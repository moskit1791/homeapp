import { describe, expect, it, vi } from 'vitest';
import { MealPlannerService } from './meal-planner.service';

describe('MealPlannerService', () => {
  it('builds a universal AI copy prompt with household-specific meal history patterns', async () => {
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ meal_slots_per_day: 3 }] })
        .mockResolvedValueOnce({
          rows: [
            mealHistoryRow({
              meal_name: 'C owsianka kokosowa',
              note: 'Zrodlo: Cookidoo',
              served_on: '2026-06-01',
              slot_index: 0,
              weekday: 1,
              week_start_date: '2026-06-01'
            }),
            mealHistoryRow({
              meal_name: 'smoothie malinowe',
              note: 'Zrodlo: Cookidoo',
              served_on: '2026-06-03',
              slot_index: 0,
              weekday: 3,
              week_start_date: '2026-06-01'
            }),
            mealHistoryRow({
              meal_name: 'gofry',
              served_on: '2026-06-07',
              slot_index: 0,
              weekday: 7,
              week_start_date: '2026-06-01'
            }),
            mealHistoryRow({
              meal_name: 'leczo',
              served_on: '2026-06-02',
              slot_index: 1,
              weekday: 2,
              week_start_date: '2026-06-01'
            }),
            mealHistoryRow({
              meal_name: 'KS dorsz z batatami',
              served_on: '2026-05-22',
              slot_index: 1,
              weekday: 5,
              week_start_date: '2026-05-18'
            }),
            mealHistoryRow({
              meal_name: 'zupa pomidorowa',
              served_on: '2026-05-24',
              slot_index: 2,
              weekday: 7,
              week_start_date: '2026-05-18'
            })
          ]
        })
    };
    const realtime = { publish: vi.fn() };
    const service = new MealPlannerService(database as never, realtime as never);

    const result = await service.generateAiPrompt('household-id');
    const payload = parsePromptPayload(result.prompt);

    expect(result.prompt).toContain('To jest prompt uniwersalny');
    expect(result.prompt).toContain('Nie zakladaj z gory, ze slot 0 zawsze jest sniadaniem');
    expect(result.prompt).toContain('Nie dawaj teraz ponownie');
    expect(payload.summary).toMatchObject({
      entriesCount: 6,
      latestWeekStartDate: '2026-06-01',
      mealSlotsPerDay: 3,
      suggestedTargetWeekStartDate: '2026-06-08',
      weeksCount: 2
    });
    expect(payload.slotProfiles[0]).toMatchObject({
      detectedRole: 'prawdopodobnie sniadanie',
      slotIndex: 0
    });
    expect(payload.slotProfiles[1]).toMatchObject({
      detectedRole: 'prawdopodobnie obiad lub danie glowne',
      slotIndex: 1
    });
    expect(payload.sourcePreferences).toEqual(
      expect.arrayContaining([
        { count: 2, source: 'Cookidoo' },
        { count: 1, source: 'Kwestia Smaku' }
      ])
    );
    expect(
      payload.weekdaySlotPatterns.find(
        (pattern: { slotIndex: number; weekday: number }) =>
          pattern.weekday === 1 && pattern.slotIndex === 0
      )?.topMeals[0]
    ).toMatchObject({
      mealName: 'C owsianka kokosowa',
      sourceHints: ['Cookidoo']
    });
    expect(payload.recentWeeks[0]).toMatchObject({
      weekStartDate: '2026-06-01'
    });
  });
});

function mealHistoryRow(
  overrides: Partial<{
    link_url: string | null;
    meal_name: string;
    note: string | null;
    served_on: string;
    slot_index: number;
    weekday: number;
    week_start_date: string;
  }>
) {
  return {
    link_url: null,
    meal_name: 'owsianka',
    note: null,
    served_on: '2026-06-01',
    slot_index: 0,
    weekday: 1,
    week_start_date: '2026-06-01',
    ...overrides
  };
}

function parsePromptPayload(prompt: string): any {
  const marker = 'DANE DOMU I HISTORIA (JSON do analizy):\n';
  const [, json] = prompt.split(marker);

  if (!json) {
    throw new Error('Prompt payload marker not found');
  }

  return JSON.parse(json);
}
