import { it, expect, describe } from 'vitest';

import { todoMovePlan, reorderTodosAfterDrop } from './todo-order';

const items = [
  { id: 'a', status: 'todo' },
  { id: 'b', status: 'todo' },
  { id: 'c', status: 'todo' },
  { id: 'd', status: 'done' },
];

describe('kolejność zadań po przeciągnięciu', () => {
  it('wyznacza serię ruchów zgodną z API mobilnym', () => {
    expect(todoMovePlan(items, 'a', 'c')).toEqual({ direction: 'down', steps: 2 });
    expect(todoMovePlan(items, 'c', 'a')).toEqual({ direction: 'up', steps: 2 });
  });

  it('zmienia kolejność oczekujących i zostawia wykonane na końcu', () => {
    expect(reorderTodosAfterDrop(items, 'a', 'c').map((item) => item.id)).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
    expect(todoMovePlan(items, 'a', 'd')).toBeNull();
  });
});
