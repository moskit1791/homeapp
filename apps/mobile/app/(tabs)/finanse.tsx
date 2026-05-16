import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import {
  Archive,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Minus,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Trash2,
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
  upsertIncome,
} from "../../src/api";
import { useModulePermission } from "../../src/permissions/use-permissions";
import { loadStoredJson, saveStoredJson } from "../../src/session/secure-session-store";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
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
  savingsChangedAt: string;
  savingsName: string;
  savingsNote: string;
  savingsTransactionAmount: string;
  savingsTransactionChangedAt: string;
  savingsTransactionNote: string;
};

type BudgetItem = BudgetCategoryWithItems["items"][number];
type BudgetItemWithCategory = BudgetItem & {
  category: BudgetCategoryWithItems;
};

type FinanceModal =
  | "menu"
  | "income"
  | "category"
  | "item"
  | "editItem"
  | "expense"
  | "copyAmounts"
  | "debt"
  | "month"
  | "savingsAccount"
  | "savingsTransaction"
  | null;
type FinanceView = "budget" | "debts" | "savings";
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
  const params = useLocalSearchParams<{ action?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
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
      savingsChangedAt: todayIso(),
      savingsName: "",
      savingsNote: "",
      savingsTransactionAmount: "",
      savingsTransactionChangedAt: todayIso(),
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
  const savingsChangedAt = watch("savingsChangedAt");
  const savingsName = watch("savingsName");
  const savingsNote = watch("savingsNote");
  const savingsTransactionAmount = watch("savingsTransactionAmount");
  const savingsTransactionChangedAt = watch("savingsTransactionChangedAt");
  const savingsTransactionNote = watch("savingsTransactionNote");
  const [selectedIncomeMemberId, setSelectedIncomeMemberId] = useState("");
  const [selectedItemCategoryId, setSelectedItemCategoryId] = useState("");
  const [selectedItemOwnerId, setSelectedItemOwnerId] = useState("");
  const [selectedExpenseOwnerId, setSelectedExpenseOwnerId] = useState("");
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] = useState("");
  const [selectedExpenseItemId, setSelectedExpenseItemId] = useState("");
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

  const currentSummary = currentQuery.data;
  const summary =
    selectedMonthId && selectedMonthId !== currentSummary?.month.id
      ? selectedArchiveQuery.data
      : currentSummary;
  const totals = summary?.summary;
  const incomes = summary?.incomes ?? [];
  const categories = summary?.categories ?? [];
  const visibleFlatItems = useMemo<BudgetItemWithCategory[]>(
    () =>
      categories.flatMap((category) =>
        getCategoryItems(category).map((item) => ({ ...item, category })),
      ),
    [categories],
  );
  const currentMonth = currentSummary?.month;
  const visibleMonth = summary?.month;
  const budgetAmount = Number(totals?.totalBudgetAmount ?? 0);
  const spentAmount = Number(totals?.totalSpentAmount ?? 0);
  const remainingAmount = Number(totals?.totalRemainingAmount ?? 0);
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
  const expenseOwnerOptions = useMemo(() => {
    const itemOwnerIds = new Set(
      visibleFlatItems
        .map((item) => item.owner?.memberId)
        .filter((ownerId): ownerId is string => Boolean(ownerId)),
    );

    return financeOwnerOptions.filter((owner) => itemOwnerIds.has(owner.id));
  }, [financeOwnerOptions, visibleFlatItems]);
  const expenseCategoryOptions = useMemo(() => {
    if (!selectedExpenseOwnerId) {
      return [];
    }

    return categories
      .map((category) => ({
        category,
        items: getCategoryItems(category)
          .filter((item) => item.owner?.memberId === selectedExpenseOwnerId)
          .map((item) => ({ ...item, category })),
      }))
      .filter((option) => option.items.length > 0);
  }, [categories, selectedExpenseOwnerId]);
  const expenseItems = useMemo(
    () =>
      expenseCategoryOptions.find((option) => option.category.id === selectedExpenseCategoryId)?.items ?? [],
    [expenseCategoryOptions, selectedExpenseCategoryId],
  );
  const selectedExpenseItem = useMemo(
    () => expenseItems.find((item) => item.id === selectedExpenseItemId),
    [expenseItems, selectedExpenseItemId],
  );
  const filteredRows = useMemo(
    () => applyFinanceFilters(visibleFlatItems, financeFilters),
    [financeFilters, visibleFlatItems],
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
    if (!params.action) {
      setHandledRouteAction(null);
      return;
    }

    if (params.action !== "expense" || handledRouteAction === params.action) {
      return;
    }

    setSelectedExpenseOwnerId("");
    setSelectedExpenseCategoryId("");
    setSelectedExpenseItemId("");
    setValue("expenseAmount", "");
    setFinanceModal("expense");
    setHandledRouteAction(params.action);
    router.setParams({ action: undefined });
  }, [handledRouteAction, params.action, router]);

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
          changedAt: savingsChangedAt.trim(),
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
          changedAt: savingsTransactionChangedAt.trim(),
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
    mutationFn: () =>
      createExpense(
        {
          amount: parseMoney(expenseAmount),
          budgetItemId: selectedExpenseItemId,
        },
        { accessToken },
      ),
    onSuccess: async () => {
      setValue("expenseAmount", "");
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
  }

  function openExpenseModal() {
    setSelectedExpenseOwnerId("");
    setSelectedExpenseCategoryId("");
    setSelectedExpenseItemId("");
    setValue("expenseAmount", "");
    setFinanceModal("expense");
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
    setValue("savingsChangedAt", todayIso());
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
    setValue("savingsTransactionChangedAt", todayIso());
    setValue("savingsTransactionNote", "");
  }

  function openSavingsTransaction(account: FinanceSavingsAccount, direction: FinanceSavingsDirection) {
    setSelectedSavingsAccount(account);
    setSavingsDirection(direction);
    setValue("savingsTransactionAmount", "");
    setValue("savingsTransactionChangedAt", todayIso());
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
    canCreate && Boolean(selectedExpenseItem) && isPositiveMoney(expenseAmount);
  const canSaveDebt =
    (editingDebt ? canUpdate : canCreate) &&
    Boolean(debtLenderName.trim()) &&
    Boolean(debtPurpose.trim()) &&
    isPositiveMoney(debtAmount) &&
    (!debtDueDate.trim() || /^\d{4}-\d{2}-\d{2}$/.test(debtDueDate));
  const canSaveSavingsAccount =
    canCreate &&
    Boolean(savingsName.trim()) &&
    isValidMoney(savingsAmount) &&
    isValidDateInput(savingsChangedAt);
  const canSaveSavingsTransaction =
    canUpdate &&
    Boolean(selectedSavingsAccount?.id) &&
    isPositiveMoney(savingsTransactionAmount) &&
    isValidDateInput(savingsTransactionChangedAt);
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
    <AppScreen title="Finanse">
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

          <View style={styles.metricRow}>
            <FinanceMetric
              color={theme.colors.finance}
              icon={<Banknote color={theme.colors.finance} size={17} />}
              label="Dochody"
              value={formatMoney(totals?.incomeAmount)}
            />
            <FinanceMetric
              color={theme.colors.text}
              icon={<WalletCards color={theme.colors.textMuted} size={17} />}
              label="Budżet"
              value={formatMoney(totals?.totalBudgetAmount)}
            />
            <FinanceMetric
              color={theme.colors.warning}
              icon={<ReceiptText color={theme.colors.warning} size={17} />}
              label="Wydane"
              value={formatMoney(totals?.totalSpentAmount)}
            />
            <FinanceMetric
              color={remainingAmount < 0 ? theme.colors.danger : theme.colors.primaryDark}
              icon={<Archive color={remainingAmount < 0 ? theme.colors.danger : theme.colors.primaryDark} size={17} />}
              label="Zostaje"
              value={formatMoney(totals?.totalRemainingAmount)}
            />
          </View>

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

          <FinanceSheet
            canUpdate={canEditVisibleMonth}
            onEdit={openEditBudgetItem}
            rows={filteredRows}
          />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>RAZEM</Text>
            <Text style={styles.totalValue}>{formatMoney(budgetAmount)}</Text>
            <Text style={styles.totalValue}>{formatMoney(spentAmount)}</Text>
            <Text style={[styles.totalValue, remainingAmount < 0 && styles.dangerText]}>
              {formatMoney(remainingAmount)}
            </Text>
          </View>

          {canCreate ? (
            <Pressable onPress={() => setFinanceModal("menu")} style={styles.fab}>
              <Plus color={theme.colors.card} size={25} />
            </Pressable>
          ) : null}

          <FormModal
            onClose={closeFinanceModal}
            subtitle="Wybierz, co chcesz dopisać do finansów."
            title="Dodaj w finansach"
            visible={financeModal === "menu"}
          >
            <View style={styles.actionPicker}>
              {canUpdate ? (
                <ActionButton onPress={() => setFinanceModal("income")} title="Zmień dochód" variant="secondary" />
              ) : null}
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
                  onPress={() => setFinanceModal(null)}
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
            onClose={() => setFinanceModal(null)}
            subtitle="Najpierw wybierz osobę, potem kategorię, pozycję i kwotę."
            title="Dodaj wydatek"
            visible={financeModal === "expense"}
          >
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
            {selectedExpenseItem ? (
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
              <Text style={styles.debtSummaryValue}>{formatMoney(openDebtTotal)}</Text>
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
                  {formatMoney(savingsTotal)}
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
            <TextField control={control} label="Data ostatniej zmiany" name="savingsChangedAt" placeholder="YYYY-MM-DD" />
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
                ? `${selectedSavingsAccount.name} / obecnie ${formatMoney(selectedSavingsAccount.currentAmount)}`
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
              label="Data zmiany"
              name="savingsTransactionChangedAt"
              placeholder="YYYY-MM-DD"
            />
            <TextField control={control} label="Notatka" name="savingsTransactionNote" placeholder="Opcjonalnie" />
            {savingsTransactionMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się zapisać zmiany oszczędności." />
            ) : null}
          </FormModal>
        </>
      ) : null}
    </AppScreen>
  );
}

function FinanceMetric({
  color,
  icon,
  label,
  value,
}: {
  color: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.metric}>
      <View style={styles.metricTop}>
        {icon}
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.metricValue, { color }]}>
        {value}
      </Text>
    </View>
  );
}

function FinanceDebtsList({
  canDelete,
  canUpdate,
  debts,
  deleting,
  onDelete,
  onEdit,
  onToggleSettled,
  updating,
}: {
  canDelete: boolean;
  canUpdate: boolean;
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
              {formatMoney(debt.amount)}
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
  deleting,
  onDelete,
  onTransaction,
  updating,
}: {
  accounts: FinanceSavingsAccount[];
  canDelete: boolean;
  canUpdate: boolean;
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
                <Text style={styles.savingsAmount}>{formatMoney(account.currentAmount)}</Text>
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
                      {transaction.direction === "add" ? "+" : "-"}{formatMoney(transaction.amount)}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterChipRow}>
            <FilterChip active={!filters.categoryId} label="Wszystkie" onPress={() => onChange({ categoryId: "" })} />
            {categories.map((category) => (
              <FilterChip
                active={filters.categoryId === category.id}
                key={category.id}
                label={category.name}
                onPress={() => onChange({ categoryId: category.id })}
              />
            ))}
          </View>
        </ScrollView>
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
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text numberOfLines={1} style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FinanceSheet({
  canUpdate,
  onEdit,
  rows,
}: {
  canUpdate: boolean;
  onEdit: (item: BudgetItemWithCategory) => void;
  rows: BudgetItemWithCategory[];
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const canDelete = false;
  const deletingItemId: string | null = null;
  const onDelete = (_item: BudgetItemWithCategory) => undefined;

  if (rows.length === 0) {
    return <InlineAlert text="Brak pozycji pasujących do filtrów." />;
  }

  const groups = groupRowsByCategory(rows);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sheetScroller}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.headerCell, styles.personCell]}>Osoba</Text>
          <Text style={[styles.headerCell, styles.categoryCell]}>Pozycja</Text>
          <Text style={styles.amountHeaderCell}>Budżet</Text>
          <Text style={styles.amountHeaderCell}>Wydano</Text>
          <Text style={styles.amountHeaderCell}>Zostaje</Text>
          {canUpdate ? <Text style={styles.actionHeaderCell}>Akcje</Text> : null}
        </View>
        {groups.map((group) => (
          <View key={group.category.id}>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryRowText}>{group.category.name.toUpperCase()}</Text>
            </View>
            {group.items.map((item) => (
              <View key={item.id} style={styles.sheetRow}>
                <Text numberOfLines={1} style={[styles.bodyCell, styles.personCell]}>
                  {formatOwner(item.owner)}
                </Text>
                <Text numberOfLines={1} style={[styles.bodyCell, styles.categoryCell]}>
                  {item.name}
                </Text>
                <Text style={styles.amountCell}>{formatMoney(item.budgetAmount)}</Text>
                <Text style={styles.amountCell}>{formatMoney(item.spentAmount)}</Text>
                <Text
                  style={[
                    styles.amountCell,
                    Number(item.remainingAmount ?? 0) < 0 && styles.dangerText,
                    Number(item.remainingAmount ?? 0) >= 0 && styles.positiveText,
                  ]}
                >
                  {item.budgetAmount ? formatMoney(item.remainingAmount ?? 0) : "bez limitu"}
                </Text>
                {canUpdate ? (
                  <View style={styles.actionCell}>
                    {canUpdate ? (
                      <IconButton accessibilityLabel="Edytuj pozycję" onPress={() => onEdit(item)}>
                        <Pencil color={theme.colors.textMuted} size={15} />
                      </IconButton>
                    ) : null}
                    {canDelete ? (
                      <IconButton
                        accessibilityLabel="Usuń pozycję"
                        disabled={deletingItemId === item.id}
                        onPress={() => onDelete(item)}
                      >
                        <Trash2 color={theme.colors.danger} size={15} />
                      </IconButton>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
            <View style={styles.sumRow}>
              <Text style={[styles.sumCell, styles.personCell]}>Suma</Text>
              <Text style={[styles.sumCell, styles.categoryCell]}>{group.category.name}</Text>
              <Text style={styles.amountSumCell}>{formatMoney(group.planned)}</Text>
              <Text style={styles.amountSumCell}>{formatMoney(group.spent)}</Text>
              <Text style={[styles.amountSumCell, group.remaining < 0 && styles.dangerText]}>
                {formatMoney(group.remaining)}
              </Text>
              {canUpdate ? <View style={styles.actionSumCell} /> : null}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
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

function groupRowsByCategory(rows: BudgetItemWithCategory[]) {
  const groups = new Map<
    string,
    {
      category: BudgetCategoryWithItems;
      items: BudgetItemWithCategory[];
      planned: number;
      remaining: number;
      spent: number;
    }
  >();

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

function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function formatMoney(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return `${safeAmount.toLocaleString("pl-PL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(safeAmount) ? 0 : 2,
  })} zł`;
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
    categoryRow: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderTopWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    categoryRowText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
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
      shadowColor: colors.primary,
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.26,
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
    filterChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      paddingRight: spacing.md,
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
      minWidth: 336,
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
