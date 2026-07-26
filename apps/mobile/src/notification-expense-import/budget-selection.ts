export type BudgetItemOption = {
  id: string;
  label: string;
};

export type BudgetCategoryOption = {
  id: string;
  items: BudgetItemOption[];
  label: string;
};

export function findBudgetCategoryId(
  categories: BudgetCategoryOption[],
  budgetItemId: string | null,
): string | null {
  if (!budgetItemId) return null;

  return (
    categories.find((category) =>
      category.items.some((item) => item.id === budgetItemId),
    )?.id ?? null
  );
}

export function getBudgetItemsForCategory(
  categories: BudgetCategoryOption[],
  categoryId: string | null,
): BudgetItemOption[] {
  if (!categoryId) return [];

  return categories.find((category) => category.id === categoryId)?.items ?? [];
}

export function changeBudgetCategory(
  currentCategoryId: string | null,
  currentBudgetItemId: string | null,
  nextCategoryId: string,
): { budgetCategoryId: string; budgetItemId: string | null } {
  return {
    budgetCategoryId: nextCategoryId,
    budgetItemId:
      currentCategoryId === nextCategoryId ? currentBudgetItemId : null,
  };
}
