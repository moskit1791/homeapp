import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MealPlannerAiService } from './meal-planner-ai.service';

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('GEMINI_MODEL', 'gemini-test');
  vi.stubEnv('GEMINI_TIMEOUT_MS', '15000');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MealPlannerAiService', () => {
  it('proxies chat messages through Gemini with Google Search enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(geminiTextResponse('Jasne, dopracujmy ten plan.'));
    vi.stubGlobal('fetch', fetchMock);

    const service = new MealPlannerAiService(createDatabase() as never);

    const result = await service.chat('household-id', {
      messages: [
        { content: 'Pon: KS makaron z kurczakiem', role: 'user' },
        { content: 'Mam propozycje, chcesz link?', role: 'assistant' },
        { content: 'Tak, znajdz linki.', role: 'user' }
      ],
      targetWeekStartDate: '2026-05-18'
    });

    expect(result).toMatchObject({
      assistantMessage: 'Jasne, dopracujmy ten plan.',
      entries: [],
      limitExhausted: false,
      status: 'ready'
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);

    expect(body.tools).toEqual([{ google_search: {} }]);
    expect(body.contents.map((content: { role: string }) => content.role)).toEqual([
      'user',
      'user',
      'model',
      'user'
    ]);
  });

  it('finalizes the chat into a draft and uses a separate Search pass for missing recipe links', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        geminiTextResponse(
          JSON.stringify({
            assistantMessage: 'Mam gotowy plan do zapisu.',
            entries: [
              {
                linkUrl: '',
                mealName: 'makaron z kurczakiem',
                note: '',
                slotIndex: 0,
                sourceHint: 'Kwestia Smaku',
                weekday: 1
              }
            ],
            questions: [],
            status: 'ready',
            targetWeekStartDate: '2026-05-18'
          })
        )
      )
      .mockResolvedValueOnce(
        geminiTextResponse(
          JSON.stringify({
            updates: [
              {
                linkUrl: 'https://www.kwestiasmaku.com/przepis/makaron-z-kurczakiem',
                note: '',
                slotIndex: 0,
                sourceHint: 'Kwestia Smaku',
                weekday: 1
              }
            ]
          })
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const service = new MealPlannerAiService(createDatabase() as never);

    const result = await service.finalize('household-id', {
      messages: [
        { content: 'Pon: KS makaron z kurczakiem', role: 'user' },
        { content: 'Dopisz realne linki i przygotuj zapis.', role: 'assistant' }
      ],
      targetWeekStartDate: '2026-05-18'
    });

    expect(result.entries[0]?.linkUrl).toBe(
      'https://www.kwestiasmaku.com/przepis/makaron-z-kurczakiem'
    );
    expect(result.limitExhausted).toBe(false);

    const firstBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(firstBody.tools).toEqual([{ google_search: {} }]);
    expect(firstBody.generationConfig.responseMimeType).toBeUndefined();
    expect(secondBody.tools).toEqual([{ google_search: {} }]);
  });

  it('returns a local fallback when Gemini reports an exhausted limit', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => '{"error":{"status":"RESOURCE_EXHAUSTED"}}'
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new MealPlannerAiService(createDatabase() as never);

    const result = await service.chat('household-id', {
      messages: [{ content: 'Pon: KS makaron z kurczakiem', role: 'user' }],
      targetWeekStartDate: '2026-05-18'
    });

    expect(result.limitExhausted).toBe(true);
    expect(result.status).toBe('limit_exhausted');
    expect(result.entries[0]).toMatchObject({
      mealName: 'makaron z kurczakiem',
      sourceHint: 'Kwestia Smaku',
      weekday: 1
    });
  });
});

function createDatabase() {
  return {
    query: vi.fn(async (query: string) => {
      if (query.includes('meal_slots_per_day')) {
        return { rows: [{ meal_slots_per_day: 2 }] };
      }

      return { rows: [] };
    })
  };
}

function geminiTextResponse(text: string) {
  return {
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text }]
          }
        }
      ]
    }),
    ok: true
  };
}
