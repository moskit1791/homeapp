import type { FinanceDebt } from '../api';

type BudgetCategoryValues = {
  items: Array<{ budgetAmount: string | null; spentAmount: string }>;
};

function finiteAmount(value: string | null): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function groupDebtsByLender(debts: FinanceDebt[]) {
  const groups = new Map<
    string,
    {
      id: string;
      label: string;
      debts: FinanceDebt[];
      activeCount: number;
      settledCount: number;
      totalOpen: number;
    }
  >();

  for (const debt of debts) {
    const label = debt.lenderName.trim() || 'Bez nazwy';
    const id = label.toLocaleLowerCase('pl-PL');
    const group = groups.get(id) ?? {
      id,
      label,
      debts: [],
      activeCount: 0,
      settledCount: 0,
      totalOpen: 0,
    };
    group.debts.push(debt);
    if (debt.isSettled) group.settledCount += 1;
    else {
      group.activeCount += 1;
      group.totalOpen += Number(debt.remainingAmount ?? debt.amount ?? 0);
    }
    groups.set(id, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      debts: [...group.debts].sort(
        (left, right) =>
          Number(left.isSettled) - Number(right.isSettled) ||
          (left.dueDate ? Date.parse(left.dueDate) : Infinity) -
            (right.dueDate ? Date.parse(right.dueDate) : Infinity) ||
          left.purpose.localeCompare(right.purpose, 'pl-PL')
      ),
    }))
    .sort(
      (left, right) =>
        right.totalOpen - left.totalOpen ||
        right.activeCount - left.activeCount ||
        left.label.localeCompare(right.label, 'pl-PL')
    );
}

export function summarizeBudgetCategories(categories: BudgetCategoryValues[]) {
  const items = categories.flatMap((category) => category.items);
  const budget = items.reduce((total, item) => total + finiteAmount(item.budgetAmount), 0);
  const spent = items.reduce((total, item) => total + finiteAmount(item.spentAmount), 0);

  return {
    budget,
    spent,
    remaining: budget - spent,
    usage: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    itemCount: items.length,
  };
}
