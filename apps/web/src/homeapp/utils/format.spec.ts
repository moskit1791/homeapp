import { it, expect, describe } from 'vitest';

import {
  money,
  shortDate,
  calendarWeekDates,
  monthCalendarDays,
  calendarMonthDates,
} from './format';

describe('formatowanie danych HomeApp', () => {
  it('bezpiecznie formatuje kwoty i daty API', () => {
    expect(money('12.50')).toContain('12,50');
    expect(shortDate('2026-09-07')).toContain('07');
    expect(shortDate(null)).toBe('—');
  });

  it('układa miesiąc od poniedziałku w sześciu tygodniach', () => {
    const september2026 = monthCalendarDays(new Date(2026, 8, 8));

    expect(september2026).toHaveLength(42);
    expect(september2026.slice(0, 9)).toEqual([null, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(september2026.filter(Boolean)).toHaveLength(30);
  });

  it('zwraca pełne zakresy miesiąca i tygodnia', () => {
    const august2026 = calendarMonthDates('2026-08');
    const september2026 = calendarMonthDates('2026-09');

    expect(august2026).toHaveLength(42);
    expect(august2026[0]).toBe('2026-07-27');
    expect(august2026.at(-1)).toBe('2026-09-06');
    expect(september2026).toHaveLength(35);
    expect(september2026[0]).toBe('2026-08-31');
    expect(september2026.at(-1)).toBe('2026-10-04');
    expect(calendarWeekDates('2026-08-08')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
  });
});
