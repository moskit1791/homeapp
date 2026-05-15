import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { z } from 'zod';
import { loadEnv } from '../../shared/env';
import { DatabaseService } from '../database/database.service';
import { MealPlanAiChatDto, MealPlanAiDraftEntryDto } from './dto/meal-planner.dto';

const mealPlanAiEntrySchema = z.object({
  confidence: z.number().optional(),
  linkUrl: z.string(),
  mealName: z.string(),
  note: z.string(),
  slotIndex: z.number(),
  sourceHint: z.string(),
  weekday: z.number()
});

const mealPlanAiResponseSchema = z.object({
  assistantMessage: z.string(),
  entries: z.array(mealPlanAiEntrySchema),
  questions: z.array(z.string()),
  status: z.enum(['ready', 'needs_clarification']),
  targetWeekStartDate: z.string()
});

type MealPlanAiResponse = z.infer<typeof mealPlanAiResponseSchema>;

const mealPlanAiResponseJsonSchema = {
  properties: {
    assistantMessage: {
      description:
        'Short Polish message. Summarize the draft and ask whether to save it when status is ready.',
      type: 'string'
    },
    entries: {
      description:
        'Full current draft after applying the whole conversation. Empty only when no meal plan can be inferred.',
      items: {
        properties: {
          confidence: {
            description: '0..1 confidence for the meal and link mapping.',
            type: 'number'
          },
          linkUrl: {
            description:
              'Real recipe URL only when confident. Empty string when no exact public recipe URL is known.',
            type: 'string'
          },
          mealName: {
            description: 'Clean Polish meal name without source prefix.',
            type: 'string'
          },
          note: {
            description:
              'Short Polish note, for example source hint, work/trip context or uncertainty. Empty string if not needed.',
            type: 'string'
          },
          slotIndex: {
            description: 'Meal slot in the day, starting at 0.',
            type: 'integer'
          },
          sourceHint: {
            description:
              'Normalized source hint such as Cookidoo, Kwestia Smaku, Instagram, AniaGotuje, Knorr. Empty string if none.',
            type: 'string'
          },
          weekday: {
            description: 'ISO weekday: Monday=1, Sunday=7.',
            type: 'integer'
          }
        },
        required: ['weekday', 'slotIndex', 'mealName', 'linkUrl', 'note', 'sourceHint'],
        type: 'object'
      },
      type: 'array'
    },
    questions: {
      description: 'Polish clarification questions. Empty when status is ready.',
      items: { type: 'string' },
      type: 'array'
    },
    status: {
      description:
        'ready when a usable draft exists, needs_clarification only when the pasted text cannot be turned into a meal plan.',
      enum: ['ready', 'needs_clarification'],
      type: 'string'
    },
    targetWeekStartDate: {
      description: 'Monday date in YYYY-MM-DD format.',
      type: 'string'
    }
  },
  required: ['status', 'assistantMessage', 'targetWeekStartDate', 'entries', 'questions'],
  type: 'object'
} as const;

const dayAliases: Array<{ aliases: string[]; weekday: number }> = [
  { aliases: ['pon', 'pn', 'poniedzialek'], weekday: 1 },
  { aliases: ['wt', 'wto', 'wtorek'], weekday: 2 },
  { aliases: ['sr', 'sroda'], weekday: 3 },
  { aliases: ['czw', 'czwartek'], weekday: 4 },
  { aliases: ['pt', 'piatek'], weekday: 5 },
  { aliases: ['sob', 'sobota'], weekday: 6 },
  { aliases: ['ndz', 'nd', 'niedz', 'niedziela'], weekday: 7 }
];

const sourceAliases: Array<{ aliases: string[]; label: string }> = [
  { aliases: ['c', 'cookidoo'], label: 'Cookidoo' },
  { aliases: ['ks', 'kwestia smaku', 'kwestiasmaku'], label: 'Kwestia Smaku' },
  { aliases: ['ag', 'ania gotuje', 'aniagotuje'], label: 'AniaGotuje' },
  { aliases: ['i', 'ig', 'instagram'], label: 'Instagram' },
  { aliases: ['knorr'], label: 'Knorr' },
  { aliases: ['przepisy'], label: 'Przepisy.pl' },
  { aliases: ['moje wypieki', 'mw'], label: 'Moje Wypieki' }
];

@Injectable()
export class MealPlannerAiService {
  private readonly logger = new Logger(MealPlannerAiService.name);

  constructor(private readonly database: DatabaseService) {}

  async chat(householdId: string, dto: MealPlanAiChatDto): Promise<MealPlanAiChatResult> {
    const messages = normalizeMessages(dto.messages);

    if (!messages.some((message) => message.role === 'user')) {
      throw new BadRequestException('Meal plan AI chat needs a user message');
    }

    const [mealSlotsPerDay, knownRecipes] = await Promise.all([
      this.getMealSlotsPerDay(householdId),
      this.listKnownRecipes(householdId)
    ]);

    if (!isMondayDateOnly(dto.targetWeekStartDate)) {
      throw new BadRequestException('Meal plan AI target week is required');
    }

    const targetWeekStartDate = dto.targetWeekStartDate;
    const currentDraft = normalizeDraftEntries(dto.currentDraft ?? [], mealSlotsPerDay);
    const latestUserMessage = getLatestUserMessage(messages);
    const useGoogleSearch = shouldUseGoogleSearch(messages, currentDraft);

    try {
      const responseText = await this.callGemini(
        this.buildPrompt({
          currentDraft,
          knownRecipes,
          mealSlotsPerDay,
          messages,
          targetWeekStartDate,
          useGoogleSearch
        }),
        { useGoogleSearch }
      );
      const response = this.normalizeResponse(
        this.parseResponse(responseText),
        targetWeekStartDate,
        mealSlotsPerDay,
        currentDraft,
        latestUserMessage?.content ?? ''
      );

      if (response.entries.length > 0) {
        return response;
      }

      this.logger.warn('Gemini meal plan chat returned no entries');
    } catch (error) {
      this.logger.warn(
        `Gemini meal plan chat fallback used: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return this.buildFallbackResponse(messages, currentDraft, targetWeekStartDate, mealSlotsPerDay);
  }

  private async callGemini(
    prompt: string,
    options: { useGoogleSearch?: boolean } = {}
  ): Promise<string> {
    const env = loadEnv();

    if (!env.GEMINI_API_KEY) {
      throw new ServiceUnavailableException('Meal plan AI is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.GEMINI_TIMEOUT_MS);
    const model = env.GEMINI_MODEL.startsWith('models/')
      ? env.GEMINI_MODEL.slice('models/'.length)
      : env.GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    const requestBody: GeminiGenerateContentRequest = {
      contents: [
        {
          parts: [{ text: prompt }],
          role: 'user'
        }
      ],
      generationConfig: options.useGoogleSearch
        ? {
            temperature: 0.15
          }
        : {
            responseMimeType: 'application/json',
            responseSchema: mealPlanAiResponseJsonSchema,
            temperature: 0.15
          }
    };

    if (options.useGoogleSearch) {
      requestBody.tools = [{ google_search: {} }];
    }

    try {
      const response = await fetch(url, {
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        signal: controller.signal
      });

      if (!response.ok) {
        const details = await response.text();

        this.logger.warn(
          `Gemini meal plan chat failed with ${response.status}: ${details.slice(0, 500)}`
        );
        throw new ServiceUnavailableException('Meal plan AI request failed');
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();

      if (!text) {
        this.logger.warn('Gemini meal plan chat returned no text content');
        throw new ServiceUnavailableException('Meal plan AI returned invalid response');
      }

      return text;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new ServiceUnavailableException('Meal plan AI request timed out');
      }

      this.logger.error(
        'Gemini meal plan chat request failed',
        error instanceof Error ? error.stack : undefined
      );
      throw new ServiceUnavailableException('Meal plan AI request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildPrompt(input: {
    currentDraft: MealPlanAiDraftEntry[];
    knownRecipes: KnownMealRecipe[];
    mealSlotsPerDay: number;
    messages: MealPlanAiMessage[];
    targetWeekStartDate: string;
    useGoogleSearch: boolean;
  }): string {
    const searchRules = input.useGoogleSearch
      ? [
          '- W tym wywolaniu masz wlaczone Google Search. Gdy uzytkownik prosi o linki albo podaje zrodlo przepisu, uzyj wyszukiwania i wpisz znaleziony publiczny URL w linkUrl.',
          '- Nie odpowiadaj, ze nie masz dostepu do internetu. Jesli wyszukiwanie nie daje pewnego wyniku, zostaw linkUrl pusty i napisz krotko, ktore pozycje wymagaja recznego sprawdzenia.'
        ]
      : [
          '- W tym wywolaniu nie uzywasz wyszukiwania. Jesli nie masz pewnego adresu ze znanych przepisow albo wiedzy modelu, zostaw linkUrl pusty.'
        ];

    return [
      'Jestes backendowym asystentem planu posilkow w polskiej aplikacji domowej.',
      'To jest rozmowa robocza: niczego nie zapisujesz w bazie. Zwracasz tylko aktualny szkic planu i odpowiedz dla uzytkownika.',
      '',
      'Zadanie:',
      '- Uzytkownik wkleja tekst z planem jedzenia albo dopisuje poprawki do obecnego szkicu.',
      '- Zachowuj sie jak chat: odpowiadaj na ostatnia prosbe w kontekscie rozmowy i obecnego szkicu.',
      '- Zamien rozmowe na pelny aktualny szkic wpisow posilkow tylko wtedy, gdy uzytkownik faktycznie podaje plan albo prosi o korekte planu.',
      '- Nigdy nie sugeruj, ze plan zostal zapisany. Mozesz tylko zapytac, czy zapisac szkic na wskazany tydzien.',
      '',
      'Zasady planu:',
      '- Weekday: poniedzialek=1, wtorek=2, sroda=3, czwartek=4, piatek=5, sobota=6, niedziela=7.',
      `- W domu skonfigurowano ${input.mealSlotsPerDay} posilkow dziennie. slotIndex zaczyna sie od 0 i musi byc mniejszy od tej liczby.`,
      '- Jesli w jednym dniu jest kilka pozycji oddzielonych przecinkami lub srednikami, wpisz je kolejno w slotIndex 0, 1, 2...',
      '- Nie zapisuj pozycji typu "obiad w pracy", "jedzenie na wycieczke" jako przepisu, jesli to tylko kontekst. Mozesz jednak zachowac to jako osobny posilek, gdy wyglada jak realny wpis w planie.',
      '- Zachowaj wpisy bez przepisu, np. kanapki, angielskie, kielbasa, omlet, jesli uzytkownik je podal.',
      '',
      'Zasady linkow:',
      '- LinkUrl wypelnij tylko wtedy, gdy znasz realny, publiczny URL przepisu albo masz go w sekcji znanych przepisow z domu.',
      '- Nie wymyslaj slugow ani adresow. Gdy nie masz pewnosci, linkUrl musi byc pustym stringiem.',
      '- Najpierw uzywaj znanych przepisow z domu, jezeli nazwa pasuje.',
      '- Oznaczenia zrodla sa podpowiedziami wyszukiwania: C=szukaj na Cookidoo, KS=szukaj na Kwestia Smaku, I/IG=szukaj na Instagramie, AG=szukaj na AniaGotuje, Knorr=szukaj na Knorr, MW=szukaj na Moje Wypieki.',
      '- Gdy uzytkownik wkleja plan z prefiksami zrodla, np. "C kokosowa jaglanka", "KS kasza + schab", "AG nalesniki", od razu potraktuj prefiks jako prosbe o znalezienie adresu URL. Nie czekaj na osobna wiadomosc "daj linki".',
      '- Dla pozycji z prefiksem zrodla wyszukaj konkretny przepis w odpowiednim serwisie i wpisz URL do pola linkUrl tego posilku. Przyklady: C -> Cookidoo, KS -> Kwestia Smaku, AG -> AniaGotuje, I/IG -> Instagram, Knorr -> Knorr, MW -> Moje Wypieki.',
      '- Pozycje bez prefiksu zrodla, np. "kanapki", "pizza", "parowki", nie powinny dostawac przypadkowych linkow. Uzupelnij je tylko, jesli pasuja do znanych przepisow z domu albo masz bardzo pewny publiczny URL.',
      '- Prefix zrodla usun z mealName i wpisz znormalizowana nazwe do sourceHint.',
      '- Gdy uzytkownik pisze "to samo co w sobote" albo podobnie, skopiuj odpowiednie posilki z tego dnia razem z linkUrl/sourceHint, jesli te dane sa juz dostepne w szkicu.',
      '- Gdy uzytkownik pisze "daj linki", "uzupelnij linki", "znajdz przepisy" albo podobnie, nie tworz nowej listy jedzenia. Zachowaj currentDraft, uzupelnij tylko pewne linkUrl/sourceHint/note i powiedz, ktorych linkow nie udalo sie pewnie znalezc.',
      ...searchRules,
      '',
      'Zasady korekt:',
      '- Jesli currentDraft nie jest pusty, traktuj go jako aktualny stan rozmowy.',
      '- Jesli uzytkownik poprawia szkic ("popraw", "zamien", "usun", "dodaj", "zmien"), zastosuj poprawke do currentDraft i zwroc caly zaktualizowany szkic, nie tylko zmiany.',
      '- Jesli uzytkownik zadaje pytanie albo prosi o wyjasnienie bez zmiany planu, zwroc currentDraft bez zmian i odpowiedz na pytanie.',
      '- Jesli uzytkownik podaje krotka wiadomosc bez dni tygodnia, nie interpretuj jej jako nowego planu.',
      '- Jesli nie da sie zrozumiec intencji, status needs_clarification i zadaj krotkie pytanie.',
      '- Odpowiadasz wylacznie JSON-em zgodnym ze schematem.',
      '',
      `Docelowy poniedzialek tygodnia: ${input.targetWeekStartDate}`,
      '',
      'Obecny szkic:',
      JSON.stringify(input.currentDraft),
      '',
      'Znane przepisy z domu (uzywaj linkow stad, gdy pasuja):',
      input.knownRecipes.length > 0
        ? JSON.stringify(input.knownRecipes)
        : '[]',
      '',
      'Rozmowa:',
      JSON.stringify(input.messages)
    ].join('\n');
  }

  private parseResponse(responseText: string): MealPlanAiResponse {
    try {
      return mealPlanAiResponseSchema.parse(parseJsonResponse(responseText));
    } catch (error) {
      this.logger.warn(
        `Invalid Gemini meal plan chat JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new ServiceUnavailableException('Meal plan AI returned invalid response');
    }
  }

  private normalizeResponse(
    response: MealPlanAiResponse,
    fallbackTargetWeekStartDate: string,
    mealSlotsPerDay: number,
    currentDraft: MealPlanAiDraftEntry[],
    latestUserMessage: string
  ): MealPlanAiChatResult {
    const responseEntries = normalizeDraftEntries(response.entries, mealSlotsPerDay);
    const entries =
      currentDraft.length > 0 && isLinkRequest(latestUserMessage)
        ? mergeDraftEntries(currentDraft, responseEntries, mealSlotsPerDay)
        : responseEntries.length > 0
          ? responseEntries
          : currentDraft;
    const targetWeekStartDate = isMondayDateOnly(response.targetWeekStartDate)
      ? response.targetWeekStartDate
      : fallbackTargetWeekStartDate;
    const assistantMessage = response.assistantMessage.trim() || buildDefaultAssistantMessage(
      entries,
      targetWeekStartDate
    );

    return {
      assistantMessage,
      entries,
      questions: response.questions.map((question) => trimToLength(question, 300)).filter(Boolean),
      status: entries.length > 0 ? response.status : 'needs_clarification',
      targetWeekStartDate
    };
  }

  private buildFallbackResponse(
    messages: MealPlanAiMessage[],
    currentDraft: MealPlanAiDraftEntry[],
    targetWeekStartDate: string,
    mealSlotsPerDay: number
  ): MealPlanAiChatResult {
    const lastUserMessage = getLatestUserMessage(messages);
    const parsedEntries = lastUserMessage
      ? parseMealPlanText(lastUserMessage.content, mealSlotsPerDay)
      : [];
    const linkRequest = Boolean(lastUserMessage && isLinkRequest(lastUserMessage.content));
    const entries = linkRequest && currentDraft.length > 0
      ? currentDraft
      : parsedEntries.length > 0
        ? parsedEntries
        : currentDraft;

    if (entries.length === 0) {
      return {
        assistantMessage:
          'Nie widze jeszcze planu posilkow. Wklej dni tygodnia i posilki, a przygotuje szkic.',
        entries: [],
        questions: ['Wkleisz plan z dniami tygodnia?'],
        status: 'needs_clarification',
        targetWeekStartDate
      };
    }

    const assistantMessage = linkRequest
      ? `Mam obecny szkic na tydzien ${targetWeekStartDate}, ale bez AI nie znalazlem pewnych nowych linkow. ` +
        'Zostawiam niepewne adresy puste. Czy mam zapisac taki szkic?'
      : `Rozpisalem szkic planu na tydzien ${targetWeekStartDate}. ` +
        'Nie uzupelnilem linkow tam, gdzie nie mialem pewnego adresu. Czy zapisac taki plan?';

    return {
      assistantMessage,
      entries,
      questions: [],
      status: 'ready',
      targetWeekStartDate
    };
  }

  private async getMealSlotsPerDay(householdId: string): Promise<number> {
    const result = await this.database.query<{ meal_slots_per_day: number }>(
      `
        select meal_slots_per_day
        from households
        where id = $1
        limit 1
      `,
      [householdId]
    );
    const row = result.rows[0];

    if (!row) {
      throw new BadRequestException('Household not found');
    }

    return Math.max(1, Math.min(8, Number(row.meal_slots_per_day) || 1));
  }

  private async listKnownRecipes(householdId: string): Promise<KnownMealRecipe[]> {
    const result = await this.database.query<KnownMealRecipeRow>(
      `
        select distinct on (lower(title))
          title,
          link_url,
          note,
          source,
          updated_at
        from (
          select
            mi.title,
            mi.link_url,
            mi.note,
            'pomysly' as source,
            mi.updated_at
          from meal_ideas mi
          where mi.household_id = $1
            and mi.link_url is not null
            and btrim(mi.link_url) <> ''
          union all
          select
            mpe.meal_name as title,
            mpe.link_url,
            mpe.note,
            'plan' as source,
            mpe.updated_at
          from meal_plan_entries mpe
          join meal_plan_weeks mpw on mpw.id = mpe.meal_plan_week_id
          where mpw.household_id = $1
            and mpe.link_url is not null
            and btrim(mpe.link_url) <> ''
        ) recipes
        order by lower(title), updated_at desc
        limit 80
      `,
      [householdId]
    );

    return result.rows.map((row) => ({
      linkUrl: row.link_url,
      note: row.note ?? '',
      source: row.source,
      title: row.title
    }));
  }
}

function normalizeMessages(messages: MealPlanAiChatDto['messages']): MealPlanAiMessage[] {
  return messages
    .map((message) => ({
      content: trimToLength(message.content, 4000),
      role: message.role
    }))
    .filter((message) => message.content.length > 0);
}

function getLatestUserMessage(messages: MealPlanAiMessage[]): MealPlanAiMessage | undefined {
  return [...messages].reverse().find((message) => message.role === 'user');
}

function shouldUseGoogleSearch(
  messages: MealPlanAiMessage[],
  currentDraft: MealPlanAiDraftEntry[]
): boolean {
  const userMessages = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content);

  return userMessages.some((message) => isLinkRequest(message) || hasSourceHintRequest(message)) ||
    currentDraft.some((entry) => Boolean(entry.sourceHint && !entry.linkUrl));
}

function hasSourceHintRequest(value: string): boolean {
  const normalized = normalizeText(value);
  const tokens = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));

  return sourceAliases.some((source) =>
    source.aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);

      if (normalizedAlias === 'i') {
        return false;
      }

      return normalizedAlias.length <= 2
        ? tokens.has(normalizedAlias)
        : normalized.includes(normalizedAlias);
    })
  );
}

function parseJsonResponse(value: string): unknown {
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error('No JSON object found in Gemini response');
  }
}

function normalizeDraftEntries(
  entries: Array<MealPlanAiDraftEntryDto | MealPlanAiResponse['entries'][number]>,
  mealSlotsPerDay: number
): MealPlanAiDraftEntry[] {
  const bySlot = new Map<string, MealPlanAiDraftEntry>();

  for (const entry of entries) {
    const weekday = Number(entry.weekday);
    const slotIndex = Number(entry.slotIndex);
    const mealName = trimToLength(entry.mealName, 180);

    if (
      !Number.isInteger(weekday) ||
      weekday < 1 ||
      weekday > 7 ||
      !Number.isInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= mealSlotsPerDay ||
      !mealName
    ) {
      continue;
    }

    const sourceHint = trimToLength(entry.sourceHint ?? '', 80);
    const note = trimToLength(entry.note ?? '', 1000);
    const normalized: MealPlanAiDraftEntry = {
      linkUrl: normalizeUrl(entry.linkUrl ?? ''),
      mealName,
      note: note || null,
      slotIndex,
      sourceHint: sourceHint || null,
      weekday
    };

    bySlot.set(`${weekday}:${slotIndex}`, normalized);
  }

  return [...bySlot.values()].sort(
    (left, right) => left.weekday - right.weekday || left.slotIndex - right.slotIndex
  );
}

function mergeDraftEntries(
  currentDraft: MealPlanAiDraftEntry[],
  updates: MealPlanAiDraftEntry[],
  mealSlotsPerDay: number
): MealPlanAiDraftEntry[] {
  const merged = new Map<string, MealPlanAiDraftEntry>();

  for (const entry of normalizeDraftEntries(currentDraft, mealSlotsPerDay)) {
    merged.set(`${entry.weekday}:${entry.slotIndex}`, entry);
  }

  for (const update of normalizeDraftEntries(updates, mealSlotsPerDay)) {
    const key = `${update.weekday}:${update.slotIndex}`;
    const previous = merged.get(key);

    merged.set(key, {
      linkUrl: update.linkUrl ?? previous?.linkUrl ?? null,
      mealName: update.mealName || previous?.mealName || '',
      note: update.note ?? previous?.note ?? null,
      slotIndex: update.slotIndex,
      sourceHint: update.sourceHint ?? previous?.sourceHint ?? null,
      weekday: update.weekday
    });
  }

  return [...merged.values()]
    .filter((entry) => entry.mealName)
    .sort((left, right) => left.weekday - right.weekday || left.slotIndex - right.slotIndex);
}

function isLinkRequest(value: string): boolean {
  const normalized = normalizeText(value);

  return /\b(link|linki|url|adres|adresy|przepis|przepisy|znajdz|znajdzcie|wyszukaj)\b/.test(
    normalized
  );
}

function parseMealPlanText(input: string, mealSlotsPerDay: number): MealPlanAiDraftEntry[] {
  const entries: MealPlanAiDraftEntry[] = [];
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parsedDay = parseDayLine(line);

    if (!parsedDay) {
      continue;
    }

    const meals = splitMeals(parsedDay.rest);

    meals.slice(0, mealSlotsPerDay).forEach((rawMeal, index) => {
      const parsedMeal = parseSourceHint(rawMeal);
      const mealName = trimToLength(parsedMeal.mealName, 180);

      if (!mealName) {
        return;
      }

      entries.push({
        linkUrl: null,
        mealName,
        note: parsedMeal.sourceHint ? `Zrodlo: ${parsedMeal.sourceHint}` : null,
        slotIndex: index,
        sourceHint: parsedMeal.sourceHint,
        weekday: parsedDay.weekday
      });
    });
  }

  return normalizeDraftEntries(entries, mealSlotsPerDay);
}

function parseDayLine(line: string): { rest: string; weekday: number } | null {
  const match = line.match(/^([^:.-]{1,24})\s*[:.-]\s*(.+)$/);

  if (!match) {
    return null;
  }

  const normalizedLabel = normalizeText(match[1] ?? '');
  const day = dayAliases.find((candidate) => candidate.aliases.includes(normalizedLabel));

  if (!day) {
    return null;
  }

  return {
    rest: match[2]?.trim() ?? '',
    weekday: day.weekday
  };
}

function splitMeals(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseSourceHint(value: string): { mealName: string; sourceHint: string | null } {
  const normalizedValue = value.trim();
  const prefixMatch = normalizedValue.match(/^([A-Za-z ]{1,24})\s+(.+)$/);

  if (!prefixMatch) {
    return {
      mealName: normalizedValue,
      sourceHint: null
    };
  }

  const sourceHint = resolveSourceHint(prefixMatch[1] ?? '');

  if (!sourceHint) {
    return {
      mealName: normalizedValue,
      sourceHint: null
    };
  }

  return {
    mealName: prefixMatch[2]?.trim() ?? normalizedValue,
    sourceHint
  };
}

function resolveSourceHint(value: string): string | null {
  const normalized = normalizeText(value);
  const source = sourceAliases.find((candidate) => candidate.aliases.includes(normalized));

  return source?.label ?? null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\u0142/g, 'l')
    .replace(/\u0141/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    return trimToLength(url.toString(), 500);
  } catch {
    return null;
  }
}

function isMondayDateOnly(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value &&
    parsed.getUTCDay() === 1;
}

function buildDefaultAssistantMessage(
  entries: MealPlanAiDraftEntry[],
  targetWeekStartDate: string
): string {
  if (entries.length === 0) {
    return 'Nie widze jeszcze planu posilkow. Doprecyzujesz dni i posilki?';
  }

  return `Mam szkic ${entries.length} posilkow na tydzien ${targetWeekStartDate}. Czy zapisac taki plan?`;
}

function trimToLength(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

export interface MealPlanAiMessage {
  content: string;
  role: 'user' | 'assistant';
}

export interface MealPlanAiDraftEntry {
  linkUrl: string | null;
  mealName: string;
  note: string | null;
  slotIndex: number;
  sourceHint: string | null;
  weekday: number;
}

export interface MealPlanAiChatResult {
  assistantMessage: string;
  entries: MealPlanAiDraftEntry[];
  questions: string[];
  status: 'ready' | 'needs_clarification';
  targetWeekStartDate: string;
}

interface KnownMealRecipe {
  linkUrl: string;
  note: string;
  source: string;
  title: string;
}

interface KnownMealRecipeRow {
  link_url: string;
  note: string | null;
  source: string;
  title: string;
  updated_at: string;
}

interface GeminiGenerateContentRequest {
  contents: Array<{
    parts: Array<{ text: string }>;
    role: 'user';
  }>;
  generationConfig: {
    responseMimeType?: 'application/json';
    responseSchema?: typeof mealPlanAiResponseJsonSchema;
    temperature: number;
  };
  tools?: Array<{
    google_search: Record<string, never>;
  }>;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}
