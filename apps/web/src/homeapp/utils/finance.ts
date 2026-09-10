type BudgetCategoryValues = {
  items: Array<{ budgetAmount: string | null; spentAmount: string }>;
};

function finiteAmount(value: string | null): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
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
