import { it, expect, describe } from 'vitest';

import { summarizeBudgetCategories } from './finance';

describe('podsumowanie przefiltrowanego budżetu', () => {
  it('liczy liczby wyłącznie z widocznych pozycji', () => {
    const summary = summarizeBudgetCategories([
      {
        items: [
          { budgetAmount: '100', spentAmount: '60' },
          { budgetAmount: '50', spentAmount: '55' },
        ],
      },
    ]);

    expect(summary).toEqual({ budget: 150, spent: 115, remaining: 35, usage: 77, itemCount: 2 });
  });

  it('bezpiecznie obsługuje brak budżetu i wartości nieliczbowe', () => {
    expect(
      summarizeBudgetCategories([{ items: [{ budgetAmount: null, spentAmount: 'błąd' }] }])
    ).toEqual({ budget: 0, spent: 0, remaining: 0, usage: 0, itemCount: 1 });
  });
});
