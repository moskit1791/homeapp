import { describe, expect, it } from 'vitest';

import { isNavItemActive } from './is-nav-item-active';

const foodItem = {
  title: 'Jedzenie',
  path: '/zakupy',
  children: [
    { title: 'Zakupy', path: '/zakupy' },
    { title: 'Spiżarnia', path: '/spizarnia' },
    { title: 'Plan posiłków', path: '/posilki' },
  ],
};

describe('isNavItemActive', () => {
  it.each(['/zakupy', '/spizarnia', '/posilki'])(
    'marks a parent item active for its child route %s',
    (pathname) => {
      expect(isNavItemActive(pathname, foodItem)).toBe(true);
    }
  );

  it('does not mark an unrelated parent item active', () => {
    expect(isNavItemActive('/finanse', foodItem)).toBe(false);
  });
});
