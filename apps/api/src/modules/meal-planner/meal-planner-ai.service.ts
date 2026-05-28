import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { z } from 'zod';
import { loadEnv } from '../../shared/env';
import { DatabaseService } from '../database/database.service';
import {
  MealPlanAiChatDto,
  MealPlanAiDraftEntryDto,
  MealPlanAiSuggestDto
} from './dto/meal-planner.dto';

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
  status: z.enum(['ready', 'needs_clarification', 'limit_exhausted']),
  targetWeekStartDate: z.string()
});

type MealPlanAiResponse = z.infer<typeof mealPlanAiResponseSchema>;

const mealPlanLinkSearchResponseSchema = z.object({
  updates: z.array(
    z.object({
      confidence: z.number().optional(),
      linkUrl: z.string(),
      note: z.string().optional(),
      slotIndex: z.number(),
      sourceHint: z.string().optional(),
      weekday: z.number()
    })
  )
});

const mealPlanAiSuggestionResponseSchema = z.object({
  assistantMessage: z.string(),
  entries: z.array(mealPlanAiEntrySchema),
  insights: z.array(z.string()),
  status: z.enum(['ready', 'needs_more_history'])
});

type MealPlanAiSuggestionResponse = z.infer<typeof mealPlanAiSuggestionResponseSchema>;

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
      enum: ['ready', 'needs_clarification', 'limit_exhausted'],
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

    try {
      const assistantMessage = await this.callGeminiContents(
        this.buildChatContents({
          knownRecipes,
          mealSlotsPerDay,
          messages,
          targetWeekStartDate
        }),
        { useGoogleSearch: true }
      );

      return {
        assistantMessage,
        entries: [],
        limitExhausted: false,
        questions: [],
        status: 'ready',
        targetWeekStartDate
      };
    } catch (error) {
      if (isGeminiRateLimitError(error)) {
        return this.buildLimitFallbackResponse(messages, currentDraft, targetWeekStartDate, mealSlotsPerDay);
      }

      this.logger.warn(
        `Gemini meal plan chat failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  async finalize(householdId: string, dto: MealPlanAiChatDto): Promise<MealPlanAiChatResult> {
    const messages = normalizeMessages(dto.messages);

    if (!messages.some((message) => message.role === 'user')) {
      throw new BadRequestException('Meal plan AI finalize needs a user message');
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

    try {
      const responseText = await this.callGemini(
        this.buildFinalizePrompt({
          currentDraft,
          knownRecipes,
          mealSlotsPerDay,
          messages,
          targetWeekStartDate
        }),
        { useGoogleSearch: true }
      );
      const response = await this.enrichMealLinks(
        this.normalizeResponse(
          this.parseResponse(responseText),
          targetWeekStartDate,
          mealSlotsPerDay,
          currentDraft,
          latestUserMessage?.content ?? ''
        ),
        {
          currentDraft,
          knownRecipes,
          mealSlotsPerDay,
          messages,
          shouldPrioritizeLinks: true,
          targetWeekStartDate
        }
      );

      return {
        ...response,
        limitExhausted: false
      };
    } catch (error) {
      if (isGeminiRateLimitError(error)) {
        return this.buildLimitFallbackResponse(messages, currentDraft, targetWeekStartDate, mealSlotsPerDay);
      }

      this.logger.warn(
        `Gemini meal plan finalize fallback used: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return {
      ...(await this.enrichMealLinks(
        this.buildFallbackResponse(messages, currentDraft, targetWeekStartDate, mealSlotsPerDay),
        {
          currentDraft,
          knownRecipes,
          mealSlotsPerDay,
          messages,
          shouldPrioritizeLinks: true,
          targetWeekStartDate
        }
      )),
      limitExhausted: false
    };
  }

  async suggestFromHistory(
    householdId: string,
    dto: MealPlanAiSuggestDto
  ): Promise<MealPlanAiSuggestionResult> {
    if (!isMondayDateOnly(dto.targetWeekStartDate)) {
      throw new BadRequestException('Meal plan AI target week is required');
    }

    const targetWeekStartDate = dto.targetWeekStartDate;
    const [mealSlotsPerDay, knownRecipes, history] = await Promise.all([
      this.getMealSlotsPerDay(householdId),
      this.listKnownRecipes(householdId),
      this.listMealHistoryForSuggestions(householdId)
    ]);

    try {
      const responseText = await this.callGemini(
        this.buildHistorySuggestionPrompt({
          history,
          knownRecipes,
          mealSlotsPerDay,
          targetWeekStartDate
        }),
        { useGoogleSearch: true }
      );
      const response = this.normalizeSuggestionResponse(
        this.parseSuggestionResponse(responseText),
        {
          history,
          knownRecipes,
          mealSlotsPerDay,
          targetWeekStartDate
        }
      );

      return {
        ...response,
        limitExhausted: false
      };
    } catch (error) {
      if (!isGeminiRateLimitError(error)) {
        this.logger.warn(
          `Gemini meal history suggestions fallback used: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      return this.buildHistorySuggestionFallback({
        history,
        limitExhausted: isGeminiRateLimitError(error),
        mealSlotsPerDay,
        targetWeekStartDate
      });
    }
  }

  private async buildLimitFallbackResponse(
    messages: MealPlanAiMessage[],
    currentDraft: MealPlanAiDraftEntry[],
    targetWeekStartDate: string,
    mealSlotsPerDay: number
  ): Promise<MealPlanAiChatResult> {
    const fallback = this.buildFallbackResponse(messages, currentDraft, targetWeekStartDate, mealSlotsPerDay);

    return {
      ...fallback,
      assistantMessage:
        'Limit AI jest teraz wyczerpany. Dostosowalem dostepne informacje lokalnym algorytmem, bez rozmowy z AI. Sprobuj ponownie pozniej, jesli chcesz dopracowac linki albo szczegoly.',
      limitExhausted: true,
      status: fallback.entries.length > 0 ? 'limit_exhausted' : 'needs_clarification'
    };
  }

  private buildChatContents(input: {
    knownRecipes: KnownMealRecipe[];
    mealSlotsPerDay: number;
    messages: MealPlanAiMessage[];
    targetWeekStartDate: string;
  }): GeminiContent[] {
    return [
      {
        parts: [
          {
            text: this.buildChatSystemPrompt(input)
          }
        ],
        role: 'user'
      },
      ...input.messages.map((message): GeminiContent => ({
        parts: [{ text: message.content }],
        role: message.role === 'assistant' ? 'model' : 'user'
      }))
    ];
  }

  private buildChatSystemPrompt(input: {
    knownRecipes: KnownMealRecipe[];
    mealSlotsPerDay: number;
    targetWeekStartDate: string;
  }): string {
    return [
      'Jestes asystentem planu posilkow w polskiej aplikacji domowej.',
      'Rozmawiasz bezposrednio z uzytkownikiem jak normalny chat. Backend nie bedzie dopowiadal nic w Twoim imieniu.',
      'Pomagaj ulozyc tygodniowy plan jedzenia, poprawiaj go w rozmowie i szukaj linkow do przepisow, gdy uzytkownik o to prosi lub podaje zrodlo.',
      'Masz wlaczone Google Search. Jesli rozmawiacie o linkach, szukaj realnych publicznych URL-i i pokazuj je uzytkownikowi w odpowiedzi.',
      'Nie twierdz, ze plan jest zapisany. Zapis nastapi dopiero, gdy uzytkownik kliknie przycisk "Zapisz plan" w aplikacji.',
      '',
      `Docelowy poniedzialek tygodnia: ${input.targetWeekStartDate}.`,
      `W domu skonfigurowano ${input.mealSlotsPerDay} posilkow dziennie.`,
      'Oznaczenia zrodla: C=Cookidoo, KS=Kwestia Smaku, I/IG=Instagram, AG=AniaGotuje, Knorr=Knorr, MW=Moje Wypieki.',
      '',
      'Znane przepisy z domu:',
      input.knownRecipes.length > 0 ? JSON.stringify(input.knownRecipes) : '[]'
    ].join('\n');
  }

  private buildFinalizePrompt(input: {
    currentDraft: MealPlanAiDraftEntry[];
    knownRecipes: KnownMealRecipe[];
    mealSlotsPerDay: number;
    messages: MealPlanAiMessage[];
    targetWeekStartDate: string;
  }): string {
    return [
      this.buildPrompt({
        ...input,
        useGoogleSearch: true
      }),
      '',
      'Tryb finalizacji:',
      '- Uzytkownik kliknal "Zapisz plan". Na podstawie calej rozmowy przygotuj ostateczny JSON do zapisu.',
      '- Wpisz pelny aktualny plan, nie tylko ostatnia zmiane.',
      '- Jesli w rozmowie sa linki, zachowaj je w linkUrl.',
      '- Jesli trzeba znalezc linki do przepisow, uzyj Google Search i uzupelnij realne URL-e.',
      '- Odpowiadasz wylacznie JSON-em zgodnym ze schematem.'
    ].join('\n');
  }

  private async callGeminiContents(
    contents: GeminiContent[],
    options: { useGoogleSearch?: boolean } = {}
  ): Promise<string> {
    return this.callGeminiRequest(
      {
        contents,
        generationConfig: {
          temperature: 0.55
        }
      },
      options
    );
  }

  private async callGemini(
    prompt: string,
    options: { useGoogleSearch?: boolean } = {}
  ): Promise<string> {
    return this.callGeminiRequest(
      {
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
      },
      options
    );
  }

  private async callGeminiRequest(
    requestBody: GeminiGenerateContentRequest,
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

        if (response.status === 429 || details.includes('RESOURCE_EXHAUSTED')) {
          throw new GeminiRateLimitError();
        }

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
      if (error instanceof GeminiRateLimitError || error instanceof ServiceUnavailableException) {
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

  private async enrichMealLinks(
    response: MealPlanAiChatResult,
    input: {
      currentDraft: MealPlanAiDraftEntry[];
      knownRecipes: KnownMealRecipe[];
      mealSlotsPerDay: number;
      messages: MealPlanAiMessage[];
      shouldPrioritizeLinks: boolean;
      targetWeekStartDate: string;
    }
  ): Promise<MealPlanAiChatResult> {
    if (response.entries.length === 0) {
      return response;
    }

    const entriesWithKnownLinks = applyKnownRecipeLinks(response.entries, input.knownRecipes);

    if (!shouldRunLinkSearch(entriesWithKnownLinks, input.messages, input.currentDraft)) {
      return {
        ...response,
        entries: entriesWithKnownLinks
      };
    }

    try {
      const updates = await this.searchMealLinksWithGemini({
        entries: entriesWithKnownLinks,
        mealSlotsPerDay: input.mealSlotsPerDay,
        messages: input.messages,
        shouldPrioritizeLinks: input.shouldPrioritizeLinks,
        targetWeekStartDate: input.targetWeekStartDate
      });
      const entries = applyLinkSearchUpdates(
        entriesWithKnownLinks,
        updates,
        input.mealSlotsPerDay
      );

      return {
        ...response,
        assistantMessage: improveLinkAssistantMessage(response.assistantMessage, entries),
        entries
      };
    } catch (error) {
      this.logger.warn(
        `Gemini meal link search failed: ${error instanceof Error ? error.message : String(error)}`
      );

      return {
        ...response,
        entries: entriesWithKnownLinks
      };
    }
  }

  private async searchMealLinksWithGemini(input: {
    entries: MealPlanAiDraftEntry[];
    mealSlotsPerDay: number;
    messages: MealPlanAiMessage[];
    shouldPrioritizeLinks: boolean;
    targetWeekStartDate: string;
  }): Promise<MealPlanAiDraftEntry[]> {
    const candidates = input.entries
      .filter((entry) => !entry.linkUrl && shouldSearchLinkForEntry(entry))
      .slice(0, 28);

    if (candidates.length === 0) {
      return [];
    }

    const responseText = await this.callGemini(
      this.buildLinkSearchPrompt({
        candidates,
        messages: input.messages,
        shouldPrioritizeLinks: input.shouldPrioritizeLinks,
        targetWeekStartDate: input.targetWeekStartDate
      }),
      { useGoogleSearch: true }
    );
    const response = mealPlanLinkSearchResponseSchema.parse(parseJsonResponse(responseText));
    const updates = response.updates.map((update) => ({
      linkUrl: update.linkUrl,
      mealName:
        candidates.find(
          (entry) => entry.weekday === update.weekday && entry.slotIndex === update.slotIndex
        )?.mealName ?? '',
      note: update.note ?? '',
      slotIndex: update.slotIndex,
      sourceHint: update.sourceHint ?? '',
      weekday: update.weekday
    }));

    return normalizeDraftEntries(updates, input.mealSlotsPerDay);
  }

  private buildLinkSearchPrompt(input: {
    candidates: MealPlanAiDraftEntry[];
    messages: MealPlanAiMessage[];
    shouldPrioritizeLinks: boolean;
    targetWeekStartDate: string;
  }): string {
    return [
      'Jestes resolverem linkow do przepisow w polskiej aplikacji domowej.',
      'Masz wlaczone Google Search. Twoim jedynym zadaniem jest znalezienie realnych URL-i do juz rozpisanych posilkow.',
      '',
      'Zasady:',
      '- Nie zmieniaj dni, slotow ani nazw posilkow. Dopasowujesz tylko linkUrl/sourceHint/note.',
      '- Dla kazdej pozycji wykonaj konkretne wyszukiwanie. Link jest priorytetem tej funkcji.',
      '- Jesli sourceHint istnieje, szukaj przede wszystkim w tym serwisie: Cookidoo, Kwestia Smaku, AniaGotuje, Instagram, Knorr, Przepisy.pl albo Moje Wypieki.',
      '- Jesli sourceHint nie istnieje, wybierz najlepiej pasujacy publiczny przepis, gdy nazwa wyglada jak konkretne danie.',
      '- linkUrl musi prowadzic bezposrednio do przepisu albo posta z przepisem, nie do strony glownej, kategorii ani wynikow wyszukiwania.',
      '- Nie wymyslaj adresow. Pusty linkUrl zostaw tylko dla ogolnych rzeczy typu kanapki, jajecznica, parowki, gotowy produkt albo gdy Google Search nie pokazuje pewnego wyniku.',
      '- Jesli znajdziesz pasujacy wynik z wyszukiwania, wpisz URL. Nie pomijaj linku z nadmiernej ostroznosci.',
      '- Odpowiadasz wylacznie JSON-em: {"updates":[{"weekday":1,"slotIndex":0,"linkUrl":"https://...","sourceHint":"Kwestia Smaku","note":"..."}]}',
      '',
      `Docelowy poniedzialek tygodnia: ${input.targetWeekStartDate}`,
      `Tryb nacisku na linki: ${input.shouldPrioritizeLinks ? 'wysoki' : 'standardowy'}`,
      '',
      'Pozycje do uzupelnienia:',
      JSON.stringify(input.candidates),
      '',
      'Kontekst rozmowy:',
      JSON.stringify(input.messages.slice(-6))
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
      limitExhausted: false,
      entries,
      questions: response.questions.map((question) => trimToLength(question, 300)).filter(Boolean),
      status: entries.length > 0
        ? response.status === 'limit_exhausted'
          ? 'ready'
          : response.status
        : 'needs_clarification',
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
        limitExhausted: false,
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
      limitExhausted: false,
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

  private async listMealHistoryForSuggestions(householdId: string): Promise<MealHistoryEntry[]> {
    const result = await this.database.query<MealHistoryRow>(
      `
        select
          mpe.meal_name,
          mpe.link_url,
          mpe.note,
          mpe.weekday,
          mpe.slot_index,
          mpw.week_start_date,
          (mpw.week_start_date + ((mpe.weekday - 1) * interval '1 day'))::date as served_on,
          (
            (mpw.week_start_date + ((mpe.weekday - 1) * interval '1 day'))::date
              >= (current_date - interval '30 days')::date
          ) as is_recent
        from meal_plan_entries mpe
        join meal_plan_weeks mpw on mpw.id = mpe.meal_plan_week_id
        where mpw.household_id = $1
          and btrim(mpe.meal_name) <> ''
          and (mpw.week_start_date + ((mpe.weekday - 1) * interval '1 day'))::date <= current_date
        order by served_on desc, mpe.weekday asc, mpe.slot_index asc
        limit 500
      `,
      [householdId]
    );

    return result.rows.map((row) => ({
      isRecent: Boolean(row.is_recent),
      linkUrl: row.link_url,
      mealName: row.meal_name,
      note: row.note,
      servedOn: formatDateOnlyValue(row.served_on),
      slotIndex: row.slot_index,
      weekStartDate: formatDateOnlyValue(row.week_start_date),
      weekday: row.weekday
    }));
  }

  private parseSuggestionResponse(responseText: string): MealPlanAiSuggestionResponse {
    try {
      return mealPlanAiSuggestionResponseSchema.parse(parseJsonResponse(responseText));
    } catch (error) {
      this.logger.warn(
        `Invalid Gemini meal suggestion JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new ServiceUnavailableException('Meal plan AI returned invalid suggestions');
    }
  }

  private normalizeSuggestionResponse(
    response: MealPlanAiSuggestionResponse,
    input: {
      history: MealHistoryEntry[];
      knownRecipes: KnownMealRecipe[];
      mealSlotsPerDay: number;
      targetWeekStartDate: string;
    }
  ): Omit<MealPlanAiSuggestionResult, 'limitExhausted'> {
    const entries = applyKnownRecipeLinks(
      filterRecentlyEatenEntries(
        normalizeDraftEntries(response.entries, input.mealSlotsPerDay),
        input.history
      ),
      input.knownRecipes
    );
    const recentMealNames = getUniqueRecentMealNames(input.history);
    const assistantMessage = trimToLength(response.assistantMessage, 700) ||
      buildDefaultHistorySuggestionMessage(entries);

    return {
      assistantMessage,
      entries,
      excludedRecentDays: 30,
      insights: normalizeInsights(response.insights, input.history, entries.length),
      recentMealNames,
      status: entries.length > 0
        ? 'ready'
        : response.status === 'needs_more_history'
          ? 'needs_more_history'
          : 'ready',
      targetWeekStartDate: input.targetWeekStartDate
    };
  }

  private buildHistorySuggestionFallback(input: {
    history: MealHistoryEntry[];
    limitExhausted: boolean;
    mealSlotsPerDay: number;
    targetWeekStartDate: string;
  }): MealPlanAiSuggestionResult {
    const entries = buildLocalHistorySuggestions(input.history, input.mealSlotsPerDay);
    const recentMealNames = getUniqueRecentMealNames(input.history);

    return {
      assistantMessage: entries.length > 0
        ? input.limitExhausted
          ? 'Limit AI jest teraz wyczerpany. Przygotowalem lokalne propozycje z historii domu, z pominieciem ostatnich 30 dni.'
          : 'AI nie odpowiedzialo poprawnie. Przygotowalem lokalne propozycje z historii domu, z pominieciem ostatnich 30 dni.'
        : 'Nie mam jeszcze dosc starszej historii posilkow, zeby bezpiecznie zaproponowac plan po odjeciu ostatnich 30 dni.',
      entries,
      excludedRecentDays: 30,
      insights: normalizeInsights([], input.history, entries.length),
      limitExhausted: input.limitExhausted,
      recentMealNames,
      status: entries.length > 0
        ? input.limitExhausted
          ? 'limit_exhausted'
          : 'ready'
        : 'needs_more_history',
      targetWeekStartDate: input.targetWeekStartDate
    };
  }

  private buildHistorySuggestionPrompt(input: {
    history: MealHistoryEntry[];
    knownRecipes: KnownMealRecipe[];
    mealSlotsPerDay: number;
    targetWeekStartDate: string;
  }): string {
    const payload = buildHistoryPromptPayload(input.history);

    return [
      'Jestes asystentem AI planu posilkow dla polskiego domu.',
      'Masz przeanalizowac historie jedzenia domownikow, znalezc rytm i upodobania, a potem zaproponowac plan posilkow.',
      'Masz wlaczone Google Search. Uzyj internetu do dobrania nowych alternatyw, ktore pasuja do wzorcow z historii.',
      '',
      'Cel:',
      `- Przygotuj propozycje na tydzien zaczynajacy sie ${input.targetWeekStartDate}.`,
      `- W domu sa ${input.mealSlotsPerDay} sloty posilkow dziennie, slotIndex od 0 do ${input.mealSlotsPerDay - 1}.`,
      '- Wypelnij mozliwie caly tydzien: weekday 1..7, slotIndex wedlug liczby slotow.',
      '- Zachowaj styl domu: czeste sniadania, obiady, powtarzalne zestawy i ulubione zrodla przepisow.',
      '',
      'Twarde zasady wykluczenia:',
      '- Nie proponuj zadnego posilku, ktory byl jedzony w ostatnich 30 dniach.',
      '- Nie proponuj tez bliskich wariantow tej samej nazwy, np. jesli niedawno bylo spaghetti, nie dawaj spaghetti bolognese.',
      '- Lista ostatnich 30 dni ponizej jest zakazana nawet wtedy, gdy jest bardzo popularna w historii.',
      '',
      'Zasady internetu:',
      '- Oprocz propozycji z historii dodaj alternatywy z internetu, ale tylko takie, ktore pasuja do upodoban domu.',
      '- Szukaj realnych publicznych przepisow. Preferuj polskie zrodla, np. Kwestia Smaku, AniaGotuje, Przepisy.pl, Cookidoo, Knorr, Moje Wypieki albo sensowne publiczne przepisy.',
      '- linkUrl wypelnij tylko realnym URL-em do konkretnego przepisu lub posta. Nie wymyslaj adresow.',
      '- W sourceHint wpisz zrodlo lub "Historia domu".',
      '- W note napisz jedno krotkie uzasadnienie: jaki wzorzec z historii lub jaka alternatywa z internetu.',
      '',
      'Odpowiedz wylacznie JSON-em:',
      '{"status":"ready","assistantMessage":"...","insights":["..."],"entries":[{"weekday":1,"slotIndex":0,"mealName":"...","linkUrl":"https://...","note":"...","sourceHint":"..."}]}',
      'status ustaw na "needs_more_history" tylko gdy historia jest zbyt mala i nie da sie sensownie zaproponowac planu.',
      '',
      'Ostatnie 30 dni - zakazane:',
      JSON.stringify(payload.recentMeals),
      '',
      'Najczestsze starsze posilki i wzorce:',
      JSON.stringify(payload.frequentMeals),
      '',
      'Starsza historia do analizy:',
      JSON.stringify(payload.olderMeals),
      '',
      'Znane przepisy z linkami z domu:',
      input.knownRecipes.length > 0 ? JSON.stringify(input.knownRecipes) : '[]'
    ].join('\n');
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

function shouldRunLinkSearch(
  entries: MealPlanAiDraftEntry[],
  messages: MealPlanAiMessage[],
  currentDraft: MealPlanAiDraftEntry[]
): boolean {
  const hasMissingCandidate = entries.some(
    (entry) => !entry.linkUrl && shouldSearchLinkForEntry(entry)
  );

  if (!hasMissingCandidate) {
    return false;
  }

  return messages.some((message) => message.role === 'user' && looksLikeMealPlanOrLinkTask(message.content)) ||
    currentDraft.some((entry) => Boolean(entry.sourceHint && !entry.linkUrl)) ||
    entries.some((entry) => Boolean(entry.sourceHint && !entry.linkUrl));
}

function looksLikeMealPlanOrLinkTask(value: string): boolean {
  return isLinkRequest(value) || hasSourceHintRequest(value) || parseDayLine(value) !== null ||
    value.split(/\r?\n/).some((line) => parseDayLine(line.trim()) !== null);
}

function shouldSearchLinkForEntry(entry: MealPlanAiDraftEntry): boolean {
  if (entry.linkUrl) {
    return false;
  }

  if (entry.sourceHint) {
    return true;
  }

  const normalized = normalizeText(entry.mealName);

  if (!normalized || isGenericMealName(normalized)) {
    return false;
  }

  return normalized.split(/[^a-z0-9]+/).filter(Boolean).length >= 2 || normalized.length >= 10;
}

function applyKnownRecipeLinks(
  entries: MealPlanAiDraftEntry[],
  knownRecipes: KnownMealRecipe[]
): MealPlanAiDraftEntry[] {
  if (knownRecipes.length === 0) {
    return entries;
  }

  return entries.map((entry) => {
    if (entry.linkUrl) {
      return entry;
    }

    const match = knownRecipes.find((recipe) =>
      areRecipeTitlesMatching(entry.mealName, recipe.title)
    );
    const linkUrl = normalizeUrl(match?.linkUrl ?? '');

    if (!match || !linkUrl) {
      return entry;
    }

    const recipeNote = trimToLength(match.note, 1000);

    return {
      ...entry,
      linkUrl,
      note: entry.note ?? (recipeNote || null),
      sourceHint: entry.sourceHint ?? normalizeKnownRecipeSource(match.source)
    };
  });
}

function applyLinkSearchUpdates(
  entries: MealPlanAiDraftEntry[],
  updates: MealPlanAiDraftEntry[],
  mealSlotsPerDay: number
): MealPlanAiDraftEntry[] {
  const updatesBySlot = new Map<string, MealPlanAiDraftEntry>();

  for (const update of normalizeDraftEntries(updates, mealSlotsPerDay)) {
    if (update.linkUrl) {
      updatesBySlot.set(`${update.weekday}:${update.slotIndex}`, update);
    }
  }

  if (updatesBySlot.size === 0) {
    return entries;
  }

  return entries.map((entry) => {
    if (entry.linkUrl) {
      return entry;
    }

    const update = updatesBySlot.get(`${entry.weekday}:${entry.slotIndex}`);

    if (!update?.linkUrl) {
      return entry;
    }

    return {
      ...entry,
      linkUrl: update.linkUrl,
      note: mergeEntryNotes(entry.note, update.note),
      sourceHint: update.sourceHint ?? entry.sourceHint
    };
  });
}

function improveLinkAssistantMessage(
  assistantMessage: string,
  entries: MealPlanAiDraftEntry[]
): string {
  const linkedCount = entries.filter((entry) => Boolean(entry.linkUrl)).length;

  if (linkedCount === 0 || normalizeText(assistantMessage).includes('link')) {
    return assistantMessage;
  }

  return `${assistantMessage} Uzupelnilem ${linkedCount} linkow do przepisow.`;
}

function buildHistoryPromptPayload(history: MealHistoryEntry[]): {
  frequentMeals: MealHistoryFrequency[];
  olderMeals: MealHistoryPromptMeal[];
  recentMeals: MealHistoryPromptMeal[];
} {
  const recentMeals = history
    .filter((entry) => entry.isRecent)
    .slice(0, 120)
    .map(toHistoryPromptMeal);
  const olderMeals = history
    .filter((entry) => !entry.isRecent)
    .slice(0, 220)
    .map(toHistoryPromptMeal);

  return {
    frequentMeals: buildMealFrequency(history.filter((entry) => !entry.isRecent)).slice(0, 80),
    olderMeals,
    recentMeals
  };
}

function toHistoryPromptMeal(entry: MealHistoryEntry): MealHistoryPromptMeal {
  return {
    linkUrl: entry.linkUrl ?? '',
    mealName: entry.mealName,
    note: entry.note ?? '',
    servedOn: entry.servedOn,
    slotIndex: entry.slotIndex,
    weekday: entry.weekday
  };
}

function buildMealFrequency(history: MealHistoryEntry[]): MealHistoryFrequency[] {
  const groups = new Map<string, MealHistoryFrequency>();

  for (const entry of history) {
    const key = normalizeText(entry.mealName);

    if (!key) {
      continue;
    }

    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        count: 1,
        lastServedOn: entry.servedOn,
        linkUrl: entry.linkUrl ?? '',
        mealName: entry.mealName,
        slotIndexes: [entry.slotIndex],
        weekdays: [entry.weekday]
      });
      continue;
    }

    current.count += 1;
    current.lastServedOn = current.lastServedOn > entry.servedOn
      ? current.lastServedOn
      : entry.servedOn;

    if (!current.linkUrl && entry.linkUrl) {
      current.linkUrl = entry.linkUrl;
    }

    if (!current.weekdays.includes(entry.weekday)) {
      current.weekdays.push(entry.weekday);
    }

    if (!current.slotIndexes.includes(entry.slotIndex)) {
      current.slotIndexes.push(entry.slotIndex);
    }
  }

  return [...groups.values()].sort(
    (left, right) => right.count - left.count || right.lastServedOn.localeCompare(left.lastServedOn)
  );
}

function filterRecentlyEatenEntries(
  entries: MealPlanAiDraftEntry[],
  history: MealHistoryEntry[]
): MealPlanAiDraftEntry[] {
  return normalizeDraftEntries(
    entries.filter((entry) => !isRecentlyEatenMeal(entry.mealName, history)),
    8
  );
}

function isRecentlyEatenMeal(mealName: string, history: MealHistoryEntry[]): boolean {
  return history
    .filter((entry) => entry.isRecent)
    .some((recent) => areRecipeTitlesMatching(mealName, recent.mealName));
}

function getUniqueRecentMealNames(history: MealHistoryEntry[]): string[] {
  const names = new Map<string, string>();

  for (const entry of history.filter((item) => item.isRecent)) {
    const key = normalizeText(entry.mealName);

    if (key && !names.has(key)) {
      names.set(key, entry.mealName);
    }
  }

  return [...names.values()].slice(0, 80);
}

function normalizeInsights(
  insights: string[],
  history: MealHistoryEntry[],
  entriesCount: number
): string[] {
  const cleaned = insights
    .map((insight) => trimToLength(insight, 220))
    .filter(Boolean)
    .slice(0, 5);

  if (cleaned.length > 0) {
    return cleaned;
  }

  const frequent = buildMealFrequency(history.filter((entry) => !entry.isRecent)).slice(0, 3);
  const fallback: string[] = [];

  if (frequent.length > 0) {
    fallback.push(
      `Najmocniejsze starsze wzorce: ${frequent.map((item) => item.mealName).join(', ')}.`
    );
  }

  fallback.push('Posilki z ostatnich 30 dni zostaly potraktowane jako zakazane.');

  if (entriesCount === 0) {
    fallback.push('Brakuje starszych kandydatow po odjeciu ostatnich 30 dni.');
  }

  return fallback.slice(0, 5);
}

function buildLocalHistorySuggestions(
  history: MealHistoryEntry[],
  mealSlotsPerDay: number
): MealPlanAiDraftEntry[] {
  const frequencies = buildMealFrequency(
    history.filter((entry) => !entry.isRecent && !isRecentlyEatenMeal(entry.mealName, history))
  );
  const usedNames = new Set<string>();
  const entries: MealPlanAiDraftEntry[] = [];

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    for (let slotIndex = 0; slotIndex < mealSlotsPerDay; slotIndex += 1) {
      const candidate = pickHistoryFrequency(frequencies, weekday, slotIndex, usedNames);

      if (!candidate) {
        continue;
      }

      usedNames.add(normalizeText(candidate.mealName));
      entries.push({
        linkUrl: normalizeUrl(candidate.linkUrl),
        mealName: candidate.mealName,
        note: `Pasuje do historii domu. Ostatnio starsze niz 30 dni: ${candidate.lastServedOn}.`,
        slotIndex,
        sourceHint: 'Historia domu',
        weekday
      });
    }
  }

  return normalizeDraftEntries(entries, mealSlotsPerDay);
}

function pickHistoryFrequency(
  frequencies: MealHistoryFrequency[],
  weekday: number,
  slotIndex: number,
  usedNames: Set<string>
): MealHistoryFrequency | null {
  const scored = frequencies
    .filter((item) => !usedNames.has(normalizeText(item.mealName)))
    .map((item) => ({
      item,
      score:
        item.count * 3 +
        (item.slotIndexes.includes(slotIndex) ? 8 : 0) +
        (item.weekdays.includes(weekday) ? 5 : 0) +
        Math.min(4, item.weekdays.length)
    }))
    .sort((left, right) =>
      right.score - left.score ||
      right.item.lastServedOn.localeCompare(left.item.lastServedOn) ||
      left.item.mealName.localeCompare(right.item.mealName)
    );

  return scored[0]?.item ?? null;
}

function buildDefaultHistorySuggestionMessage(entries: MealPlanAiDraftEntry[]): string {
  if (entries.length === 0) {
    return 'Nie mam jeszcze wystarczajacej historii po odjeciu ostatnich 30 dni.';
  }

  return `Przygotowalem ${entries.length} propozycji na podstawie historii domu i blokady ostatnich 30 dni.`;
}

function areRecipeTitlesMatching(left: string, right: string): boolean {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  return normalizedLeft.length >= 8 &&
    normalizedRight.length >= 8 &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft));
}

function normalizeKnownRecipeSource(source: string): string | null {
  return source === 'pomysly' ? 'Pomysly' : source === 'plan' ? 'Plan posilkow' : null;
}

function mergeEntryNotes(current: string | null, update: string | null): string | null {
  if (!update) {
    return current;
  }

  if (!current) {
    return update;
  }

  if (normalizeText(current).includes(normalizeText(update))) {
    return current;
  }

  return trimToLength(`${current}\n${update}`, 1000);
}

function isGenericMealName(normalizedMealName: string): boolean {
  const genericMeals = new Set([
    'angielskie',
    'gotowiec',
    'jajecznica',
    'kanapka',
    'kanapki',
    'kielbasa',
    'kolacja',
    'lunch',
    'obiad',
    'omlet',
    'owsianka',
    'parowki',
    'pizza',
    'resztki',
    'salatka',
    'sniadanie',
    'tosty',
    'zupa'
  ]);

  return genericMeals.has(normalizedMealName);
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
  entries: Array<
    | MealPlanAiDraftEntry
    | MealPlanAiDraftEntryDto
    | MealPlanAiResponse['entries'][number]
    | MealPlanAiSuggestionResponse['entries'][number]
  >,
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

  return /\b(link|linki|linkow|linkami|url|urle|adres|adresy|przepis|przepisy|przepisow|przepisami|znajdz|znajdzcie|poszukaj|wyszukaj)\b/.test(normalized);
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
        linkUrl: parsedMeal.linkUrl,
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

function parseSourceHint(value: string): {
  linkUrl: string | null;
  mealName: string;
  sourceHint: string | null;
} {
  const urlMatch = value.match(/https?:\/\/[^\s),]+/i);
  const linkUrl = normalizeUrl(urlMatch?.[0] ?? '');
  const normalizedValue = urlMatch ? value.replace(urlMatch[0], ' ').trim() : value.trim();
  const words = normalizedValue.split(/\s+/).filter(Boolean);

  for (let prefixLength = Math.min(3, words.length - 1); prefixLength >= 1; prefixLength -= 1) {
    const sourceHint = resolveSourceHint(words.slice(0, prefixLength).join(' '));

    if (sourceHint) {
      return {
        linkUrl,
        mealName: words.slice(prefixLength).join(' '),
        sourceHint
      };
    }
  }

  return {
    linkUrl,
    mealName: normalizedValue,
    sourceHint: null
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

function formatDateOnlyValue(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
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

class GeminiRateLimitError extends Error {
  constructor() {
    super('Meal plan AI limit exhausted');
    this.name = 'GeminiRateLimitError';
  }
}

function isGeminiRateLimitError(error: unknown): error is GeminiRateLimitError {
  return error instanceof GeminiRateLimitError;
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
  limitExhausted: boolean;
  questions: string[];
  status: 'ready' | 'needs_clarification' | 'limit_exhausted';
  targetWeekStartDate: string;
}

export interface MealPlanAiSuggestionResult {
  assistantMessage: string;
  entries: MealPlanAiDraftEntry[];
  excludedRecentDays: number;
  insights: string[];
  limitExhausted: boolean;
  recentMealNames: string[];
  status: 'ready' | 'needs_more_history' | 'limit_exhausted';
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

interface MealHistoryEntry {
  isRecent: boolean;
  linkUrl: string | null;
  mealName: string;
  note: string | null;
  servedOn: string;
  slotIndex: number;
  weekStartDate: string;
  weekday: number;
}

interface MealHistoryRow {
  is_recent: boolean;
  link_url: string | null;
  meal_name: string;
  note: string | null;
  served_on: Date | string;
  slot_index: number;
  week_start_date: Date | string;
  weekday: number;
}

interface MealHistoryFrequency {
  count: number;
  lastServedOn: string;
  linkUrl: string;
  mealName: string;
  slotIndexes: number[];
  weekdays: number[];
}

interface MealHistoryPromptMeal {
  linkUrl: string;
  mealName: string;
  note: string;
  servedOn: string;
  slotIndex: number;
  weekday: number;
}

interface GeminiContent {
  parts: Array<{ text: string }>;
  role: 'model' | 'user';
}

interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
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
