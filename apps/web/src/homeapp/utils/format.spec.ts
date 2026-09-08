import { it, expect, describe } from 'vitest';

import { money, shortDate, monthCalendarDays } from './format';

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
});
