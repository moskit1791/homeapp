import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { findNodeHandle, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import {
  Archive,
  Banknote,
  Car,
  CartPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Gift,
  Hammer,
  Heart,
  Home,
  Minus,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  ShoppingCart,
  Smartphone,
  TableLarge,
  Trash2,
  Users,
  Utensils,
  ViewGrid,
  WalletCards,
} from "../../src/ui/icon";
import {
  createBudgetCategory,
  createBudgetItem,
  createBudgetMonth,
  createExpense,
  createFinanceDebt,
  createFinanceSavingsAccount,
  createFinanceSavingsTransaction,
  deleteBudgetItem,
  deleteFinanceDebt,
  deleteBudgetMonth,
  deleteFinanceSavingsAccount,
  generateNextBudgetMonth,
  getBudgetMonth,
  getFinanceSummary,
  getMyHousehold,
  listBudgetCategories,
  listBudgetMonths,
  listFinanceDebts,
  listFinanceSavings,
  queryKeys,
  updateBudgetItem,
  updateFinanceDebt,
  type BudgetCategoryWithItems,
  type BudgetMonthDetail,
  type BudgetMonth,
  type FinanceDebt,
  type FinanceSavingsAccount,
  type FinanceSavingsDirection,
  type FinanceTotalSummary,
  type PersonFinanceSummary,
  upsertIncome,
} from "../../src/api";
import { useModulePermission } from "../../src/permissions/use-permissions";
import { loadStoredJson, saveStoredJson } from "../../src/session/secure-session-store";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import {
  formatCurrencyAmount,
  normalizeCurrencyCode,
  type SupportedCurrencyCode,
} from "../../src/utils/currency";
import {
  ActionButton,
  AppScreen,
  FormModal,
  IconButton,
  InlineAlert,
  QueryState,
  SegmentedControl,
  TextField,
} from "../../src/ui";

type FinanceFormValues = {
  categoryName: string;
  debtAmount: string;
  debtDueDate: string;
  debtLenderName: string;
  debtNote: string;
  debtPurpose: string;
  expenseAmount: string;
  incomeAmount: string;
  itemAmount: string;
  itemName: string;
  monthInput: string;
  savingsAmount: string;
  savingsName: string;
  savingsNote: string;
  savingsTransactionAmount: string;
  savingsTransactionNote: string;
};

type BudgetItem = BudgetCategoryWithItems["items"][number];
type BudgetItemWithCategory = BudgetItem & {
  category: BudgetCategoryWithItems;
};
type BudgetCategoryGroup = {
  category: BudgetCategoryWithItems;
  items: BudgetItemWithCategory[];
  planned: number;
  remaining: number;
  spent: number;
};

type FinanceModal =
  | "menu"
  | "incomeBreakdown"
  | "income"
  | "category"
  | "item"
  | "editItem"
  | "expense"
  | "expenseHistory"
  | "copyAmounts"
  | "debt"
  | "month"
  | "savingsAccount"
  | "savingsTransaction"
  | null;
type FinanceView = "budget" | "debts" | "savings";
type FinanceBudgetLayout = "table" | "cards";
type FinanceSortKey = "category" | "owner" | "name" | "budget" | "spent" | "remaining";
type FinanceSortDirection = "asc" | "desc";

type FinanceFilters = {
  categoryId: string;
  onlyOverBudget: boolean;
  ownerMemberId: string;
  search: string;
  sortBy: FinanceSortKey;
  sortDirection: FinanceSortDirection;
};

const financeFilterStorageKey = "homeapp.finance.filters.v1";
const financeBudgetLayoutStorageKey = "homeapp.finance.budget-layout.v1";

const defaultFinanceFilters: FinanceFilters = {
  categoryId: "",
  onlyOverBudget: false,
  ownerMemberId: "",
  search: "",
  sortBy: "category",
  sortDirection: "asc",
};

const financeSortOptions: Array<{ id: FinanceSortKey; label: string }> = [
  { id: "category", label: "Kategoria" },
  { id: "owner", label: "Osoba" },
  { id: "name", label: "Pozycja" },
  { id: "budget", label: "Budżet" },
  { id: "spent", label: "Wydano" },
  { id: "remaining", label: "Zostaje" },
];

export default function FinanseScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ action?: string; intent?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const screenScrollRef = useRef<ScrollView>(null);
  const { canCreate, canDelete, canRead, canUpdate, permissionsQuery } = useModulePermission("finances");
  const accessToken = session?.accessToken;
  const { control, setValue, watch } = useForm<FinanceFormValues>({
    defaultValues: {
      categoryName: "",
      debtAmount: "",
      debtDueDate: "",
      debtLenderName: "",
      debtNote: "",
      debtPurpose: "",
      expenseAmount: "",
      incomeAmount: "",
      itemAmount: "",
      itemName: "",
      monthInput: "",
      savingsAmount: "",
      savingsName: "",
      savingsNote: "",
      savingsTransactionAmount: "",
      savingsTransactionNote: "",
    },
  });

  const incomeAmount = watch("incomeAmount");
  const categoryName = watch("categoryName");
  const itemName = watch("itemName");
  const itemAmount = watch("itemAmount");
  const monthInput = watch("monthInput");
  const expenseAmount = watch("expenseAmount");
  const debtAmount = watch("debtAmount");
  const debtDueDate = watch("debtDueDate");
  const debtLenderName = watch("debtLenderName");
  const debtNote = watch("debtNote");
  const debtPurpose = watch("debtPurpose");
  const savingsAmount = watch("savingsAmount");
  const savingsName = watch("savingsName");
  const savingsNote = watch("savingsNote");
  const savingsTransactionAmount = watch("savingsTransactionAmount");
  const savingsTransactionNote = watch("savingsTransactionNote");
  const [selectedIncomeMemberId, setSelectedIncomeMemberId] = useState("");
  const [selectedItemCategoryId, setSelectedItemCategoryId] = useState("");
  const [selectedItemOwnerId, setSelectedItemOwnerId] = useState("");
  const [selectedExpenseOwnerId, setSelectedExpenseOwnerId] = useState("");
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState("");
  const [selectedExpenseItemId, setSelectedExpenseItemId] = useState("");
  const [expenseQuickItemId, setExpenseQuickItemId] = useState<string | null>(null);
  const [expenseQuickCategoryId, setExpenseQuickCategoryId] = useState<string | null>(null);
  const [historyBudgetItemId, setHistoryBudgetItemId] = useState<string | null>(null);
  const [copyCategory, setCopyCategory] = useState(true);
  const [activeFinanceView, setActiveFinanceView] = useState<FinanceView>("budget");
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [financeModal, setFinanceModal] = useState<FinanceModal>(null);
  const [editingBudgetItem, setEditingBudgetItem] = useState<BudgetItemWithCategory | null>(null);
  const [editingDebt, setEditingDebt] = useState<FinanceDebt | null>(null);
  const [selectedSavingsAccount, setSelectedSavingsAccount] = useState<FinanceSavingsAccount | null>(null);
  const [savingsDirection, setSavingsDirection] = useState<FinanceSavingsDirection>("add");
  const [copiedMonthDetail, setCopiedMonthDetail] = useState<BudgetMonthDetail | null>(null);
  const [copyAmountInputs, setCopyAmountInputs] = useState<Record<string, string>>({});
  const [budgetLayout, setBudgetLayout] = useState<FinanceBudgetLayout>("table");
  const [budgetLayoutLoaded, setBudgetLayoutLoaded] = useState(false);
  const [financeFilters, setFinanceFilters] = useState<FinanceFilters>(defaultFinanceFilters);
  const [financeFiltersLoaded, setFinanceFiltersLoaded] = useState(false);
  const [financeFiltersExpanded, setFinanceFiltersExpanded] = useState(false);
  const [deleteMonthConfirmVisible, setDeleteMonthConfirmVisible] = useState(false);
  const [handledRouteAction, setHandledRouteAction] = useState<string | null>(null);

  const currentQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => getFinanceSummary({ accessToken }),
    queryKey: [...queryKeys.finances, "current"],
  });
  const archiveQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listBudgetMonths({ accessToken }),
    queryKey: [...queryKeys.finances, "archive"],
  });
  const selectedArchiveQuery = useQuery({
    enabled:
      canRead &&
      Boolean(accessToken) &&
      Boolean(selectedMonthId) &&
      selectedMonthId !== currentQuery.data?.month.id,
    queryFn: () => getBudgetMonth(selectedMonthId ?? "", { accessToken }),
    queryKey: [...queryKeys.finances, "month", selectedMonthId],
  });
  const categoriesQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listBudgetCategories({ accessToken }),
    queryKey: [...queryKeys.finances, "categories"],
  });
  const debtsQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listFinanceDebts({ accessToken }),
    queryKey: [...queryKeys.finances, "debts"],
  });
  const savingsQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listFinanceSavings({ accessToken }),
    queryKey: [...queryKeys.finances, "savings"],
  });
  const householdQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: [...queryKeys.household, "me"],
  });

  const currencyCode = normalizeCurrencyCode(householdQuery.data?.currencyCode);
  const currentSummary = currentQuery.data;
  const summary =
    selectedMonthId && selectedMonthId !== currentSummary?.month.id
      ? selectedArchiveQuery.data
      : currentSummary;
  const totals = summary?.summary;
  const personSummaries = summary?.personSummary ?? [];
  const incomes = summary?.incomes ?? [];
  const categories = summary?.categories ?? [];
  const visibleFlatItems = useMemo<BudgetItemWithCategory[]>(
    () =>
      categories.flatMap((category) =>
        getCategoryItems(category).map((item) => ({ ...item, category })),
      ),
    [categories],
  );
  const historyBudgetItem = useMemo(
    () => visibleFlatItems.find((item) => item.id === historyBudgetItemId) ?? null,
    [historyBudgetItemId, visibleFlatItems],
  );
  const currentMonth = currentSummary?.month;
  const visibleMonth = summary?.month;
  const selectedPersonSummary = personSummaries.find(
    (person) => person.ownerMemberId === financeFilters.ownerMemberId,
  );
  const scopedTotals = getFinanceScopeTotals(
    totals,
    selectedPersonSummary,
    Boolean(financeFilters.ownerMemberId),
  );
  const budgetAmount = Number(scopedTotals.totalBudgetAmount);
  const spentAmount = Number(scopedTotals.totalSpentAmount);
  const remainingAmount = Number(scopedTotals.totalRemainingAmount);
  const debts = debtsQuery.data ?? [];
  const openDebts = debts.filter((debt) => !debt.isSettled);
  const settledDebts = debts.filter((debt) => debt.isSettled);
  const openDebtTotal = openDebts.reduce((sum, debt) => sum + Number(debt.amount ?? 0), 0);
  const savings = savingsQuery.data ?? [];
  const savingsTotal = savings.reduce((sum, account) => sum + Number(account.currentAmount ?? 0), 0);
  const monthTabs = useMemo(() => {
    const months = [...(archiveQuery.data ?? []), ...(currentMonth ? [currentMonth] : [])];
    const unique = new Map<string, BudgetMonth>();

    months.forEach((month) => unique.set(month.id, month));

    return [...unique.values()]
      .sort((left, right) => left.year - right.year || left.month - right.month);
  }, [archiveQuery.data, currentMonth]);
  const selectedMonthIndex = monthTabs.findIndex((month) => month.id === selectedMonthId);
  const selectedMonth = monthTabs.find((month) => month.id === selectedMonthId) ?? visibleMonth;
  const showingArchiveMonth = Boolean(selectedMonthId) && selectedMonthId !== currentSummary?.month.id;
  const canEditVisibleMonth = canUpdate && Boolean(visibleMonth?.id);
  const canCreateVisibleExpense = canCreate && Boolean(visibleMonth?.isCurrent);
  const canDeleteVisibleMonthItems = canDelete && Boolean(visibleMonth?.id);
  const canGoPreviousMonth = selectedMonthIndex > 0;
  const canGoNextMonth = selectedMonthIndex >= 0 && selectedMonthIndex < monthTabs.length - 1;
  const copiedMonthItems = useMemo<BudgetItemWithCategory[]>(
    () =>
      (copiedMonthDetail?.categories ?? []).flatMap((category) =>
        getCategoryItems(category).map((item) => ({ ...item, category })),
      ),
    [copiedMonthDetail],
  );
  const financeOwnerOptions = useMemo(() => {
    const owners = new Map<string, string>();

    incomes.forEach((income) => owners.set(income.ownerMemberId, income.displayName || income.email));
    visibleFlatItems.forEach((item) => {
      if (item.owner?.memberId) {
        owners.set(item.owner.memberId, formatOwner(item.owner));
      }
    });

    return [...owners.entries()].map(([id, label]) => ({ id, label }));
  }, [incomes, visibleFlatItems]);
  const expenseOwnerOptions = financeOwnerOptions;
  const expenseCategoryOptions = useMemo(() => {
    if (!selectedExpenseOwnerId) {
      return [];
    }

    return categories.map((category) => ({
      category,
      items: getCategoryItems(category)
        .filter((item) => item.owner?.memberId === selectedExpenseOwnerId)
        .map((item) => ({ ...item, category })),
    }));
  }, [categories, selectedExpenseOwnerId]);
  const expenseItems = useMemo(
    () =>
      expenseCategoryOptions.find((option) => option.category.id === selectedExpenseCategoryId)?.items ?? [],
    [expenseCategoryOptions, selectedExpenseCategoryId],
  );
  const selectedExpenseCategory = useMemo(
    () => categories.find((category) => category.id === selectedExpenseCategoryId) ?? null,
    [categories, selectedExpenseCategoryId],
  );
  const selectedExpenseOwner = useMemo(
    () => expenseOwnerOptions.find((owner) => owner.id === selectedExpenseOwnerId) ?? null,
    [expenseOwnerOptions, selectedExpenseOwnerId],
  );
  const selectedExpenseItem = useMemo(
    () => expenseItems.find((item) => item.id === selectedExpenseItemId),
    [expenseItems, selectedExpenseItemId],
  );
  const isQuickExpense = Boolean(expenseQuickItemId && selectedExpenseItem);
  const isQuickCategoryExpense = Boolean(expenseQuickCategoryId && selectedExpenseCategory);
  const isPresetExpense = isQuickExpense || isQuickCategoryExpense;
  const historyExpenses = historyBudgetItem?.expenses ?? [];
  const filteredRows = useMemo(
    () => applyFinanceFilters(visibleFlatItems, financeFilters),
    [financeFilters, visibleFlatItems],
  );
  const filteredCategories = useMemo(
    () => applyFinanceCategoryFilters(categories, financeFilters, filteredRows),
    [categories, financeFilters, filteredRows],
  );

  function selectAdjacentMonth(direction: -1 | 1) {
    const nextMonth = monthTabs[selectedMonthIndex + direction];

    if (nextMonth) {
      setSelectedMonthId(nextMonth.id);
    }
  }

  useEffect(() => {
    if (!selectedMonthId && currentMonth?.id) {
      setSelectedMonthId(currentMonth.id);
    }
  }, [currentMonth?.id, selectedMonthId]);

  useEffect(() => {
    let isMounted = true;

    loadStoredJson<Partial<FinanceFilters>>(financeFilterStorageKey).then((storedFilters) => {
      if (!isMounted) {
        return;
      }

      if (storedFilters) {
        setFinanceFilters({ ...defaultFinanceFilters, ...storedFilters });
      }

      setFinanceFiltersLoaded(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!financeFiltersLoaded) {
      return;
    }

    saveStoredJson(financeFilterStorageKey, financeFilters);
  }, [financeFilters, financeFiltersLoaded]);

  useEffect(() => {
    let isMounted = true;

    loadStoredJson<{ layout?: FinanceBudgetLayout }>(financeBudgetLayoutStorageKey)
      .then((storedLayout) => {
        if (!isMounted) {
          return;
        }

        if (storedLayout?.layout === "table" || storedLayout?.layout === "cards") {
          setBudgetLayout(storedLayout.layout);
        }

        setBudgetLayoutLoaded(true);
      })
      .catch(() => {
        if (isMounted) {
          setBudgetLayoutLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!budgetLayoutLoaded) {
      return;
    }

    saveStoredJson(financeBudgetLayoutStorageKey, { layout: budgetLayout });
  }, [budgetLayout, budgetLayoutLoaded]);

  useEffect(() => {
    if (!params.action) {
      setHandledRouteAction(null);
      return;
    }

    const routeActionKey = `${params.action}:${params.intent ?? ""}`;

    if (params.action !== "expense" || handledRouteAction === routeActionKey) {
      return;
    }

    setSelectedExpenseOwnerId("");
    setSelectedExpenseCategoryId("");
    setSelectedExpenseItemId("");
    setExpenseQuickItemId(null);
    setValue("expenseAmount", "");
    setFinanceModal("expense");
    setHandledRouteAction(routeActionKey);
    router.setParams({ action: undefined, intent: undefined });
  }, [handledRouteAction, params.action, params.intent, router, setValue]);

  useEffect(() => {
    if (!selectedIncomeMemberId && incomes[0]) {
      setSelectedIncomeMemberId(incomes[0].ownerMemberId);
    }
  }, [incomes, selectedIncomeMemberId]);

  useEffect(() => {
    if (!selectedItemOwnerId && incomes[0]) {
      setSelectedItemOwnerId(incomes[0].ownerMemberId);
    }
  }, [incomes, selectedItemOwnerId]);

  useEffect(() => {
    const firstCategoryId = categories[0]?.id ?? categoriesQuery.data?.[0]?.id;

    if (!selectedItemCategoryId && firstCategoryId) {
      setSelectedItemCategoryId(firstCategoryId);
    }
  }, [categories, categoriesQuery.data, selectedItemCategoryId]);

  useEffect(() => {
    if (financeModal !== "expense") {
      return;
    }

    if (!selectedExpenseOwnerId) {
      return;
    }

    const ownerIds = new Set(expenseOwnerOptions.map((owner) => owner.id));

    if (ownerIds.has(selectedExpenseOwnerId)) {
      return;
    }

    setSelectedExpenseOwnerId("");
    setSelectedExpenseCategoryId("");
    setSelectedExpenseItemId("");
  }, [expenseOwnerOptions, financeModal, selectedExpenseOwnerId]);

  useEffect(() => {
    if (financeModal !== "expense") {
      return;
    }

    if (!selectedExpenseOwnerId) {
      setSelectedExpenseCategoryId("");
      setSelectedExpenseItemId("");
      return;
    }

    if (!selectedExpenseCategoryId) {
      return;
    }

    const categoryIds = new Set(expenseCategoryOptions.map((option) => option.category.id));

    if (categoryIds.has(selectedExpenseCategoryId)) {
      return;
    }

    setSelectedExpenseCategoryId("");
    setSelectedExpenseItemId("");
  }, [
    expenseCategoryOptions,
    financeModal,
    selectedExpenseCategoryId,
    selectedExpenseOwnerId,
  ]);

  useEffect(() => {
    if (financeModal !== "expense") {
      return;
    }

    if (!selectedExpenseCategoryId) {
      setSelectedExpenseItemId("");
      return;
    }

    if (!selectedExpenseItemId) {
      return;
    }

    const itemIds = new Set(expenseItems.map((item) => item.id));

    if (itemIds.has(selectedExpenseItemId)) {
      return;
    }

    setSelectedExpenseItemId("");
  }, [expenseItems, financeModal, selectedExpenseCategoryId, selectedExpenseItemId]);

  const invalidateFinance = () => queryClient.invalidateQueries({ queryKey: queryKeys.finances });
  const incomeMutation = useMutation({
    mutationFn: () =>
      upsertIncome(
        selectedIncomeMemberId,
        { amount: parseMoney(incomeAmount), budgetMonthId: visibleMonth?.id },
        { accessToken },
      ),
    onSuccess: async () => {
      setValue("incomeAmount", "");
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const categoryMutation = useMutation({
    mutationFn: () =>
      createBudgetCategory(
        {
          copyBudgetToNextMonth: copyCategory,
          name: categoryName.trim(),
        },
        { accessToken },
      ),
    onSuccess: async (category) => {
      setValue("categoryName", "");
      setSelectedItemCategoryId(category.id);
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const itemMutation = useMutation({
    mutationFn: () =>
      createBudgetItem(
        {
          budgetAmount: itemAmount.trim() ? parseMoney(itemAmount) : null,
          budgetMonthId: visibleMonth?.id ?? "",
          categoryId: selectedItemCategoryId,
          name: itemName.trim(),
          ownerMemberId: selectedItemOwnerId,
        },
        { accessToken },
      ),
    onSuccess: async (item) => {
      setValue("itemName", "");
      setValue("itemAmount", "");
      setSelectedExpenseItemId(item.id);
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const updateItemMutation = useMutation({
    mutationFn: () =>
      updateBudgetItem(
        editingBudgetItem?.id ?? "",
        {
          budgetAmount: itemAmount.trim() ? parseMoney(itemAmount) : null,
          categoryId: selectedItemCategoryId,
          name: itemName.trim(),
          ownerMemberId: selectedItemOwnerId,
        },
        { accessToken },
      ),
    onSuccess: async (item) => {
      setValue("itemName", "");
      setValue("itemAmount", "");
      setEditingBudgetItem(null);
      setSelectedExpenseItemId(item.id);
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const deleteItemMutation = useMutation({
    mutationFn: (budgetItemId: string) => deleteBudgetItem(budgetItemId, { accessToken }),
    onSuccess: async (_, budgetItemId) => {
      if (selectedExpenseItemId === budgetItemId) {
        setSelectedExpenseItemId("");
      }
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const saveDebtMutation = useMutation({
    mutationFn: () => {
      const input = {
        amount: parseMoney(debtAmount),
        dueDate: debtDueDate.trim() ? debtDueDate.trim() : null,
        lenderName: debtLenderName.trim(),
        note: debtNote.trim() || null,
        purpose: debtPurpose.trim(),
      };

      return editingDebt
        ? updateFinanceDebt(editingDebt.id, input, { accessToken })
        : createFinanceDebt(input, { accessToken });
    },
    onSuccess: async () => {
      resetDebtForm();
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const settleDebtMutation = useMutation({
    mutationFn: (debt: FinanceDebt) =>
      updateFinanceDebt(debt.id, { isSettled: !debt.isSettled }, { accessToken }),
    onSuccess: async () => {
      await invalidateFinance();
    },
  });
  const deleteDebtMutation = useMutation({
    mutationFn: (debtId: string) => deleteFinanceDebt(debtId, { accessToken }),
    onSuccess: async () => {
      await invalidateFinance();
    },
  });
  const savingsAccountMutation = useMutation({
    mutationFn: () =>
      createFinanceSavingsAccount(
        {
          amount: parseMoney(savingsAmount),
          changedAt: todayIso(),
          name: savingsName.trim(),
          note: savingsNote.trim() || null,
        },
        { accessToken },
      ),
    onSuccess: async () => {
      resetSavingsAccountForm();
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const savingsTransactionMutation = useMutation({
    mutationFn: () =>
      createFinanceSavingsTransaction(
        selectedSavingsAccount?.id ?? "",
        {
          amount: parseMoney(savingsTransactionAmount),
          changedAt: todayIso(),
          direction: savingsDirection,
          note: savingsTransactionNote.trim() || null,
        },
        { accessToken },
      ),
    onSuccess: async () => {
      resetSavingsTransactionForm();
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const deleteSavingsAccountMutation = useMutation({
    mutationFn: (accountId: string) => deleteFinanceSavingsAccount(accountId, { accessToken }),
    onSuccess: async () => {
      await invalidateFinance();
    },
  });
  const expenseMutation = useMutation({
    mutationFn: async () => {
      let budgetItemId = selectedExpenseItemId;

      if (!budgetItemId && expenseQuickCategoryId && selectedExpenseCategory && visibleMonth?.id) {
        const createdItem = await createBudgetItem(
          {
            budgetAmount: null,
            budgetMonthId: visibleMonth.id,
            categoryId: selectedExpenseCategory.id,
            name: selectedExpenseCategory.name,
            ownerMemberId: selectedExpenseOwnerId,
          },
          { accessToken },
        );

        budgetItemId = createdItem.id;
      }

      if (!budgetItemId) {
        throw new Error("Missing budget item");
      }

      return createExpense(
        {
          amount: parseMoney(expenseAmount),
          budgetItemId,
        },
        { accessToken },
      );
    },
    onSuccess: async () => {
      setValue("expenseAmount", "");
      setExpenseQuickItemId(null);
      setExpenseQuickCategoryId(null);
      setFinanceModal(null);
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const nextMonthMutation = useMutation({
    mutationFn: () => generateNextBudgetMonth({ accessToken }),
    onSuccess: async (nextMonth) => {
      setSelectedMonthId(nextMonth.month.id);
      setCopiedMonthDetail(nextMonth);
      setCopyAmountInputs(
        Object.fromEntries(
          nextMonth.categories.flatMap((category) =>
            getCategoryItems(category).map((item) => [item.id, item.budgetAmount ?? ""]),
          ),
        ),
      );
      setFinanceModal("copyAmounts");
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const createMonthMutation = useMutation({
    mutationFn: () => {
      const parsed = parseMonthInput(monthInput);

      if (!parsed) {
        throw new Error("Invalid month");
      }

      return createBudgetMonth(
        {
          month: parsed.month,
          sourceBudgetMonthId: visibleMonth?.id ?? null,
          year: parsed.year,
        },
        { accessToken },
      );
    },
    onSuccess: async (createdMonth) => {
      setValue("monthInput", "");
      setSelectedMonthId(createdMonth.month.id);
      setCopiedMonthDetail(createdMonth);
      setCopyAmountInputs(
        Object.fromEntries(
          createdMonth.categories.flatMap((category) =>
            getCategoryItems(category).map((item) => [item.id, item.budgetAmount ?? ""]),
          ),
        ),
      );
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
      setFinanceModal(createdMonth.categories.some((category) => getCategoryItems(category).length > 0) ? "copyAmounts" : null);
    },
  });
  const copyAmountsMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        copiedMonthItems.map((item) =>
          updateBudgetItem(
            item.id,
            {
              budgetAmount: copyAmountInputs[item.id]?.trim()
                ? parseMoney(copyAmountInputs[item.id] ?? "")
                : null,
            },
            { accessToken },
          ),
        ),
      );
    },
    onSuccess: async () => {
      setCopiedMonthDetail(null);
      setCopyAmountInputs({});
      setFinanceModal(null);
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const deleteMonthMutation = useMutation({
    mutationFn: () => deleteBudgetMonth(selectedMonthId ?? "", { accessToken }),
    onSuccess: async () => {
      const deletedMonthId = selectedMonthId;
      setDeleteMonthConfirmVisible(false);
      setFinanceModal(null);
      setSelectedMonthId(null);
      if (deletedMonthId) {
        queryClient.removeQueries({ queryKey: [...queryKeys.finances, "month", deletedMonthId] });
      }
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });

  function closeFinanceModal() {
    setFinanceModal(null);
    setEditingBudgetItem(null);
    setEditingDebt(null);
    setSelectedSavingsAccount(null);
    setExpenseQuickItemId(null);
    setExpenseQuickCategoryId(null);
    setHistoryBudgetItemId(null);
  }

  function openExpenseModal() {
    setSelectedExpenseOwnerId("");
    setSelectedExpenseCategoryId("");
    setSelectedExpenseItemId("");
    setExpenseQuickItemId(null);
    setExpenseQuickCategoryId(null);
    setValue("expenseAmount", "");
    setFinanceModal("expense");
  }

  function openExpenseModalForItem(item: BudgetItemWithCategory) {
    setSelectedExpenseOwnerId(item.owner.memberId);
    setSelectedExpenseCategoryId(item.category.id);
    setSelectedExpenseItemId(item.id);
    setExpenseQuickItemId(item.id);
    setExpenseQuickCategoryId(null);
    setValue("expenseAmount", "");
    setFinanceModal("expense");
  }

  function openItemModalForCategory(category: BudgetCategoryWithItems) {
    setEditingBudgetItem(null);
    setSelectedItemCategoryId(category.id);
    setValue("itemName", "");
    setValue("itemAmount", "");
    setFinanceModal("item");
  }

  function openExpenseModalForCategory(category: BudgetCategoryWithItems) {
    const ownerId =
      financeFilters.ownerMemberId ||
      selectedIncomeMemberId ||
      incomes.find((income) => Number(income.amount) > 0)?.ownerMemberId ||
      incomes[0]?.ownerMemberId ||
      "";
    const firstItem =
      ownerId
        ? getCategoryItems(category).find((item) => item.owner?.memberId === ownerId)
        : getCategoryItems(category)[0];

    setSelectedExpenseOwnerId(ownerId);
    setSelectedExpenseCategoryId(category.id);
    setSelectedExpenseItemId(firstItem?.id ?? "");
    setExpenseQuickItemId(null);
    setExpenseQuickCategoryId(category.id);
    setValue("expenseAmount", "");
    setFinanceModal("expense");
  }

  function openExpenseHistory(item: BudgetItemWithCategory) {
    setHistoryBudgetItemId(item.id);
    setFinanceModal("expenseHistory");
  }

  function openEditBudgetItem(item: BudgetItemWithCategory) {
    setEditingBudgetItem(item);
    setSelectedItemCategoryId(item.categoryId);
    setSelectedItemOwnerId(item.owner?.memberId ?? "");
    setValue("itemName", item.name);
    setValue("itemAmount", item.budgetAmount ? formatMoneyInput(item.budgetAmount) : "");
    setFinanceModal("item");
  }

  function updateFinanceFilters(nextFilters: Partial<FinanceFilters>) {
    setFinanceFilters((current) => ({ ...current, ...nextFilters }));
  }

  function toggleBudgetLayout() {
    setBudgetLayout((current) => (current === "table" ? "cards" : "table"));
  }

  function resetDebtForm() {
    setEditingDebt(null);
    setValue("debtAmount", "");
    setValue("debtDueDate", "");
    setValue("debtLenderName", "");
    setValue("debtNote", "");
    setValue("debtPurpose", "");
  }

  function openCreateDebt() {
    resetDebtForm();
    setFinanceModal("debt");
  }

  function openEditDebt(debt: FinanceDebt) {
    setEditingDebt(debt);
    setValue("debtAmount", formatMoneyInput(debt.amount));
    setValue("debtDueDate", debt.dueDate ?? "");
    setValue("debtLenderName", debt.lenderName);
    setValue("debtNote", debt.note ?? "");
    setValue("debtPurpose", debt.purpose);
    setFinanceModal("debt");
  }

  function resetSavingsAccountForm() {
    setValue("savingsAmount", "");
    setValue("savingsName", "");
    setValue("savingsNote", "");
  }

  function openCreateSavingsAccount() {
    resetSavingsAccountForm();
    setFinanceModal("savingsAccount");
  }

  function resetSavingsTransactionForm() {
    setSelectedSavingsAccount(null);
    setSavingsDirection("add");
    setValue("savingsTransactionAmount", "");
    setValue("savingsTransactionNote", "");
  }

  function openSavingsTransaction(account: FinanceSavingsAccount, direction: FinanceSavingsDirection) {
    setSelectedSavingsAccount(account);
    setSavingsDirection(direction);
    setValue("savingsTransactionAmount", "");
    setValue("savingsTransactionNote", "");
    setFinanceModal("savingsTransaction");
  }

  const canSaveIncome =
    canUpdate && Boolean(selectedIncomeMemberId) && isValidMoney(incomeAmount);
  const canSaveCategory = canCreate && Boolean(categoryName.trim());
  const canSaveItem =
    canCreate &&
    Boolean(visibleMonth?.id) &&
    Boolean(itemName.trim()) &&
    Boolean(selectedItemCategoryId) &&
    Boolean(selectedItemOwnerId) &&
    (!itemAmount.trim() || isValidMoney(itemAmount));
  const canSaveEditedItem =
    canUpdate &&
    Boolean(editingBudgetItem?.id) &&
    Boolean(itemName.trim()) &&
    Boolean(selectedItemCategoryId) &&
    Boolean(selectedItemOwnerId) &&
    (!itemAmount.trim() || isValidMoney(itemAmount));
  const canSaveExpense =
    canCreate &&
    isPositiveMoney(expenseAmount) &&
    (Boolean(selectedExpenseItem) ||
      Boolean(
        expenseQuickCategoryId &&
          selectedExpenseCategory &&
          selectedExpenseOwnerId &&
          visibleMonth?.id,
      ));
  const canSaveDebt =
    (editingDebt ? canUpdate : canCreate) &&
    Boolean(debtLenderName.trim()) &&
    Boolean(debtPurpose.trim()) &&
    isPositiveMoney(debtAmount) &&
    (!debtDueDate.trim() || /^\d{4}-\d{2}-\d{2}$/.test(debtDueDate));
  const canSaveSavingsAccount =
    canCreate &&
    Boolean(savingsName.trim()) &&
    isValidMoney(savingsAmount);
  const canSaveSavingsTransaction =
    canUpdate &&
    Boolean(selectedSavingsAccount?.id) &&
    isPositiveMoney(savingsTransactionAmount);
  const canSaveCopyAmounts =
    copiedMonthItems.length > 0 &&
    copiedMonthItems.every((item) => {
      const value = copyAmountInputs[item.id] ?? "";

      return !value.trim() || isValidMoney(value);
    });
  const canRemoveSelectedMonth =
    canDelete && Boolean(selectedMonthId) && monthTabs.length > 1 && !deleteMonthMutation.isPending;
  const canCreateMonth = canCreate && Boolean(parseMonthInput(monthInput)) && !createMonthMutation.isPending;

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Finanse">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (!canRead) {
    return (
      <AppScreen title="Finanse">
        <InlineAlert tone="error" text="Nie masz uprawnienia do finansów." />
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollRef={screenScrollRef} title="Finanse">
      <QueryState
        emptyText="Brak danych finansowych."
        error={currentQuery.error ?? (showingArchiveMonth ? selectedArchiveQuery.error : null)}
        isEmpty={!currentQuery.isLoading && !summary}
        isLoading={currentQuery.isLoading || selectedArchiveQuery.isLoading}
      />

      <SegmentedControl
        onChange={(value) => setActiveFinanceView(value as FinanceView)}
        options={[
          { label: "Budżet", value: "budget" },
          { label: "Pożyczki/Debety", value: "debts" },
          { label: "Oszczędności", value: "savings" },
        ]}
        value={activeFinanceView}
      />

      {activeFinanceView === "budget" && summary ? (
        <>
          <View style={styles.monthSwitcherRow}>
            <View style={styles.monthSwitcher}>
              <IconButton
                accessibilityLabel="Poprzedni miesiąc budżetu"
                disabled={!canGoPreviousMonth}
                onPress={() => selectAdjacentMonth(-1)}
                style={styles.monthNavButton}
              >
                <ChevronLeft color={canGoPreviousMonth ? theme.colors.textMuted : theme.colors.textSubtle} size={20} />
              </IconButton>
              <Text numberOfLines={1} style={styles.monthSwitcherTitle}>
                {visibleMonth ? formatMonthLong(visibleMonth) : "Miesiąc"}
              </Text>
              <IconButton
                accessibilityLabel="Następny miesiąc budżetu"
                disabled={!canGoNextMonth}
                onPress={() => selectAdjacentMonth(1)}
                style={styles.monthNavButton}
              >
                <ChevronRight color={canGoNextMonth ? theme.colors.textMuted : theme.colors.textSubtle} size={20} />
              </IconButton>
            </View>
            <IconButton
              accessibilityLabel={
                budgetLayout === "table"
                  ? "Zmień widok budżetu na kafelki"
                  : "Zmień widok budżetu na tabelę"
              }
              onPress={toggleBudgetLayout}
              style={styles.budgetLayoutButton}
            >
              {budgetLayout === "table" ? (
                <ViewGrid color={theme.colors.primaryDark} size={20} />
              ) : (
                <TableLarge color={theme.colors.primaryDark} size={20} />
              )}
            </IconButton>
            {canDelete ? (
              <IconButton
                accessibilityLabel="Usuń wybrany miesiąc budżetu"
                disabled={!canRemoveSelectedMonth}
                onPress={() => setDeleteMonthConfirmVisible(true)}
                style={styles.monthDeleteButton}
              >
                <Trash2
                  color={canRemoveSelectedMonth ? theme.colors.danger : theme.colors.textSubtle}
                  size={19}
                />
              </IconButton>
            ) : null}
          </View>

          <FinanceSummaryCard
            budgetAmount={budgetAmount}
            currencyCode={currencyCode}
            incomeAmount={Number(scopedTotals.incomeAmount)}
            onIncomePress={() => setFinanceModal("incomeBreakdown")}
            remainingAmount={remainingAmount}
            spentAmount={spentAmount}
          />

          <FinanceFiltersPanel
            categories={categories}
            expanded={financeFiltersExpanded}
            filters={financeFilters}
            onChange={updateFinanceFilters}
            onToggleExpanded={() => setFinanceFiltersExpanded((value) => !value)}
            owners={financeOwnerOptions}
            resultCount={filteredRows.length}
            totalCount={visibleFlatItems.length}
          />

          {budgetLayout === "table" ? (
            <FinanceSheet
              canCreateExpense={canCreateVisibleExpense}
              canCreateItem={canEditVisibleMonth}
              canUpdate={canEditVisibleMonth}
              categories={filteredCategories}
              currencyCode={currencyCode}
              onAddCategoryItem={openItemModalForCategory}
              onAddExpense={openExpenseModalForItem}
              onEdit={openEditBudgetItem}
              onHistory={openExpenseHistory}
              rows={filteredRows}
            />
          ) : (
            <FinanceCategoryCards
              canCreateExpense={canCreateVisibleExpense}
              canCreateItem={canEditVisibleMonth}
              canUpdate={canEditVisibleMonth}
              categories={filteredCategories}
              currencyCode={currencyCode}
              onAddCategoryItem={openItemModalForCategory}
              onAddExpense={openExpenseModalForItem}
              onEdit={openEditBudgetItem}
              onHistory={openExpenseHistory}
              rows={filteredRows}
              scrollRef={screenScrollRef}
            />
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>RAZEM</Text>
            <Text style={styles.totalValue}>{formatMoney(budgetAmount, currencyCode)}</Text>
            <Text style={styles.totalValue}>{formatMoney(spentAmount, currencyCode)}</Text>
            <Text style={[styles.totalValue, remainingAmount < 0 && styles.dangerText]}>
              {formatMoney(remainingAmount, currencyCode)}
            </Text>
          </View>

          {canRead ? (
            <Pressable onPress={() => setFinanceModal("menu")} style={styles.fab}>
              <Plus color={theme.colors.card} size={25} />
            </Pressable>
          ) : null}

          <FormModal
            onClose={closeFinanceModal}
            subtitle="Zmień układ tabeli albo wybierz, co chcesz dopisać do finansów."
            title="Menu finansów"
            visible={financeModal === "menu"}
          >
            <View style={styles.actionPicker}>
              <ActionButton
                onPress={toggleBudgetLayout}
                title={budgetLayout === "table" ? "Układ: kafelki" : "Układ: tabela"}
                variant="secondary"
              />
              {canUpdate ? (
                <ActionButton onPress={() => setFinanceModal("income")} title="Zmień dochód" variant="secondary" />
              ) : null}
              {canCreate ? (
                <>
                  <ActionButton onPress={() => setFinanceModal("category")} title="Dodaj kategorię" variant="secondary" />
                  <ActionButton onPress={() => setFinanceModal("month")} title="Dodaj miesiąc" variant="secondary" />
                  <ActionButton
                    onPress={() => {
                      setEditingBudgetItem(null);
                      setValue("itemName", "");
                      setValue("itemAmount", "");
                      setFinanceModal("item");
                    }}
                    title="Dodaj pozycję budżetu"
                  />
                  <ActionButton onPress={openExpenseModal} title="Dodaj wydatek" variant="secondary" />
                  <ActionButton
                    disabled={nextMonthMutation.isPending}
                    loading={nextMonthMutation.isPending}
                    onPress={() => nextMonthMutation.mutate()}
                    title="Wygeneruj kolejny miesiąc"
                    variant="ghost"
                  />
                </>
              ) : null}
              {canDelete ? (
                <ActionButton
                  disabled={!canRemoveSelectedMonth}
                  onPress={() => setDeleteMonthConfirmVisible(true)}
                  title="Usuń wybrany miesiąc"
                  variant="ghost"
                />
              ) : null}
              {deleteMonthMutation.error ? (
                <InlineAlert tone="error" text="Nie udało się usunąć miesiąca." />
              ) : null}
            </View>
          </FormModal>

          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canCreateMonth}
                  loading={createMonthMutation.isPending}
                  onPress={() => createMonthMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Dodaj"
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle="Struktura pozycji zostanie skopiowana z wybranego miesiąca bez kwot."
            title="Dodaj miesiąc"
            visible={financeModal === "month"}
          >
            <TextField
              control={control}
              label="Miesiąc"
              name="monthInput"
              placeholder="YYYY-MM"
            />
            {createMonthMutation.error ? (
              <InlineAlert tone="error" text="Podaj miesiąc w formacie YYYY-MM, który jeszcze nie istnieje." />
            ) : null}
          </FormModal>

          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={() => setDeleteMonthConfirmVisible(false)}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canRemoveSelectedMonth}
                  loading={deleteMonthMutation.isPending}
                  onPress={() => deleteMonthMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Usuń"
                />
              </View>
            }
            onClose={() => setDeleteMonthConfirmVisible(false)}
            subtitle={
              selectedMonth
                ? `${formatMonthLong(selectedMonth)} zostanie usunięty wraz z wpisami budżetu.`
                : "Wybierz miesiąc budżetu."
            }
            title="Usuń miesiąc"
            visible={deleteMonthConfirmVisible}
          >
            <View style={styles.deleteWarning}>
              <Trash2 color={theme.colors.danger} size={18} />
              <Text style={styles.deleteWarningText}>
                Ta akcja usuwa miesiąc budżetowy, jego pozycje, dochody i wydatki. Jeśli usuwasz aktualny miesiąc,
                poprzedni miesiąc wróci jako aktywny.
              </Text>
            </View>
          </FormModal>

          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canSaveIncome}
                  loading={incomeMutation.isPending}
                  onPress={() => incomeMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Zapisz"
                />
              </View>
            }
            onClose={() => setFinanceModal(null)}
            subtitle="Wybierz domownika i zapisz jego miesięczny dochód."
            title="Zapisz dochód"
            visible={financeModal === "income"}
          >
            <ChoiceSelector
              emptyText="Brak osób do wyboru."
              items={incomes.map((income) => ({
                id: income.ownerMemberId,
                label: income.displayName,
              }))}
              onSelect={setSelectedIncomeMemberId}
              selectedId={selectedIncomeMemberId}
            />
            <TextField
              control={control}
              keyboardType="decimal-pad"
              label="Kwota dochodu"
              name="incomeAmount"
              placeholder="0,00"
            />
            {incomeMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się zapisać dochodu." />
            ) : null}
          </FormModal>

          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canSaveCategory}
                  loading={categoryMutation.isPending}
                  onPress={() => categoryMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Dodaj"
                />
              </View>
            }
            onClose={() => setFinanceModal(null)}
            subtitle="Kategorie porządkują budżet i mogą przechodzić na następny miesiąc."
            title="Dodaj kategorię"
            visible={financeModal === "category"}
          >
            <TextField
              control={control}
              label="Nazwa kategorii"
              name="categoryName"
              placeholder="Np. rachunki"
            />
            <View style={styles.switchRow}>
              <Text style={styles.muted}>Kopiuj pozycje do kolejnego miesiąca</Text>
              <Switch
                onValueChange={setCopyCategory}
                thumbColor={theme.colors.card}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
                value={copyCategory}
              />
            </View>
            {categoryMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się dodać kategorii." />
            ) : null}
          </FormModal>

          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={editingBudgetItem ? !canSaveEditedItem : !canSaveItem}
                  loading={editingBudgetItem ? updateItemMutation.isPending : itemMutation.isPending}
                  onPress={() => (editingBudgetItem ? updateItemMutation.mutate() : itemMutation.mutate())}
                  style={styles.modalFooterButton}
                  title={editingBudgetItem ? "Zapisz" : "Dodaj"}
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle={editingBudgetItem ? "Zmieniasz nazwę, osobę, kategorię albo limit tej pozycji." : "Pozycja to konkretny limit lub koszt w aktualnym miesiącu."}
            title={editingBudgetItem ? "Edytuj pozycję budżetu" : "Dodaj pozycję budżetu"}
            visible={financeModal === "item"}
          >
            <TextField
              control={control}
              label="Nazwa pozycji"
              name="itemName"
              placeholder="Np. czynsz"
            />
            <TextField
              control={control}
              keyboardType="decimal-pad"
              label="Planowana kwota"
              name="itemAmount"
              placeholder="Opcjonalnie"
            />
            <ChoiceSelector
              emptyText="Brak kategorii do wyboru."
              items={(categoriesQuery.data ?? categories).map((category) => ({
                id: category.id,
                label: category.name,
              }))}
              onSelect={setSelectedItemCategoryId}
              selectedId={selectedItemCategoryId}
            />
            <ChoiceSelector
              emptyText="Brak właścicieli do wyboru."
              items={incomes.map((income) => ({
                id: income.ownerMemberId,
                label: income.displayName,
              }))}
              onSelect={setSelectedItemOwnerId}
              selectedId={selectedItemOwnerId}
            />
            {editingBudgetItem && canDeleteVisibleMonthItems ? (
              <ActionButton
                disabled={deleteItemMutation.isPending}
                loading={deleteItemMutation.isPending}
                onPress={() => {
                  deleteItemMutation.mutate(editingBudgetItem.id, {
                    onSuccess: () => closeFinanceModal(),
                  });
                }}
                title="Usun pozycje"
                variant="ghost"
              />
            ) : null}
            {deleteItemMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się usunąć pozycji." />
            ) : null}
            {itemMutation.error || updateItemMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się zapisać pozycji." />
            ) : null}
          </FormModal>

          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canSaveExpense}
                  loading={expenseMutation.isPending}
                  onPress={() => expenseMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Dodaj"
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle={
              isPresetExpense
                ? "Kategoria jest już wybrana. Wpisz tylko kwotę wydatku."
                : "Najpierw wybierz osobę, potem kategorię, pozycję i kwotę."
            }
            title="Dodaj wydatek"
            visible={financeModal === "expense"}
          >
            {isPresetExpense ? (
              <View style={styles.expenseContextCard}>
                <Text style={styles.expenseContextLabel}>
                  {selectedExpenseItem ? formatOwner(selectedExpenseItem.owner) : selectedExpenseOwner?.label}
                </Text>
                <Text style={styles.expenseContextTitle}>
                  {selectedExpenseItem?.name ?? selectedExpenseCategory?.name}
                </Text>
                <Text style={styles.expenseContextMeta}>
                  {selectedExpenseCategory?.name}
                  {selectedExpenseItem
                    ? ` / wydano ${formatMoney(selectedExpenseItem.spentAmount, currencyCode)} z ${
                        selectedExpenseItem.budgetAmount
                          ? formatMoney(selectedExpenseItem.budgetAmount, currencyCode)
                          : "bez limitu"
                      }`
                    : " / pozycja powstanie automatycznie"}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.selectorGroup}>
                  <Text style={styles.selectorLabel}>Osoba</Text>
                  <ChoiceSelector
                    emptyText="Brak osób z pozycjami budżetu."
                    items={expenseOwnerOptions}
                    onSelect={(ownerId) => {
                      setSelectedExpenseOwnerId(ownerId);
                      setSelectedExpenseCategoryId("");
                      setSelectedExpenseItemId("");
                    }}
                    selectedId={selectedExpenseOwnerId}
                  />
                </View>
                {selectedExpenseOwnerId ? (
                  <View style={styles.selectorGroup}>
                    <Text style={styles.selectorLabel}>Kategoria</Text>
                    <ChoiceSelector
                      emptyText="Ta osoba nie ma kategorii z pozycjami budżetu."
                      items={expenseCategoryOptions.map((option) => ({
                        id: option.category.id,
                        label: option.category.name,
                      }))}
                      onSelect={(categoryId) => {
                        setSelectedExpenseCategoryId(categoryId);
                        setSelectedExpenseItemId("");
                      }}
                      selectedId={selectedExpenseCategoryId}
                    />
                  </View>
                ) : null}
                {selectedExpenseCategoryId ? (
                  <View style={styles.selectorGroup}>
                    <Text style={styles.selectorLabel}>Pozycja</Text>
                    <ChoiceSelector
                      emptyText="Ta kategoria nie ma pozycji dla wybranej osoby."
                      items={expenseItems.map((item) => ({
                        id: item.id,
                        label: item.name,
                      }))}
                      onSelect={setSelectedExpenseItemId}
                      selectedId={selectedExpenseItemId}
                    />
                  </View>
                ) : null}
              </>
            )}
            {selectedExpenseItem || isQuickCategoryExpense ? (
              <TextField
                control={control}
                keyboardType="decimal-pad"
                label="Kwota wydatku"
                name="expenseAmount"
                placeholder="0,00"
              />
            ) : null}
            {expenseMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się dodać wydatku." />
            ) : null}
          </FormModal>

          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Zamknij"
                  variant="secondary"
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle={historyBudgetItem ? `${historyBudgetItem.category.name} / ${historyBudgetItem.name}` : undefined}
            title="Historia wpłat"
            visible={financeModal === "expenseHistory"}
          >
            {historyBudgetItem ? (
              <View style={styles.selectorGroup}>
                <View style={styles.expenseHistorySummary}>
                  <View>
                    <Text style={styles.expenseContextLabel}>Wydano</Text>
                    <Text style={styles.expenseHistorySummaryValue}>
                      {formatMoney(historyBudgetItem.spentAmount, currencyCode)}
                    </Text>
                  </View>
                  <View style={styles.expenseHistorySummarySide}>
                    <Text style={styles.expenseContextMeta}>
                      Budżet{" "}
                      {historyBudgetItem.budgetAmount
                        ? formatMoney(historyBudgetItem.budgetAmount, currencyCode)
                        : "bez limitu"}
                    </Text>
                    <Text
                      style={[
                        styles.expenseContextMeta,
                        Number(historyBudgetItem.remainingAmount ?? 0) < 0 && styles.dangerText,
                        Number(historyBudgetItem.remainingAmount ?? 0) >= 0 && styles.positiveText,
                      ]}
                    >
                      Zostaje{" "}
                      {historyBudgetItem.budgetAmount
                        ? formatMoney(historyBudgetItem.remainingAmount ?? 0, currencyCode)
                        : "bez limitu"}
                    </Text>
                  </View>
                </View>
                {historyExpenses.length > 0 ? (
                  <View style={styles.expenseHistoryList}>
                    {historyExpenses.map((expense) => (
                      <View key={expense.id} style={styles.expenseHistoryRow}>
                        <View style={styles.expenseHistoryText}>
                          <Text style={styles.expenseHistoryTitle}>Wpis</Text>
                          <Text style={styles.expenseHistoryMeta}>
                            {formatDateTimeFull(expense.createdAt)}
                          </Text>
                        </View>
                        <Text style={styles.expenseHistoryAmount}>
                          {formatMoney(expense.amount, currencyCode)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <InlineAlert text="Brak wpłat dla tej pozycji." />
                )}
              </View>
            ) : (
              <InlineAlert text="Nie znaleziono wybranej pozycji budżetu." />
            )}
          </FormModal>

          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Później"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canSaveCopyAmounts}
                  loading={copyAmountsMutation.isPending}
                  onPress={() => copyAmountsMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Zapisz kwoty"
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle="Pozycje zostały skopiowane bez kwot. Wpisz tylko te limity, które znasz."
            title="Kwoty nowego miesiąca"
            visible={financeModal === "copyAmounts"}
          >
            <View style={styles.copyAmountList}>
              {copiedMonthItems.map((item) => (
                <View key={item.id} style={styles.copyAmountRow}>
                  <View style={styles.copyAmountText}>
                    <Text numberOfLines={1} style={styles.copyAmountTitle}>
                      {item.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.copyAmountMeta}>
                      {item.category.name} / {formatOwner(item.owner)}
                    </Text>
                  </View>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setCopyAmountInputs((current) => ({ ...current, [item.id]: value }))
                    }
                    placeholder="0,00"
                    placeholderTextColor={theme.colors.textSubtle}
                    style={styles.copyAmountInput}
                    value={copyAmountInputs[item.id] ?? ""}
                  />
                </View>
              ))}
            </View>
            {copyAmountsMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się zapisać kwot nowego miesiąca." />
            ) : null}
          </FormModal>
        </>
      ) : null}

      {activeFinanceView === "debts" ? (
        <>
          <View style={styles.debtSummary}>
            <View>
              <Text style={styles.debtSummaryLabel}>Do oddania</Text>
              <Text style={styles.debtSummaryValue}>{formatMoney(openDebtTotal, currencyCode)}</Text>
            </View>
            <Text style={styles.debtSummaryMeta}>
              {openDebts.length} aktywne / {settledDebts.length} spłacone
            </Text>
          </View>
          <QueryState
            emptyText="Brak pożyczek i debetów."
            error={debtsQuery.error}
            isEmpty={!debtsQuery.isLoading && debts.length === 0}
            isLoading={debtsQuery.isLoading}
          />
          <FinanceDebtsList
            canDelete={canDelete}
            canUpdate={canUpdate}
            currencyCode={currencyCode}
            deleting={deleteDebtMutation.isPending}
            debts={debts}
            onDelete={(debt) => deleteDebtMutation.mutate(debt.id)}
            onEdit={openEditDebt}
            onToggleSettled={(debt) => settleDebtMutation.mutate(debt)}
            updating={settleDebtMutation.isPending}
          />
          {canCreate ? (
            <Pressable onPress={openCreateDebt} style={styles.fab}>
              <Plus color={theme.colors.card} size={25} />
            </Pressable>
          ) : null}
          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canSaveDebt}
                  loading={saveDebtMutation.isPending}
                  onPress={() => saveDebtMutation.mutate()}
                  style={styles.modalFooterButton}
                  title={editingDebt ? "Zapisz" : "Dodaj"}
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle="Ta lista jest poza miesięcznym budżetem i nie wpływa na podsumowania."
            title={editingDebt ? "Edytuj pożyczkę" : "Dodaj pożyczkę/debet"}
            visible={financeModal === "debt"}
          >
            <TextField control={control} keyboardType="decimal-pad" label="Kwota" name="debtAmount" placeholder="0,00" />
            <TextField control={control} label="Od kogo" name="debtLenderName" placeholder="Np. rodzice, znajomy, bank" />
            <TextField control={control} label="Na co" name="debtPurpose" placeholder="Np. naprawa auta" />
            <TextField control={control} label="Termin oddania" name="debtDueDate" placeholder="YYYY-MM-DD, opcjonalnie" />
            <TextField control={control} label="Notatka" name="debtNote" placeholder="Opcjonalnie" />
            {saveDebtMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się zapisać pożyczki." />
            ) : null}
          </FormModal>
        </>
      ) : null}

      {activeFinanceView === "savings" ? (
        <>
          <View style={styles.debtSummary}>
            <View style={styles.savingsSummaryTitle}>
              <PiggyBank color={theme.colors.primaryDark} size={20} />
              <View>
                <Text style={styles.debtSummaryLabel}>Oszczędności domu</Text>
                <Text style={[styles.debtSummaryValue, styles.savingsSummaryValue]}>
                  {formatMoney(savingsTotal, currencyCode)}
                </Text>
              </View>
            </View>
            <Text style={styles.debtSummaryMeta}>{savings.length} pozycji</Text>
          </View>
          <QueryState
            emptyText="Brak zapisanych oszczędności."
            error={savingsQuery.error}
            isEmpty={!savingsQuery.isLoading && savings.length === 0}
            isLoading={savingsQuery.isLoading}
          />
          <FinanceSavingsList
            accounts={savings}
            canDelete={canDelete}
            canUpdate={canUpdate}
            currencyCode={currencyCode}
            deleting={deleteSavingsAccountMutation.isPending}
            onDelete={(account) => deleteSavingsAccountMutation.mutate(account.id)}
            onTransaction={openSavingsTransaction}
            updating={savingsTransactionMutation.isPending}
          />
          {canCreate ? (
            <Pressable onPress={openCreateSavingsAccount} style={styles.fab}>
              <Plus color={theme.colors.card} size={25} />
            </Pressable>
          ) : null}
          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canSaveSavingsAccount}
                  loading={savingsAccountMutation.isPending}
                  onPress={() => savingsAccountMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Dodaj"
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle="Pozycja będzie widoczna dla wszystkich domowników."
            title="Dodaj oszczędności"
            visible={financeModal === "savingsAccount"}
          >
            <TextField control={control} label="Nazwa" name="savingsName" placeholder="Np. Poduszka finansowa" />
            <TextField control={control} keyboardType="decimal-pad" label="Kwota" name="savingsAmount" placeholder="0,00" />
            <TextField control={control} label="Notatka" name="savingsNote" placeholder="Opcjonalnie" />
            {savingsAccountMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się dodać oszczędności." />
            ) : null}
          </FormModal>
          <FormModal
            footer={
              <View style={styles.modalFooter}>
                <ActionButton
                  onPress={closeFinanceModal}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canSaveSavingsTransaction}
                  loading={savingsTransactionMutation.isPending}
                  onPress={() => savingsTransactionMutation.mutate()}
                  style={styles.modalFooterButton}
                  title={savingsDirection === "add" ? "Dodaj" : "Odejmij"}
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle={
              selectedSavingsAccount
                ? `${selectedSavingsAccount.name} / obecnie ${formatMoney(selectedSavingsAccount.currentAmount, currencyCode)}`
                : undefined
            }
            title={savingsDirection === "add" ? "Dodaj do oszczędności" : "Odejmij z oszczędności"}
            visible={financeModal === "savingsTransaction"}
          >
            <TextField
              control={control}
              keyboardType="decimal-pad"
              label="Kwota"
              name="savingsTransactionAmount"
              placeholder="0,00"
            />
            <TextField
              control={control}
              label="Notatka"
              name="savingsTransactionNote"
              placeholder="Opcjonalnie"
            />
            {savingsTransactionMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się zapisać zmiany oszczędności." />
            ) : null}
          </FormModal>
        </>
      ) : null}
      <FormModal
        onClose={closeFinanceModal}
        subtitle="Podgląd dochodów i budżetu w wybranym miesiącu."
        title="Dochody domowników"
        visible={financeModal === "incomeBreakdown"}
      >
        <IncomeBreakdownList
          currencyCode={currencyCode}
          rows={personSummaries}
          selectedOwnerMemberId={financeFilters.ownerMemberId}
          totals={totals}
        />
        {canUpdate ? (
          <ActionButton onPress={() => setFinanceModal("income")} title="Zmień dochód" variant="secondary" />
        ) : null}
      </FormModal>
    </AppScreen>
  );
}

function FinanceSummaryCard({
  budgetAmount,
  currencyCode,
  incomeAmount,
  onIncomePress,
  remainingAmount,
  spentAmount,
}: {
  budgetAmount: number;
  currencyCode: SupportedCurrencyCode;
  incomeAmount: number;
  onIncomePress: () => void;
  remainingAmount: number;
  spentAmount: number;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const ringBase = Math.max(incomeAmount, budgetAmount, spentAmount, 1);
  const spentRatio = Math.max(0, Math.min(spentAmount / ringBase, 1));

  return (
    <View style={styles.financeSummaryCard}>
      <Pressable
        accessibilityLabel="Dochody domowników"
        accessibilityRole="button"
        onPress={onIncomePress}
        style={({ pressed }) => [styles.financeSummarySide, pressed && styles.metricPressed]}
      >
        <View style={styles.financeSummaryLabelRow}>
          <Banknote color="#8CE1BF" size={16} />
          <Text style={[styles.financeSummaryLabel, { color: "#8CE1BF" }]}>Dochody</Text>
        </View>
        <Text numberOfLines={1} style={styles.financeSummaryValue}>
          {formatMoney(incomeAmount, currencyCode)}
        </Text>
      </Pressable>

      <View style={styles.financeSummaryCenter}>
        <FinanceSummaryRing spentRatio={spentRatio} />
        <View pointerEvents="none" style={styles.financeSummaryCenterText}>
          <Text numberOfLines={1} style={[styles.financeSummaryRingValue, remainingAmount < 0 && styles.dangerText]}>
            {formatMoney(remainingAmount, currencyCode)}
          </Text>
          <Text style={styles.financeSummaryRingLabel}>zostało</Text>
        </View>
      </View>

      <View style={styles.financeSummarySide}>
        <View style={styles.financeSummaryLabelRow}>
          <ReceiptText color="#FFAD6F" size={16} />
          <Text style={[styles.financeSummaryLabel, { color: "#FFAD6F" }]}>Wydatki</Text>
        </View>
        <Text numberOfLines={1} style={styles.financeSummaryValue}>
          {formatMoney(spentAmount, currencyCode)}
        </Text>
      </View>

      <View style={styles.financeSummaryBudgetPill}>
        <WalletCards color={theme.colors.textMuted} size={14} />
        <Text numberOfLines={1} style={styles.financeSummaryBudgetText}>
          Budżet {formatMoney(budgetAmount, currencyCode)}
        </Text>
      </View>
    </View>
  );
}

function FinanceSummaryRing({ spentRatio }: { spentRatio: number }) {
  const styles = createStyles(useAppTheme().colors);
  const segmentCount = 28;
  const spentSegments = Math.round(spentRatio * segmentCount);

  return (
    <View style={styles.financeSummaryRing}>
      {Array.from({ length: segmentCount }).map((_, index) => {
        const angle = (360 / segmentCount) * index;
        const isSpent = index < spentSegments;

        return (
          <View
            key={index}
            style={[
              styles.financeSummaryRingSegment,
              {
                backgroundColor: isSpent ? "#FFA45D" : "#79CDB0",
                transform: [{ rotate: `${angle}deg` }, { translateY: -35 }],
              },
            ]}
          />
        );
      })}
      <View style={styles.financeSummaryRingInner} />
    </View>
  );
}

function IncomeBreakdownList({
  currencyCode,
  rows,
  selectedOwnerMemberId,
  totals,
}: {
  currencyCode: SupportedCurrencyCode;
  rows: PersonFinanceSummary[];
  selectedOwnerMemberId: string;
  totals: FinanceTotalSummary | undefined;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const total = totals ?? emptyFinanceTotals;

  if (rows.length === 0) {
    return <InlineAlert text="Brak dochodów w tym miesiącu." />;
  }

  return (
    <View style={styles.incomeBreakdownList}>
      {rows.map((row) => {
        const isSelected = selectedOwnerMemberId === row.ownerMemberId;

        return (
          <View
            key={row.ownerMemberId}
            style={[styles.incomeBreakdownRow, isSelected && styles.incomeBreakdownRowActive]}
          >
            <View style={styles.incomeBreakdownText}>
              <Text numberOfLines={1} style={styles.incomeBreakdownName}>
                {row.displayName || row.email}
              </Text>
              <Text style={styles.incomeBreakdownMeta}>
                Budżet {formatMoney(row.totalBudgetAmount, currencyCode)} / wydano{" "}
                {formatMoney(row.totalSpentAmount, currencyCode)} / zostaje{" "}
                {formatMoney(row.totalRemainingAmount, currencyCode)}
              </Text>
            </View>
            <Text style={styles.incomeBreakdownValue}>{formatMoney(row.incomeAmount, currencyCode)}</Text>
          </View>
        );
      })}
      <View style={styles.incomeBreakdownTotal}>
        <Text style={styles.totalLabel}>RAZEM DOM</Text>
        <Text style={styles.totalValue}>{formatMoney(total.incomeAmount, currencyCode)}</Text>
      </View>
    </View>
  );
}

function FinanceDebtsList({
  canDelete,
  canUpdate,
  currencyCode,
  debts,
  deleting,
  onDelete,
  onEdit,
  onToggleSettled,
  updating,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  currencyCode: SupportedCurrencyCode;
  debts: FinanceDebt[];
  deleting: boolean;
  onDelete: (debt: FinanceDebt) => void;
  onEdit: (debt: FinanceDebt) => void;
  onToggleSettled: (debt: FinanceDebt) => void;
  updating: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  if (debts.length === 0) {
    return null;
  }

  return (
    <View style={styles.debtList}>
      {debts.map((debt) => (
        <View key={debt.id} style={[styles.debtCard, debt.isSettled && styles.debtCardSettled]}>
          <View style={styles.debtCardText}>
            <Text numberOfLines={1} style={[styles.debtTitle, debt.isSettled && styles.debtSettledText]}>
              {debt.purpose}
            </Text>
            <Text style={styles.debtMeta}>
              {debt.lenderName}
              {debt.dueDate ? ` / do ${formatDateShort(debt.dueDate)}` : ""}
            </Text>
            {debt.note ? <Text style={styles.debtNote}>{debt.note}</Text> : null}
          </View>
          <View style={styles.debtSide}>
            <Text style={[styles.debtAmount, debt.isSettled && styles.debtSettledText]}>
              {formatMoney(debt.amount, currencyCode)}
            </Text>
            <View style={styles.debtActions}>
              {canUpdate ? (
                <ActionButton
                  disabled={updating}
                  onPress={() => onToggleSettled(debt)}
                  size="small"
                  title={debt.isSettled ? "Cofnij" : "Spłacone"}
                  variant={debt.isSettled ? "secondary" : "primary"}
                />
              ) : null}
              {canUpdate ? (
                <IconButton accessibilityLabel="Edytuj pożyczkę" onPress={() => onEdit(debt)}>
                  <Pencil color={theme.colors.textMuted} size={15} />
                </IconButton>
              ) : null}
              {canDelete ? (
                <IconButton
                  accessibilityLabel="Usuń pożyczkę"
                  disabled={deleting}
                  onPress={() => onDelete(debt)}
                >
                  <Trash2 color={theme.colors.danger} size={15} />
                </IconButton>
              ) : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function FinanceSavingsList({
  accounts,
  canDelete,
  canUpdate,
  currencyCode,
  deleting,
  onDelete,
  onTransaction,
  updating,
}: {
  accounts: FinanceSavingsAccount[];
  canDelete: boolean;
  canUpdate: boolean;
  currencyCode: SupportedCurrencyCode;
  deleting: boolean;
  onDelete: (account: FinanceSavingsAccount) => void;
  onTransaction: (account: FinanceSavingsAccount, direction: FinanceSavingsDirection) => void;
  updating: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  if (accounts.length === 0) {
    return null;
  }

  return (
    <View style={styles.debtList}>
      {accounts.map((account) => {
        const recentTransactions = account.transactions.slice(0, 3);

        return (
          <View key={account.id} style={styles.savingsCard}>
            <View style={styles.savingsCardHeader}>
              <View style={styles.debtCardText}>
                <Text numberOfLines={1} style={styles.debtTitle}>
                  {account.name}
                </Text>
                <Text style={styles.debtMeta}>
                  Ostatnia zmiana: {formatDateFull(account.lastChangedAt)}
                </Text>
              </View>
              <View style={styles.debtSide}>
                <Text style={styles.savingsAmount}>{formatMoney(account.currentAmount, currencyCode)}</Text>
                <View style={styles.debtActions}>
                  {canUpdate ? (
                    <>
                      <IconButton
                        accessibilityLabel="Dodaj do oszczędności"
                        disabled={updating}
                        onPress={() => onTransaction(account, "add")}
                        style={styles.savingsIconButton}
                      >
                        <Plus color={theme.colors.primaryDark} size={16} />
                      </IconButton>
                      <IconButton
                        accessibilityLabel="Odejmij z oszczędności"
                        disabled={updating}
                        onPress={() => onTransaction(account, "subtract")}
                        style={styles.savingsIconButton}
                      >
                        <Minus color={theme.colors.danger} size={16} />
                      </IconButton>
                    </>
                  ) : null}
                  {canDelete ? (
                    <IconButton
                      accessibilityLabel="Usuń oszczędności"
                      disabled={deleting}
                      onPress={() => onDelete(account)}
                    >
                      <Trash2 color={theme.colors.danger} size={15} />
                    </IconButton>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.savingsHistory}>
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction) => (
                  <View key={transaction.id} style={styles.savingsTransactionRow}>
                    <Text
                      style={[
                        styles.savingsDelta,
                        transaction.direction === "add" ? styles.savingsDeltaAdd : styles.savingsDeltaSubtract,
                      ]}
                    >
                      {transaction.direction === "add" ? "+" : "-"}{formatMoney(transaction.amount, currencyCode)}
                    </Text>
                    <Text numberOfLines={1} style={styles.savingsTransactionMeta}>
                      {formatDateFull(transaction.changedAt)}
                      {transaction.note ? ` / ${transaction.note}` : ""}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.savingsTransactionMeta}>Brak historii zmian.</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function FinanceFiltersPanel({
  categories,
  expanded,
  filters,
  onChange,
  onToggleExpanded,
  owners,
  resultCount,
  totalCount,
}: {
  categories: BudgetCategoryWithItems[];
  expanded: boolean;
  filters: FinanceFilters;
  onChange: (filters: Partial<FinanceFilters>) => void;
  onToggleExpanded: () => void;
  owners: Array<{ id: string; label: string }>;
  resultCount: number;
  totalCount: number;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const summary = describeFinanceFilters(filters, resultCount, totalCount);

  return (
    <View style={styles.filterPanel}>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Widok budżetu</Text>
        <Text style={styles.filterCount}>{resultCount}/{totalCount}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onToggleExpanded} style={styles.filterToggleButton}>
        <Text numberOfLines={1} style={styles.filterSummary}>
          {summary}
        </Text>
        <Text style={styles.filterToggle}>{expanded ? "Zwin" : "Rozwin"}</Text>
      </Pressable>
      {expanded ? (
        <>
      <TextInput
        onChangeText={(search) => onChange({ search })}
        placeholder="Szukaj pozycji"
        placeholderTextColor={theme.colors.textSubtle}
        style={styles.filterInput}
        value={filters.search}
      />
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Osoba</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterChipRow}>
            <FilterChip active={!filters.ownerMemberId} label="Wszyscy" onPress={() => onChange({ ownerMemberId: "" })} />
            {owners.map((owner) => (
              <FilterChip
                active={filters.ownerMemberId === owner.id}
                key={owner.id}
                label={owner.label}
                onPress={() => onChange({ ownerMemberId: owner.id })}
              />
            ))}
          </View>
        </ScrollView>
      </View>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Kategoria</Text>
        <View style={[styles.filterChipRow, styles.filterCategoryGrid]}>
          <FilterChip
            active={!filters.categoryId}
            compact
            label="Wszystkie"
            onPress={() => onChange({ categoryId: "" })}
          />
          {categories.map((category) => (
            <FilterChip
              active={filters.categoryId === category.id}
              compact
              key={category.id}
              label={category.name}
              onPress={() => onChange({ categoryId: category.id })}
            />
          ))}
        </View>
      </View>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Sortowanie</Text>
        <View style={styles.filterChipRow}>
          {financeSortOptions.map((option) => (
            <FilterChip
              active={filters.sortBy === option.id}
              key={option.id}
              label={option.label}
              onPress={() => onChange({ sortBy: option.id })}
            />
          ))}
          <FilterChip
            active={filters.sortDirection === "desc"}
            label={filters.sortDirection === "asc" ? "Rosnąco" : "Malejąco"}
            onPress={() =>
              onChange({ sortDirection: filters.sortDirection === "asc" ? "desc" : "asc" })
            }
          />
          <FilterChip
            active={filters.onlyOverBudget}
            label="Po limicie"
            onPress={() => onChange({ onlyOverBudget: !filters.onlyOverBudget })}
          />
        </View>
      </View>
        </>
      ) : null}
    </View>
  );
}

function FilterChip({
  active,
  compact = false,
  label,
  onPress,
}: {
  active: boolean;
  compact?: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        compact && styles.filterChipCompact,
        active && styles.filterChipActive,
      ]}
    >
      <Text numberOfLines={1} style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FinanceSheet({
  canCreateExpense,
  canCreateItem,
  canUpdate,
  categories,
  currencyCode,
  onAddCategoryItem,
  onAddExpense,
  onEdit,
  onHistory,
  rows,
}: {
  canCreateExpense: boolean;
  canCreateItem: boolean;
  canUpdate: boolean;
  categories: BudgetCategoryWithItems[];
  currencyCode: SupportedCurrencyCode;
  onAddCategoryItem: (category: BudgetCategoryWithItems) => void;
  onAddExpense: (item: BudgetItemWithCategory) => void;
  onEdit: (item: BudgetItemWithCategory) => void;
  onHistory: (item: BudgetItemWithCategory) => void;
  rows: BudgetItemWithCategory[];
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(() => new Set());

  if (rows.length === 0 && categories.length === 0) {
    return <InlineAlert text="Brak pozycji pasujących do filtrów." />;
  }

  const groups = groupRowsByCategory(rows, categories);

  function toggleCategory(categoryId: string) {
    setCollapsedCategoryIds((current) => {
      const next = new Set(current);

      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }

      return next;
    });
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sheetScroller}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.headerCell, styles.personCell]}>Osoba</Text>
          <Text style={[styles.headerCell, styles.categoryCell]}>Pozycja</Text>
          <Text style={styles.amountHeaderCell}>Budżet</Text>
          <Text style={styles.amountHeaderCell}>Wydano</Text>
          <Text style={styles.amountHeaderCell}>Zostaje</Text>
          <Text style={styles.actionHeaderCell}>Akcje</Text>
        </View>
        {groups.map((group, index) => {
          const accent = getCategoryAccent(index);
          const collapsed = collapsedCategoryIds.has(group.category.id);

          return (
          <View key={group.category.id}>
            <View style={[styles.categoryRow, { backgroundColor: theme.colors.cardMuted, borderTopColor: accent.border }]}>
              <View style={styles.categoryRowMain}>
                <View style={[styles.categoryColorBar, { backgroundColor: accent.color }]} />
                <View style={styles.categoryRowTitleBlock}>
                  <Text style={[styles.categoryRowText, { color: accent.text }]}>
                    {group.category.name.toUpperCase()}
                  </Text>
                  <Text style={styles.categoryRowMeta}>
                    {group.items.length} pozycji / {formatMoney(group.spent, currencyCode)} z{" "}
                    {formatMoney(group.planned, currencyCode)}
                  </Text>
                </View>
              </View>
              <View style={styles.categoryToggleCell}>
                <Pressable
                  accessibilityLabel={collapsed ? "Rozwiń kategorię" : "Zwiń kategorię"}
                  accessibilityRole="button"
                  onPress={() => toggleCategory(group.category.id)}
                  style={styles.categoryCollapseButton}
                >
                  {collapsed ? (
                    <ChevronRight color={accent.text} size={20} />
                  ) : (
                    <ChevronDown color={accent.text} size={20} />
                  )}
                </Pressable>
              </View>
            </View>
            {collapsed ? null : (
              <>
                {group.items.map((item) => (
                  <View key={item.id} style={styles.sheetRow}>
                    <Pressable
                      accessibilityLabel={`Pokaż historię pozycji ${item.name}`}
                      accessibilityRole="button"
                      onPress={() => onHistory(item)}
                      style={({ pressed }) => [styles.sheetRowContent, pressed && styles.pressedRow]}
                    >
                      <Text numberOfLines={1} style={[styles.bodyCell, styles.personCell]}>
                        {formatOwner(item.owner)}
                      </Text>
                      <Text numberOfLines={1} style={[styles.bodyCell, styles.categoryCell]}>
                        {item.name}
                      </Text>
                      <Text style={styles.amountCell}>{formatMoney(item.budgetAmount, currencyCode)}</Text>
                      <Text style={styles.amountCell}>{formatMoney(item.spentAmount, currencyCode)}</Text>
                      <Text
                        style={[
                          styles.amountCell,
                          Number(item.remainingAmount ?? 0) < 0 && styles.dangerText,
                          Number(item.remainingAmount ?? 0) >= 0 && styles.positiveText,
                        ]}
                      >
                        {item.budgetAmount ? formatMoney(item.remainingAmount ?? 0, currencyCode) : "bez limitu"}
                      </Text>
                    </Pressable>
                    <View style={styles.actionCell}>
                      {canCreateExpense ? (
                        <IconButton
                          accessibilityLabel="Dodaj wydatek"
                          onPress={() => onAddExpense(item)}
                          style={styles.sheetActionButton}
                        >
                          <CartPlus color={theme.colors.primaryDark} size={15} />
                        </IconButton>
                      ) : null}
                      {canUpdate ? (
                        <IconButton
                          accessibilityLabel="Edytuj pozycję"
                          onPress={() => onEdit(item)}
                          style={styles.sheetActionButton}
                        >
                          <Pencil color={theme.colors.textMuted} size={15} />
                        </IconButton>
                      ) : null}
                    </View>
                  </View>
                ))}
                {canCreateItem ? (
                  <View style={[styles.sheetRow, { paddingHorizontal: 12 }]}>
                    <Pressable
                      accessibilityLabel={`Dodaj pozycję w kategorii ${group.category.name}`}
                      accessibilityRole="button"
                      onPress={() => onAddCategoryItem(group.category)}
                      style={{ paddingVertical: 12, alignItems: "flex-start", width: "100%" }}
                    >
                      <Text style={{ color: theme.colors.primaryDark, fontWeight: "600" }}>+ Dodaj pozycję</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}
          </View>
        );
        })}
      </View>
    </ScrollView>
  );
}

function FinanceCategoryCards({
  canCreateExpense,
  canCreateItem,
  canUpdate,
  categories,
  currencyCode,
  onAddCategoryItem,
  onAddExpense,
  onEdit,
  onHistory,
  rows,
  scrollRef,
}: {
  canCreateExpense: boolean;
  canCreateItem: boolean;
  canUpdate: boolean;
  categories: BudgetCategoryWithItems[];
  currencyCode: SupportedCurrencyCode;
  onAddCategoryItem: (category: BudgetCategoryWithItems) => void;
  onAddExpense: (item: BudgetItemWithCategory) => void;
  onEdit: (item: BudgetItemWithCategory) => void;
  onHistory: (item: BudgetItemWithCategory) => void;
  rows: BudgetItemWithCategory[];
  scrollRef: RefObject<ScrollView>;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [detailsY, setDetailsY] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedCategoryId) {
      setDetailsY(null);
      return;
    }

    if (detailsY !== null) {
      const timeout = setTimeout(() => {
        scrollRef.current?.scrollTo({ animated: true, y: Math.max(0, detailsY - 12) });
      }, 80);

      return () => clearTimeout(timeout);
    }
  }, [scrollRef, selectedCategoryId, detailsY]);

  if (rows.length === 0 && categories.length === 0) {
    return <InlineAlert text="Brak pozycji pasujących do filtrów." />;
  }

  const groups = groupRowsByCategory(rows, categories);
  const selectedGroup = groups.find((group) => group.category.id === selectedCategoryId);

  return (
    <View style={styles.categoryCardsSection}>
      <View style={styles.categoryCardGrid}>
        {groups.map((group, index) => {
          const accent = getCategoryAccent(index);
          const active = selectedCategoryId === group.category.id;
          const spentProgress = getBudgetSpentProgress(group);
          const remainingLabel =
            group.remaining >= 0
              ? formatMoney(group.remaining, currencyCode)
              : `-${formatMoney(Math.abs(group.remaining), currencyCode)}`;
          const progressText = group.planned > 0 ? `${Math.round(spentProgress * 100)}%` : "bez limitu";

          return (
            <Pressable
              accessibilityLabel={`Pokaż pozycje kategorii ${group.category.name}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={group.category.id}
              onPress={() => setSelectedCategoryId(active ? null : group.category.id)}
              style={[
                styles.categoryCard,
                active && styles.categoryCardActive,
                active && { borderColor: accent.color, shadowColor: accent.color },
              ]}
            >
              <View style={[styles.categoryCardIcon, { borderColor: accent.color }]}>
                {getBudgetCategoryIcon(group.category.name, accent.color)}
              </View>
              <View style={styles.categoryCardContent}>
                <View style={styles.categoryCardTopLine}>
                  <Text numberOfLines={1} style={styles.categoryCardTitle}>
                    {group.category.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.categoryCardBudget}>
                    {formatMoney(group.planned, currencyCode)}
                  </Text>
                </View>
                <View style={styles.categoryProgressTrack}>
                  <View
                    style={[
                      styles.categoryProgressFill,
                      {
                        backgroundColor: accent.color,
                        width: `${Math.min(spentProgress, 1) * 100}%`,
                      },
                    ]}
                  />
                  <Text style={styles.categoryProgressValue}>{progressText}</Text>
                </View>
              </View>
              <View style={styles.categoryCardRemainingBlock}>
                <Text
                  numberOfLines={1}
                  style={[styles.categoryCardAmount, group.remaining < 0 && styles.dangerText]}
                >
                  {remainingLabel}
                </Text>
                <Text style={styles.categoryCardMeta}>zostaje</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedGroup ? (
        <View onLayout={(e) => setDetailsY(e.nativeEvent.layout.y)} style={styles.categoryDetails}>
          <View style={styles.categoryDetailsHeader}>
            <View style={styles.categoryDetailsHeaderTop}>
              <View style={styles.categoryDetailsTitleBlock}>
                <Text style={styles.categoryDetailsTitle}>{selectedGroup.category.name}</Text>
                <Text style={styles.categoryDetailsMeta}>
                  {selectedGroup.items.length} pozycji / zostaje {formatMoney(selectedGroup.remaining, currencyCode)}
                </Text>
              </View>
              {canCreateItem ? (
                <ActionButton
                  onPress={() => onAddCategoryItem(selectedGroup.category)}
                  size="small"
                  title="Dodaj pozycję"
                  variant="secondary"
                />
              ) : null}
            </View>
          </View>
          {selectedGroup.items.length === 0 ? (
            <InlineAlert text="Ta kategoria nie ma jeszcze pozycji. Dodaj nową pozycję, aby zarządzać wydatkami." />
          ) : selectedGroup.items.map((item) => (
            <Pressable
              accessibilityLabel={`Pokaż historię pozycji ${item.name}`}
              accessibilityRole="button"
              key={item.id}
              onPress={() => onHistory(item)}
              style={({ pressed }) => [styles.categoryDetailsRow, pressed && styles.pressedRow]}
            >
              <View style={styles.categoryDetailsText}>
                <Text numberOfLines={1} style={styles.categoryDetailsItemTitle}>
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={styles.categoryDetailsItemMeta}>
                  {formatOwner(item.owner)}
                </Text>
              </View>
              <View style={styles.categoryDetailsAmounts}>
                <Text style={styles.categoryDetailsAmount}>{formatMoney(item.budgetAmount, currencyCode)}</Text>
                <Text style={styles.categoryDetailsSpent}>wydano {formatMoney(item.spentAmount, currencyCode)}</Text>
                <Text
                  style={[
                    styles.categoryDetailsRemaining,
                    Number(item.remainingAmount ?? 0) < 0 && styles.dangerText,
                    Number(item.remainingAmount ?? 0) >= 0 && styles.positiveText,
                  ]}
                >
                  {item.budgetAmount ? formatMoney(item.remainingAmount ?? 0, currencyCode) : "bez limitu"}
                </Text>
              </View>
              <View style={styles.categoryDetailsActions}>
                {canCreateExpense ? (
                  <IconButton accessibilityLabel="Dodaj wydatek" onPress={() => onAddExpense(item)}>
                    <CartPlus color={theme.colors.primaryDark} size={15} />
                  </IconButton>
                ) : null}
                {canUpdate ? (
                  <IconButton accessibilityLabel="Edytuj pozycję" onPress={() => onEdit(item)}>
                    <Pencil color={theme.colors.textMuted} size={15} />
                  </IconButton>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ChoiceSelector({
  emptyText,
  items,
  onSelect,
  selectedId,
}: {
  emptyText: string;
  items: Array<{ id: string; label: string }>;
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  if (items.length === 0) {
    return <InlineAlert text={emptyText} />;
  }

  if (items.length > 4) {
    return (
      <View style={styles.chipRow}>
        {items.map((item) => (
          <ActionButton
            key={item.id}
            onPress={() => onSelect(item.id)}
            size="small"
            title={item.label}
            variant={selectedId === item.id ? "primary" : "secondary"}
          />
        ))}
      </View>
    );
  }

  return (
    <SegmentedControl
      onChange={onSelect}
      options={items.map((item) => ({ label: item.label, value: item.id }))}
      value={selectedId}
    />
  );
}

const emptyFinanceTotals: FinanceTotalSummary = {
  incomeAmount: "0.00",
  totalBudgetAmount: "0.00",
  totalRemainingAmount: "0.00",
  totalSpentAmount: "0.00",
};

function getFinanceScopeTotals(
  totals: FinanceTotalSummary | undefined,
  personSummary: PersonFinanceSummary | undefined,
  isPersonScope: boolean,
): FinanceTotalSummary {
  if (!isPersonScope) {
    return totals ?? emptyFinanceTotals;
  }

  return {
    incomeAmount: personSummary?.incomeAmount ?? "0.00",
    totalBudgetAmount: personSummary?.totalBudgetAmount ?? "0.00",
    totalRemainingAmount: personSummary?.totalRemainingAmount ?? "0.00",
    totalSpentAmount: personSummary?.totalSpentAmount ?? "0.00",
  };
}

function applyFinanceFilters(
  rows: BudgetItemWithCategory[],
  filters: FinanceFilters,
): BudgetItemWithCategory[] {
  const normalizedSearch = filters.search.trim().toLocaleLowerCase("pl-PL");

  const filtered = rows.filter((row) => {
    const ownerId = row.owner?.memberId ?? "";
    const searchable = `${row.name} ${row.category.name} ${formatOwner(row.owner)}`.toLocaleLowerCase("pl-PL");

    if (filters.ownerMemberId && ownerId !== filters.ownerMemberId) {
      return false;
    }

    if (filters.categoryId && row.category.id !== filters.categoryId) {
      return false;
    }

    if (filters.onlyOverBudget && Number(row.remainingAmount ?? 0) >= 0) {
      return false;
    }

    return !normalizedSearch || searchable.includes(normalizedSearch);
  });

  return filtered.sort((left, right) => compareFinanceRows(left, right, filters));
}

function applyFinanceCategoryFilters(
  categories: BudgetCategoryWithItems[],
  filters: FinanceFilters,
  filteredRows: BudgetItemWithCategory[],
): BudgetCategoryWithItems[] {
  const normalizedSearch = filters.search.trim().toLocaleLowerCase("pl-PL");
  const rowCategoryIds = new Set(filteredRows.map((row) => row.category.id));

  return categories.filter((category) => {
    const categoryName = category.name.toLocaleLowerCase("pl-PL");

    if (filters.categoryId && category.id !== filters.categoryId) {
      return false;
    }

    if (filters.onlyOverBudget && !rowCategoryIds.has(category.id)) {
      return false;
    }

    if (normalizedSearch && !categoryName.includes(normalizedSearch) && !rowCategoryIds.has(category.id)) {
      return false;
    }

    return true;
  });
}

function compareFinanceRows(
  left: BudgetItemWithCategory,
  right: BudgetItemWithCategory,
  filters: FinanceFilters,
): number {
  const direction = filters.sortDirection === "asc" ? 1 : -1;
  const textCompare = (a: string, b: string) => a.localeCompare(b, "pl-PL") * direction;
  const numberCompare = (a: number, b: number) => (a - b) * direction;

  switch (filters.sortBy) {
    case "budget":
      return numberCompare(Number(left.budgetAmount ?? 0), Number(right.budgetAmount ?? 0));
    case "spent":
      return numberCompare(Number(left.spentAmount ?? 0), Number(right.spentAmount ?? 0));
    case "remaining":
      return numberCompare(Number(left.remainingAmount ?? 0), Number(right.remainingAmount ?? 0));
    case "owner":
      return textCompare(formatOwner(left.owner), formatOwner(right.owner));
    case "name":
      return textCompare(left.name, right.name);
    case "category":
    default:
      return (
        textCompare(left.category.name, right.category.name) ||
        numberCompare(left.displayOrder, right.displayOrder) ||
        textCompare(left.name, right.name)
      );
  }
}

function describeFinanceFilters(filters: FinanceFilters, resultCount: number, totalCount: number): string {
  const active: string[] = [`${resultCount}/${totalCount} pozycji`];

  if (filters.search.trim()) {
    active.push(`szukaj: ${filters.search.trim()}`);
  }

  if (filters.ownerMemberId) {
    active.push("osoba");
  }

  if (filters.categoryId) {
    active.push("kategoria");
  }

  if (filters.onlyOverBudget) {
    active.push("po limicie");
  }

  active.push(filters.sortDirection === "asc" ? "rosnaco" : "malejaco");

  return active.join(" / ");
}

function groupRowsByCategory(
  rows: BudgetItemWithCategory[],
  categories: BudgetCategoryWithItems[] = [],
): BudgetCategoryGroup[] {
  const groups = new Map<string, BudgetCategoryGroup>();

  categories.forEach((category) => {
    groups.set(category.id, {
      category,
      items: [],
      planned: 0,
      remaining: 0,
      spent: 0,
    });
  });

  rows.forEach((row) => {
    const group =
      groups.get(row.category.id) ??
      {
        category: row.category,
        items: [],
        planned: 0,
        remaining: 0,
        spent: 0,
      };

    group.items.push(row);
    group.planned += Number(row.budgetAmount ?? 0);
    group.spent += Number(row.spentAmount ?? 0);
    group.remaining += Number(row.remainingAmount ?? 0);
    groups.set(row.category.id, group);
  });

  return [...groups.values()];
}

function getCategoryAccent(index: number): { border: string; color: string; onColor: string; text: string } {
  const colors = [
    "#FF9F43",
    "#65D6A4",
    "#4DA3FF",
    "#FF7A8A",
    "#8B7CFF",
    "#B5E875",
    "#F6C35B",
    "#7CD8E8",
    "#D78BFF",
    "#FF8A5C",
  ];
  const color = colors[index % colors.length] ?? "#FF7A59";

  return {
    border: color,
    color,
    onColor: getReadableTextColor(color),
    text: color,
  };
}

function getBudgetSpentProgress(group: BudgetCategoryGroup): number {
  if (group.planned <= 0) {
    return 0;
  }

  return Math.max(0, group.spent / group.planned);
}

function getBudgetCategoryIcon(categoryName: string, color: string): ReactNode {
  const normalized = normalizeCategoryName(categoryName);
  const iconSize = 19;

  if (normalized.includes("jedzenie")) {
    return <Utensils color={color} size={iconSize} />;
  }

  if (normalized.includes("dom") || normalized.includes("media") || normalized.includes("rachunki")) {
    return <Home color={color} size={iconSize} />;
  }

  if (normalized.includes("transport") || normalized.includes("auto")) {
    return <Car color={color} size={iconSize} />;
  }

  if (normalized.includes("zdrowie") || normalized.includes("uroda")) {
    return <Heart color={color} size={iconSize} />;
  }

  if (normalized.includes("rozrywka")) {
    return <Gamepad2 color={color} size={iconSize} />;
  }

  if (normalized.includes("dzieci")) {
    return <Users color={color} size={iconSize} />;
  }

  if (normalized.includes("oszczednosci")) {
    return <PiggyBank color={color} size={iconSize} />;
  }

  if (normalized.includes("subskrypcje") || normalized.includes("cyfrowe")) {
    return <Smartphone color={color} size={iconSize} />;
  }

  if (normalized.includes("prezenty") || normalized.includes("okazje")) {
    return <Gift color={color} size={iconSize} />;
  }

  if (normalized.includes("remont")) {
    return <Hammer color={color} size={iconSize} />;
  }

  if (normalized.includes("zobowiazania")) {
    return <Archive color={color} size={iconSize} />;
  }

  if (normalized.includes("kieszonkowe")) {
    return <WalletCards color={color} size={iconSize} />;
  }

  return <ShoppingCart color={color} size={iconSize} />;
}

function normalizeCategoryName(value: string): string {
  return value
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .trim();
}

function getReadableTextColor(color: string): string {
  const normalized = color.replace("#", "");

  if (normalized.length !== 6) {
    return "#FFFFFF";
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some((part) => Number.isNaN(part))) {
    return "#FFFFFF";
  }

  const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;

  return luminance > 0.62 ? "#111827" : "#FFFFFF";
}

function getCategoryItems(category: BudgetCategoryWithItems): BudgetItem[] {
  return Array.isArray(category.items) ? category.items : [];
}

function formatOwner(owner: BudgetItem["owner"] | null | undefined): string {
  return owner?.displayName || owner?.email || "Brak właściciela";
}

function parseMoney(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".").trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : Number.NaN;
}

function parseMonthInput(value: string): { month: number; year: number } | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) {
    return null;
  }

  return { month, year };
}

function isValidMoney(value: string): boolean {
  const parsed = parseMoney(value);

  return value.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0;
}

function isPositiveMoney(value: string): boolean {
  const parsed = parseMoney(value);

  return value.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;
}

function formatMoney(
  value: string | number | null | undefined,
  currencyCode: SupportedCurrencyCode,
): string {
  return formatCurrencyAmount(value, currencyCode);
}

function formatMoneyInput(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? String(amount).replace(".", ",") : "";
}

function formatDateShort(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return `${value.slice(8, 10)}.${value.slice(5, 7)}`;
}

function formatDateFull(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)} r.`;
}

function formatDateTimeFull(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function todayIso(): string {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return local.toISOString().slice(0, 10);
}

function formatMonthLong(month: BudgetMonth): string {
  const date = new Date(month.year, month.month - 1, 1);
  const label = new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    actionPicker: {
      gap: spacing.sm,
    },
    actionCell: {
      alignItems: "center",
      borderColor: colors.line,
      borderLeftWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 38,
      width: 78,
    },
    sheetActionButton: {
      height: 32,
      width: 32,
    },
    actionHeaderCell: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderLeftWidth: 1,
      color: colors.text,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      textAlign: "center",
      width: 78,
    },
    actionSumCell: {
      borderColor: colors.line,
      borderLeftWidth: 1,
      width: 78,
    },
    amountCell: {
      borderColor: colors.line,
      borderLeftWidth: 1,
      color: colors.text,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
      textAlign: "right",
      width: 60,
    },
    amountHeaderCell: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderLeftWidth: 1,
      color: colors.text,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      textAlign: "right",
      width: 60,
    },
    amountSumCell: {
      borderColor: colors.line,
      borderLeftWidth: 1,
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
      textAlign: "right",
      width: 60,
    },
    bodyCell: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    categoryCell: {
      width: 92,
    },
    categoryCard: {
      alignItems: "center",
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      elevation: 2,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      shadowColor: "#000000",
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      width: "100%",
    },
    categoryCardActive: {
      borderWidth: 2,
      shadowOpacity: 0.18,
    },
    categoryCardAddButton: {
      backgroundColor: colors.primary,
      height: 34,
      width: 34,
    },
    categoryCardAmount: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 15,
      textAlign: "right",
    },
    categoryCardBudget: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      maxWidth: 82,
      textAlign: "right",
    },
    categoryCardContent: {
      flex: 1,
      gap: 7,
      minWidth: 0,
    },
    categoryCardGrid: {
      gap: spacing.sm,
    },
    categoryCardIcon: {
      alignItems: "center",
      backgroundColor: "#151A27",
      borderRadius: 8,
      borderWidth: 1,
      height: 34,
      justifyContent: "center",
      shadowColor: "#000000",
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      width: 34,
    },
    categoryCardMeta: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "right",
      textTransform: "uppercase",
    },
    categoryCardRemainingBlock: {
      alignItems: "flex-end",
      gap: 1,
      minWidth: 70,
    },
    categoryCardsSection: {
      gap: spacing.sm,
    },
    categoryCardTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 15,
      minWidth: 0,
    },
    categoryCardTopLine: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    categoryColorBar: {
      borderRadius: 999,
      height: 30,
      width: 4,
    },
    categoryDetails: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    categoryDetailsActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    categoryDetailsAmount: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "right",
    },
    categoryDetailsAmounts: {
      alignItems: "flex-end",
      gap: 2,
      minWidth: 92,
    },
    categoryDetailsHeader: {
      gap: 2,
    },
    categoryDetailsHeaderTop: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    categoryDetailsItemMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
    },
    categoryDetailsItemTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    categoryDetailsMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    categoryDetailsRemaining: {
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "right",
    },
    categoryDetailsRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      padding: spacing.sm,
    },
    categoryDetailsSpent: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
      textAlign: "right",
    },
    categoryDetailsText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    categoryDetailsTitleBlock: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    categoryDetailsTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    pressedRow: {
      opacity: 0.82,
    },
    categoryProgressFill: {
      borderRadius: 999,
      height: "100%",
    },
    categoryProgressTrack: {
      backgroundColor: colors.cardMuted,
      borderRadius: 999,
      height: 12,
      overflow: "hidden",
      position: "relative",
      width: "100%",
    },
    categoryProgressValue: {
      color: colors.text,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 12,
      position: "absolute",
      right: 5,
      top: 0,
    },
    categoryRow: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
      minHeight: 48,
    },
    categoryRowMain: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    categoryRowMeta: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0,
    },
    categoryRowText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
    },
    categoryRowTitleBlock: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    categoryToggleCell: {
      alignItems: "center",
      borderColor: colors.line,
      borderLeftWidth: 1,
      flexDirection: "row",
      gap: 2,
      justifyContent: "center",
      width: 78,
    },
    categoryCollapseButton: {
      alignItems: "center",
      borderRadius: 999,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    selectorGroup: {
      gap: spacing.xs,
    },
    selectorLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    dangerText: {
      color: colors.danger,
    },
    deleteWarning: {
      alignItems: "flex-start",
      backgroundColor: colors.warningSoft,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    deleteWarningText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 19,
    },
    debtActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "flex-end",
    },
    debtAmount: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "right",
    },
    debtCard: {
      alignItems: "flex-start",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    debtCardSettled: {
      backgroundColor: colors.cardMuted,
      opacity: 0.82,
    },
    debtCardText: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    debtList: {
      gap: spacing.sm,
    },
    debtMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
    },
    debtNote: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    debtSettledText: {
      color: colors.textSubtle,
      textDecorationLine: "line-through",
    },
    debtSide: {
      alignItems: "flex-end",
      gap: spacing.sm,
      minWidth: 104,
    },
    debtSummary: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md,
      padding: spacing.md,
    },
    debtSummaryLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    debtSummaryMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "right",
    },
    debtSummaryValue: {
      color: colors.danger,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0,
    },
    debtTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    expenseContextCard: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    expenseContextLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    expenseContextMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 17,
    },
    expenseContextTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 21,
    },
    expenseHistoryAmount: {
      color: colors.primaryDark,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "right",
    },
    expenseHistoryList: {
      gap: spacing.xs,
    },
    expenseHistoryMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
    },
    expenseHistoryRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      padding: spacing.sm,
    },
    expenseHistorySummary: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      padding: spacing.md,
    },
    expenseHistorySummarySide: {
      alignItems: "flex-end",
      gap: 2,
    },
    expenseHistorySummaryValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0,
    },
    expenseHistoryText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    expenseHistoryTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    savingsAmount: {
      color: colors.primaryDark,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "right",
    },
    savingsCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    savingsCardHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
    },
    savingsDelta: {
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      minWidth: 78,
    },
    savingsDeltaAdd: {
      color: colors.primaryDark,
    },
    savingsDeltaSubtract: {
      color: colors.danger,
    },
    savingsHistory: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.sm,
    },
    savingsIconButton: {
      height: 34,
      width: 34,
    },
    savingsSummaryTitle: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    savingsSummaryValue: {
      color: colors.primaryDark,
    },
    savingsTransactionMeta: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 12,
      letterSpacing: 0,
      minWidth: 0,
    },
    savingsTransactionRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    copyAmountInput: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      minHeight: 38,
      paddingHorizontal: spacing.sm,
      textAlign: "right",
      width: 92,
    },
    copyAmountList: {
      gap: spacing.xs,
    },
    copyAmountMeta: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
    },
    copyAmountRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    copyAmountText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    copyAmountTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    fab: {
      alignItems: "center",
      alignSelf: "flex-end",
      backgroundColor: colors.primary,
      borderRadius: 999,
      elevation: 5,
      height: 54,
      justifyContent: "center",
      marginTop: spacing.xs,
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      width: 54,
    },
    filterChip: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 32,
      paddingHorizontal: spacing.sm,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipCompact: {
      flexBasis: "31.8%",
      flexGrow: 1,
      maxWidth: "32%",
      paddingHorizontal: 6,
    },
    filterChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      paddingRight: spacing.md,
    },
    filterCategoryGrid: {
      paddingRight: 0,
    },
    filterChipText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
    },
    filterChipTextActive: {
      color: colors.inverseText,
    },
    filterCount: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
    },
    filterSummary: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
      minWidth: 0,
    },
    filterToggle: {
      color: colors.primaryDark,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
    },
    filterToggleButton: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      minHeight: 36,
      paddingHorizontal: spacing.sm,
    },
    filterGroup: {
      gap: spacing.xs,
    },
    filterHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    filterInput: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 13,
      minHeight: 40,
      paddingHorizontal: spacing.sm,
    },
    filterLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    filterPanel: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.sm,
    },
    filterTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    headerCell: {
      backgroundColor: colors.cardMuted,
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
    },
    incomeBreakdownList: {
      gap: spacing.sm,
    },
    incomeBreakdownMeta: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
      lineHeight: 16,
    },
    incomeBreakdownName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    incomeBreakdownRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    incomeBreakdownRowActive: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    incomeBreakdownText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    incomeBreakdownTotal: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    incomeBreakdownValue: {
      color: colors.finance,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "right",
    },
    financeSummaryBudgetPill: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      bottom: 9,
      flexDirection: "row",
      gap: 5,
      minHeight: 24,
      paddingHorizontal: spacing.sm,
      position: "absolute",
    },
    financeSummaryBudgetText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
    },
    financeSummaryCard: {
      alignItems: "center",
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      elevation: 3,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      minHeight: 118,
      overflow: "hidden",
      paddingBottom: 30,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 22,
    },
    financeSummaryCenter: {
      alignItems: "center",
      height: 84,
      justifyContent: "center",
      width: 88,
    },
    financeSummaryCenterText: {
      alignItems: "center",
      gap: 1,
      position: "absolute",
    },
    financeSummaryLabel: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
    },
    financeSummaryLabelRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      justifyContent: "center",
    },
    financeSummaryRing: {
      alignItems: "center",
      borderRadius: 999,
      height: 82,
      justifyContent: "center",
      position: "relative",
      width: 82,
    },
    financeSummaryRingInner: {
      backgroundColor: colors.overlay,
      borderColor: colors.cardMuted,
      borderRadius: 999,
      borderWidth: 1,
      height: 58,
      position: "absolute",
      width: 58,
    },
    financeSummaryRingLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0,
    },
    financeSummaryRingSegment: {
      borderRadius: 999,
      height: 10,
      left: 39,
      position: "absolute",
      top: 36,
      width: 4,
    },
    financeSummaryRingValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
      maxWidth: 58,
      textAlign: "center",
    },
    financeSummarySide: {
      alignItems: "center",
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
    },
    financeSummaryValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "center",
    },
    metric: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flex: 1,
      gap: spacing.xs,
      minHeight: 70,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    metricPressed: {
      opacity: 0.78,
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
    },
    metricRow: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    metricTop: {
      alignItems: "center",
      flexDirection: "row",
      gap: 3,
    },
    metricValue: {
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    monthSwitcher: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 38,
      paddingHorizontal: 4,
    },
    monthSwitcherRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    monthSwitcherTitle: {
      color: colors.primaryDark,
      flex: 1,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "center",
    },
    budgetLayoutButton: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      height: 38,
      width: 38,
    },
    monthNavButton: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      height: 34,
      width: 34,
    },
    monthDeleteButton: {
      backgroundColor: colors.card,
      borderColor: `${colors.danger}55`,
      height: 38,
      width: 38,
    },
    monthTab: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      minHeight: 34,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    monthTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    monthTabs: {
      flexDirection: "row",
      gap: spacing.xs,
      paddingRight: spacing.md,
    },
    monthTabText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
    },
    monthTabTextActive: {
      color: colors.inverseText,
    },
    muted: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 18,
    },
    personCell: {
      width: 64,
    },
    positiveText: {
      color: colors.primaryDark,
    },
    sheet: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      minWidth: 414,
      overflow: "hidden",
    },
    sheetHeader: {
      flexDirection: "row",
    },
    sheetRow: {
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
    },
    sheetRowContent: {
      flexDirection: "row",
    },
    sheetScroller: {
      marginRight: -spacing.md,
    },
    sumCell: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    sumRow: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
    },
    switchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
    },
    totalLabel: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    totalRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    totalValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      minWidth: 68,
      textAlign: "right",
    },
  });
}
