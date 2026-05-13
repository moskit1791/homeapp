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
  additionalProperties: false,
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
        additionalProperties: false,
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
        additionalProperties: false,
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
        'ready only when all shopping items are clear and every source fragment is covered, ignored or unresolved.',
      enum: ['ready', 'needs_clarification'],
      type: 'string'
    },
    unresolvedSourceFragments: {
      description:
        'Fragments that are too vague to save safely. Use this for phrases like "something for X".',
      items: {
        additionalProperties: false,
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

    const responseText = await this.callGemini(this.buildPrompt(input, sourceFragments));
    const parsed = this.parseResponse(responseText);
    const coverage = this.verifyCoverage(parsed, sourceFragments);

    if (coverage.needsClarification) {
      throw new BadRequestException({
        code: 'SHOPPING_AI_NEEDS_CLARIFICATION',
        details: {
          clarificationMessage: coverage.clarificationMessage,
          ignoredSourceFragments: parsed.ignoredSourceFragments,
          missingSourceFragments: coverage.missingSourceFragments,
          unresolvedSourceFragments: parsed.unresolvedSourceFragments
        },
        message: 'Shopping AI needs clarification'
      });
    }

    const items = this.normalizeItems(parsed.items);

    if (items.length === 0) {
      throw new ServiceUnavailableException('Shopping AI returned invalid response');
    }

    return {
      ignoredSourceFragments: parsed.ignoredSourceFragments,
      items,
      sourceFragments
    };
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
    )}:generateContent`;

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
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY
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
      '- Użyj dokładnie kategorii podanych niżej i ułóż produkty według tej kolejności kategorii.',
      '- Nie gub żadnego fragmentu źródłowego. Każdy fragment musi trafić do items.sourceFragmentIds, unresolvedSourceFragments albo ignoredSourceFragments.',
      '- Frazy typu "coś do kogoś", "jakieś rzeczy", "prezent" bez konkretu oznacz jako unresolvedSourceFragments.',
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
    const needsClarification =
      response.status !== 'ready' ||
      response.items.length === 0 ||
      response.unresolvedSourceFragments.length > 0 ||
      missingSourceFragments.length > 0 ||
      unknownIds.size > 0 ||
      response.items.some((item) => item.sourceFragmentIds.length === 0);

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

  private normalizeItems(items: ShoppingAiResponse['items']): ShoppingAiPlannedItem[] {
    const order = new Map<ShoppingAiCategory, number>(
      SHOPPING_AI_CATEGORIES.map((category, index) => [category, index])
    );

    return items
      .map((item, index) => ({
        category: item.category,
        name: trimToLength(item.name, 180),
        orderIndex: index,
        quantity: trimToLength(formatQuantity(item.quantity, item.note), 80),
        sourceFragmentIds: item.sourceFragmentIds
      }))
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
    .map(cleanFragment)
    .filter((fragment) => fragment.length > 0)
    .map((text, index) => ({
      id: `f${index + 1}`,
      text
    }));
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
