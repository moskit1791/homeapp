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
  it('uses a separate Google Search pass to add recipe links', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      assistantMessage: 'Mam szkic planu.',
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
                  }
                ]
              }
            }
          ]
        }),
        ok: true
      })
      .mockResolvedValueOnce({
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
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
                  }
                ]
              }
            }
          ]
        }),
        ok: true
      });
    vi.stubGlobal('fetch', fetchMock);

    const database = {
      query: vi.fn(async (query: string) => {
        if (query.includes('meal_slots_per_day')) {
          return { rows: [{ meal_slots_per_day: 2 }] };
        }

        return { rows: [] };
      })
    };
    const service = new MealPlannerAiService(database as never);

    const result = await service.chat('household-id', {
      messages: [{ content: 'Pon: KS makaron z kurczakiem', role: 'user' }],
      targetWeekStartDate: '2026-05-18'
    });

    expect(result.entries[0]?.linkUrl).toBe(
      'https://www.kwestiasmaku.com/przepis/makaron-z-kurczakiem'
    );

    const firstBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);

    expect(firstBody.tools).toBeUndefined();
    expect(firstBody.generationConfig.responseMimeType).toBe('application/json');
    expect(secondBody.tools).toEqual([{ google_search: {} }]);
  });
});
