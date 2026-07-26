import {
  changeBudgetCategory,
  findBudgetCategoryId,
  getBudgetItemsForCategory,
  type BudgetCategoryOption,
} from "./budget-selection";

const categories: BudgetCategoryOption[] = [
  {
    id: "food",
    label: "Jedzenie",
    items: [
      { id: "groceries", label: "Zakupy spożywcze" },
      { id: "restaurants", label: "Restauracje" },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    items: [{ id: "fuel", label: "Paliwo" }],
  },
];

describe("notification expense budget selection", () => {
  it("finds the category of an existing budget item", () => {
    expect(findBudgetCategoryId(categories, "restaurants")).toBe("food");
    expect(findBudgetCategoryId(categories, "missing")).toBeNull();
  });

  it("shows only items from the selected category", () => {
    expect(getBudgetItemsForCategory(categories, "transport")).toEqual([
      { id: "fuel", label: "Paliwo" },
    ]);
    expect(getBudgetItemsForCategory(categories, null)).toEqual([]);
  });

  it("clears an item when the category changes", () => {
    expect(changeBudgetCategory("food", "groceries", "transport")).toEqual({
      budgetCategoryId: "transport",
      budgetItemId: null,
    });
  });

  it("keeps an item when the same category is selected", () => {
    expect(changeBudgetCategory("food", "groceries", "food")).toEqual({
      budgetCategoryId: "food",
      budgetItemId: "groceries",
    });
  });
});
