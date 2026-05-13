import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { z } from 'zod';
import { loadEnv } from '../../shared/env';

export const SHOPPING_AI_CATEGORIES = [
  'Owoce i warzywa',
  'Pieczywo',
  'Nabial',
  'Mieso i wedliny',
  'Ryby i owoce morza',
  'Mrozonki',
  'Produkty suche i spizarnia',
  'Sosy i dodatki',
  'Przekaski i slodycze',
  'Napoje',
  'Chemia i dom',
  'Grill i ogrod',
  'Dziecko i prezenty',
  'Inne'
] as const;

export type ShoppingAiCategory = (typeof SHOPPING_AI_CATEGORIES)[number];

const shoppingAiResponseSchema = z.object({
  clarificationMessage: z.string(),
  ignoredSourceFragments: z.array(
    z.object({
      id: z.string(),
      reason: z.string()
    })
  ),
  items: z.array(
    z.object({
      category: z.enum(SHOPPING_AI_CATEGORIES),
      name: z.string(),
      note: z.string(),
      quantity: z.string(),
      sourceFragmentIds: z.array(z.string())
    })
  ),
  status: z.enum(['ready', 'needs_clarification']),
  unresolvedSourceFragments: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      reason: z.string()
    })
  )
});

type ShoppingAiResponse = z.infer<typeof shoppingAiResponseSchema>;

const shoppingAiResponseJsonSchema = {
  properties: {
    clarificationMessage: {
      description:
        'Polish message for the user. Empty string when status is ready.',
      type: 'string'
    },
    ignoredSourceFragments: {
      description:
        'Source fragments that are only headings, occasions or context and should not become shopping items.',
      items: {
        properties: {
          id: { description: 'Exact source fragment id.', type: 'string' },
          reason: { description: 'Short Polish reason.', type: 'string' }
        },
        required: ['id', 'reason'],
        type: 'object'
      },
      type: 'array'
    },
    items: {
      description:
        'Shopping items sorted by the category order provided in the prompt.',
      items: {
        properties: {
          category: {
            description: 'One of the allowed categories from the prompt.',
            enum: [...SHOPPING_AI_CATEGORIES],
            type: 'string'
          },
          name: {
            description:
              'Clean product name in Polish, without quantity or occasion notes.',
            type: 'string'
          },
          note: {
            description:
              'Short Polish note if the source contains occasion or uncertainty. Empty string if not needed.',
            type: 'string'
          },
          quantity: {
            description:
              'Quantity, multiplier or very short note to save with the item. Empty string if not present.',
            type: 'string'
          },
          sourceFragmentIds: {
            description:
              'Ids of source fragments used to create this item. Every item must reference at least one id.',
            items: { type: 'string' },
            type: 'array'
          }
        },
        required: ['category', 'name', 'quantity', 'note', 'sourceFragmentIds'],
        type: 'object'
      },
      type: 'array'
    },
    status: {
      description:
        'Always ready. The mobile UI is not a chat, so vague shopping wishes must be saved as Inne.',
      enum: ['ready'],
      type: 'string'
    },
    unresolvedSourceFragments: {
      description:
        'Always empty. Do not ask the user questions; save unclear shopping wishes as category Inne.',
      items: {
        properties: {
          id: { description: 'Exact source fragment id.', type: 'string' },
          question: {
            description: 'Question in Polish that helps the user clarify.',
            type: 'string'
          },
          reason: { description: 'Short Polish reason.', type: 'string' }
        },
        required: ['id', 'reason', 'question'],
        type: 'object'
      },
      type: 'array'
    }
  },
  required: [
    'status',
    'clarificationMessage',
    'items',
    'unresolvedSourceFragments',
    'ignoredSourceFragments'
  ],
  type: 'object'
} as const;

@Injectable()
export class ShoppingAiService {
  private readonly logger = new Logger(ShoppingAiService.name);

  async planImport(input: string): Promise<ShoppingAiImportPlan> {
    const sourceFragments = extractShoppingSourceFragments(input);

    if (sourceFragments.length === 0) {
      throw new BadRequestException('Shopping AI empty list');
    }

    try {
      const responseText = await this.callGemini(this.buildPrompt(input, sourceFragments));
      const parsed = this.repairShoppingAiResponse(
        this.parseResponse(responseText),
        sourceFragments
      );
      const coverage = this.verifyCoverage(parsed, sourceFragments);

      if (!coverage.needsClarification) {
        const items = this.normalizeItems(parsed.items, sourceFragments);

        if (items.length > 0) {
          return {
            ignoredSourceFragments: parsed.ignoredSourceFragments,
            items,
            sourceFragments
          };
        }
      }

      this.logger.warn('Gemini shopping import needed fallback coverage repair');
    } catch (error) {
      this.logger.warn(
        `Gemini shopping import fallback used: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return this.buildFallbackImportPlan(sourceFragments);
  }

  private async callGemini(prompt: string): Promise<string> {
    const env = loadEnv();

    if (!env.GEMINI_API_KEY) {
      throw new ServiceUnavailableException('Shopping AI is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.GEMINI_TIMEOUT_MS);
    const model = env.GEMINI_MODEL.startsWith('models/')
      ? env.GEMINI_MODEL.slice('models/'.length)
      : env.GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

    try {
      const response = await fetch(url, {
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
              role: 'user'
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: shoppingAiResponseJsonSchema,
            temperature: 0.1
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        signal: controller.signal
      });

      if (!response.ok) {
        const details = await response.text();

        this.logger.warn(
          `Gemini shopping import failed with ${response.status}: ${details.slice(0, 500)}`
        );
        throw new ServiceUnavailableException('Shopping AI request failed');
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();

      if (!text) {
        this.logger.warn('Gemini shopping import returned no text content');
        throw new ServiceUnavailableException('Shopping AI returned invalid response');
      }

      return text;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new ServiceUnavailableException('Shopping AI request timed out');
      }

      this.logger.error(
        'Gemini shopping import request failed',
        error instanceof Error ? error.stack : undefined
      );
      throw new ServiceUnavailableException('Shopping AI request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildPrompt(input: string, fragments: ShoppingAiSourceFragment[]): string {
    return [
      'Jesteś backendowym parserem listy zakupów dla polskiej aplikacji domowej.',
      'Zadanie: zamień chaotyczny tekst użytkownika na produkty do zapisania w bazie.',
      '',
      'Zasady:',
      '- Odpowiadasz wyłącznie JSON-em zgodnym ze schematem.',
      '- To nie jest chat. Nie dopytuj użytkownika i nie zwracaj prośby o doprecyzowanie.',
      '- Status zawsze ma być "ready", a unresolvedSourceFragments zawsze pustą tablicą.',
      '- Użyj dokładnie kategorii podanych niżej i ułóż produkty według tej kolejności kategorii.',
      '- Nie gub żadnego fragmentu źródłowego. Każdy fragment musi trafić do items.sourceFragmentIds albo ignoredSourceFragments.',
      '- Jeśli fragment jest niejasny, zbyt ogólny albo nie masz pewności, nadal dodaj go jako produkt w kategorii "Inne".',
      '- Frazy typu "coś do kogoś", "jakieś rzeczy", "prezent" bez konkretu nadal są produktami do kupienia. Zachowaj sens frazy w nazwie.',
      '- Znane produkty z pytajnikiem, np. "prosciutto?", nadal dodaj jako produkt, a pytajnik przenieś do quantity albo note.',
      '- Nagłówki, okazje i kontekst bez produktu, np. "lista zakupów", "grill", "praca", możesz oznaczyć jako ignoredSourceFragments.',
      '- Jeśli nawias opisuje danie lub okazję, nie twórz z niego produktu, chyba że w nawiasie są konkretne produkty.',
      '- Nazwa produktu ma być krótka, bez ilości. Ilość, mnożnik i dopiski typu "do pracy" zapisz w quantity lub note.',
      '- Nie wymyślaj nowych produktów. Nie usuwaj konkretnych produktów.',
      '',
      `Kategorie w kolejności: ${SHOPPING_AI_CATEGORIES.join(', ')}`,
      '',
      'Fragmenty źródłowe do pokrycia:',
      ...fragments.map((fragment) => `${fragment.id}: ${fragment.text}`),
      '',
      'Oryginalny tekst użytkownika:',
      input
    ].join('\n');
  }

  private parseResponse(responseText: string): ShoppingAiResponse {
    try {
      return shoppingAiResponseSchema.parse(JSON.parse(responseText));
    } catch (error) {
      this.logger.warn(
        `Invalid Gemini shopping import JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new ServiceUnavailableException('Shopping AI returned invalid response');
    }
  }

  private repairShoppingAiResponse(
    response: ShoppingAiResponse,
    fragments: ShoppingAiSourceFragment[]
  ): ShoppingAiResponse {
    const fragmentById = new Map(fragments.map((fragment) => [fragment.id, fragment]));
    const knownFragmentIds = new Set(fragmentById.keys());
    const items = response.items.map((item) => ({
      ...item,
      sourceFragmentIds: item.sourceFragmentIds.filter((id) => knownFragmentIds.has(id))
    }));
    const itemFragmentIds = new Set(items.flatMap((item) => item.sourceFragmentIds));
    const ignoredSourceFragments = response.ignoredSourceFragments.filter((fragment) =>
      knownFragmentIds.has(fragment.id)
    );
    const ignoredFragmentIds = new Set(ignoredSourceFragments.map((fragment) => fragment.id));
    const promotedItems: ShoppingAiResponse['items'] = [];

    for (const fragment of response.unresolvedSourceFragments) {
      const source = fragmentById.get(fragment.id);

      if (!source) {
        continue;
      }

      if (itemFragmentIds.has(fragment.id) || ignoredFragmentIds.has(fragment.id)) {
        continue;
      }

      promotedItems.push(createFallbackItem(source));
      itemFragmentIds.add(fragment.id);
    }

    for (const fragment of fragments) {
      if (itemFragmentIds.has(fragment.id) || ignoredFragmentIds.has(fragment.id)) {
        continue;
      }

      if (isIgnorableShoppingContext(fragment.text)) {
        ignoredSourceFragments.push({
          id: fragment.id,
          reason: 'Kontekst listy zakupów.'
        });
        ignoredFragmentIds.add(fragment.id);
        continue;
      }

      promotedItems.push(createFallbackItem(fragment));
      itemFragmentIds.add(fragment.id);
    }

    return {
      ...response,
      clarificationMessage: '',
      ignoredSourceFragments,
      items: [...items, ...promotedItems],
      status: 'ready',
      unresolvedSourceFragments: []
    };
  }

  private verifyCoverage(
    response: ShoppingAiResponse,
    fragments: ShoppingAiSourceFragment[]
  ): ShoppingAiCoverage {
    const fragmentIds = new Set(fragments.map((fragment) => fragment.id));
    const coveredIds = new Set<string>();
    const unknownIds = new Set<string>();

    const addCoverage = (id: string) => {
      if (fragmentIds.has(id)) {
        coveredIds.add(id);
      } else {
        unknownIds.add(id);
      }
    };

    for (const item of response.items) {
      for (const id of item.sourceFragmentIds) {
        addCoverage(id);
      }
    }

    for (const fragment of response.unresolvedSourceFragments) {
      addCoverage(fragment.id);
    }

    for (const fragment of response.ignoredSourceFragments) {
      addCoverage(fragment.id);
    }

    const missingSourceFragments = fragments.filter((fragment) => !coveredIds.has(fragment.id));
    const needsClarification = unknownIds.size > 0;

    return {
      clarificationMessage: this.buildClarificationMessage(
        response,
        missingSourceFragments,
        unknownIds
      ),
      missingSourceFragments,
      needsClarification
    };
  }

  private buildFallbackImportPlan(
    sourceFragments: ShoppingAiSourceFragment[]
  ): ShoppingAiImportPlan {
    const hasMultipleFragments = sourceFragments.length > 1;
    const ignoredSourceFragments: ShoppingAiResponse['ignoredSourceFragments'] = [];
    const fallbackItems: ShoppingAiResponse['items'] = [];

    for (const fragment of sourceFragments) {
      if (hasMultipleFragments && isIgnorableShoppingContext(fragment.text)) {
        ignoredSourceFragments.push({
          id: fragment.id,
          reason: 'Kontekst listy zakupów.'
        });
        continue;
      }

      fallbackItems.push(...createFallbackItems(fragment));
    }

    const repaired = this.repairShoppingAiResponse(
      {
        clarificationMessage: '',
        ignoredSourceFragments,
        items: fallbackItems,
        status: 'ready',
        unresolvedSourceFragments: []
      },
      sourceFragments
    );
    const items = this.normalizeItems(repaired.items, sourceFragments);

    if (items.length === 0) {
      throw new ServiceUnavailableException('Shopping AI returned invalid response');
    }

    return {
      ignoredSourceFragments: repaired.ignoredSourceFragments,
      items,
      sourceFragments
    };
  }

  private buildClarificationMessage(
    response: ShoppingAiResponse,
    missingSourceFragments: ShoppingAiSourceFragment[],
    unknownIds: Set<string>
  ): string {
    const directMessage = response.clarificationMessage.trim();

    if (directMessage) {
      return directMessage;
    }

    const firstQuestion = response.unresolvedSourceFragments
      .map((fragment) => fragment.question.trim())
      .find(Boolean);

    if (firstQuestion) {
      return firstQuestion;
    }

    if (missingSourceFragments.length > 0) {
      return `Doprecyzuj proszę te fragmenty: ${missingSourceFragments
        .map((fragment) => fragment.text)
        .join(', ')}.`;
    }

    if (unknownIds.size > 0) {
      return 'AI zwróciło nieprawidłowe odniesienia do listy. Spróbuj wkleić listę jeszcze raz.';
    }

    return 'Doprecyzuj proszę listę zakupów, żebym niczego nie dopisał ani nie zgubił.';
  }

  private normalizeItems(
    items: ShoppingAiResponse['items'],
    fragments: ShoppingAiSourceFragment[]
  ): ShoppingAiPlannedItem[] {
    const order = new Map<ShoppingAiCategory, number>(
      SHOPPING_AI_CATEGORIES.map((category, index) => [category, index])
    );
    const fragmentById = new Map(fragments.map((fragment) => [fragment.id, fragment]));

    return items
      .map((item, index) => {
        const forcedFallbackCategory = categorizeShoppingProduct(item.name);
        const isUnclearItem = item.sourceFragmentIds.some((id) => {
          const fragment = fragmentById.get(id);

          return fragment ? isUnclearShoppingWish(fragment.text) : false;
        });
        const category = isUnclearItem
          ? 'Inne'
          : forcedFallbackCategory === 'Inne'
            ? item.category
            : forcedFallbackCategory;

        return {
          category,
          name: trimToLength(item.name, 180),
          orderIndex: index,
          quantity: trimToLength(formatQuantity(item.quantity, item.note), 80),
          sourceFragmentIds: item.sourceFragmentIds
        };
      })
      .filter((item) => item.name.length > 0)
      .sort((left, right) => {
        const categoryDiff = (order.get(left.category) ?? 999) - (order.get(right.category) ?? 999);

        if (categoryDiff !== 0) {
          return categoryDiff;
        }

        return left.orderIndex - right.orderIndex;
      });
  }
}

export function extractShoppingSourceFragments(input: string): ShoppingAiSourceFragment[] {
  const fragments: string[] = [];
  const normalizedInput = input
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^\s*(lista\s+zakup[oó]w|zakupy)\s*:\s*/i, ''))
    .join('\n');

  for (const part of splitTopLevel(normalizedInput)) {
    const extracted = extractParentheticalFragments(part);

    if (extracted.length > 0) {
      fragments.push(...extracted);
    } else {
      fragments.push(part);
    }
  }

  return fragments
    .flatMap(splitQuestionSeparatedFragments)
    .map(cleanFragment)
    .filter((fragment) => fragment.length > 0)
    .map((text, index) => ({
      id: `f${index + 1}`,
      text
    }));
}

function splitQuestionSeparatedFragments(value: string): string[] {
  return value.split(/(?<=\?)\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u);
}

function extractParentheticalFragments(value: string): string[] {
  const fragments: string[] = [];
  let outer = '';
  let currentInner = '';
  let depth = 0;

  for (const char of value) {
    if (char === '(' || char === '[') {
      if (depth === 0) {
        outer += ' ';
      } else {
        currentInner += char;
      }

      depth += 1;
      continue;
    }

    if ((char === ')' || char === ']') && depth > 0) {
      depth -= 1;

      if (depth === 0) {
        fragments.push(...splitTopLevel(currentInner));
        currentInner = '';
      } else {
        currentInner += char;
      }

      continue;
    }

    if (depth > 0) {
      currentInner += char;
    } else {
      outer += char;
    }
  }

  if (currentInner.trim()) {
    fragments.push(...splitTopLevel(currentInner));
  }

  if (outer.trim()) {
    fragments.unshift(outer);
  }

  return fragments;
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of input) {
    if (char === '(' || char === '[') {
      depth += 1;
      current += char;
      continue;
    }

    if ((char === ')' || char === ']') && depth > 0) {
      depth -= 1;
      current += char;
      continue;
    }

    if ((char === ',' || char === ';' || char === '\n') && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current);

  return parts;
}

function cleanFragment(value: string): string {
  return value
    .replace(/^\s*(lista\s+zakup[oó]w|zakupy)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:.-]+|[\s:.-]+$/g, '')
    .replace(/^i\s+/i, '')
    .trim();
}

function formatQuantity(quantity: string, note: string): string {
  const parts = [quantity.trim(), note.trim()].filter(Boolean);

  return parts.join(parts.length > 1 ? ' | ' : '');
}

function trimToLength(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trim();
}

function createFallbackItem(fragment: ShoppingAiSourceFragment): ShoppingAiResponse['items'][number] {
  return createFallbackItems(fragment)[0] ?? {
    category: 'Inne',
    name: fragment.text,
    note: '',
    quantity: '',
    sourceFragmentIds: [fragment.id]
  };
}

function createFallbackItems(fragment: ShoppingAiSourceFragment): ShoppingAiResponse['items'] {
  return splitFallbackProducts(fragment.text)
    .map((text) => createFallbackProduct(fragment.id, text))
    .filter((item) => item.name.trim().length > 0);
}

function createFallbackProduct(
  sourceFragmentId: string,
  rawText: string
): ShoppingAiResponse['items'][number] {
  const { name, quantity } = extractFallbackQuantity(rawText);

  return {
    category: categorizeShoppingProduct(name),
    name,
    note: '',
    quantity,
    sourceFragmentIds: [sourceFragmentId]
  };
}

function splitFallbackProducts(value: string): string[] {
  return value
    .split(/(?<=\?)\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractFallbackQuantity(value: string): { name: string; quantity: string } {
  const quantityParts: string[] = [];
  let name = value.trim();
  const uncertain = /\?$/.test(name);

  if (uncertain) {
    quantityParts.push('?');
    name = name.replace(/\?+$/g, '').trim();
  }

  name = name.replace(/\b[xX]\s*(\d+)\b/g, (_match, count: string) => {
    quantityParts.push(`x${count}`);
    return '';
  });
  name = name.replace(
    /\b(\d+(?:[,.]\d+)?)\s*(kg|g|dag|l|ml|szt|szt\.|opak|op|paczki|paczka)\b/giu,
    (match) => {
      quantityParts.push(match.trim());
      return '';
    }
  );

  return {
    name: formatFallbackName(name),
    quantity: quantityParts.join(' | ')
  };
}

function formatFallbackName(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '').trim();

  if (!normalized) {
    return '';
  }

  return `${normalized.charAt(0).toLocaleUpperCase('pl-PL')}${normalized.slice(1)}`;
}

export function categorizeShoppingProduct(value: string): ShoppingAiCategory {
  const normalized = normalizeFallbackText(value);

  if (isUnclearShoppingWish(value)) {
    return 'Inne';
  }

  if (/(jabl|granat|pomidor|pomidork|pieczark|papryk|owoc|warzyw|ogork|cebula|marchew|banan|cytryn|ziemniak|salat|boczniak|rukol|szpinak|por\b|porr|czosnek|cukini|brokul|kalafior|kapust|awokado|truskawk|malin|borowk|winogron|pomarancz|mandarynk|kiwi)/.test(normalized)) {
    return 'Owoce i warzywa';
  }

  if (/(chleb|pieczyw|bulka|bulki|grzank|bagiet)/.test(normalized)) {
    return 'Pieczywo';
  }

  if (/(mleko|maslo|feta|burrat|buratt|ser|jogurt|smietan|parmezan|mozzarell|jajka|jajko|twarog|serek|kefir|skyr|maslank)/.test(normalized)) {
    return 'Nabial';
  }

  if (/(prosciutto|salami|kielbas|szynk|kurczak|mieso|wedlin|boczek)/.test(normalized)) {
    return 'Mieso i wedliny';
  }

  if (/(ryba|losos|tunczyk|krewet)/.test(normalized)) {
    return 'Ryby i owoce morza';
  }

  if (/(mrozon|lody)/.test(normalized)) {
    return 'Mrozonki';
  }

  if (/(makaron|tortill|ryz|kasz|maka|cukier|platki|barilla)/.test(normalized)) {
    return 'Produkty suche i spizarnia';
  }

  if (/(pesto|sos|ketchup|majonez|musztard)/.test(normalized)) {
    return 'Sosy i dodatki';
  }

  if (/(slodk|czekolad|ciast|chips|przekask)/.test(normalized)) {
    return 'Przekaski i slodycze';
  }

  if (/(napoj|woda|sok|cola|piwo)/.test(normalized)) {
    return 'Napoje';
  }

  if (/(papier|folia|worki|chemia|plyn|proszek)/.test(normalized)) {
    return 'Chemia i dom';
  }

  if (/(grill|wegiel|brykiet|podpalk|wyposazenie grilla)/.test(normalized)) {
    return 'Grill i ogrod';
  }

  return 'Inne';
}

function normalizeFallbackText(value: string): string {
  return value
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function isUnclearShoppingWish(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  return /\b(cos|cokolwiek|jakies|jakis|jakas|jakiegos)\b/.test(normalized);
}

function isIgnorableShoppingContext(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /^(lista zakupow|zakupy|lista|grill|obiad|kolacja|sniadanie|praca|dom|weekend|jutro|dzis|dzisiaj|na jutro|na dzis|na dzisiaj)$/.test(
    normalized
  );
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

interface ShoppingAiCoverage {
  clarificationMessage: string;
  missingSourceFragments: ShoppingAiSourceFragment[];
  needsClarification: boolean;
}

export interface ShoppingAiSourceFragment {
  id: string;
  text: string;
}

export interface ShoppingAiPlannedItem {
  category: ShoppingAiCategory;
  name: string;
  orderIndex: number;
  quantity: string;
  sourceFragmentIds: string[];
}

export interface ShoppingAiImportPlan {
  ignoredSourceFragments: Array<{
    id: string;
    reason: string;
  }>;
  items: ShoppingAiPlannedItem[];
  sourceFragments: ShoppingAiSourceFragment[];
}
