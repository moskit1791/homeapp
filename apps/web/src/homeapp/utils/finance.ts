import type { FinanceDebt } from '../api';

type BudgetCategoryValues = {
  items: Array<{ budgetAmount: string | null; spentAmount: string }>;
};

type SelectableBudgetCategory = { id: string; isActive: boolean; name: string };

const fallbackBudgetIcons = [
  'solar:bill-list-bold-duotone',
  'solar:wallet-money-bold-duotone',
  'solar:box-bold-duotone',
  'solar:case-minimalistic-bold',
  'solar:cart-3-bold-duotone',
  'solar:home-smile-bold-duotone',
] as const;

const budgetIconRules: Array<{ icon: string; pattern: RegExp }> = [
  { icon: 'solar:hand-money-bold-duotone', pattern: /\b(rata|kredyt|pozycz|leasing|splata)\b/ },
  { icon: 'solar:wi-fi-router-bold-duotone', pattern: /internet|wi-?fi|router|swiatlowod/ },
  { icon: 'solar:waterdrops-bold-duotone', pattern: /\b(woda|scieki|kanaliz)/ },
  { icon: 'solar:phone-calling-bold-duotone', pattern: /telefon|komork|abonament.*tel/ },
  { icon: 'solar:fire-bold-duotone', pattern: /\b(gaz|opal|ogrzew|wegiel|pellet)\b/ },
  { icon: 'solar:bolt-bold-duotone', pattern: /prad|energi|elektr/ },
  { icon: 'solar:gas-station-bold-duotone', pattern: /paliw|benzyn|diesel|tankowan/ },
  { icon: 'solar:chef-hat-heart-bold-duotone', pattern: /jedz|zywn|spozyw|obiad|lunch|restaur|zakup.*dom/ },
  { icon: 'solar:trash-bin-trash-bold-duotone', pattern: /smiec|odpady|wywoz/ },
  { icon: 'solar:medical-kit-bold-duotone', pattern: /lekar|zdrow|apte|lek\b|dent|terap|rehab|weteryn/ },
  { icon: 'solar:scissors-square-bold-duotone', pattern: /fryz|urod|kosmet|paznok|barber/ },
  { icon: 'solar:home-smile-bold-duotone', pattern: /mieszkan|czynsz|hipotek|nieruchom|remont|mebl|\bdom\b/ },
  { icon: 'solar:wheel-bold-duotone', pattern: /\b(auto|samochod|motocykl|rower|transport|parking|opony|mechanik)\b/ },
  { icon: 'solar:tv-bold-duotone', pattern: /netflix|telewiz|subskry|stream|spotify|hbo|disney/ },
  { icon: 'solar:gift-bold-duotone', pattern: /prezent|urodzin|swiet|boze narodzenie|mikolaj|komuni/ },
  { icon: 'solar:notebook-bold-duotone', pattern: /przedszkol|szkol|nauk|kurs|ksiazk|studia/ },
  { icon: 'solar:piggy-bank-bold-duotone', pattern: /emerytur|oszcz|poduszk|rezerw|inwest/ },
  { icon: 'solar:users-group-rounded-bold-duotone', pattern: /dziec|rodzic|rodzin|kieszonkow/ },
  { icon: 'solar:suitcase-tag-bold', pattern: /wakac|urlop|podroz|wyjazd|hotel/ },
  { icon: 'solar:dumbbell-large-minimalistic-bold', pattern: /silown|sport|fitness|basen/ },
  { icon: 'solar:gamepad-bold', pattern: /konkurs|rozrywk|gra\b|hobby/ },
  { icon: 'solar:shield-check-bold-duotone', pattern: /ubezpiecz|polisa/ },
  { icon: 'solar:box-bold-duotone', pattern: /chemia|sprzatan|detergent|higien|zabaw/ },
  { icon: 'solar:heart-bold', pattern: /\b(kot|pies|zwierz|karma)\b/ },
  { icon: 'solar:bill-check-bold-duotone', pattern: /podatek|oplata|rachunek|skladk|izba|koszt.*rocz/ },
];

function finiteAmount(value: string | null): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function resolveBudgetItemIcon(name: string, categoryName = ''): string {
  const normalizedName = normalizeBudgetLabel(name);
  const normalizedCategory = normalizeBudgetLabel(categoryName);
  const searchable = `${normalizedName} ${normalizedCategory}`.trim();
  const matchingRule = budgetIconRules.find(({ pattern }) => pattern.test(searchable));

  if (matchingRule) return matchingRule.icon;

  const hash = [...normalizedName].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 2147483647,
    0
  );
  return fallbackBudgetIcons[hash % fallbackBudgetIcons.length];
}

function normalizeBudgetLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveBudgetItemCategories<
  VisibleCategory extends SelectableBudgetCategory,
  CatalogCategory extends SelectableBudgetCategory,
>(
  visibleMonthCategories: VisibleCategory[],
  catalogCategories: CatalogCategory[]
): Array<VisibleCategory | CatalogCategory> {
  const categories = new Map<string, VisibleCategory | CatalogCategory>();

  for (const category of [...visibleMonthCategories, ...catalogCategories]) {
    if (category.isActive && !categories.has(category.id)) categories.set(category.id, category);
  }

  return [...categories.values()];
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
