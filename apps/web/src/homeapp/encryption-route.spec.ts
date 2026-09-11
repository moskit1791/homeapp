import { it, expect, describe } from 'vitest';

import { encryptionRouteForPath, routeNeedsEncryptionUnlock } from './encryption-route';

describe('web encryption route protection', () => {
  it.each([
    ['/kalendarz', 'calendar'],
    ['/finanse', 'finances'],
    ['/zakupy', 'shopping'],
    ['/spizarnia', 'shopping'],
    ['/posilki', 'meal_planner'],
    ['/zadania', 'notes'],
    ['/zadania', 'todo'],
    ['/dom', 'cleaning'],
    ['/dom', 'annual_costs'],
    ['/dom', 'data_entries'],
    ['/dom', 'attachments'],
  ] as const)('protects %s when %s is encrypted', (path, module) => {
    expect(routeNeedsEncryptionUnlock(path, [module])).toBe(true);
  });

  it.each(['/', '/domownicy', '/auth/invitation'])('keeps %s available while locked', (path) => {
    expect(routeNeedsEncryptionUnlock(path, ['shopping', 'notes'])).toBe(false);
  });

  it('normalizes a trailing slash and ignores unrelated encrypted modules', () => {
    expect(encryptionRouteForPath('/finanse/')?.label).toBe('Finanse');
    expect(routeNeedsEncryptionUnlock('/finanse/', ['calendar'])).toBe(false);
  });
});
