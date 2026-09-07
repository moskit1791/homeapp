import { it, expect, describe } from 'vitest';

import { money, shortDate } from './format';

describe('formatowanie danych HomeApp', () => {
  it('bezpiecznie formatuje kwoty i daty API', () => {
    expect(money('12.50')).toContain('12,50');
    expect(shortDate('2026-09-07')).toContain('07');
    expect(shortDate(null)).toBe('—');
  });
});
