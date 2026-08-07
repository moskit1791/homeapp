import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import DraggableFlatList, {
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import {
  Archive,
  Car,
  ChartBar,
  Check,
  CheckCircle2,
  CreditCardClock,
  CalendarDays,
  Close,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Dumbbell,
  DragHandle,
  Filter,
  Gamepad2,
  Gift,
  Hammer,
  Heart,
  Home,
  Minus,
  MoreHorizontal,
  PiggyBank,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Smartphone,
  TableLarge,
  Trash2,
  Users,
  Utensils,
  Vacuum,
  ViewGrid,
  WalletCards,
  WalletPlus,
  Wrench,
} from "../../src/ui/icon";
import savingsGoalCarImage from "../../assets/savings-goal-car.png";
import savingsGoalDefaultImage from "../../assets/savings-goal-default.png";
import savingsGoalEmergencyImage from "../../assets/savings-goal-emergency.png";
import savingsGoalGiftImage from "../../assets/savings-goal-gift.png";
import savingsGoalHomeImage from "../../assets/savings-goal-home.png";
import savingsGoalPhoneImage from "../../assets/savings-goal-phone.png";
import savingsGoalTravelImage from "../../assets/savings-goal-travel.png";
import {
  createBudgetCategory,
  createBudgetItem,
  createExpense,
  createFinanceDebt,
  createFinanceDebtPayment,
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
  listHouseholdMembers,
  listBudgetCategories,
  listBudgetMonths,
  listFinanceDebts,
  listFinanceSavings,
  queryKeys,
  updateBudgetItem,
  updateBudgetCategory,
  updateFinanceDebt,
  type BudgetCategoryWithItems,
  type BudgetMonth,
  type FinanceDebt,
  type FinanceSavingsAccount,
  type FinanceSavingsDirection,
  type FinanceTotalSummary,
  type HouseholdMember,
  type PersonFinanceSummary,
  upsertIncome,
} from "../../src/api";
import {
  decryptBudgetCategories,
  decryptBudgetMonthDetail,
  decryptFinanceDebts,
  decryptFinanceSavings,
  sealFinanceEnvelope,
} from "../../src/encryption/finance-crypto";
import { useEncryption } from "../../src/encryption/encryption-context";
import { EncryptionUnlockCard } from "../../src/encryption/encryption-unlock-card";
import { useModulePermission } from "../../src/permissions/use-permissions";
import { notificationExpenseImport } from "../../src/notification-expense-import/native";
import {
  loadStoredJson,
  saveStoredJson,
} from "../../src/session/secure-session-store";
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
  DatePickerField,
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
  debtPaymentAmount: string;
  debtPaymentNote: string;
  debtPurpose: string;
  expenseAmount: string;
  incomeAmount: string;
  itemAmount: string;
  itemName: string;
  savingsAmount: string;
  savingsName: string;
  savingsNote: string;
  savingsTargetAmount: string;
  savingsTargetDate: string;
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
  | "generateMonth"
  | "debt"
  | "savingsAccount"
  | "savingsTransaction"
  | "savingsDetails"
  | null;
type FinanceView = "budget" | "debts" | "savings";
type BudgetViewMode = "cards" | "table";
type FinanceSortKey =
  | "category"
  | "owner"
  | "name"
  | "budget"
  | "spent"
  | "remaining";
type FinanceSortDirection = "asc" | "desc";

type FinanceFilters = {
  categoryId: string;
  onlyOverBudget: boolean;
  ownerMemberId: string;
  search: string;
  showEmptyCategories: boolean;
  sortBy: FinanceSortKey;
  sortDirection: FinanceSortDirection;
};

type SavingsGoalView = FinanceSavingsAccount & {
  currentAmountNumber: number;
  isAchieved: boolean;
  owner: HouseholdMember | null;
  progressRatio: number;
  targetAmountNumber: number | null;
};

type SavingsGoalGroup = {
  accounts: SavingsGoalView[];
  achievedCount: number;
  currentTotal: number;
  id: string;
  label: string;
  member: HouseholdMember | null;
  targetTotal: number;
  totalCount: number;
};

const financeFilterStorageKey = "homeapp.finance.filters.v1";
const financeViewStorageKey = "homeapp.finance.view.v1";

const defaultFinanceFilters: FinanceFilters = {
  categoryId: "",
  onlyOverBudget: false,
  ownerMemberId: "",
  search: "",
  showEmptyCategories: true,
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

const mockupGreen = "#4F8D2C";

export default function FinanseScreen() {
  const { session } = useSession();
  const encryption = useEncryption();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ action?: string; intent?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const { canCreate, canDelete, canRead, canUpdate, permissionsQuery } =
    useModulePermission("finances");
  const accessToken = session?.accessToken;
  const financeEncryptionEnabled = encryption.isModuleEnabled("finances");
  const financeContentReady =
    encryption.lockState !== "loading" &&
    (!financeEncryptionEnabled || encryption.lockState === "unlocked");
  const { control, setValue, watch } = useForm<FinanceFormValues>({
    defaultValues: {
      categoryName: "",
      debtAmount: "",
      debtDueDate: "",
      debtLenderName: "",
      debtNote: "",
      debtPaymentAmount: "",
      debtPaymentNote: "",
      debtPurpose: "",
      expenseAmount: "",
      incomeAmount: "",
      itemAmount: "",
      itemName: "",
      savingsAmount: "",
      savingsName: "",
      savingsNote: "",
      savingsTargetAmount: "",
      savingsTargetDate: "",
      savingsTransactionAmount: "",
      savingsTransactionNote: "",
    },
  });

  const incomeAmount = watch("incomeAmount");
  const categoryName = watch("categoryName");
  const itemName = watch("itemName");
  const itemAmount = watch("itemAmount");
  const expenseAmount = watch("expenseAmount");
  const debtAmount = watch("debtAmount");
  const debtDueDate = watch("debtDueDate");
  const debtLenderName = watch("debtLenderName");
  const debtNote = watch("debtNote");
  const debtPaymentAmount = watch("debtPaymentAmount");
  const debtPaymentNote = watch("debtPaymentNote");
  const debtPurpose = watch("debtPurpose");
  const savingsAmount = watch("savingsAmount");
  const savingsName = watch("savingsName");
  const savingsNote = watch("savingsNote");
  const savingsTargetAmount = watch("savingsTargetAmount");
  const savingsTargetDate = watch("savingsTargetDate");
  const savingsTransactionAmount = watch("savingsTransactionAmount");
  const savingsTransactionNote = watch("savingsTransactionNote");
  const [selectedIncomeMemberId, setSelectedIncomeMemberId] = useState("");
  const [selectedItemCategoryId, setSelectedItemCategoryId] = useState("");
  const [selectedItemOwnerId, setSelectedItemOwnerId] = useState("");
  const [selectedExpenseOwnerId, setSelectedExpenseOwnerId] = useState("");
  const [selectedExpenseCategoryId, setSelectedExpenseCategoryId] =
    useState("");
  const [selectedExpenseItemId, setSelectedExpenseItemId] = useState("");
  const [selectedSavingsOwnerId, setSelectedSavingsOwnerId] = useState("");
  const [expenseQuickItemId, setExpenseQuickItemId] = useState<string | null>(
    null,
  );
  const [expenseQuickCategoryId, setExpenseQuickCategoryId] = useState<
    string | null
  >(null);
  const [historyBudgetItemId, setHistoryBudgetItemId] = useState<string | null>(
    null,
  );
  const [copyCategory, setCopyCategory] = useState(true);
  const [activeFinanceView, setActiveFinanceView] =
    useState<FinanceView>("budget");
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [financeModal, setFinanceModal] = useState<FinanceModal>(null);
  const [editingBudgetCategory, setEditingBudgetCategory] =
    useState<BudgetCategoryWithItems | null>(null);
  const [editingBudgetItem, setEditingBudgetItem] =
    useState<BudgetItemWithCategory | null>(null);
  const [editingDebt, setEditingDebt] = useState<FinanceDebt | null>(null);
  const [debtIsSettled, setDebtIsSettled] = useState(false);
  const [selectedSavingsAccount, setSelectedSavingsAccount] =
    useState<FinanceSavingsAccount | null>(null);
  const [savingsDirection, setSavingsDirection] =
    useState<FinanceSavingsDirection>("add");
  const [generateCopyItemIds, setGenerateCopyItemIds] = useState<string[]>([]);
  const [generateAmountInputs, setGenerateAmountInputs] = useState<
    Record<string, string>
  >({});
  const [generateCategoryOrder, setGenerateCategoryOrder] = useState<string[]>(
    [],
  );
  const [budgetViewMode, setBudgetViewMode] = useState<BudgetViewMode>("cards");
  const [budgetViewModeLoaded, setBudgetViewModeLoaded] = useState(false);
  const [financeSearchVisible, setFinanceSearchVisible] = useState(false);
  const [financeFilters, setFinanceFilters] = useState<FinanceFilters>(
    defaultFinanceFilters,
  );
  const [financeFiltersLoaded, setFinanceFiltersLoaded] = useState(false);
  const [financeFiltersExpanded, setFinanceFiltersExpanded] = useState(false);
  const [deleteMonthConfirmVisible, setDeleteMonthConfirmVisible] =
    useState(false);
  const [handledRouteAction, setHandledRouteAction] = useState<string | null>(
    null,
  );
  const [notificationImportPendingCount, setNotificationImportPendingCount] =
    useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!notificationExpenseImport.available) return;
      notificationExpenseImport
        .getPendingCount()
        .then(setNotificationImportPendingCount)
        .catch(() => setNotificationImportPendingCount(0));
    }, []),
  );

  const currentQuery = useQuery({
    enabled: canRead && Boolean(accessToken) && financeContentReady,
    queryFn: async () =>
      decryptBudgetMonthDetail(
        await getFinanceSummary({ accessToken }),
        encryption.decryptPayload,
      ),
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
      financeContentReady &&
      Boolean(selectedMonthId) &&
      selectedMonthId !== currentQuery.data?.month.id,
    queryFn: async () =>
      decryptBudgetMonthDetail(
        await getBudgetMonth(selectedMonthId ?? "", { accessToken }),
        encryption.decryptPayload,
      ),
    queryKey: [...queryKeys.finances, "month", selectedMonthId],
  });
  const categoriesQuery = useQuery({
    enabled: canRead && Boolean(accessToken) && financeContentReady,
    queryFn: async () =>
      decryptBudgetCategories(
        await listBudgetCategories({ accessToken }),
        encryption.decryptPayload,
      ),
    queryKey: [...queryKeys.finances, "categories"],
  });
  const debtsQuery = useQuery({
    enabled: canRead && Boolean(accessToken) && financeContentReady,
    queryFn: async () =>
      decryptFinanceDebts(
        await listFinanceDebts({ accessToken }),
        encryption.decryptPayload,
      ),
    queryKey: [...queryKeys.finances, "debts"],
  });
  const savingsQuery = useQuery({
    enabled: canRead && Boolean(accessToken) && financeContentReady,
    queryFn: async () =>
      decryptFinanceSavings(
        await listFinanceSavings({ accessToken }),
        encryption.decryptPayload,
      ),
    queryKey: [...queryKeys.finances, "savings"],
  });
  const householdMembersQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listHouseholdMembers({ accessToken }),
    queryKey: [...queryKeys.household, "members"],
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
  const incomes = summary?.incomes ?? [];
  const incomeByOwner = new Map(
    incomes.map((income) => [income.ownerMemberId, income.amount]),
  );
  const personSummaries = (summary?.personSummary ?? []).map((person) => ({
    ...person,
    incomeAmount:
      incomeByOwner.get(person.ownerMemberId) ?? person.incomeAmount,
  }));
  const totals = summary?.summary
    ? {
        ...summary.summary,
        incomeAmount: incomes
          .reduce((total, income) => total + Number(income.amount), 0)
          .toFixed(2),
      }
    : undefined;
  const categories = summary?.categories ?? [];
  const visibleFlatItems = useMemo<BudgetItemWithCategory[]>(
    () =>
      categories.flatMap((category) =>
        getCategoryItems(category).map((item) => ({ ...item, category })),
      ),
    [categories],
  );
  const historyBudgetItem = useMemo(
    () =>
      visibleFlatItems.find((item) => item.id === historyBudgetItemId) ?? null,
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
  const incomeAmountValue = Number(scopedTotals.incomeAmount);
  const incomeBudgetDifference = incomeAmountValue - budgetAmount;
  const spentAmount = Number(scopedTotals.totalSpentAmount);
  const remainingAmount = Number(scopedTotals.totalRemainingAmount);
  const debts = debtsQuery.data ?? [];
  const openDebts = debts.filter((debt) => !debt.isSettled);
  const settledDebts = debts.filter((debt) => debt.isSettled);
  const openDebtTotal = openDebts.reduce(
    (sum, debt) => sum + Number(debt.remainingAmount ?? debt.amount ?? 0),
    0,
  );
  const savings = savingsQuery.data ?? [];
  const householdMembers = householdMembersQuery.data ?? [];
  const savingsTotal = savings.reduce(
    (sum, account) => sum + Number(account.currentAmount ?? 0),
    0,
  );
  const monthTabs = useMemo(() => {
    const months = [
      ...(archiveQuery.data ?? []),
      ...(currentMonth ? [currentMonth] : []),
    ];
    const unique = new Map<string, BudgetMonth>();

    months.forEach((month) => unique.set(month.id, month));

    return [...unique.values()].sort(
      (left, right) => left.year - right.year || left.month - right.month,
    );
  }, [archiveQuery.data, currentMonth]);
  const selectedMonthIndex = monthTabs.findIndex(
    (month) => month.id === selectedMonthId,
  );
  const selectedMonth =
    monthTabs.find((month) => month.id === selectedMonthId) ?? visibleMonth;
  const showingArchiveMonth =
    Boolean(selectedMonthId) && selectedMonthId !== currentSummary?.month.id;
  const hasVisibleMonth = Boolean(visibleMonth?.id);
  const canCreateVisibleBudgetItem = canCreate && hasVisibleMonth;
  const canUpdateVisibleBudgetItem = canUpdate && hasVisibleMonth;
  const canCreateVisibleExpense = canCreate && hasVisibleMonth;
  const canDeleteVisibleMonthItems = canDelete && hasVisibleMonth;
  const canGoPreviousMonth = selectedMonthIndex > 0;
  const canGoNextMonth =
    selectedMonthIndex >= 0 && selectedMonthIndex < monthTabs.length - 1;
  const generateSourceCategories = useMemo(
    () =>
      (currentSummary?.categories ?? []).filter(
        (category) => category.isActive,
      ),
    [currentSummary?.categories],
  );
  const generateSourceItems = useMemo<BudgetItemWithCategory[]>(
    () =>
      generateSourceCategories.flatMap((category) =>
        getCategoryItems(category).map((item) => ({ ...item, category })),
      ),
    [generateSourceCategories],
  );
  const generateSelectedItemSet = useMemo(
    () => new Set(generateCopyItemIds),
    [generateCopyItemIds],
  );
  const selectedGenerateItems = useMemo(
    () =>
      generateSourceItems.filter((item) =>
        generateSelectedItemSet.has(item.id),
      ),
    [generateSelectedItemSet, generateSourceItems],
  );
  const orderedGenerateCategories = useMemo(() => {
    const order = new Map(
      generateCategoryOrder.map((categoryId, index) => [categoryId, index]),
    );

    return [...generateSourceCategories].sort(
      (left, right) =>
        (order.get(left.id) ?? left.displayOrder) -
          (order.get(right.id) ?? right.displayOrder) ||
        left.name.localeCompare(right.name, "pl-PL"),
    );
  }, [generateCategoryOrder, generateSourceCategories]);
  const financeOwnerOptions = useMemo(() => {
    const owners = new Map<string, string>();

    incomes.forEach((income) =>
      owners.set(income.ownerMemberId, income.displayName || income.email),
    );
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
      expenseCategoryOptions.find(
        (option) => option.category.id === selectedExpenseCategoryId,
      )?.items ?? [],
    [expenseCategoryOptions, selectedExpenseCategoryId],
  );
  const selectedExpenseCategory = useMemo(
    () =>
      categories.find(
        (category) => category.id === selectedExpenseCategoryId,
      ) ?? null,
    [categories, selectedExpenseCategoryId],
  );
  const selectedExpenseOwner = useMemo(
    () =>
      expenseOwnerOptions.find(
        (owner) => owner.id === selectedExpenseOwnerId,
      ) ?? null,
    [expenseOwnerOptions, selectedExpenseOwnerId],
  );
  const selectedExpenseItem = useMemo(
    () => expenseItems.find((item) => item.id === selectedExpenseItemId),
    [expenseItems, selectedExpenseItemId],
  );
  const isQuickExpense = Boolean(expenseQuickItemId && selectedExpenseItem);
  const isQuickCategoryExpense = Boolean(
    expenseQuickCategoryId && selectedExpenseCategory,
  );
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
  const householdMemberMap = useMemo(
    () => new Map(householdMembers.map((member) => [member.id, member])),
    [householdMembers],
  );
  const savingsGoals = useMemo<SavingsGoalView[]>(
    () =>
      savings.map((account) => {
        const currentAmountNumber = Number(account.currentAmount ?? 0);
        const targetAmountNumber =
          account.targetAmount === null ? null : Number(account.targetAmount);
        const owner = account.ownerMemberId
          ? (householdMemberMap.get(account.ownerMemberId) ?? null)
          : null;
        const progressRatio =
          targetAmountNumber && targetAmountNumber > 0
            ? Math.max(0, Math.min(currentAmountNumber / targetAmountNumber, 1))
            : 0;

        return {
          ...account,
          currentAmountNumber,
          isAchieved:
            targetAmountNumber !== null &&
            targetAmountNumber > 0 &&
            currentAmountNumber >= targetAmountNumber,
          owner,
          progressRatio,
          targetAmountNumber,
        };
      }),
    [householdMemberMap, savings],
  );
  const savingsGroups = useMemo<SavingsGoalGroup[]>(() => {
    const grouped = new Map<string, SavingsGoalGroup>();

    savingsGoals.forEach((goal) => {
      const member = goal.owner;
      const id = member?.id ?? goal.ownerMemberId ?? "unassigned";
      const label =
        member?.displayName ||
        member?.email ||
        (goal.ownerMemberId ? "Bez przypisania" : "Bez właściciela");
      const current =
        grouped.get(id) ??
        ({
          accounts: [],
          achievedCount: 0,
          currentTotal: 0,
          id,
          label,
          member,
          targetTotal: 0,
          totalCount: 0,
        } as SavingsGoalGroup);

      current.accounts.push(goal);
      current.currentTotal += goal.currentAmountNumber;
      current.targetTotal += goal.targetAmountNumber ?? 0;
      current.totalCount += 1;
      if (goal.isAchieved) {
        current.achievedCount += 1;
      }

      grouped.set(id, current);
    });

    return [...grouped.values()]
      .map((group) => ({
        ...group,
        accounts: [...group.accounts].sort(compareSavingsGoals),
      }))
      .sort(
        (left, right) =>
          right.currentTotal - left.currentTotal ||
          left.label.localeCompare(right.label, "pl-PL"),
      );
  }, [savingsGoals]);
  const savingsGoalsAchieved = savingsGoals.filter(
    (goal) => goal.isAchieved,
  ).length;
  const nextSavingsGoal = useMemo(
    () =>
      [...savingsGoals]
        .sort(compareSavingsGoals)
        .find((goal) => !goal.isAchieved) ??
      savingsGoals[0] ??
      null,
    [savingsGoals],
  );
  const selectedSavingsGoal = useMemo(
    () =>
      savingsGoals.find((goal) => goal.id === selectedSavingsAccount?.id) ??
      null,
    [selectedSavingsAccount?.id, savingsGoals],
  );

  function selectAdjacentMonth(direction: -1 | 1) {
    const nextMonth = monthTabs[selectedMonthIndex + direction];

    if (nextMonth) {
      setSelectedMonthId(nextMonth.id);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setSelectedMonthId(currentMonth?.id ?? null);
    }, [currentMonth?.id]),
  );

  function getGenerateAmountDefault(item: BudgetItemWithCategory): string {
    return item.budgetAmount ? formatMoneyInput(item.budgetAmount) : "";
  }

  function openGenerateMonthModal() {
    setGenerateCopyItemIds(generateSourceItems.map((item) => item.id));
    setGenerateAmountInputs(
      Object.fromEntries(
        generateSourceItems.map((item) => [
          item.id,
          getGenerateAmountDefault(item),
        ]),
      ),
    );
    setGenerateCategoryOrder(
      [...generateSourceCategories]
        .sort(
          (left, right) =>
            left.displayOrder - right.displayOrder ||
            left.name.localeCompare(right.name, "pl-PL"),
        )
        .map((category) => category.id),
    );
    setFinanceModal("generateMonth");
  }

  function toggleGenerateItemCopy(item: BudgetItemWithCategory) {
    const isSelected = generateSelectedItemSet.has(item.id);

    if (isSelected) {
      setGenerateCopyItemIds((current) =>
        current.filter((id) => id !== item.id),
      );
      return;
    }

    setGenerateCopyItemIds((current) =>
      current.includes(item.id) ? current : [...current, item.id],
    );
    setGenerateAmountInputs((current) =>
      current[item.id] === undefined
        ? { ...current, [item.id]: getGenerateAmountDefault(item) }
        : current,
    );
  }

  function setGenerateAllItemsCopy(checked: boolean) {
    if (!checked) {
      setGenerateCopyItemIds([]);
      return;
    }

    setGenerateCopyItemIds(generateSourceItems.map((item) => item.id));
    setGenerateAmountInputs((current) => ({
      ...Object.fromEntries(
        generateSourceItems.map((item) => [
          item.id,
          getGenerateAmountDefault(item),
        ]),
      ),
      ...current,
    }));
  }

  function setGenerateCategoryCopy(
    category: BudgetCategoryWithItems,
    checked: boolean,
  ) {
    const categoryItems = getCategoryItems(category).map((item) => ({
      ...item,
      category,
    }));
    const categoryItemIds = categoryItems.map((item) => item.id);

    setGenerateCopyItemIds((current) => {
      const next = new Set(current);

      categoryItemIds.forEach((id) => {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });

      return [...next];
    });

    if (checked) {
      setGenerateAmountInputs((current) => ({
        ...Object.fromEntries(
          categoryItems.map((item) => [
            item.id,
            getGenerateAmountDefault(item),
          ]),
        ),
        ...current,
      }));
    }
  }

  useEffect(() => {
    if (!selectedMonthId && currentMonth?.id) {
      setSelectedMonthId(currentMonth.id);
    }
  }, [currentMonth?.id, selectedMonthId]);

  useEffect(() => {
    let isMounted = true;

    loadStoredJson<Partial<FinanceFilters>>(financeFilterStorageKey).then(
      (storedFilters) => {
        if (!isMounted) {
          return;
        }

        if (storedFilters) {
          setFinanceFilters({ ...defaultFinanceFilters, ...storedFilters });
        }

        setFinanceFiltersLoaded(true);
      },
    );

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

    loadStoredJson<BudgetViewMode>(financeViewStorageKey).then((storedView) => {
      if (!isMounted) {
        return;
      }

      if (storedView === "cards" || storedView === "table") {
        setBudgetViewMode(storedView);
      }
      setBudgetViewModeLoaded(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (budgetViewModeLoaded) {
      saveStoredJson(financeViewStorageKey, budgetViewMode);
    }
  }, [budgetViewMode, budgetViewModeLoaded]);

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
    const ownerIds = new Set(householdMembers.map((member) => member.id));

    if (ownerIds.size === 0) {
      return;
    }

    if (!selectedSavingsOwnerId || !ownerIds.has(selectedSavingsOwnerId)) {
      setSelectedSavingsOwnerId(householdMembers[0]?.id ?? "");
    }
  }, [householdMembers, selectedSavingsOwnerId]);

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

    const categoryIds = new Set(
      expenseCategoryOptions.map((option) => option.category.id),
    );

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
  }, [
    expenseItems,
    financeModal,
    selectedExpenseCategoryId,
    selectedExpenseItemId,
  ]);

  const invalidateFinance = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.finances });
  const incomeMutation = useMutation({
    mutationFn: async () => {
      const amount = parseMoney(incomeAmount);
      const envelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope(
            "income",
            { amount },
            {
              encryptPayload: encryption.encryptPayload,
              keyVersion: encryption.settings?.keyVersion,
            },
          )
        : {};

      return upsertIncome(
        selectedIncomeMemberId,
        {
          amount: financeEncryptionEnabled ? 0 : amount,
          budgetMonthId: visibleMonth?.id,
          ...envelope,
        },
        { accessToken },
      );
    },
    onSuccess: async () => {
      setValue("incomeAmount", "");
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const categoryMutation = useMutation({
    mutationFn: async () => {
      const name = categoryName.trim();
      const envelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope(
            "budget-category",
            { name },
            {
              encryptPayload: encryption.encryptPayload,
              keyVersion: encryption.settings?.keyVersion,
            },
          )
        : {};

      return createBudgetCategory(
        {
          copyBudgetToNextMonth: copyCategory,
          name: financeEncryptionEnabled ? "[Zaszyfrowana kategoria]" : name,
          ...envelope,
        },
        { accessToken },
      );
    },
    onSuccess: async (category) => {
      setValue("categoryName", "");
      setSelectedItemCategoryId(category.id);
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const updateCategoryMutation = useMutation({
    mutationFn: async () => {
      const name = categoryName.trim();
      const envelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope(
            "budget-category",
            { name },
            {
              encryptPayload: encryption.encryptPayload,
              keyVersion: encryption.settings?.keyVersion,
            },
          )
        : {};

      return updateBudgetCategory(
        editingBudgetCategory?.id ?? "",
        {
          copyBudgetToNextMonth: copyCategory,
          name: financeEncryptionEnabled ? "[Zaszyfrowana kategoria]" : name,
          ...envelope,
        },
        { accessToken },
      );
    },
    onSuccess: async () => {
      setEditingBudgetCategory(null);
      setValue("categoryName", "");
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const archiveCategoryMutation = useMutation({
    mutationFn: () =>
      updateBudgetCategory(
        editingBudgetCategory?.id ?? "",
        { isActive: false },
        { accessToken },
      ),
    onSuccess: async () => {
      setEditingBudgetCategory(null);
      setValue("categoryName", "");
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const itemMutation = useMutation({
    mutationFn: async () => {
      const budgetAmount = itemAmount.trim() ? parseMoney(itemAmount) : null;
      const name = itemName.trim();
      const envelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope(
            "budget-item",
            { budgetAmount, name },
            {
              encryptPayload: encryption.encryptPayload,
              keyVersion: encryption.settings?.keyVersion,
            },
          )
        : {};

      return createBudgetItem(
        {
          budgetAmount: financeEncryptionEnabled ? null : budgetAmount,
          budgetMonthId: visibleMonth?.id ?? "",
          categoryId: selectedItemCategoryId,
          name: financeEncryptionEnabled ? "[Zaszyfrowana pozycja]" : name,
          ownerMemberId: selectedItemOwnerId,
          ...envelope,
        },
        { accessToken },
      );
    },
    onSuccess: async (item) => {
      setValue("itemName", "");
      setValue("itemAmount", "");
      setSelectedExpenseItemId(item.id);
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const updateItemMutation = useMutation({
    mutationFn: async () => {
      const budgetAmount = itemAmount.trim() ? parseMoney(itemAmount) : null;
      const name = itemName.trim();
      const envelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope(
            "budget-item",
            { budgetAmount, name },
            {
              encryptPayload: encryption.encryptPayload,
              keyVersion: encryption.settings?.keyVersion,
            },
          )
        : {};

      return updateBudgetItem(
        editingBudgetItem?.id ?? "",
        {
          budgetAmount: financeEncryptionEnabled ? null : budgetAmount,
          categoryId: selectedItemCategoryId,
          name: financeEncryptionEnabled ? "[Zaszyfrowana pozycja]" : name,
          ownerMemberId: selectedItemOwnerId,
          ...envelope,
        },
        { accessToken },
      );
    },
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
    mutationFn: (budgetItemId: string) =>
      deleteBudgetItem(budgetItemId, { accessToken }),
    onSuccess: async (_, budgetItemId) => {
      if (selectedExpenseItemId === budgetItemId) {
        setSelectedExpenseItemId("");
      }
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const saveDebtMutation = useMutation({
    mutationFn: async () => {
      const privateFields = {
        amount: parseMoney(debtAmount),
        lenderName: debtLenderName.trim(),
        note: debtNote.trim() || null,
        purpose: debtPurpose.trim(),
      };
      const envelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope("finance-debt", privateFields, {
            encryptPayload: encryption.encryptPayload,
            keyVersion: encryption.settings?.keyVersion,
          })
        : {};
      const input = {
        amount: financeEncryptionEnabled ? 0.01 : privateFields.amount,
        dueDate: debtDueDate.trim() ? debtDueDate.trim() : null,
        lenderName: financeEncryptionEnabled
          ? "[Zaszyfrowany pożyczkodawca]"
          : privateFields.lenderName,
        note: financeEncryptionEnabled ? null : privateFields.note,
        purpose: financeEncryptionEnabled
          ? "[Zaszyfrowany cel]"
          : privateFields.purpose,
        ...envelope,
      };

      return editingDebt
        ? updateFinanceDebt(
            editingDebt.id,
            { ...input, isSettled: debtIsSettled },
            { accessToken },
          )
        : createFinanceDebt(input, { accessToken });
    },
    onSuccess: async () => {
      resetDebtForm();
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const deleteDebtMutation = useMutation({
    mutationFn: (debtId: string) => deleteFinanceDebt(debtId, { accessToken }),
    onSuccess: async () => {
      resetDebtForm();
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const debtPaymentMutation = useMutation({
    mutationFn: async () => {
      const amount = parseMoney(debtPaymentAmount);
      const note = debtPaymentNote.trim() || null;
      const envelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope(
            "finance-debt-payment",
            { amount, note },
            {
              encryptPayload: encryption.encryptPayload,
              keyVersion: encryption.settings?.keyVersion,
            },
          )
        : {};

      return createFinanceDebtPayment(
        editingDebt?.id ?? "",
        {
          amount: financeEncryptionEnabled ? 0.01 : amount,
          note: financeEncryptionEnabled ? null : note,
          paidAt: todayIso(),
          ...envelope,
        },
        { accessToken },
      );
    },
    onSuccess: async (debt) => {
      const decryptedDebt = financeEncryptionEnabled
        ? (decryptFinanceDebts([debt], encryption.decryptPayload)[0] ?? debt)
        : debt;
      setEditingDebt(decryptedDebt);
      setDebtIsSettled(decryptedDebt.isSettled);
      setValue("debtPaymentAmount", "");
      setValue("debtPaymentNote", "");
      await invalidateFinance();
    },
  });
  const savingsAccountMutation = useMutation({
    mutationFn: async () => {
      const amount = parseMoney(savingsAmount);
      const name = savingsName.trim();
      const note = savingsNote.trim() || null;
      const targetAmount = parseMoney(savingsTargetAmount);
      const accountEnvelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope(
            "finance-savings-account",
            { currentAmount: amount, name, targetAmount },
            {
              encryptPayload: encryption.encryptPayload,
              keyVersion: encryption.settings?.keyVersion,
            },
          )
        : {};
      const transactionEnvelope =
        financeEncryptionEnabled && amount > 0
          ? await sealFinanceEnvelope(
              "finance-savings-transaction",
              { amount, note },
              {
                encryptPayload: encryption.encryptPayload,
                keyVersion: encryption.settings?.keyVersion,
              },
            )
          : null;

      return createFinanceSavingsAccount(
        {
          amount: financeEncryptionEnabled ? (amount > 0 ? 0.01 : 0) : amount,
          changedAt: todayIso(),
          ownerMemberId: selectedSavingsOwnerId || null,
          name: financeEncryptionEnabled ? "[Zaszyfrowany cel]" : name,
          note: financeEncryptionEnabled ? null : note,
          targetAmount: financeEncryptionEnabled ? null : targetAmount,
          targetDate: savingsTargetDate.trim() || null,
          transactionEncryptedPayload: transactionEnvelope?.encryptedPayload,
          ...accountEnvelope,
        },
        { accessToken },
      );
    },
    onSuccess: async () => {
      resetSavingsAccountForm();
      setSelectedSavingsOwnerId(householdMembers[0]?.id ?? "");
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const savingsTransactionMutation = useMutation({
    mutationFn: async () => {
      const amount = parseMoney(savingsTransactionAmount);
      const note = savingsTransactionNote.trim() || null;
      const envelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope(
            "finance-savings-transaction",
            { amount, note },
            {
              encryptPayload: encryption.encryptPayload,
              keyVersion: encryption.settings?.keyVersion,
            },
          )
        : {};

      return createFinanceSavingsTransaction(
        selectedSavingsAccount?.id ?? "",
        {
          amount: financeEncryptionEnabled ? 0.01 : amount,
          changedAt: todayIso(),
          direction: savingsDirection,
          note: financeEncryptionEnabled ? null : note,
          ...envelope,
        },
        { accessToken },
      );
    },
    onSuccess: async () => {
      resetSavingsTransactionForm();
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const deleteSavingsAccountMutation = useMutation({
    mutationFn: (accountId: string) =>
      deleteFinanceSavingsAccount(accountId, { accessToken }),
    onSuccess: async () => {
      setSelectedSavingsAccount(null);
      setFinanceModal(null);
      await invalidateFinance();
    },
  });
  const expenseMutation = useMutation({
    mutationFn: async () => {
      let budgetItemId =
        financeModal === "expenseHistory" && historyBudgetItemId
          ? historyBudgetItemId
          : selectedExpenseItemId;

      if (
        !budgetItemId &&
        expenseQuickCategoryId &&
        selectedExpenseCategory &&
        visibleMonth?.id
      ) {
        const quickItemEnvelope = financeEncryptionEnabled
          ? await sealFinanceEnvelope(
              "budget-item",
              { budgetAmount: null, name: selectedExpenseCategory.name },
              {
                encryptPayload: encryption.encryptPayload,
                keyVersion: encryption.settings?.keyVersion,
              },
            )
          : {};
        const createdItem = await createBudgetItem(
          {
            budgetAmount: null,
            budgetMonthId: visibleMonth.id,
            categoryId: selectedExpenseCategory.id,
            name: financeEncryptionEnabled
              ? "[Zaszyfrowana pozycja]"
              : selectedExpenseCategory.name,
            ownerMemberId: selectedExpenseOwnerId,
            ...quickItemEnvelope,
          },
          { accessToken },
        );

        budgetItemId = createdItem.id;
      }

      if (!budgetItemId) {
        throw new Error("Missing budget item");
      }

      const amount = parseMoney(expenseAmount);
      const envelope = financeEncryptionEnabled
        ? await sealFinanceEnvelope(
            "expense",
            { amount },
            {
              encryptPayload: encryption.encryptPayload,
              keyVersion: encryption.settings?.keyVersion,
            },
          )
        : {};

      return createExpense(
        {
          amount: financeEncryptionEnabled ? 0.01 : amount,
          budgetItemId,
          ...envelope,
        },
        { accessToken },
      );
    },
    onSuccess: async () => {
      setValue("expenseAmount", "");
      setExpenseQuickItemId(null);
      setExpenseQuickCategoryId(null);
      if (financeModal !== "expenseHistory") {
        setFinanceModal(null);
      }
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const nextMonthMutation = useMutation({
    mutationFn: async () => {
      const items = await Promise.all(
        selectedGenerateItems.map(async (item) => {
          const amountInput = generateAmountInputs[item.id]?.trim() ?? "";
          const budgetAmount = amountInput ? parseMoney(amountInput) : null;
          const envelope = financeEncryptionEnabled
            ? await sealFinanceEnvelope(
                "budget-item",
                { budgetAmount, name: item.name },
                {
                  encryptPayload: encryption.encryptPayload,
                  keyVersion: encryption.settings?.keyVersion,
                },
              )
            : {};

          return {
            budgetAmount: financeEncryptionEnabled ? null : budgetAmount,
            budgetItemId: item.id,
            ...envelope,
          };
        }),
      );

      return generateNextBudgetMonth(
        {
          categories: generateCategoryOrder.map((categoryId, displayOrder) => ({
            categoryId,
            displayOrder,
          })),
          items,
        },
        { accessToken },
      );
    },
    onSuccess: async (nextMonth) => {
      setSelectedMonthId(nextMonth.month.id);
      setGenerateCopyItemIds([]);
      setGenerateAmountInputs({});
      setGenerateCategoryOrder([]);
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
        queryClient.removeQueries({
          queryKey: [...queryKeys.finances, "month", deletedMonthId],
        });
      }
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });

  function closeFinanceModal() {
    setFinanceModal(null);
    setEditingBudgetCategory(null);
    setEditingBudgetItem(null);
    setEditingDebt(null);
    setDebtIsSettled(false);
    setSelectedSavingsAccount(null);
    resetSavingsAccountForm();
    resetSavingsTransactionForm();
    setExpenseQuickItemId(null);
    setExpenseQuickCategoryId(null);
    setHistoryBudgetItemId(null);
    setValue("debtPaymentAmount", "");
    setValue("debtPaymentNote", "");
    setGenerateCopyItemIds([]);
    setGenerateAmountInputs({});
    setGenerateCategoryOrder([]);
  }

  function openCreateCategory() {
    setEditingBudgetCategory(null);
    setValue("categoryName", "");
    setCopyCategory(true);
    setFinanceModal("category");
  }

  function openEditCategory(category: BudgetCategoryWithItems) {
    setEditingBudgetCategory(category);
    setValue("categoryName", category.name);
    setCopyCategory(category.copyBudgetToNextMonth);
    setFinanceModal("category");
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

  function openItemModalForCategory(category: BudgetCategoryWithItems) {
    setEditingBudgetItem(null);
    setSelectedItemCategoryId(category.id);
    setValue("itemName", "");
    setValue("itemAmount", "");
    setFinanceModal("item");
  }

  function openEditBudgetItem(item: BudgetItemWithCategory) {
    setEditingBudgetItem(item);
    setSelectedItemCategoryId(item.category.id);
    setSelectedItemOwnerId(item.owner?.memberId ?? "");
    setValue("itemName", item.name);
    setValue("itemAmount", formatMoneyInput(item.budgetAmount));
    setFinanceModal("item");
  }

  function openExpenseHistory(item: BudgetItemWithCategory) {
    setHistoryBudgetItemId(item.id);
    setSelectedExpenseOwnerId(item.owner?.memberId ?? "");
    setSelectedExpenseCategoryId(item.category.id);
    setSelectedExpenseItemId(item.id);
    setExpenseQuickItemId(null);
    setExpenseQuickCategoryId(null);
    setValue("expenseAmount", "");
    setFinanceModal("expenseHistory");
  }

  function updateFinanceFilters(nextFilters: Partial<FinanceFilters>) {
    setFinanceFilters((current) => ({ ...current, ...nextFilters }));
  }

  function resetDebtForm() {
    setEditingDebt(null);
    setDebtIsSettled(false);
    setValue("debtAmount", "");
    setValue("debtDueDate", "");
    setValue("debtLenderName", "");
    setValue("debtNote", "");
    setValue("debtPaymentAmount", "");
    setValue("debtPaymentNote", "");
    setValue("debtPurpose", "");
  }

  function openCreateDebt() {
    resetDebtForm();
    setFinanceModal("debt");
  }

  function openEditDebt(debt: FinanceDebt) {
    setEditingDebt(debt);
    setDebtIsSettled(debt.isSettled);
    setValue("debtAmount", formatMoneyInput(debt.amount));
    setValue("debtDueDate", debt.dueDate ?? "");
    setValue("debtLenderName", debt.lenderName);
    setValue("debtNote", debt.note ?? "");
    setValue("debtPaymentAmount", "");
    setValue("debtPaymentNote", "");
    setValue("debtPurpose", debt.purpose);
    setFinanceModal("debt");
  }

  function resetSavingsAccountForm() {
    setValue("savingsAmount", "");
    setValue("savingsName", "");
    setValue("savingsNote", "");
    setValue("savingsTargetAmount", "");
    setValue("savingsTargetDate", "");
  }

  function openCreateSavingsAccount() {
    resetSavingsAccountForm();
    setSelectedSavingsOwnerId(
      householdMembers.find((member) => member.id === selectedSavingsOwnerId)
        ? selectedSavingsOwnerId
        : (householdMembers[0]?.id ?? ""),
    );
    setFinanceModal("savingsAccount");
  }

  function resetSavingsTransactionForm() {
    setSelectedSavingsAccount(null);
    setSavingsDirection("add");
    setValue("savingsTransactionAmount", "");
    setValue("savingsTransactionNote", "");
  }

  function openSavingsTransaction(
    account: FinanceSavingsAccount,
    direction: FinanceSavingsDirection,
  ) {
    setSelectedSavingsAccount(account);
    setSavingsDirection(direction);
    setValue("savingsTransactionAmount", "");
    setValue("savingsTransactionNote", "");
    setFinanceModal("savingsTransaction");
  }

  function openSavingsDetails(account: FinanceSavingsAccount) {
    setSelectedSavingsAccount(account);
    setFinanceModal("savingsDetails");
  }

  function selectIncomeMember(memberId: string) {
    const income = incomes.find((entry) => entry.ownerMemberId === memberId);

    setSelectedIncomeMemberId(memberId);
    setValue("incomeAmount", formatMoneyInput(income?.amount ?? 0));
  }

  function openIncomeModal() {
    const memberId = selectedIncomeMemberId || incomes[0]?.ownerMemberId || "";

    if (memberId) {
      selectIncomeMember(memberId);
    }

    setFinanceModal("income");
  }

  const canSaveIncome =
    canUpdate && Boolean(selectedIncomeMemberId) && isValidMoney(incomeAmount);
  const canSaveCategory =
    (editingBudgetCategory ? canUpdate : canCreate) &&
    Boolean(categoryName.trim());
  const canSaveItem =
    canCreateVisibleBudgetItem &&
    Boolean(itemName.trim()) &&
    Boolean(selectedItemCategoryId) &&
    Boolean(selectedItemOwnerId) &&
    (!itemAmount.trim() || isValidMoney(itemAmount));
  const canSaveEditedItem =
    canUpdateVisibleBudgetItem &&
    Boolean(editingBudgetItem?.id) &&
    Boolean(itemName.trim()) &&
    Boolean(selectedItemCategoryId) &&
    Boolean(selectedItemOwnerId) &&
    (!itemAmount.trim() || isValidMoney(itemAmount));
  const canSaveExpense =
    canCreate &&
    isPositiveMoney(expenseAmount) &&
    (Boolean(financeModal === "expenseHistory" && historyBudgetItemId) ||
      Boolean(selectedExpenseItem) ||
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
  const debtRemainingAmount = Number(
    editingDebt?.remainingAmount ?? editingDebt?.amount ?? 0,
  );
  const canSaveDebtPayment =
    canUpdate &&
    Boolean(editingDebt?.id) &&
    debtRemainingAmount > 0 &&
    isPositiveMoney(debtPaymentAmount) &&
    parseMoney(debtPaymentAmount) <= debtRemainingAmount &&
    !debtPaymentMutation.isPending;
  const canSaveSavingsAccount =
    canCreate &&
    Boolean(selectedSavingsOwnerId) &&
    Boolean(savingsName.trim()) &&
    isValidMoney(savingsAmount) &&
    isPositiveMoney(savingsTargetAmount) &&
    /^\d{4}-\d{2}-\d{2}$/.test(savingsTargetDate.trim());
  const canSaveSavingsTransaction =
    canUpdate &&
    Boolean(selectedSavingsAccount?.id) &&
    isPositiveMoney(savingsTransactionAmount);
  const canGenerateNextMonth =
    canCreate &&
    Boolean(currentMonth?.id) &&
    !nextMonthMutation.isPending &&
    selectedGenerateItems.every((item) => {
      const value = generateAmountInputs[item.id] ?? "";

      return !value.trim() || isValidMoney(value);
    });
  const canRemoveSelectedMonth =
    canDelete &&
    Boolean(selectedMonthId) &&
    monthTabs.length > 1 &&
    !deleteMonthMutation.isPending;
  const canOpenFinanceActions =
    activeFinanceView === "budget"
      ? canCreate || canDelete || canUpdate
      : canCreate;
  const financeActionLabel =
    activeFinanceView === "debts"
      ? "Dodaj pożyczkę"
      : activeFinanceView === "savings"
        ? "Dodaj cel oszczędnościowy"
        : "Akcje finansów";

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

  if (encryption.lockState === "loading") {
    return (
      <AppScreen title="Finanse">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (financeEncryptionEnabled && encryption.lockState === "locked") {
    return (
      <AppScreen
        actions={
          notificationExpenseImport.available ? (
            <IconButton
              accessibilityLabel="Oczekujące płatności z powiadomień"
              onPress={() =>
                router.push("/notification-expense-import" as never)
              }
              style={styles.financeHeaderActionButton}
            >
              <CreditCardClock
                color={theme.isDark ? theme.colors.primary : mockupGreen}
                size={23}
              />
              {notificationImportPendingCount > 0 ? (
                <Text style={styles.notificationImportBadge}>
                  {Math.min(99, notificationImportPendingCount)}
                </Text>
              ) : null}
            </IconButton>
          ) : undefined
        }
        title="Finanse"
      >
        <EncryptionUnlockCard modules={["finances"]} />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      actions={
        <View style={styles.financeHeaderActions}>
          {notificationExpenseImport.available ? (
            <IconButton
              accessibilityLabel="Oczekujące płatności z powiadomień"
              onPress={() =>
                router.push("/notification-expense-import" as never)
              }
              style={styles.financeHeaderActionButton}
            >
              <CreditCardClock
                color={theme.isDark ? theme.colors.primary : mockupGreen}
                size={23}
              />
              {notificationImportPendingCount > 0 ? (
                <Text style={styles.notificationImportBadge}>
                  {Math.min(99, notificationImportPendingCount)}
                </Text>
              ) : null}
            </IconButton>
          ) : null}
          {activeFinanceView === "budget" ? (
            <IconButton
              accessibilityLabel="Szukaj w budżecie"
              onPress={() => setFinanceSearchVisible((visible) => !visible)}
              style={styles.financeHeaderActionButton}
            >
              <Search
                color={theme.isDark ? theme.colors.primary : mockupGreen}
                size={23}
              />
            </IconButton>
          ) : null}
          {canOpenFinanceActions ? (
            <IconButton
              accessibilityLabel={financeActionLabel}
              onPress={() => {
                if (activeFinanceView === "debts") {
                  openCreateDebt();
                  return;
                }

                if (activeFinanceView === "savings") {
                  openCreateSavingsAccount();
                  return;
                }

                setFinanceModal("menu");
              }}
              style={styles.financeHeaderActionButton}
            >
              <WalletPlus
                color={theme.isDark ? theme.colors.primary : mockupGreen}
                size={24}
              />
            </IconButton>
          ) : null}
        </View>
      }
      contentStyle={styles.financeScreenContent}
      backgroundColor={
        theme.isDark ? theme.colors.background : "#FBFAF6"
      }
      title="Finanse"
    >
      {!summary ? (
        <QueryState
          emptyText="Brak danych finansowych."
          error={
            currentQuery.error ??
            (showingArchiveMonth ? selectedArchiveQuery.error : null)
          }
          isEmpty={!currentQuery.isLoading}
          isLoading={currentQuery.isLoading || selectedArchiveQuery.isLoading}
        />
      ) : null}

      <SegmentedControl
        accentColor={mockupGreen}
        onChange={(value) => setActiveFinanceView(value as FinanceView)}
        options={[
          {
            icon: (active) => (
              <ChartBar
                color={
                  active
                    ? theme.isDark
                      ? theme.colors.primaryDarker
                      : mockupGreen
                    : theme.colors.textMuted
                }
                size={16}
              />
            ),
            label: "Budżet",
            value: "budget",
          },
          {
            icon: (active) => (
              <ReceiptText
                color={
                  active
                    ? theme.isDark
                      ? theme.colors.primaryDarker
                      : mockupGreen
                    : theme.colors.textMuted
                }
                size={16}
              />
            ),
            label: "Pożyczki",
            value: "debts",
          },
          {
            icon: (active) => (
              <PiggyBank
                color={
                  active
                    ? theme.isDark
                      ? theme.colors.primaryDarker
                      : mockupGreen
                    : theme.colors.textMuted
                }
                size={16}
              />
            ),
            label: "Oszczędności",
            value: "savings",
          },
        ]}
        presentation="mockup"
        value={activeFinanceView}
      />

      {activeFinanceView === "budget" && financeSearchVisible ? (
        <View style={styles.financeHeaderSearch}>
          <Search color={theme.colors.textMuted} size={19} />
          <TextInput
            autoFocus
            onChangeText={(search) => updateFinanceFilters({ search })}
            placeholder="Szukaj kategorii lub pozycji"
            placeholderTextColor={theme.colors.textSubtle}
            style={styles.financeHeaderSearchInput}
            value={financeFilters.search}
          />
          <IconButton
            accessibilityLabel="Wyczyść i zamknij wyszukiwanie"
            onPress={() => {
              updateFinanceFilters({ search: "" });
              setFinanceSearchVisible(false);
            }}
            style={styles.financeSearchCloseButton}
          >
            <Close color={theme.colors.textMuted} size={18} />
          </IconButton>
        </View>
      ) : null}

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
                <ChevronLeft
                  color={
                    canGoPreviousMonth
                      ? theme.colors.textMuted
                      : theme.colors.textSubtle
                  }
                  size={20}
                />
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
                <ChevronRight
                  color={
                    canGoNextMonth
                      ? theme.colors.textMuted
                      : theme.colors.textSubtle
                  }
                  size={20}
                />
              </IconButton>
            </View>
            <IconButton
              accessibilityLabel="Filtry i sortowanie budżetu"
              onPress={() => setFinanceFiltersExpanded((value) => !value)}
              style={[
                styles.monthFilterButton,
                (financeFiltersExpanded ||
                  hasActiveFinanceFilters(financeFilters)) &&
                  styles.monthFilterButtonActive,
              ]}
            >
              <Filter
                color={
                  financeFiltersExpanded ||
                  hasActiveFinanceFilters(financeFilters)
                    ? theme.colors.primaryDark
                    : theme.colors.textMuted
                }
                size={19}
              />
            </IconButton>
            {canDelete && canRemoveSelectedMonth ? (
              <IconButton
                accessibilityLabel="Usuń wybrany miesiąc budżetu"
                disabled={!canRemoveSelectedMonth}
                onPress={() => setDeleteMonthConfirmVisible(true)}
                style={styles.monthDeleteButton}
              >
                <Trash2
                  color={
                    canRemoveSelectedMonth
                      ? theme.colors.danger
                      : theme.colors.textSubtle
                  }
                  size={19}
                />
              </IconButton>
            ) : null}
          </View>

          <FinanceSummaryCard
            budgetAmount={budgetAmount}
            currencyCode={currencyCode}
            remainingAmount={remainingAmount}
            spentAmount={spentAmount}
          />

          <FinanceFiltersPanel
            categories={categories}
            expanded={financeFiltersExpanded}
            filters={financeFilters}
            onChange={updateFinanceFilters}
            owners={financeOwnerOptions}
          />

          <BudgetViewToggle
            onChange={setBudgetViewMode}
            value={budgetViewMode}
          />

          {budgetViewMode === "cards" ? (
            <FinanceCategoryCards
              canCreateItem={canCreateVisibleBudgetItem}
              canEditCategory={canUpdate}
              categories={filteredCategories}
              currencyCode={currencyCode}
              onAddCategoryItem={openItemModalForCategory}
              onEditCategory={openEditCategory}
              onHistory={openExpenseHistory}
              rows={filteredRows}
              showOwner={!financeFilters.ownerMemberId}
            />
          ) : (
            <FinanceBudgetTable
              canEditCategory={canUpdate}
              categories={filteredCategories}
              currencyCode={currencyCode}
              onEditCategory={openEditCategory}
              onHistory={openExpenseHistory}
              rows={filteredRows}
              showOwner={!financeFilters.ownerMemberId}
            />
          )}

          <View style={styles.totalRow}>
            <View style={styles.totalMetric}>
              <Text numberOfLines={1} style={styles.totalMetricLabel}>
                Dochód
              </Text>
              <Text numberOfLines={1} style={styles.totalMetricValue}>
                {formatMoney(incomeAmountValue, currencyCode)}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.totalMetricMeta,
                  incomeBudgetDifference < 0 && styles.dangerText,
                  incomeBudgetDifference > 0 && styles.positiveText,
                ]}
              >
                Budżet {formatSignedMoney(incomeBudgetDifference, currencyCode)}
              </Text>
            </View>
            <View style={styles.totalMetric}>
              <Text numberOfLines={1} style={styles.totalMetricLabel}>
                Wydano
              </Text>
              <Text numberOfLines={1} style={styles.totalMetricValue}>
                {formatMoney(spentAmount, currencyCode)}
              </Text>
            </View>
            <View style={styles.totalMetric}>
              <Text
                numberOfLines={1}
                style={[
                  styles.totalMetricLabel,
                  remainingAmount < 0 && styles.dangerText,
                ]}
              >
                {remainingAmount < 0 ? "Przekroczono" : "Zostaje"}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.totalMetricValue,
                  remainingAmount < 0 && styles.dangerText,
                ]}
              >
                {formatMoney(remainingAmount, currencyCode)}
              </Text>
            </View>
          </View>

          <FormModal
            onClose={closeFinanceModal}
            title="Menu finansów"
            visible={financeModal === "menu"}
          >
            <View style={styles.financeMenu}>
              {canCreate ? (
                <View style={styles.financeMenuSection}>
                  <Text style={styles.financeMenuHeading}>Budżet</Text>
                  <View style={styles.actionPicker}>
                    <ActionButton
                      onPress={openCreateCategory}
                      title="Dodaj kategorię"
                      variant="secondary"
                    />
                    <ActionButton
                      disabled={!canCreateVisibleBudgetItem}
                      onPress={() => {
                        setEditingBudgetItem(null);
                        setValue("itemName", "");
                        setValue("itemAmount", "");
                        setFinanceModal("item");
                      }}
                      title="Dodaj pozycję budżetu"
                    />
                    <ActionButton
                      disabled={!canCreateVisibleExpense}
                      onPress={openExpenseModal}
                      title="Dodaj wydatek"
                      variant="secondary"
                    />
                  </View>
                </View>
              ) : null}

              {canCreate || canDelete ? (
                <View style={styles.financeMenuSection}>
                  <Text style={styles.financeMenuHeading}>Miesiąc</Text>
                  <View style={styles.actionPicker}>
                    {canCreate ? (
                      <ActionButton
                        disabled={!currentMonth?.id}
                        onPress={openGenerateMonthModal}
                        title="Wygeneruj nowy miesiąc"
                      />
                    ) : null}
                    {canDelete ? (
                      <ActionButton
                        disabled={!canRemoveSelectedMonth}
                        onPress={() => setDeleteMonthConfirmVisible(true)}
                        title="Usuń wybrany miesiąc"
                        variant="ghost"
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}

              {canUpdate ? (
                <View style={styles.financeMenuSection}>
                  <Text style={styles.financeMenuHeading}>Domownicy</Text>
                  <View style={styles.actionPicker}>
                    <ActionButton
                      onPress={openIncomeModal}
                      title="Zmień dochód"
                      variant="secondary"
                    />
                  </View>
                </View>
              ) : null}
              {deleteMonthMutation.error ? (
                <InlineAlert
                  tone="error"
                  text="Nie udało się usunąć miesiąca."
                />
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
                  disabled={!canGenerateNextMonth}
                  loading={nextMonthMutation.isPending}
                  onPress={() => nextMonthMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Wygeneruj"
                />
              </View>
            }
            onClose={closeFinanceModal}
            scrollEnabled={false}
            subtitle={currentMonth ? formatMonthLong(currentMonth) : undefined}
            title="Wygeneruj nowy miesiąc"
            visible={financeModal === "generateMonth"}
          >
            <View style={styles.generateModalBody}>
              {generateSourceCategories.length > 0 ? (
                <View style={styles.generateCopyList}>
                  {generateSourceItems.length > 0 ? (
                    <View style={styles.generateToolbar}>
                      <Text style={styles.generateToolbarMeta}>
                        Wybrano {selectedGenerateItems.length}/
                        {generateSourceItems.length} pozycji
                      </Text>
                      <View style={styles.generateToolbarActions}>
                        <ActionButton
                          disabled={
                            selectedGenerateItems.length ===
                            generateSourceItems.length
                          }
                          onPress={() => setGenerateAllItemsCopy(true)}
                          size="small"
                          style={styles.generateToolbarButton}
                          title="Kopiuj wszystko"
                          variant="secondary"
                        />
                        <ActionButton
                          disabled={selectedGenerateItems.length === 0}
                          onPress={() => setGenerateAllItemsCopy(false)}
                          size="small"
                          style={styles.generateToolbarButton}
                          title="Pusty miesiąc"
                          variant="ghost"
                        />
                      </View>
                    </View>
                  ) : null}
                  <DraggableFlatList
                    activationDistance={8}
                    autoscrollSpeed={160}
                    autoscrollThreshold={90}
                    data={orderedGenerateCategories}
                    keyExtractor={(category) => category.id}
                    onDragEnd={({ data }) =>
                      setGenerateCategoryOrder(
                        data.map((category) => category.id),
                      )
                    }
                    renderItem={({ drag, isActive, item: category }) => {
                      const categoryItems = getCategoryItems(category).map(
                        (item) => ({
                          ...item,
                          category,
                        }),
                      );
                      const selectedCount = categoryItems.filter((item) =>
                        generateSelectedItemSet.has(item.id),
                      ).length;
                      const allSelected =
                        categoryItems.length > 0 &&
                        selectedCount === categoryItems.length;
                      const partiallySelected =
                        selectedCount > 0 && !allSelected;

                      return (
                        <ScaleDecorator activeScale={1.015}>
                          <View
                            style={[
                              styles.generateCategoryGroup,
                              isActive && styles.generateCategoryGroupActive,
                            ]}
                          >
                            <View style={styles.generateCategoryHeader}>
                              <Pressable
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: allSelected }}
                                disabled={categoryItems.length === 0}
                                onPress={() =>
                                  setGenerateCategoryCopy(
                                    category,
                                    !allSelected,
                                  )
                                }
                                style={styles.generateCategorySelect}
                              >
                                <View
                                  style={[
                                    styles.generateCheckbox,
                                    allSelected &&
                                      styles.generateCheckboxChecked,
                                    partiallySelected &&
                                      styles.generateCheckboxPartial,
                                  ]}
                                >
                                  {allSelected ? (
                                    <Check
                                      color={theme.colors.inverseText}
                                      size={13}
                                    />
                                  ) : partiallySelected ? (
                                    <Minus
                                      color={theme.colors.inverseText}
                                      size={13}
                                    />
                                  ) : null}
                                </View>
                                <View style={styles.generateCategoryText}>
                                  <Text
                                    numberOfLines={1}
                                    style={styles.generateCategoryTitle}
                                  >
                                    {category.name}
                                  </Text>
                                  <Text style={styles.generateCategoryMeta}>
                                    {categoryItems.length === 0
                                      ? "Pusta kategoria"
                                      : `${selectedCount}/${categoryItems.length} pozycji`}
                                  </Text>
                                </View>
                              </Pressable>
                              <Pressable
                                accessibilityLabel={`Przeciągnij kategorię ${category.name}`}
                                accessibilityRole="button"
                                delayLongPress={180}
                                disabled={isActive}
                                onLongPress={drag}
                                style={({ pressed }) => [
                                  styles.generateDragHandle,
                                  (pressed || isActive) &&
                                    styles.generateDragHandleActive,
                                ]}
                              >
                                <DragHandle
                                  color={
                                    isActive
                                      ? theme.colors.primaryDark
                                      : theme.colors.textMuted
                                  }
                                  size={25}
                                />
                              </Pressable>
                            </View>

                            <View style={styles.generateItemList}>
                              {categoryItems.map((item) => {
                                const selected = generateSelectedItemSet.has(
                                  item.id,
                                );

                                return (
                                  <View
                                    key={item.id}
                                    style={[
                                      styles.generateItemRow,
                                      !selected && styles.generateItemRowMuted,
                                    ]}
                                  >
                                    <Pressable
                                      accessibilityRole="checkbox"
                                      accessibilityState={{ checked: selected }}
                                      onPress={() =>
                                        toggleGenerateItemCopy(item)
                                      }
                                      style={styles.generateItemCheckButton}
                                    >
                                      <View
                                        style={[
                                          styles.generateCheckbox,
                                          selected &&
                                            styles.generateCheckboxChecked,
                                        ]}
                                      >
                                        {selected ? (
                                          <Check
                                            color={theme.colors.inverseText}
                                            size={13}
                                          />
                                        ) : null}
                                      </View>
                                    </Pressable>
                                    <View style={styles.copyAmountText}>
                                      <Text
                                        numberOfLines={1}
                                        style={styles.copyAmountTitle}
                                      >
                                        {item.name}
                                      </Text>
                                      <Text
                                        numberOfLines={1}
                                        style={styles.copyAmountMeta}
                                      >
                                        {formatOwner(item.owner)}
                                      </Text>
                                    </View>
                                    {selected ? (
                                      <TextInput
                                        keyboardType="decimal-pad"
                                        onChangeText={(value) =>
                                          setGenerateAmountInputs(
                                            (current) => ({
                                              ...current,
                                              [item.id]: value,
                                            }),
                                          )
                                        }
                                        placeholder="0,00"
                                        placeholderTextColor={
                                          theme.colors.textSubtle
                                        }
                                        style={styles.copyAmountInput}
                                        value={
                                          generateAmountInputs[item.id] ?? ""
                                        }
                                      />
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        </ScaleDecorator>
                      );
                    }}
                    showsVerticalScrollIndicator={false}
                    style={styles.generateCategoryList}
                  />
                </View>
              ) : null}
              {generateSourceItems.length === 0 ? (
                <InlineAlert
                  tone="info"
                  text="Bieżący miesiąc nie ma jeszcze pozycji budżetu."
                />
              ) : null}
              {nextMonthMutation.error ? (
                <InlineAlert
                  tone="error"
                  text="Nie udało się wygenerować nowego miesiąca."
                />
              ) : null}
            </View>
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
                Ta akcja usuwa miesiąc budżetowy, jego pozycje, dochody i
                wydatki. Jeśli usuwasz aktualny miesiąc, poprzedni miesiąc wróci
                jako aktywny.
              </Text>
            </View>
          </FormModal>

          <FormModal
            compact
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
              onSelect={selectIncomeMember}
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
                  loading={
                    editingBudgetCategory
                      ? updateCategoryMutation.isPending
                      : categoryMutation.isPending
                  }
                  onPress={() =>
                    editingBudgetCategory
                      ? updateCategoryMutation.mutate()
                      : categoryMutation.mutate()
                  }
                  style={styles.modalFooterButton}
                  title={editingBudgetCategory ? "Zapisz" : "Dodaj"}
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle={
              editingBudgetCategory
                ? "Zmiana dotyczy kategorii we wszystkich miesiącach. Usunięcie wyłącza ją w przyszłych budżetach, ale zachowuje historię."
                : "Kategorie porządkują budżet i mogą przechodzić na następny miesiąc."
            }
            title={
              editingBudgetCategory ? "Edytuj kategorię" : "Dodaj kategorię"
            }
            visible={financeModal === "category"}
          >
            <TextField
              control={control}
              label="Nazwa kategorii"
              name="categoryName"
              placeholder="Np. rachunki"
            />
            <View style={styles.switchRow}>
              <Text style={styles.muted}>
                Kopiuj pozycje do kolejnego miesiąca
              </Text>
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
            {editingBudgetCategory && canDelete ? (
              <ActionButton
                disabled={archiveCategoryMutation.isPending}
                loading={archiveCategoryMutation.isPending}
                onPress={() => archiveCategoryMutation.mutate()}
                title="Usuń kategorię z przyszłych miesięcy"
                variant="ghost"
              />
            ) : null}
            {categoryMutation.error ||
            updateCategoryMutation.error ||
            archiveCategoryMutation.error ? (
              <InlineAlert
                tone="error"
                text="Nie udało się zapisać kategorii."
              />
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
                  disabled={
                    editingBudgetItem ? !canSaveEditedItem : !canSaveItem
                  }
                  loading={
                    editingBudgetItem
                      ? updateItemMutation.isPending
                      : itemMutation.isPending
                  }
                  onPress={() =>
                    editingBudgetItem
                      ? updateItemMutation.mutate()
                      : itemMutation.mutate()
                  }
                  style={styles.modalFooterButton}
                  title={editingBudgetItem ? "Zapisz" : "Dodaj"}
                />
              </View>
            }
            onClose={closeFinanceModal}
            subtitle={
              editingBudgetItem
                ? "Zmieniasz nazwę, osobę, kategorię albo limit tej pozycji."
                : "Pozycja to konkretny limit lub koszt w aktualnym miesiącu."
            }
            title={
              editingBudgetItem
                ? "Edytuj pozycję budżetu"
                : "Dodaj pozycję budżetu"
            }
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
                title="Usuń pozycję"
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
                  {selectedExpenseItem
                    ? formatOwner(selectedExpenseItem.owner)
                    : selectedExpenseOwner?.label}
                </Text>
                <Text style={styles.expenseContextTitle}>
                  {selectedExpenseItem?.name ?? selectedExpenseCategory?.name}
                </Text>
                <Text style={styles.expenseContextMeta}>
                  {selectedExpenseCategory?.name}
                  {selectedExpenseItem
                    ? ` / wydano ${formatMoney(selectedExpenseItem.spentAmount, currencyCode)} z ${
                        selectedExpenseItem.budgetAmount
                          ? formatMoney(
                              selectedExpenseItem.budgetAmount,
                              currencyCode,
                            )
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
            subtitle={
              historyBudgetItem
                ? `${historyBudgetItem.category.name} / ${historyBudgetItem.name}`
                : undefined
            }
            title="Wydatek i historia"
            visible={financeModal === "expenseHistory"}
          >
            {historyBudgetItem ? (
              <View style={styles.selectorGroup}>
                <View style={styles.expenseHistoryAddCard}>
                  <View style={styles.expenseHistoryAddHeader}>
                    <View>
                      <Text style={styles.expenseContextLabel}>
                        Dodaj wydatek
                      </Text>
                      <Text style={styles.expenseContextTitle}>
                        {historyBudgetItem.name}
                      </Text>
                    </View>
                    <Text style={styles.expenseContextMeta}>
                      {formatOwner(historyBudgetItem.owner)}
                    </Text>
                  </View>
                  <TextField
                    control={control}
                    keyboardType="decimal-pad"
                    label="Kwota wydatku"
                    name="expenseAmount"
                    placeholder="0,00"
                  />
                  <ActionButton
                    disabled={!canSaveExpense}
                    loading={expenseMutation.isPending}
                    onPress={() => expenseMutation.mutate()}
                    title="Dodaj wydatek"
                  />
                  {expenseMutation.error ? (
                    <InlineAlert
                      tone="error"
                      text="Nie udało się dodać wydatku."
                    />
                  ) : null}
                </View>
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
                        ? formatMoney(
                            historyBudgetItem.budgetAmount,
                            currencyCode,
                          )
                        : "bez limitu"}
                    </Text>
                    <Text
                      style={[
                        styles.expenseContextMeta,
                        Number(historyBudgetItem.remainingAmount ?? 0) < 0 &&
                          styles.dangerText,
                        Number(historyBudgetItem.remainingAmount ?? 0) >= 0 &&
                          styles.positiveText,
                      ]}
                    >
                      Zostaje{" "}
                      {historyBudgetItem.budgetAmount
                        ? formatMoney(
                            historyBudgetItem.remainingAmount ?? 0,
                            currencyCode,
                          )
                        : "bez limitu"}
                    </Text>
                  </View>
                </View>
                {historyExpenses.length > 0 ? (
                  <View style={styles.expenseHistoryList}>
                    {historyExpenses.map((expense) => (
                      <View key={expense.id} style={styles.expenseHistoryRow}>
                        <View style={styles.expenseHistoryText}>
                          <Text style={styles.expenseHistoryTitle}>
                            {expense.name?.trim() || "Wydatek"}
                          </Text>
                          <Text style={styles.expenseHistoryMeta}>
                            {formatDateTimeFull(
                              expense.occurredAt ?? expense.createdAt,
                            )}
                          </Text>
                        </View>
                        <Text style={styles.expenseHistoryAmount}>
                          {formatMoney(expense.amount, currencyCode)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <InlineAlert text="Brak wydatków dla tej pozycji." />
                )}
                {canUpdateVisibleBudgetItem || canDeleteVisibleMonthItems ? (
                  <View style={styles.expenseHistoryActions}>
                    {canUpdateVisibleBudgetItem ? (
                      <ActionButton
                        onPress={() => openEditBudgetItem(historyBudgetItem)}
                        title="Edytuj pozycję"
                        variant="secondary"
                      />
                    ) : null}
                    {canDeleteVisibleMonthItems ? (
                      <ActionButton
                        disabled={deleteItemMutation.isPending}
                        loading={deleteItemMutation.isPending}
                        onPress={() =>
                          deleteItemMutation.mutate(historyBudgetItem.id, {
                            onSuccess: () => closeFinanceModal(),
                          })
                        }
                        title="Usuń pozycję"
                        variant="ghost"
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <InlineAlert text="Nie znaleziono wybranej pozycji budżetu." />
            )}
          </FormModal>
        </>
      ) : null}

      {activeFinanceView === "debts" ? (
        <>
          <FinanceDebtOverview
            activeCount={openDebts.length}
            currencyCode={currencyCode}
            openDebtTotal={openDebtTotal}
            settledCount={settledDebts.length}
          />
          <QueryState
            emptyText="Brak pożyczek."
            error={debtsQuery.error}
            isEmpty={!debtsQuery.isLoading && debts.length === 0}
            isLoading={debtsQuery.isLoading}
          />
          <FinanceDebtsList
            canUpdate={canUpdate}
            currencyCode={currencyCode}
            debts={debts}
            onEdit={openEditDebt}
          />
          <FormModal
            footer={
              <View style={styles.debtModalFooter}>
                <ActionButton
                  disabled={!canSaveDebt}
                  loading={saveDebtMutation.isPending}
                  onPress={() => saveDebtMutation.mutate()}
                  style={styles.debtSaveButton}
                  title={editingDebt ? "Zapisz zmiany" : "Dodaj pożyczkę"}
                />
                {editingDebt && canDelete ? (
                  <IconButton
                    accessibilityLabel="Usuń pożyczkę"
                    disabled={deleteDebtMutation.isPending}
                    onPress={() => deleteDebtMutation.mutate(editingDebt.id)}
                    style={styles.debtDeleteButton}
                  >
                    <Trash2 color={theme.colors.danger} size={24} />
                  </IconButton>
                ) : null}
              </View>
            }
            onClose={closeFinanceModal}
            showCloseButton={false}
            title={editingDebt ? "Edytuj pożyczkę" : "Dodaj pożyczkę"}
            visible={financeModal === "debt"}
          >
            <View style={styles.debtEditorPreview}>
              <View style={styles.debtEditorIcon}>
                <WalletCards color={theme.colors.finance} size={22} />
              </View>
              <View style={styles.debtEditorPreviewText}>
                <Text numberOfLines={1} style={styles.debtEditorPreviewTitle}>
                  {debtPurpose.trim() || "Nowa pożyczka"}
                </Text>
                <Text numberOfLines={1} style={styles.debtEditorPreviewMeta}>
                  {debtLenderName.trim() || "Od kogo"}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.debtEditorPreviewAmount}>
                {isValidMoney(debtAmount)
                  ? formatMoney(parseMoney(debtAmount), currencyCode)
                  : formatMoney(0, currencyCode)}
              </Text>
            </View>
            <TextField
              control={control}
              inputStyle={styles.debtFormInput}
              label="Nazwa"
              name="debtPurpose"
              placeholder="Np. tineco odkurzacz"
            />
            <View style={styles.debtFormGrid}>
              <TextField
                containerStyle={styles.debtFormField}
                control={control}
                inputStyle={styles.debtFormInput}
                label="Osoba"
                name="debtLenderName"
                placeholder="Np. Malwinka"
              />
              <TextField
                containerStyle={styles.debtFormField}
                control={control}
                inputStyle={styles.debtFormInput}
                keyboardType="decimal-pad"
                label="Kwota"
                name="debtAmount"
                placeholder="0,00"
              />
            </View>
            <DatePickerField
              allowClear
              label="Termin oddania"
              onChange={(date) => setValue("debtDueDate", date)}
              value={debtDueDate}
            />
            <TextField
              control={control}
              inputStyle={styles.debtFormInput}
              label="Notatka"
              name="debtNote"
              placeholder="Opcjonalnie"
            />
            {editingDebt ? (
              <View style={styles.debtStatusGroup}>
                <Text style={styles.selectorLabel}>Status</Text>
                <SegmentedControl
                  accentColor={mockupGreen}
                  onChange={(value) => setDebtIsSettled(value === "settled")}
                  options={[
                    { label: "Aktywne", value: "active" },
                    { label: "Spłacone", value: "settled" },
                  ]}
                  value={debtIsSettled ? "settled" : "active"}
                />
              </View>
            ) : null}
            {editingDebt ? (
              <View style={styles.debtPaymentPanel}>
                <Text style={styles.debtPaymentTitle}>Spłata</Text>
                <View style={styles.debtPaymentSummary}>
                  <View style={styles.debtPaymentSummaryItem}>
                    <Text style={styles.debtPaymentSummaryLabel}>Kwota</Text>
                    <Text style={styles.debtPaymentSummaryValue}>
                      {formatMoney(editingDebt.amount, currencyCode)}
                    </Text>
                  </View>
                  <View style={styles.debtPaymentSummaryItem}>
                    <Text style={styles.debtPaymentSummaryLabel}>Spłacono</Text>
                    <Text style={styles.debtPaymentSummaryValue}>
                      {formatMoney(editingDebt.paidAmount, currencyCode)}
                    </Text>
                  </View>
                  <View style={styles.debtPaymentSummaryItem}>
                    <Text style={styles.debtPaymentSummaryLabel}>Zostaje</Text>
                    <Text style={styles.debtPaymentSummaryValue}>
                      {formatMoney(editingDebt.remainingAmount, currencyCode)}
                    </Text>
                  </View>
                </View>
                {debtRemainingAmount > 0 ? (
                  <>
                    <View style={styles.debtFormGrid}>
                      <TextField
                        containerStyle={styles.debtFormField}
                        control={control}
                        inputStyle={styles.debtFormInput}
                        keyboardType="decimal-pad"
                        label="Kwota spłaty"
                        name="debtPaymentAmount"
                        placeholder="0,00"
                      />
                      <TextField
                        containerStyle={styles.debtFormField}
                        control={control}
                        inputStyle={styles.debtFormInput}
                        label="Notatka"
                        name="debtPaymentNote"
                        placeholder="Opcjonalnie"
                      />
                    </View>
                    <ActionButton
                      disabled={!canSaveDebtPayment}
                      loading={debtPaymentMutation.isPending}
                      onPress={() => debtPaymentMutation.mutate()}
                      title="Dodaj spłatę"
                      variant="secondary"
                    />
                  </>
                ) : (
                  <InlineAlert text="Ta pożyczka jest już spłacona." />
                )}
                <View style={styles.debtPaymentHistory}>
                  <Text style={styles.debtPaymentTitle}>Historia wpłat</Text>
                  {editingDebt.payments.length > 0 ? (
                    editingDebt.payments.map((payment) => (
                      <View key={payment.id} style={styles.debtPaymentRow}>
                        <View style={styles.debtPaymentRowText}>
                          <Text style={styles.debtPaymentRowTitle}>
                            {formatDateFull(
                              payment.paidAt ?? payment.createdAt,
                            )}
                          </Text>
                          {payment.note ? (
                            <Text
                              numberOfLines={1}
                              style={styles.debtPaymentRowMeta}
                            >
                              {payment.note}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.debtPaymentRowAmount}>
                          {formatMoney(payment.amount, currencyCode)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <InlineAlert text="Brak wpłat dla tej pożyczki." />
                  )}
                </View>
              </View>
            ) : null}
            {saveDebtMutation.error ? (
              <InlineAlert
                tone="error"
                text="Nie udało się zapisać pożyczki."
              />
            ) : null}
            {debtPaymentMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się dodać spłaty." />
            ) : null}
            {deleteDebtMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się usunąć pożyczki." />
            ) : null}
          </FormModal>
        </>
      ) : null}

      {activeFinanceView === "savings" ? (
        <>
          <SavingsOverview
            currencyCode={currencyCode}
            groups={savingsGroups}
            nextGoal={nextSavingsGoal}
            onOpenGoal={openSavingsDetails}
            savingsTotal={savingsTotal}
            totalAchieved={savingsGoalsAchieved}
            totalGoals={savingsGoals.length}
          />
          {!savingsQuery.isLoading ? (
            <QueryState
              emptyText="Brak zapisanych celów oszczędnościowych."
              error={savingsQuery.error}
              isEmpty={savingsGoals.length === 0}
            />
          ) : null}
        </>
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
        subtitle="Cel będzie widoczny dla wszystkich domowników."
        title="Dodaj oszczędności"
        visible={financeModal === "savingsAccount"}
      >
        <ChoiceSelector
          emptyText="Brak domowników do wyboru."
          items={householdMembers.map((member) => ({
            id: member.id,
            label: member.displayName || member.email,
          }))}
          onSelect={setSelectedSavingsOwnerId}
          selectedId={selectedSavingsOwnerId}
        />
        <TextField
          control={control}
          label="Nazwa"
          name="savingsName"
          placeholder="Np. Poduszka finansowa"
        />
        <TextField
          control={control}
          keyboardType="decimal-pad"
          label="Kwota startowa"
          name="savingsAmount"
          placeholder="0,00"
        />
        <TextField
          control={control}
          keyboardType="decimal-pad"
          label="Cel"
          name="savingsTargetAmount"
          placeholder="0,00"
        />
        <DatePickerField
          label="Termin celu"
          onChange={(date) => setValue("savingsTargetDate", date)}
          value={savingsTargetDate}
        />
        <TextField
          control={control}
          label="Notatka"
          name="savingsNote"
          placeholder="Opcjonalnie"
        />
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
              title="Zamknij"
              variant="secondary"
            />
            {selectedSavingsGoal ? (
              <>
                <ActionButton
                  disabled={!canUpdate || savingsTransactionMutation.isPending}
                  loading={savingsTransactionMutation.isPending}
                  onPress={() =>
                    openSavingsTransaction(selectedSavingsGoal, "add")
                  }
                  style={styles.modalFooterButton}
                  title="Dodaj"
                />
                <ActionButton
                  disabled={!canUpdate || savingsTransactionMutation.isPending}
                  loading={savingsTransactionMutation.isPending}
                  onPress={() =>
                    openSavingsTransaction(selectedSavingsGoal, "subtract")
                  }
                  style={styles.modalFooterButton}
                  title="Odejmij"
                  variant="secondary"
                />
                {canDelete ? (
                  <ActionButton
                    disabled={deleteSavingsAccountMutation.isPending}
                    labelStyle={styles.dangerButtonLabel}
                    loading={deleteSavingsAccountMutation.isPending}
                    onPress={() =>
                      deleteSavingsAccountMutation.mutate(
                        selectedSavingsGoal.id,
                      )
                    }
                    style={[styles.modalFooterButton, styles.dangerButton]}
                    title="Usuń"
                    variant="secondary"
                  />
                ) : null}
              </>
            ) : null}
          </View>
        }
        onClose={closeFinanceModal}
        subtitle={
          selectedSavingsGoal
            ? `${selectedSavingsGoal.owner?.displayName || selectedSavingsGoal.owner?.email || "Bez właściciela"} / cel ${selectedSavingsGoal.targetDate || "bez terminu"}`
            : undefined
        }
        title={selectedSavingsGoal?.name ?? "Szczegóły celu"}
        visible={financeModal === "savingsDetails"}
      >
        {selectedSavingsGoal ? (
          <View style={styles.savingsDetailsCard}>
            <View style={styles.savingsDetailsHeader}>
              <View
                style={[
                  styles.savingsGoalImageFrame,
                  styles.savingsDetailsImageFrame,
                ]}
              >
                <Image
                  resizeMode="contain"
                  source={getSavingsGoalImage(selectedSavingsGoal.name)}
                  style={styles.savingsDetailsImage}
                />
              </View>
              <View style={styles.savingsDetailsText}>
                <Text style={styles.savingsDetailsTitle}>
                  {formatMoney(
                    selectedSavingsGoal.currentAmountNumber,
                    currencyCode,
                  )}
                </Text>
                <Text style={styles.savingsDetailsMeta}>
                  Cel{" "}
                  {selectedSavingsGoal.targetAmountNumber !== null
                    ? formatMoney(
                        selectedSavingsGoal.targetAmountNumber,
                        currencyCode,
                      )
                    : "bez limitu"}
                </Text>
                <Text style={styles.savingsDetailsMeta}>
                  {selectedSavingsGoal.targetDate
                    ? `Termin: ${formatDateFull(selectedSavingsGoal.targetDate)}`
                    : "Brak terminu"}
                </Text>
              </View>
            </View>
            <View style={styles.savingsGoalProgressTrack}>
              <View
                style={[
                  styles.savingsGoalProgressFill,
                  {
                    width: `${Math.round(selectedSavingsGoal.progressRatio * 100)}%`,
                    backgroundColor: theme.colors.finance,
                  },
                ]}
              />
            </View>
            <Text style={styles.savingsDetailsMeta}>
              {Math.round(selectedSavingsGoal.progressRatio * 100)}% wykonania
            </Text>
            {selectedSavingsGoal.transactions.length > 0 ? (
              <View style={styles.savingsTransactionList}>
                {selectedSavingsGoal.transactions
                  .slice(0, 4)
                  .map((transaction) => (
                    <View
                      key={transaction.id}
                      style={styles.savingsTransactionRow}
                    >
                      <Text
                        style={[
                          styles.savingsDelta,
                          transaction.direction === "add"
                            ? styles.savingsDeltaAdd
                            : styles.savingsDeltaSubtract,
                        ]}
                      >
                        {transaction.direction === "add" ? "+" : "-"}
                        {formatMoney(transaction.amount, currencyCode)}
                      </Text>
                      <Text style={styles.savingsTransactionMeta}>
                        {formatDateFull(transaction.changedAt)}
                        {transaction.note ? ` / ${transaction.note}` : ""}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : (
              <InlineAlert text="Brak historii zmian." />
            )}
          </View>
        ) : (
          <InlineAlert text="Nie znaleziono wybranego celu." />
        )}
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
          selectedSavingsGoal
            ? `${selectedSavingsGoal.name} / obecnie ${formatMoney(selectedSavingsGoal.currentAmountNumber, currencyCode)}`
            : selectedSavingsAccount
              ? `${selectedSavingsAccount.name} / obecnie ${formatMoney(selectedSavingsAccount.currentAmount, currencyCode)}`
              : undefined
        }
        title={
          savingsDirection === "add"
            ? "Dodaj do oszczędności"
            : "Odejmij z oszczędności"
        }
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
          <InlineAlert
            tone="error"
            text="Nie udało się zapisać zmiany oszczędności."
          />
        ) : null}
      </FormModal>
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
          <ActionButton
            onPress={openIncomeModal}
            title="Zmień dochód"
            variant="secondary"
          />
        ) : null}
      </FormModal>
    </AppScreen>
  );
}

function FinanceSummaryCard({
  budgetAmount,
  currencyCode,
  remainingAmount,
  spentAmount,
}: {
  budgetAmount: number;
  currencyCode: SupportedCurrencyCode;
  remainingAmount: number;
  spentAmount: number;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const spentRatio =
    budgetAmount > 0 ? Math.max(0, Math.min(spentAmount / budgetAmount, 1)) : 0;
  const spentPercent =
    budgetAmount > 0
      ? Math.round((spentAmount / budgetAmount) * 100)
      : spentAmount > 0
        ? 100
        : 0;
  const isOverBudget = remainingAmount < 0;

  return (
    <View style={styles.financeSummaryCard}>
      <View style={styles.financeSummarySide}>
        <View style={styles.financeSummaryLabelRow}>
          <WalletCards color={theme.colors.finance} size={16} />
          <Text
            style={[
              styles.financeSummaryLabel,
              { color: theme.colors.finance },
            ]}
          >
            Do dyspozycji
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.financeSummaryValue,
            isOverBudget && styles.dangerText,
          ]}
        >
          {formatMoney(remainingAmount, currencyCode)}
        </Text>
      </View>

      <View style={styles.financeSummaryCenter}>
        <FinanceSummaryRing spentRatio={spentRatio} />
        <View pointerEvents="none" style={styles.financeSummaryCenterText}>
          <Text
            numberOfLines={1}
            style={[
              styles.financeSummaryRingValue,
              isOverBudget && styles.dangerText,
            ]}
          >
            {spentPercent}%
          </Text>
          <Text style={styles.financeSummaryRingLabel}>wykorzystane</Text>
        </View>
      </View>

      <View style={styles.financeSummarySide}>
        <View style={styles.financeSummaryLabelRow}>
          <ReceiptText color={theme.colors.warning} size={16} />
          <Text
            style={[
              styles.financeSummaryLabel,
              { color: theme.colors.warning },
            ]}
          >
            Wydano
          </Text>
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

function SavingsOverview({
  currencyCode,
  groups,
  nextGoal,
  onOpenGoal,
  savingsTotal,
  totalAchieved,
  totalGoals,
}: {
  currencyCode: SupportedCurrencyCode;
  groups: SavingsGoalGroup[];
  nextGoal: SavingsGoalView | null;
  onOpenGoal: (goal: SavingsGoalView) => void;
  savingsTotal: number;
  totalAchieved: number;
  totalGoals: number;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (groups.length === 0) {
      setExpandedGroupIds([]);
      return;
    }

    setExpandedGroupIds((current) => {
      const available = new Set(groups.map((group) => group.id));
      const next = current.filter((groupId) => available.has(groupId));

      return next.length > 0 ? next : [groups[0]!.id];
    });
  }, [groups]);

  const isExpanded = (groupId: string) => expandedGroupIds.includes(groupId);

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((currentGroupId) => currentGroupId !== groupId)
        : [...current, groupId],
    );
  }

  return (
    <View style={styles.savingsOverview}>
      <View style={styles.savingsSummaryCard}>
        <View style={styles.savingsSummaryHeader}>
          <View style={styles.savingsSummaryIconWrap}>
            <PiggyBank color={theme.colors.finance} size={28} />
          </View>
          <View style={styles.savingsSummaryText}>
            <Text style={styles.savingsSummaryKicker}>OSZCZĘDNOŚCI</Text>
            <Text style={styles.savingsSummaryValue}>
              {formatMoney(savingsTotal, currencyCode)}
            </Text>
            <Text style={styles.savingsSummaryMeta}>
              Suma wszystkich oszczędności
            </Text>
          </View>
        </View>

        <View style={styles.savingsSummaryStats}>
          <View style={styles.savingsSummaryStat}>
            <CalendarDays color={theme.colors.finance} size={17} />
            <Text style={styles.savingsSummaryStatValue}>{totalGoals}</Text>
            <Text style={styles.savingsSummaryStatLabel}>cele</Text>
          </View>
          <View style={styles.savingsSummaryStatDivider} />
          <View style={styles.savingsSummaryStat}>
            <CheckCircle2 color={theme.colors.finance} size={17} />
            <Text style={styles.savingsSummaryStatValue}>{totalAchieved}</Text>
            <Text style={styles.savingsSummaryStatLabel}>osiągnięte</Text>
          </View>
        </View>
      </View>

      <View style={styles.savingsGroupList}>
        {groups.map((group) => (
          <SavingsGoalGroupCard
            currencyCode={currencyCode}
            expanded={isExpanded(group.id)}
            group={group}
            key={group.id}
            onOpenGoal={onOpenGoal}
            onToggle={() => toggleGroup(group.id)}
          />
        ))}
      </View>

      {nextGoal ? (
        <View style={styles.savingsNextGoalCard}>
          <View style={styles.savingsNextGoalIconWrap}>
            <CalendarDays color={theme.colors.finance} size={24} />
          </View>
          <View style={styles.savingsNextGoalText}>
            <Text style={styles.savingsNextGoalLabel}>Najbliższy cel</Text>
            <Text numberOfLines={1} style={styles.savingsNextGoalTitle}>
              {nextGoal.targetDate
                ? `${formatDateFull(nextGoal.targetDate)} - ${nextGoal.name}`
                : nextGoal.name}
            </Text>
            <Text numberOfLines={1} style={styles.savingsNextGoalMeta}>
              {nextGoal.owner?.displayName ||
                nextGoal.owner?.email ||
                "Bez właściciela"}
              {" / "}
              {formatMoney(nextGoal.currentAmountNumber, currencyCode)}
            </Text>
          </View>
          <ActionButton
            labelStyle={styles.savingsNextGoalButtonLabel}
            onPress={() => onOpenGoal(nextGoal)}
            size="small"
            style={styles.savingsNextGoalButton}
            title="Zobacz cele"
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

function SavingsGoalGroupCard({
  currencyCode,
  expanded,
  group,
  onOpenGoal,
  onToggle,
}: {
  currencyCode: SupportedCurrencyCode;
  expanded: boolean;
  group: SavingsGoalGroup;
  onOpenGoal: (goal: SavingsGoalView) => void;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getMemberAccent(group.member?.displayName || group.label);

  return (
    <View style={styles.savingsGroupCard}>
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={({ pressed }) => [
          styles.savingsGroupHeader,
          pressed && styles.pressedRow,
        ]}
      >
        <View
          style={[
            styles.savingsGroupAvatar,
            { backgroundColor: accent.background, borderColor: accent.border },
          ]}
        >
          <Text
            style={[styles.savingsGroupAvatarLabel, { color: accent.text }]}
          >
            {getMemberInitial(group.member)}
          </Text>
        </View>
        <View style={styles.savingsGroupText}>
          <View style={styles.savingsGroupTitleRow}>
            <Text numberOfLines={1} style={styles.savingsGroupTitle}>
              {group.label}
            </Text>
            <View style={styles.savingsGroupCountBadge}>
              <Text style={styles.savingsGroupCountText}>
                {group.totalCount}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.savingsGroupAmountBlock}>
          <Text numberOfLines={1} style={styles.savingsGroupAmount}>
            {formatMoney(group.currentTotal, currencyCode)}
          </Text>
        </View>
        <View style={styles.savingsGroupChevron}>
          {expanded ? (
            <ChevronUp color={theme.colors.textMuted} size={18} />
          ) : (
            <ChevronDown color={theme.colors.textMuted} size={18} />
          )}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.savingsGoalList}>
          {group.accounts.map((goal) => (
            <SavingsGoalRow
              currencyCode={currencyCode}
              goal={goal}
              key={goal.id}
              onOpenGoal={onOpenGoal}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SavingsGoalRow({
  currencyCode,
  goal,
  onOpenGoal,
}: {
  currencyCode: SupportedCurrencyCode;
  goal: SavingsGoalView;
  onOpenGoal: (goal: SavingsGoalView) => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const progressPercent = Math.round(goal.progressRatio * 100);
  const progressColor = goal.isAchieved
    ? theme.colors.finance
    : progressPercent >= 50
      ? theme.colors.finance
      : theme.colors.warning;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpenGoal(goal)}
      style={({ pressed }) => [
        styles.savingsGoalRow,
        pressed && styles.pressedRow,
      ]}
    >
      <View style={styles.savingsGoalImageFrame}>
        <Image
          resizeMode="contain"
          source={getSavingsGoalImage(goal.name)}
          style={styles.savingsGoalImage}
        />
      </View>
      <View style={styles.savingsGoalText}>
        <Text numberOfLines={1} style={styles.savingsGoalTitle}>
          {goal.name}
        </Text>
        <Text style={styles.savingsGoalMeta}>
          {goal.targetDate
            ? `Cel: ${formatDateFull(goal.targetDate)}`
            : "Brak terminu"}
        </Text>
      </View>
      <View style={styles.savingsGoalAmountBlock}>
        <Text numberOfLines={1} style={styles.savingsGoalAmount}>
          {goal.targetAmountNumber !== null
            ? formatMoney(goal.targetAmountNumber, currencyCode)
            : formatMoney(goal.currentAmountNumber, currencyCode)}
        </Text>
        <Text
          style={[
            styles.savingsGoalProgressLabel,
            goal.isAchieved
              ? styles.savingsGoalProgressLabelSuccess
              : progressPercent >= 50
                ? styles.savingsGoalProgressLabelNormal
                : styles.savingsGoalProgressLabelWarning,
          ]}
        >
          {progressPercent}%
        </Text>
        <View style={styles.savingsGoalProgressTrack}>
          <View
            style={[
              styles.savingsGoalProgressFill,
              {
                backgroundColor: progressColor,
                width: `${Math.min(progressPercent, 100)}%`,
              },
            ]}
          />
        </View>
      </View>
      <ChevronRight color={theme.colors.textMuted} size={18} />
    </Pressable>
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
                transform: [{ rotate: `${angle}deg` }, { translateY: -40 }],
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
            style={[
              styles.incomeBreakdownRow,
              isSelected && styles.incomeBreakdownRowActive,
            ]}
          >
            <View style={styles.incomeBreakdownText}>
              <Text numberOfLines={1} style={styles.incomeBreakdownName}>
                {row.displayName || row.email}
              </Text>
              <Text style={styles.incomeBreakdownMeta}>
                Budżet {formatMoney(row.totalBudgetAmount, currencyCode)} /
                wydano {formatMoney(row.totalSpentAmount, currencyCode)} /
                zostaje {formatMoney(row.totalRemainingAmount, currencyCode)}
              </Text>
            </View>
            <Text style={styles.incomeBreakdownValue}>
              {formatMoney(row.incomeAmount, currencyCode)}
            </Text>
          </View>
        );
      })}
      <View style={styles.incomeBreakdownTotal}>
        <Text style={styles.totalLabel}>RAZEM DOM</Text>
        <Text style={styles.totalValue}>
          {formatMoney(total.incomeAmount, currencyCode)}
        </Text>
      </View>
    </View>
  );
}

function FinanceDebtOverview({
  activeCount,
  currencyCode,
  openDebtTotal,
  settledCount,
}: {
  activeCount: number;
  currencyCode: SupportedCurrencyCode;
  openDebtTotal: number;
  settledCount: number;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.debtOverviewCard}>
      <View style={styles.debtOverviewIconWrap}>
        <WalletCards color={theme.colors.finance} size={26} />
      </View>
      <View style={styles.debtOverviewMain}>
        <Text style={styles.debtOverviewKicker}>DO ODDANIA</Text>
        <Text numberOfLines={1} style={styles.debtOverviewAmount}>
          {formatMoney(openDebtTotal, currencyCode)}
        </Text>
        <Text style={styles.debtOverviewMeta}>Suma wszystkich długów</Text>
      </View>
      <View style={styles.debtOverviewStats}>
        <View style={styles.debtOverviewStat}>
          <ReceiptText color={theme.colors.textMuted} size={17} />
          <Text style={styles.debtOverviewStatValue}>{activeCount}</Text>
          <Text style={styles.debtOverviewStatLabel}>aktywne</Text>
        </View>
        <View style={styles.debtOverviewDivider} />
        <View style={styles.debtOverviewStat}>
          <CheckCircle2 color={theme.colors.textMuted} size={17} />
          <Text style={styles.debtOverviewStatValue}>{settledCount}</Text>
          <Text style={styles.debtOverviewStatLabel}>spłacone</Text>
        </View>
      </View>
    </View>
  );
}

type FinanceDebtGroup = {
  activeCount: number;
  debts: FinanceDebt[];
  id: string;
  label: string;
  settledCount: number;
  totalCount: number;
  totalOpen: number;
};

function FinanceDebtsList({
  canUpdate,
  currencyCode,
  debts,
  onEdit,
}: {
  canUpdate: boolean;
  currencyCode: SupportedCurrencyCode;
  debts: FinanceDebt[];
  onEdit: (debt: FinanceDebt) => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const groups = useMemo(() => groupDebtsByLender(debts), [debts]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (groups.length === 0) {
      setExpandedGroupIds([]);
      return;
    }

    setExpandedGroupIds((current) => {
      const available = new Set(groups.map((group) => group.id));
      const next = current.filter((groupId) => available.has(groupId));

      return next.length > 0 ? next : [groups[0]!.id];
    });
  }, [groups]);

  if (debts.length === 0) {
    return null;
  }

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((currentGroupId) => currentGroupId !== groupId)
        : [...current, groupId],
    );
  }

  return (
    <View style={styles.debtGroupList}>
      {groups.map((group) => {
        const expanded = expandedGroupIds.includes(group.id);
        const accent = getMemberAccent(group.label);

        return (
          <View key={group.id} style={styles.debtGroupCard}>
            <Pressable
              accessibilityRole="button"
              onPress={() => toggleGroup(group.id)}
              style={({ pressed }) => [
                styles.debtGroupHeader,
                pressed && styles.pressedRow,
              ]}
            >
              <View
                style={[
                  styles.debtGroupAvatar,
                  {
                    backgroundColor: accent.background,
                    borderColor: accent.border,
                  },
                ]}
              >
                <Text
                  style={[styles.debtGroupAvatarText, { color: accent.text }]}
                >
                  {getDebtGroupInitial(group.label)}
                </Text>
              </View>
              <View style={styles.debtGroupText}>
                <View style={styles.debtGroupTitleRow}>
                  <Text numberOfLines={1} style={styles.debtGroupTitle}>
                    {group.label}
                  </Text>
                  <View style={styles.debtGroupCountBadge}>
                    <Text style={styles.debtGroupCountText}>
                      {group.totalCount}
                    </Text>
                  </View>
                </View>
                <Text style={styles.debtGroupMeta}>
                  {group.activeCount} aktywne / {group.settledCount} spłacone
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.debtGroupAmount}>
                {formatMoney(group.totalOpen, currencyCode)}
              </Text>
              {expanded ? (
                <ChevronUp color={theme.colors.textMuted} size={18} />
              ) : (
                <ChevronDown color={theme.colors.textMuted} size={18} />
              )}
            </Pressable>

            {expanded ? (
              <View style={styles.debtRows}>
                {group.debts.map((debt) => (
                  <Pressable
                    accessibilityRole={canUpdate ? "button" : undefined}
                    disabled={!canUpdate}
                    key={debt.id}
                    onPress={() => onEdit(debt)}
                    style={({ pressed }) => [
                      styles.debtRow,
                      debt.isSettled && styles.debtRowSettled,
                      pressed && styles.pressedRow,
                    ]}
                  >
                    <View style={styles.debtRowIcon}>
                      {renderDebtPurposeIcon(
                        debt.purpose,
                        theme.colors.finance,
                        17,
                      )}
                    </View>
                    <View style={styles.debtRowText}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.debtRowTitle,
                          debt.isSettled && styles.debtSettledText,
                        ]}
                      >
                        {debt.purpose}
                      </Text>
                      <Text numberOfLines={1} style={styles.debtRowMeta}>
                        {Number(debt.paidAmount ?? 0) > 0
                          ? `Spłacono ${formatMoney(debt.paidAmount, currencyCode)} z ${formatMoney(debt.amount, currencyCode)}`
                          : debt.dueDate
                            ? `Termin: ${formatDateFull(debt.dueDate)}`
                            : "Bez terminu"}
                      </Text>
                    </View>
                    <View style={styles.debtRowSide}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.debtRowAmount,
                          debt.isSettled && styles.debtSettledText,
                        ]}
                      >
                        {formatMoney(
                          debt.remainingAmount ?? debt.amount,
                          currencyCode,
                        )}
                      </Text>
                      <View style={styles.debtStatusLine}>
                        <View
                          style={[
                            styles.debtStatusDot,
                            debt.isSettled && styles.debtStatusDotDone,
                          ]}
                        />
                        <Text style={styles.debtStatusText}>
                          {debt.isSettled ? "Spłacone" : "Do spłaty"}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight color={theme.colors.textMuted} size={18} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function _FinanceSavingsList({
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
  onTransaction: (
    account: FinanceSavingsAccount,
    direction: FinanceSavingsDirection,
  ) => void;
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
                <Text style={styles.savingsAmount}>
                  {formatMoney(account.currentAmount, currencyCode)}
                </Text>
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
                  <View
                    key={transaction.id}
                    style={styles.savingsTransactionRow}
                  >
                    <Text
                      style={[
                        styles.savingsDelta,
                        transaction.direction === "add"
                          ? styles.savingsDeltaAdd
                          : styles.savingsDeltaSubtract,
                      ]}
                    >
                      {transaction.direction === "add" ? "+" : "-"}
                      {formatMoney(transaction.amount, currencyCode)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={styles.savingsTransactionMeta}
                    >
                      {formatDateFull(transaction.changedAt)}
                      {transaction.note ? ` / ${transaction.note}` : ""}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.savingsTransactionMeta}>
                  Brak historii zmian.
                </Text>
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
  owners,
}: {
  categories: BudgetCategoryWithItems[];
  expanded: boolean;
  filters: FinanceFilters;
  onChange: (filters: Partial<FinanceFilters>) => void;
  owners: Array<{ id: string; label: string }>;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  if (!expanded) {
    return null;
  }

  return (
    <View style={styles.filterPanel}>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Osoba</Text>
        <ScrollView
          contentContainerStyle={styles.filterOwnerRail}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <FilterChip
            active={!filters.ownerMemberId}
            label="Wszystkie"
            onPress={() => onChange({ ownerMemberId: "" })}
          />
          {owners.map((owner) => (
            <FilterChip
              active={filters.ownerMemberId === owner.id}
              key={owner.id}
              label={owner.label}
              onPress={() => onChange({ ownerMemberId: owner.id })}
            />
          ))}
        </ScrollView>
      </View>
      <View style={styles.filterDetails}>
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
                onChange({
                  sortDirection:
                    filters.sortDirection === "asc" ? "desc" : "asc",
                })
              }
            />
            <FilterChip
              active={filters.onlyOverBudget}
              label="Po limicie"
              onPress={() =>
                onChange({ onlyOverBudget: !filters.onlyOverBudget })
              }
            />
            <FilterChip
              active={filters.showEmptyCategories}
              label={
                filters.showEmptyCategories ? "Puste widoczne" : "Puste ukryte"
              }
              onPress={() =>
                onChange({ showEmptyCategories: !filters.showEmptyCategories })
              }
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function FilterChip({
  active,
  compact = false,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  compact?: boolean;
  icon?: ReactNode;
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
      {icon}
      <Text
        numberOfLines={1}
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BudgetViewToggle({
  onChange,
  value,
}: {
  onChange: (value: BudgetViewMode) => void;
  value: BudgetViewMode;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.budgetViewToolbar}>
      <Text style={styles.budgetViewLabel}>Widok budżetu</Text>
      <View style={styles.budgetViewToggle}>
        <IconButton
          accessibilityLabel="Widok kart"
          onPress={() => onChange("cards")}
          style={[
            styles.budgetViewButton,
            value === "cards" && styles.budgetViewButtonActive,
          ]}
        >
          <ViewGrid
            color={
              value === "cards"
                ? theme.colors.primaryDark
                : theme.colors.textMuted
            }
            size={19}
          />
        </IconButton>
        <IconButton
          accessibilityLabel="Widok tabeli"
          onPress={() => onChange("table")}
          style={[
            styles.budgetViewButton,
            value === "table" && styles.budgetViewButtonActive,
          ]}
        >
          <TableLarge
            color={
              value === "table"
                ? theme.colors.primaryDark
                : theme.colors.textMuted
            }
            size={19}
          />
        </IconButton>
      </View>
    </View>
  );
}

function FinanceBudgetTable({
  canEditCategory,
  categories,
  currencyCode,
  onEditCategory,
  onHistory,
  rows,
  showOwner,
}: {
  canEditCategory: boolean;
  categories: BudgetCategoryWithItems[];
  currencyCode: SupportedCurrencyCode;
  onEditCategory: (category: BudgetCategoryWithItems) => void;
  onHistory: (item: BudgetItemWithCategory) => void;
  rows: BudgetItemWithCategory[];
  showOwner: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const groups = useMemo(
    () => groupRowsByCategory(rows, categories),
    [categories, rows],
  );

  if (groups.length === 0) {
    return <InlineAlert text="Brak pozycji pasujących do filtrów." />;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View
        style={[
          styles.budgetTable,
          !showOwner && styles.budgetTableSingleOwner,
        ]}
      >
        <View style={styles.budgetTableHeader}>
          <Text
            style={[styles.budgetTableHeaderText, styles.budgetTableNameCell]}
          >
            Pozycja
          </Text>
          {showOwner ? (
            <Text
              style={[
                styles.budgetTableHeaderText,
                styles.budgetTableOwnerCell,
              ]}
            >
              Osoba
            </Text>
          ) : null}
          <Text
            style={[styles.budgetTableHeaderText, styles.budgetTableMoneyCell]}
          >
            Budżet
          </Text>
          <Text
            style={[styles.budgetTableHeaderText, styles.budgetTableMoneyCell]}
          >
            Wydano
          </Text>
          <Text
            style={[styles.budgetTableHeaderText, styles.budgetTableMoneyCell]}
          >
            Zostaje
          </Text>
        </View>
        {groups.map((group) => {
          const complete = isBudgetCategoryComplete(group);

          return (
            <View key={group.category.id}>
              <View
                style={[
                  styles.budgetTableCategoryRow,
                  complete && styles.completedBudgetRow,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.budgetTableCategoryTitle,
                    complete && styles.completedBudgetText,
                  ]}
                >
                  {group.category.name}
                </Text>
                <Text style={styles.budgetTableCategorySummary}>
                  {formatMoney(group.spent, currencyCode)} /{" "}
                  {formatMoney(group.planned, currencyCode)}
                </Text>
                {canEditCategory ? (
                  <IconButton
                    accessibilityLabel={`Edytuj kategorię ${group.category.name}`}
                    onPress={() => onEditCategory(group.category)}
                    style={styles.budgetTableCategoryAction}
                  >
                    <MoreHorizontal color={theme.colors.textMuted} size={18} />
                  </IconButton>
                ) : null}
              </View>
              {group.items.length === 0 ? (
                <Text style={styles.budgetTableEmpty}>Brak pozycji</Text>
              ) : (
                group.items.map((item) => {
                  const completeItem = isBudgetItemComplete(item);

                  const spentPercent = getBudgetSpentPercent(item);

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={item.id}
                      onPress={() => onHistory(item)}
                      style={({ pressed }) => [
                        styles.budgetTableRow,
                        pressed && styles.pressedRow,
                        completeItem && styles.completedBudgetRow,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.budgetTableText,
                          styles.budgetTableNameCell,
                          completeItem && styles.completedBudgetText,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {showOwner ? (
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.budgetTableMutedText,
                            styles.budgetTableOwnerCell,
                          ]}
                        >
                          {formatOwner(item.owner)}
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.budgetTableText,
                          styles.budgetTableMoneyCell,
                        ]}
                      >
                        {item.budgetAmount
                          ? formatMoney(item.budgetAmount, currencyCode)
                          : "-"}
                      </Text>
                      <Text
                        style={[
                          styles.budgetTableText,
                          styles.budgetTableMoneyCell,
                        ]}
                      >
                        {formatMoney(item.spentAmount, currencyCode)}
                        {spentPercent === null ? "" : ` / ${spentPercent}%`}
                      </Text>
                      <Text
                        style={[
                          styles.budgetTableText,
                          styles.budgetTableMoneyCell,
                          Number(item.remainingAmount ?? 0) < 0 &&
                            styles.dangerText,
                        ]}
                      >
                        {item.budgetAmount
                          ? formatMoney(item.remainingAmount ?? 0, currencyCode)
                          : "-"}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function FinanceCategoryCards({
  canCreateItem,
  canEditCategory,
  categories,
  currencyCode,
  onAddCategoryItem,
  onEditCategory,
  onHistory,
  rows,
  showOwner,
}: {
  canCreateItem: boolean;
  canEditCategory: boolean;
  categories: BudgetCategoryWithItems[];
  currencyCode: SupportedCurrencyCode;
  onAddCategoryItem: (category: BudgetCategoryWithItems) => void;
  onEditCategory: (category: BudgetCategoryWithItems) => void;
  onHistory: (item: BudgetItemWithCategory) => void;
  rows: BudgetItemWithCategory[];
  showOwner: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const groups = useMemo(
    () => groupRowsByCategory(rows, categories),
    [categories, rows],
  );
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (groups.length === 0) {
      setExpandedCategoryIds([]);
      return;
    }

    setExpandedCategoryIds((current) => {
      const available = new Set(groups.map((group) => group.category.id));
      const next = current.filter((categoryId) => available.has(categoryId));

      return next.length > 0 ? next : [groups[0]!.category.id];
    });
  }, [groups]);

  if (rows.length === 0 && categories.length === 0) {
    return <InlineAlert text="Brak pozycji pasujących do filtrów." />;
  }

  function toggleCategory(categoryId: string) {
    setExpandedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter(
            (currentCategoryId) => currentCategoryId !== categoryId,
          )
        : [...current, categoryId],
    );
  }

  return (
    <View style={styles.categoryCardsSection}>
      {groups.map((group, index) => {
        const accent = getCategoryAccent(index);
        const expanded = expandedCategoryIds.includes(group.category.id);
        const spentProgress = getBudgetSpentProgress(group);
        const progressPercent =
          group.planned > 0 ? Math.round(spentProgress * 100) : 0;
        const complete = isBudgetCategoryComplete(group);
        const remainingLabel =
          group.remaining >= 0
            ? formatMoney(group.remaining, currencyCode)
            : formatMoney(group.remaining, currencyCode);

        return (
          <View key={group.category.id} style={styles.budgetAccordionCard}>
            <View
              style={[
                styles.budgetAccordionHeader,
                complete && styles.completedBudgetRow,
              ]}
            >
              <Pressable
                accessibilityLabel={
                  expanded
                    ? `Zwiń kategorię ${group.category.name}`
                    : `Rozwiń kategorię ${group.category.name}`
                }
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => toggleCategory(group.category.id)}
                style={({ pressed }) => [
                  styles.budgetAccordionToggle,
                  pressed && styles.pressedRow,
                ]}
              >
                <View
                  style={[
                    styles.budgetAccordionIcon,
                    { backgroundColor: accent.color },
                  ]}
                >
                  {getBudgetCategoryIcon(group.category.name, accent.onColor)}
                </View>
                <View style={styles.budgetAccordionText}>
                  <View style={styles.budgetAccordionTitleRow}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.budgetAccordionTitle,
                        complete && styles.completedBudgetText,
                      ]}
                    >
                      {group.category.name}
                    </Text>
                    <Text style={styles.budgetAccordionMeta}>
                      {group.items.length} pozycje
                    </Text>
                  </View>
                  <View style={styles.budgetProgressTrack}>
                    <View
                      style={[
                        styles.budgetProgressFill,
                        {
                          backgroundColor: accent.color,
                          width: `${Math.min(spentProgress, 1) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.budgetAccordionAmounts}>
                  <Text numberOfLines={1} style={styles.budgetAccordionSpent}>
                    {formatMoney(group.spent, currencyCode)} /{" "}
                    {formatMoney(group.planned, currencyCode)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.budgetAccordionRemaining,
                      group.remaining < 0 && styles.dangerText,
                      group.remaining >= 0 && styles.positiveText,
                    ]}
                  >
                    {remainingLabel}
                  </Text>
                  <Text style={styles.budgetAccordionPercent}>
                    {group.planned > 0 ? `${progressPercent}%` : "bez limitu"}
                  </Text>
                </View>
                {expanded ? (
                  <ChevronUp color={theme.colors.textMuted} size={23} />
                ) : (
                  <ChevronDown color={theme.colors.textMuted} size={23} />
                )}
              </Pressable>
              {canEditCategory ? (
                <IconButton
                  accessibilityLabel={`Edytuj kategorię ${group.category.name}`}
                  onPress={() => onEditCategory(group.category)}
                  style={styles.budgetCategoryMenuButton}
                >
                  <MoreHorizontal color={theme.colors.textMuted} size={19} />
                </IconButton>
              ) : null}
            </View>

            {expanded ? (
              <View style={styles.budgetAccordionBody}>
                {group.items.length === 0 ? (
                  <InlineAlert text="Ta kategoria nie ma jeszcze pozycji." />
                ) : (
                  group.items.map((item) => (
                    <Pressable
                      accessibilityLabel={`Pokaż historię pozycji ${item.name}`}
                      accessibilityRole="button"
                      key={item.id}
                      onPress={() => onHistory(item)}
                      style={({ pressed }) => [
                        styles.budgetItemRow,
                        pressed && styles.pressedRow,
                        isBudgetItemComplete(item) && styles.completedBudgetRow,
                      ]}
                    >
                      {showOwner ? (
                        <View style={styles.budgetOwnerPill}>
                          <Text
                            numberOfLines={1}
                            style={styles.budgetOwnerText}
                          >
                            {formatOwner(item.owner)}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.budgetItemText}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.budgetItemTitle,
                            isBudgetItemComplete(item) &&
                              styles.completedBudgetText,
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.budgetItemMeta}>
                          wydano {formatMoney(item.spentAmount, currencyCode)}
                          {getBudgetSpentPercent(item) === null
                            ? ""
                            : ` / ${getBudgetSpentPercent(item)}%`}
                        </Text>
                      </View>
                      <View style={styles.budgetItemAmounts}>
                        <Text style={styles.budgetItemAmount}>
                          {formatMoney(item.budgetAmount, currencyCode)}
                        </Text>
                        <Text
                          style={[
                            styles.budgetItemRemaining,
                            Number(item.remainingAmount ?? 0) < 0 &&
                              styles.dangerText,
                            Number(item.remainingAmount ?? 0) >= 0 &&
                              styles.positiveText,
                          ]}
                        >
                          {item.budgetAmount
                            ? formatMoney(
                                item.remainingAmount ?? 0,
                                currencyCode,
                              )
                            : "bez limitu"}
                        </Text>
                      </View>
                      <View style={styles.budgetItemActions}>
                        <ChevronRight
                          color={theme.colors.textMuted}
                          size={18}
                        />
                      </View>
                    </Pressable>
                  ))
                )}
                {canCreateItem ? (
                  <Pressable
                    accessibilityLabel={`Dodaj pozycję w kategorii ${group.category.name}`}
                    accessibilityRole="button"
                    onPress={() => onAddCategoryItem(group.category)}
                    style={({ pressed }) => [
                      styles.budgetAddItemRow,
                      pressed && styles.pressedRow,
                    ]}
                  >
                    <ReceiptText
                      color={theme.isDark ? theme.colors.primaryDark : mockupGreen}
                      size={22}
                    />
                    <Text style={styles.budgetAddItemText}>Dodaj pozycję</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
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
    const searchable =
      `${row.name} ${row.category.name} ${formatOwner(row.owner)}`.toLocaleLowerCase(
        "pl-PL",
      );

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

  return filtered.sort((left, right) =>
    compareFinanceRows(left, right, filters),
  );
}

function hasActiveFinanceFilters(filters: FinanceFilters): boolean {
  return (
    Boolean(filters.categoryId) ||
    filters.onlyOverBudget ||
    Boolean(filters.ownerMemberId) ||
    Boolean(filters.search.trim()) ||
    !filters.showEmptyCategories ||
    filters.sortBy !== defaultFinanceFilters.sortBy ||
    filters.sortDirection !== defaultFinanceFilters.sortDirection
  );
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

    if (
      !filters.showEmptyCategories &&
      getCategoryItems(category).length === 0
    ) {
      return false;
    }

    if (filters.onlyOverBudget && !rowCategoryIds.has(category.id)) {
      return false;
    }

    if (
      normalizedSearch &&
      !categoryName.includes(normalizedSearch) &&
      !rowCategoryIds.has(category.id)
    ) {
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
  const completionCompare =
    Number(isBudgetItemComplete(left)) - Number(isBudgetItemComplete(right));

  if (completionCompare !== 0) {
    return completionCompare;
  }

  const direction = filters.sortDirection === "asc" ? 1 : -1;
  const textCompare = (a: string, b: string) =>
    a.localeCompare(b, "pl-PL") * direction;
  const numberCompare = (a: number, b: number) => (a - b) * direction;

  switch (filters.sortBy) {
    case "budget":
      return numberCompare(
        Number(left.budgetAmount ?? 0),
        Number(right.budgetAmount ?? 0),
      );
    case "spent":
      return numberCompare(
        Number(left.spentAmount ?? 0),
        Number(right.spentAmount ?? 0),
      );
    case "remaining":
      return numberCompare(
        Number(left.remainingAmount ?? 0),
        Number(right.remainingAmount ?? 0),
      );
    case "owner":
      return textCompare(formatOwner(left.owner), formatOwner(right.owner));
    case "name":
      return textCompare(left.name, right.name);
    case "category":
    default:
      return (
        left.category.displayOrder - right.category.displayOrder ||
        left.category.name.localeCompare(right.category.name, "pl-PL") ||
        left.displayOrder - right.displayOrder ||
        textCompare(left.name, right.name)
      );
  }
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
    const group = groups.get(row.category.id) ?? {
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

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((left, right) => {
        const completionCompare =
          Number(isBudgetItemComplete(left)) -
          Number(isBudgetItemComplete(right));

        return (
          completionCompare ||
          left.displayOrder - right.displayOrder ||
          left.name.localeCompare(right.name, "pl-PL")
        );
      }),
    }))
    .sort((left, right) => {
      const completionCompare =
        Number(isBudgetCategoryComplete(left.category)) -
        Number(isBudgetCategoryComplete(right.category));

      return (
        completionCompare ||
        left.category.displayOrder - right.category.displayOrder ||
        left.category.name.localeCompare(right.category.name, "pl-PL")
      );
    });
}

function isBudgetItemComplete(item: BudgetItem): boolean {
  const budget = Number(item.budgetAmount ?? 0);
  return budget > 0 && Number(item.spentAmount ?? 0) >= budget;
}

function getBudgetSpentPercent(item: BudgetItem): number | null {
  const budget = Number(item.budgetAmount ?? 0);

  if (budget <= 0) {
    return null;
  }

  return Math.round((Number(item.spentAmount ?? 0) / budget) * 100);
}

function isBudgetCategoryComplete(
  categoryOrGroup: BudgetCategoryWithItems | BudgetCategoryGroup,
): boolean {
  const items =
    "category" in categoryOrGroup
      ? getCategoryItems(categoryOrGroup.category)
      : getCategoryItems(categoryOrGroup);
  const planned = items.reduce(
    (total, item) => total + Number(item.budgetAmount ?? 0),
    0,
  );
  const spent = items.reduce(
    (total, item) => total + Number(item.spentAmount ?? 0),
    0,
  );

  return planned > 0 && spent >= planned;
}

function groupDebtsByLender(debts: FinanceDebt[]): FinanceDebtGroup[] {
  const groups = new Map<string, FinanceDebtGroup>();

  debts.forEach((debt) => {
    const label = debt.lenderName.trim() || "Bez nazwy";
    const id = label.toLocaleLowerCase("pl-PL");
    const group =
      groups.get(id) ??
      ({
        activeCount: 0,
        debts: [],
        id,
        label,
        settledCount: 0,
        totalCount: 0,
        totalOpen: 0,
      } satisfies FinanceDebtGroup);

    group.debts.push(debt);
    group.totalCount += 1;

    if (debt.isSettled) {
      group.settledCount += 1;
    } else {
      group.activeCount += 1;
      group.totalOpen += Number(debt.remainingAmount ?? debt.amount ?? 0);
    }

    groups.set(id, group);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      debts: [...group.debts].sort(compareFinanceDebts),
    }))
    .sort(
      (left, right) =>
        right.totalOpen - left.totalOpen ||
        right.activeCount - left.activeCount ||
        left.label.localeCompare(right.label, "pl-PL"),
    );
}

function compareFinanceDebts(left: FinanceDebt, right: FinanceDebt): number {
  if (left.isSettled !== right.isSettled) {
    return left.isSettled ? 1 : -1;
  }

  const leftDate = left.dueDate
    ? Date.parse(left.dueDate)
    : Number.POSITIVE_INFINITY;
  const rightDate = right.dueDate
    ? Date.parse(right.dueDate)
    : Number.POSITIVE_INFINITY;

  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  return left.purpose.localeCompare(right.purpose, "pl-PL");
}

function getDebtGroupInitial(label: string): string {
  const initial = label.trim().charAt(0);

  return initial ? initial.toUpperCase() : "?";
}

function getCategoryAccent(index: number): {
  border: string;
  color: string;
  onColor: string;
  text: string;
} {
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

  if (
    normalized.includes("dom") ||
    normalized.includes("media") ||
    normalized.includes("rachunki")
  ) {
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

function renderDebtPurposeIcon(
  purpose: string,
  color: string,
  iconSize = 18,
): ReactNode {
  const normalized = normalizeCategoryName(purpose);

  if (
    normalized.includes("auto") ||
    normalized.includes("samochod") ||
    normalized.includes("corsa") ||
    normalized.includes("transport")
  ) {
    return <Car color={color} size={iconSize} />;
  }

  if (
    normalized.includes("silown") ||
    normalized.includes("ciezar") ||
    normalized.includes("hantl") ||
    normalized.includes("lawka") ||
    normalized.includes("fitness")
  ) {
    return <Dumbbell color={color} size={iconSize} />;
  }

  if (
    normalized.includes("napraw") ||
    normalized.includes("remont") ||
    normalized.includes("serwis")
  ) {
    return <Wrench color={color} size={iconSize} />;
  }

  if (
    normalized.includes("odkurz") ||
    normalized.includes("tineco") ||
    normalized.includes("agd")
  ) {
    return <Vacuum color={color} size={iconSize} />;
  }

  if (normalized.includes("dziec") || normalized.includes("szkol")) {
    return <Users color={color} size={iconSize} />;
  }

  if (normalized.includes("telefon") || normalized.includes("komputer")) {
    return <Smartphone color={color} size={iconSize} />;
  }

  if (normalized.includes("prezent") || normalized.includes("urodzin")) {
    return <Gift color={color} size={iconSize} />;
  }

  return <ReceiptText color={color} size={iconSize} />;
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

function compareSavingsGoals(
  left: SavingsGoalView,
  right: SavingsGoalView,
): number {
  const leftDate = left.targetDate
    ? Date.parse(left.targetDate)
    : Number.POSITIVE_INFINITY;
  const rightDate = right.targetDate
    ? Date.parse(right.targetDate)
    : Number.POSITIVE_INFINITY;

  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  if (left.isAchieved !== right.isAchieved) {
    return left.isAchieved ? 1 : -1;
  }

  return left.name.localeCompare(right.name, "pl-PL");
}

function getMemberInitial(member: HouseholdMember | null | undefined): string {
  const source = member?.displayName || member?.email || "?";
  const initial = source.trim().charAt(0);

  return initial ? initial.toUpperCase() : "?";
}

function getMemberAccent(seed: string): {
  background: string;
  border: string;
  text: string;
} {
  const accents = [
    { background: "#EEF5E8", border: "#DCE9D1", text: "#4D6A2D" },
    { background: "#EEF4FF", border: "#D8E3FF", text: "#355B9E" },
    { background: "#FFF3E7", border: "#FFE0C0", text: "#A35B10" },
    { background: "#F5EEFF", border: "#E2D7FF", text: "#7451B8" },
    { background: "#EFF9F2", border: "#D5EEDB", text: "#3F7A4A" },
  ];
  const hash = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const fallback = {
    background: "#EEF5E8",
    border: "#DCE9D1",
    text: "#4D6A2D",
  };

  return accents[hash % accents.length] ?? fallback;
}

function getSavingsGoalImage(goalName: string): ImageSourcePropType {
  const normalized = normalizeCategoryName(goalName);

  if (/(wakacj|urlop|podroz|wyjazd|travel|hotel|lot)/.test(normalized)) {
    return savingsGoalTravelImage;
  }

  if (/(bezpiec|podusz|awary|rezerwa|fundusz|spokoj)/.test(normalized)) {
    return savingsGoalEmergencyImage;
  }

  if (
    /(telefon|smartfon|iphone|android|komor|laptop|tablet|elektronik)/.test(
      normalized,
    )
  ) {
    return savingsGoalPhoneImage;
  }

  if (/(dom|mieszkan|remont|mebl|ogrod|kuchni|lazienk)/.test(normalized)) {
    return savingsGoalHomeImage;
  }

  if (/(auto|samoch|car|warsztat)/.test(normalized)) {
    return savingsGoalCarImage;
  }

  if (
    /(dzieci|rodzin|rodzina|wspolne|prezent|swieta|urodzin|gift)/.test(
      normalized,
    )
  ) {
    return savingsGoalGiftImage;
  }

  return savingsGoalDefaultImage;
}

function parseMoney(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".").trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : Number.NaN;
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

function formatSignedMoney(
  value: number,
  currencyCode: SupportedCurrencyCode,
): string {
  const formatted = formatMoney(value, currencyCode);

  return value > 0 ? `+${formatted}` : formatted;
}

function formatMoneyInput(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? String(amount).replace(".", ",") : "";
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
  const isDark = colors.isDark;
  const panelBackground = isDark ? colors.card : "#FFFFFF";
  const panelBorder = isDark ? colors.border : "#E8DED2";
  const panelShadowOpacity = isDark ? 0.18 : 0.065;

  return StyleSheet.create({
    actionPicker: { gap: spacing.sm },
    financeMenu: { gap: spacing.lg },
    financeMenuHeading: {
      color: colors.finance,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    financeMenuSection: { gap: spacing.sm },
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
    sheetActionButton: { height: 32, width: 32 },
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
    actionSumCell: { borderColor: colors.line, borderLeftWidth: 1, width: 78 },
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
    categoryCell: { width: 92 },
    budgetAccordionAmounts: { alignItems: "flex-end", gap: 1, minWidth: 88 },
    budgetAccordionBody: {
      backgroundColor: colors.card,
      paddingBottom: spacing.sm,
    },
    budgetAccordionCard: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 22,
    },
    budgetAccordionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      minHeight: 54,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    budgetAccordionToggle: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
    },
    budgetAccordionIcon: {
      alignItems: "center",
      borderRadius: 10,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    budgetCategoryMenuButton: { height: 32, width: 32 },
    budgetAccordionMeta: {
      color: colors.textMuted,
      fontSize: 9,
      letterSpacing: 0,
    },
    budgetAccordionPercent: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0,
    },
    budgetAccordionRemaining: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "right",
    },
    budgetAccordionSpent: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "right",
    },
    budgetAccordionText: { flex: 1, gap: 5, minWidth: 0 },
    budgetAccordionTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0,
      minWidth: 0,
    },
    budgetAccordionTitleRow: { gap: 1 },
    budgetAddItemRow: {
      alignItems: "center",
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 10,
      minHeight: 36,
      paddingHorizontal: spacing.md,
    },
    budgetAddItemText: {
      color: isDark ? colors.primaryDark : mockupGreen,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
    },
    budgetItemActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 2,
      minWidth: 22,
      justifyContent: "flex-end",
    },
    budgetItemAmount: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "right",
    },
    budgetItemAmounts: { alignItems: "flex-end", gap: 2, minWidth: 72 },
    budgetItemIconButton: { height: 34, width: 34 },
    budgetItemMeta: { color: colors.textMuted, fontSize: 9, letterSpacing: 0 },
    budgetItemRemaining: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "right",
    },
    budgetItemRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
    },
    budgetItemText: { flex: 1, gap: 2, minWidth: 0 },
    budgetItemTitle: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0,
    },
    budgetOwnerPill: {
      alignItems: "center",
      backgroundColor: isDark ? colors.cardMuted : colors.softGreen,
      borderColor: isDark ? colors.primary : "transparent",
      borderRadius: 999,
      borderWidth: 1,
      maxWidth: 82,
      minHeight: 20,
      paddingHorizontal: spacing.sm,
    },
    budgetOwnerText: {
      color: isDark ? colors.primaryDarker : mockupGreen,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 20,
    },
    budgetProgressFill: { borderRadius: 999, height: "100%" },
    budgetProgressTrack: {
      backgroundColor: colors.cardMuted,
      borderRadius: 999,
      height: 5,
      overflow: "hidden",
      width: "100%",
    },
    budgetTable: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: radii.card,
      borderWidth: 1,
      minWidth: 650,
      overflow: "hidden",
    },
    budgetTableSingleOwner: { minWidth: 505 },
    budgetTableCategoryAction: { height: 30, width: 30 },
    budgetTableCategoryRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 38,
      paddingHorizontal: spacing.sm,
    },
    budgetTableCategorySummary: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0,
    },
    budgetTableCategoryTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    budgetTableEmpty: {
      color: colors.textMuted,
      fontSize: 11,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
    },
    budgetTableHeader: {
      backgroundColor: colors.cardMuted,
      flexDirection: "row",
      minHeight: 36,
    },
    budgetTableHeaderText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
      textTransform: "uppercase",
    },
    budgetTableMoneyCell: { textAlign: "right", width: 108 },
    budgetTableMutedText: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
    },
    budgetTableNameCell: { width: 170 },
    budgetTableOwnerCell: { width: 145 },
    budgetTableRow: {
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
      minHeight: 40,
    },
    budgetTableText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
    },
    budgetViewButton: { borderRadius: 7, height: 34, width: 38 },
    budgetViewButtonActive: { backgroundColor: colors.softGreen },
    budgetViewLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
    },
    budgetViewToggle: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 9,
      borderWidth: 1,
      flexDirection: "row",
      padding: 2,
    },
    budgetViewToolbar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
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
    categoryCardActive: { borderWidth: 2, shadowOpacity: 0.18 },
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
    categoryCardContent: { flex: 1, gap: 7, minWidth: 0 },
    categoryCardGrid: { gap: spacing.sm },
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
    categoryCardsSection: { gap: spacing.sm },
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
    categoryColorBar: { borderRadius: 999, height: 30, width: 4 },
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
    categoryDetailsAmounts: { alignItems: "flex-end", gap: 2, minWidth: 92 },
    categoryDetailsHeader: { gap: 2 },
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
    categoryDetailsText: { flex: 1, gap: 2, minWidth: 0 },
    categoryDetailsTitleBlock: { flex: 1, gap: 2, minWidth: 0 },
    categoryDetailsTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    pressedRow: { opacity: 0.82 },
    categoryProgressFill: { borderRadius: 999, height: "100%" },
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
    categoryRowTitleBlock: { flex: 1, gap: 1, minWidth: 0 },
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
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    selectorGroup: { gap: spacing.xs },
    selectorLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    dangerText: { color: colors.danger },
    completedBudgetText: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    completedBudgetRow: { backgroundColor: colors.cardMuted, opacity: 0.62 },
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
    debtDeleteButton: {
      backgroundColor: colors.card,
      borderColor: `${colors.danger}55`,
      borderWidth: 1,
      height: 52,
      width: 62,
    },
    debtActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "flex-end",
    },
    debtCardText: { flex: 1, gap: 3, minWidth: 0 },
    debtEditorIcon: {
      alignItems: "center",
      backgroundColor: colors.softGreen,
      borderColor: colors.line,
      borderRadius: 12,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    debtEditorPreview: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    debtEditorPreviewAmount: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      maxWidth: 104,
      textAlign: "right",
    },
    debtEditorPreviewMeta: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
    },
    debtEditorPreviewText: { flex: 1, gap: 2, minWidth: 0 },
    debtEditorPreviewTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    debtFormGrid: { flexDirection: "row", gap: spacing.sm },
    debtFormField: { flex: 1, minWidth: 0 },
    debtFormInput: { fontSize: 13, minHeight: 40 },
    debtGroupAmount: {
      color: colors.finance,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0,
      maxWidth: 110,
      textAlign: "right",
    },
    debtGroupAvatar: {
      alignItems: "center",
      borderRadius: 999,
      borderWidth: 1,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    debtGroupAvatarText: {
      fontFamily: Platform.select({
        android: "serif",
        default: "Georgia",
        ios: "Georgia",
        web: "Georgia",
      }),
      fontSize: 16,
      fontWeight: "400",
      letterSpacing: 0,
    },
    debtGroupCard: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 22,
    },
    debtGroupCountBadge: {
      alignItems: "center",
      backgroundColor: colors.softGreen,
      borderRadius: 999,
      minWidth: 20,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    debtGroupCountText: {
      color: colors.finance,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0,
    },
    debtGroupHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 54,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    debtGroupList: { gap: spacing.sm },
    debtList: { gap: spacing.sm },
    debtMeta: { color: colors.textMuted, fontSize: 12, letterSpacing: 0 },
    debtGroupMeta: {
      color: colors.textMuted,
      display: "none",
      fontSize: 9,
      letterSpacing: 0,
    },
    debtGroupText: { flex: 1, gap: 1, minWidth: 0 },
    debtGroupTitle: {
      color: colors.text,
      flex: 1,
      fontFamily: Platform.select({
        android: "serif",
        default: "Georgia",
        ios: "Georgia",
        web: "Georgia",
      }),
      fontSize: 16,
      fontWeight: "400",
      letterSpacing: 0,
      minWidth: 0,
    },
    debtGroupTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    debtModalFooter: { flexDirection: "row", gap: spacing.sm },
    debtPaymentHistory: { gap: spacing.xs },
    debtPaymentPanel: {
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.sm,
    },
    debtPaymentRow: {
      alignItems: "center",
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 42,
      paddingTop: spacing.sm,
    },
    debtPaymentRowAmount: {
      color: colors.finance,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "right",
    },
    debtPaymentRowMeta: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
    },
    debtPaymentRowText: { flex: 1, gap: 2, minWidth: 0 },
    debtPaymentRowTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    debtPaymentSummary: { flexDirection: "row", gap: spacing.xs },
    debtPaymentSummaryItem: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderRadius: 10,
      borderWidth: 1,
      flex: 1,
      gap: 2,
      minWidth: 0,
      padding: spacing.sm,
    },
    debtPaymentSummaryLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    debtPaymentSummaryValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    debtPaymentTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    debtOverviewAmount: {
      color: colors.finance,
      fontFamily: Platform.select({
        android: "serif",
        default: "Georgia",
        ios: "Georgia",
        web: "Georgia",
      }),
      fontSize: 27,
      fontWeight: "400",
      letterSpacing: 0,
      lineHeight: 31,
    },
    debtOverviewCard: {
      alignItems: "center",
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      flexDirection: "row",
      gap: 10,
      minHeight: 82,
      paddingHorizontal: 10,
      paddingVertical: 9,
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 22,
    },
    debtOverviewDivider: {
      alignSelf: "stretch",
      backgroundColor: colors.line,
      width: 1,
    },
    debtOverviewIconWrap: {
      alignItems: "center",
      backgroundColor: colors.softGreen,
      borderColor: colors.line,
      borderRadius: 999,
      borderWidth: 1,
      height: 50,
      justifyContent: "center",
      width: 50,
    },
    debtOverviewKicker: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    debtOverviewMain: { flex: 1, gap: 2, minWidth: 0 },
    debtOverviewMeta: {
      color: colors.textMuted,
      fontSize: 9,
      letterSpacing: 0,
    },
    debtOverviewStat: { alignItems: "center", flex: 1, gap: 2 },
    debtOverviewStatLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0,
    },
    debtOverviewStats: {
      alignItems: "center",
      alignSelf: "stretch",
      flexDirection: "row",
      width: 112,
    },
    debtOverviewStatValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0,
    },
    debtRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 52,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    debtRowAmount: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "right",
    },
    debtRowIcon: {
      alignItems: "center",
      backgroundColor: colors.softGreen,
      borderColor: colors.line,
      borderRadius: 10,
      borderWidth: 1,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    debtRowMeta: { color: colors.textMuted, fontSize: 10, letterSpacing: 0 },
    debtRowSettled: { opacity: 0.62 },
    debtRows: { backgroundColor: colors.card },
    debtRowSide: { alignItems: "flex-end", gap: 2, minWidth: 68 },
    debtSide: { alignItems: "flex-end", gap: spacing.sm, minWidth: 104 },
    debtRowText: { flex: 1, gap: 1, minWidth: 0 },
    debtRowTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
    },
    debtSaveButton: {
      backgroundColor: isDark ? colors.primary : mockupGreen,
      borderColor: isDark ? colors.primary : mockupGreen,
      flex: 1,
    },
    debtSettledText: {
      color: colors.textSubtle,
      textDecorationLine: "line-through",
    },
    debtStatusDot: {
      backgroundColor: colors.warning,
      borderRadius: 999,
      height: 6,
      width: 6,
    },
    debtStatusDotDone: { backgroundColor: colors.finance },
    debtStatusGroup: { gap: spacing.xs },
    debtStatusLine: { alignItems: "center", flexDirection: "row", gap: 5 },
    debtStatusText: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0,
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
    debtSwipeHint: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      paddingVertical: spacing.xs,
    },
    debtSwipeHintText: {
      color: colors.textSubtle,
      fontSize: 12,
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
      color: colors.finance,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    expenseContextMeta: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
      letterSpacing: 0,
      lineHeight: 17,
    },
    expenseContextTitle: {
      color: colors.finance,
      fontSize: 17,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 21,
    },
    expenseHistoryAddCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    expenseHistoryAddHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    expenseHistoryActions: { gap: spacing.sm, paddingTop: spacing.sm },
    expenseHistoryAmount: {
      color: colors.finance,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "right",
    },
    expenseHistoryList: { gap: spacing.xs },
    expenseHistoryMeta: {
      color: colors.text,
      fontSize: 13,
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
      padding: spacing.md,
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
    expenseHistorySummarySide: { alignItems: "flex-end", gap: 2 },
    expenseHistorySummaryValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0,
    },
    expenseHistoryText: { flex: 1, gap: 2, minWidth: 0 },
    expenseHistoryTitle: {
      color: colors.finance,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0,
    },
    financeHeaderActionButton: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderWidth: 1,
      elevation: 1,
      height: 48,
      padding: 0,
      shadowColor: "#000000",
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 10,
      width: 48,
    },
    notificationImportBadge: {
      backgroundColor: colors.danger,
      borderRadius: 999,
      color: colors.inverseText,
      fontSize: 10,
      fontWeight: "700",
      minWidth: 18,
      paddingHorizontal: 4,
      paddingVertical: 2,
      position: "absolute",
      right: -3,
      textAlign: "center",
      top: -3,
    },
    financeHeaderActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    financeHeaderSearch: {
      alignItems: "center",
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 44,
      paddingLeft: spacing.md,
      paddingRight: 4,
    },
    financeHeaderSearchInput: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      letterSpacing: 0,
      minHeight: 42,
      minWidth: 0,
      paddingVertical: 0,
    },
    financeSearchCloseButton: { height: 36, width: 36 },
    financeMenuGrid: { gap: spacing.sm },
    financeScreenContent: { gap: 12, paddingBottom: 128, paddingTop: 2 },
    savingsDetailsCard: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    savingsDetailsImage: { height: 64, width: 64 },
    savingsDetailsImageFrame: { height: 72, width: 72 },
    savingsDetailsHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    savingsDetailsIcon: {
      backgroundColor: colors.softGreen,
      height: 54,
      width: 54,
    },
    savingsDetailsMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    savingsTransactionList: { gap: spacing.xs, marginTop: spacing.xs },
    savingsDetailsText: { flex: 1, gap: 2, minWidth: 0 },
    savingsDetailsTitle: {
      color: colors.finance,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: 0,
    },
    savingsGroupAmount: {
      color: colors.finance,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "right",
    },
    savingsGroupAmountBlock: { alignItems: "flex-end", minWidth: 72 },
    savingsGroupAvatar: {
      alignItems: "center",
      borderRadius: 999,
      borderWidth: 1,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    savingsGroupAvatarLabel: {
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    savingsGroupCard: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 2,
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 22,
    },
    savingsGroupChevron: {
      alignItems: "center",
      justifyContent: "center",
      width: 26,
    },
    savingsGroupCountBadge: {
      alignItems: "center",
      backgroundColor: colors.softGreen,
      borderRadius: 999,
      height: 19,
      justifyContent: "center",
      minWidth: 19,
      paddingHorizontal: 6,
    },
    savingsGroupCountText: {
      color: colors.finance,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0,
    },
    savingsGroupHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 7,
      padding: spacing.sm,
    },
    savingsGroupList: { gap: spacing.sm },
    savingsGroupMeta: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
    },
    savingsGroupText: { flex: 1, gap: 2, minWidth: 0 },
    savingsGroupTitle: {
      color: colors.text,
      flex: 1,
      fontFamily: Platform.select({
        android: "serif",
        default: "Georgia",
        ios: "Georgia",
        web: "Georgia",
      }),
      fontSize: 16,
      fontWeight: "400",
      letterSpacing: 0,
      minWidth: 0,
    },
    savingsGroupTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    savingsGoalAmount: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "right",
    },
    savingsGoalAmountBlock: { alignItems: "flex-end", gap: 2, minWidth: 78 },
    savingsGoalImage: { height: 48, width: 48 },
    savingsGoalImageFrame: {
      alignItems: "center",
      height: 52,
      justifyContent: "center",
      width: 52,
    },
    savingsGoalList: { gap: 0, paddingBottom: spacing.sm },
    savingsGoalMeta: { color: colors.textMuted, fontSize: 9, letterSpacing: 0 },
    savingsGoalProgressFill: { borderRadius: 999, height: "100%" },
    savingsGoalProgressLabel: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "right",
    },
    savingsGoalProgressLabelNormal: { color: colors.finance },
    savingsGoalProgressLabelSuccess: { color: colors.finance },
    savingsGoalProgressLabelWarning: { color: colors.warning },
    savingsGoalProgressTrack: {
      backgroundColor: colors.cardMuted,
      borderRadius: 999,
      height: 4,
      overflow: "hidden",
      width: "100%",
    },
    savingsGoalRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: spacing.sm,
      paddingVertical: 9,
    },
    savingsGoalText: { flex: 1, gap: 2, minWidth: 0 },
    savingsGoalTitle: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
    },
    savingsNextGoalCard: {
      alignItems: "center",
      backgroundColor: colors.softGreen,
      borderColor: colors.line,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    savingsNextGoalButton: {
      backgroundColor: colors.card,
      borderColor: colors.finance,
      minWidth: 106,
    },
    savingsNextGoalButtonLabel: { color: colors.finance },
    savingsNextGoalIconWrap: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderRadius: 14,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    savingsNextGoalLabel: {
      color: colors.finance,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    savingsNextGoalMeta: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    savingsNextGoalText: { flex: 1, gap: 2, minWidth: 0 },
    savingsNextGoalTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    savingsOverview: { gap: spacing.md },
    savingsSummaryCard: {
      alignItems: "center",
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 16,
      borderWidth: 1,
      elevation: 2,
      flexDirection: "row",
      gap: spacing.sm,
      padding: 10,
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 22,
    },
    savingsSummaryHeader: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
    },
    savingsSummaryIconWrap: {
      alignItems: "center",
      backgroundColor: colors.softGreen,
      borderColor: colors.line,
      borderRadius: 999,
      borderWidth: 1,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    savingsSummaryKicker: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    savingsSummaryMeta: {
      color: colors.textMuted,
      fontSize: 9,
      letterSpacing: 0,
      lineHeight: 14,
    },
    savingsSummaryStats: {
      alignItems: "center",
      alignSelf: "stretch",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingLeft: 7,
      width: 112,
    },
    savingsSummaryStat: {
      alignItems: "center",
      flex: 1,
      gap: 2,
      justifyContent: "center",
    },
    savingsSummaryStatDivider: {
      alignSelf: "stretch",
      backgroundColor: colors.line,
      width: 1,
    },
    savingsSummaryStatLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0,
    },
    savingsSummaryStatValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    savingsSummaryText: { flex: 1, gap: 2, minWidth: 0 },
    dangerButton: { borderColor: colors.danger, backgroundColor: colors.card },
    dangerButtonLabel: { color: colors.danger },
    savingsSummaryValue: {
      color: colors.finance,
      fontFamily: Platform.select({
        android: "serif",
        default: "Georgia",
        ios: "Georgia",
        web: "Georgia",
      }),
      fontSize: 27,
      fontWeight: "400",
      letterSpacing: 0,
      lineHeight: 31,
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
    savingsDeltaAdd: { color: colors.primaryDark },
    savingsDeltaSubtract: { color: colors.danger },
    savingsHistory: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.sm,
    },
    savingsIconButton: { height: 34, width: 34 },
    savingsSummaryTitle: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
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
    copyAmountList: { gap: spacing.xs },
    copyAmountMeta: { color: colors.textMuted, fontSize: 11, letterSpacing: 0 },
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
    copyAmountText: { flex: 1, gap: 2, minWidth: 0 },
    copyAmountTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    generateCategoryGroup: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginBottom: spacing.sm,
      overflow: "hidden",
    },
    generateCategoryGroupActive: {
      borderColor: colors.primary,
      elevation: 5,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: isDark ? 0.28 : 0.14,
      shadowRadius: 16,
    },
    generateCategoryHeader: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    generateCategoryList: { flexShrink: 1, minHeight: 0 },
    generateCategorySelect: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
    },
    generateCategoryMeta: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
    },
    generateCategoryText: { flex: 1, gap: 2, minWidth: 0 },
    generateCategoryTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    generateCheckbox: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderRadius: 5,
      borderWidth: 1,
      height: 22,
      justifyContent: "center",
      width: 22,
    },
    generateCheckboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    generateCheckboxPartial: {
      backgroundColor: colors.textMuted,
      borderColor: colors.textMuted,
    },
    generateCopyList: { flexShrink: 1, gap: spacing.sm, minHeight: 0 },
    generateToolbar: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.sm,
    },
    generateToolbarActions: { flexDirection: "row", gap: spacing.sm },
    generateToolbarButton: { flex: 1 },
    generateToolbarMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    generateItemCheckButton: {
      alignItems: "center",
      alignSelf: "stretch",
      justifyContent: "center",
      paddingRight: 2,
    },
    generateItemList: { gap: spacing.xs, padding: spacing.sm },
    generateItemRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 52,
      padding: spacing.sm,
    },
    generateItemRowMuted: { opacity: 0.64 },
    generateModalBody: {
      flexShrink: 1,
      gap: spacing.md,
      minHeight: 0,
      padding: spacing.lg,
      paddingBottom: spacing.lg,
    },
    generateDragHandle: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      height: 38,
      justifyContent: "center",
      width: 40,
    },
    generateDragHandleActive: {
      backgroundColor: colors.softGreen,
      borderColor: colors.primary,
    },
    filterChip: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: 5,
      justifyContent: "center",
      minHeight: 30,
      paddingHorizontal: spacing.sm,
    },
    filterChipActive: {
      backgroundColor: isDark ? colors.primary : mockupGreen,
      borderColor: isDark ? colors.primary : mockupGreen,
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
    filterCategoryGrid: { paddingRight: 0 },
    filterChipText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0,
    },
    filterChipTextActive: { color: colors.inverseText },
    filterDetails: { gap: spacing.sm },
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 30,
      justifyContent: "center",
      width: 30,
    },
    filterOwnerRail: {
      flexDirection: "row",
      gap: spacing.xs,
      paddingRight: spacing.xs,
    },
    filterTopRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    filterGroup: { gap: spacing.xs },
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
    headerCell: {
      backgroundColor: colors.cardMuted,
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
    },
    incomeBreakdownList: { gap: spacing.sm },
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
    incomeBreakdownRowActive: { borderColor: colors.primary, borderWidth: 2 },
    incomeBreakdownText: { flex: 1, gap: 2, minWidth: 0 },
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
      display: "none",
    },
    financeSummaryBudgetText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0,
    },
    financeSummaryCard: {
      alignItems: "center",
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 14,
      borderWidth: 1,
      elevation: 2,
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      minHeight: 116,
      overflow: "hidden",
      paddingHorizontal: 18,
      paddingVertical: 14,
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 22,
    },
    financeSummaryCenter: {
      alignItems: "center",
      height: 94,
      justifyContent: "flex-start",
      position: "relative",
      width: 94,
    },
    financeSummaryCenterText: {
      alignItems: "center",
      gap: 1,
      left: 0,
      position: "absolute",
      right: 0,
      top: 25,
    },
    financeSummaryLabel: {
      flexShrink: 1,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "center",
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
      height: 78,
      justifyContent: "center",
      position: "relative",
      width: 78,
    },
    financeSummaryRingInner: {
      backgroundColor: colors.overlay,
      borderColor: colors.cardMuted,
      borderRadius: 999,
      borderWidth: 1,
      height: 52,
      position: "absolute",
      width: 52,
    },
    financeSummaryRingLabel: {
      color: colors.textMuted,
      fontSize: 8,
      fontWeight: "700",
      letterSpacing: 0,
    },
    financeSummaryRingSegment: {
      borderRadius: 999,
      height: 10,
      left: 37,
      position: "absolute",
      top: 34,
      width: 4,
    },
    financeSummaryRingValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      maxWidth: 64,
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
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "center",
    },
    financeSummarySideMeta: {
      fontSize: 11,
      fontWeight: "800",
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
    metricPressed: { opacity: 0.78 },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
    },
    metricRow: { flexDirection: "row", gap: spacing.xs },
    metricTop: { alignItems: "center", flexDirection: "row", gap: 3 },
    metricValue: { fontSize: 13, fontWeight: "900", letterSpacing: 0 },
    modalFooter: { flexDirection: "row", gap: spacing.sm },
    modalFooterButton: { flex: 1 },
    monthSwitcher: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 34,
      paddingHorizontal: 4,
      width: 166,
    },
    monthSwitcherRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
    },
    monthSwitcherTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
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
    monthFilterButton: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      height: 38,
      width: 38,
    },
    monthFilterButtonActive: {
      backgroundColor: colors.softGreen,
      borderColor: colors.primary,
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
    monthTabTextActive: { color: colors.inverseText },
    muted: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 18,
    },
    personCell: { width: 64 },
    positiveText: { color: isDark ? colors.primaryDark : mockupGreen },
    sheet: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      minWidth: 414,
      overflow: "hidden",
    },
    sheetHeader: { flexDirection: "row" },
    sheetRow: {
      backgroundColor: colors.card,
      borderColor: colors.line,
      borderTopWidth: 1,
      flexDirection: "row",
    },
    sheetRowContent: { flexDirection: "row" },
    sheetScroller: { marginRight: -spacing.md },
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
      alignItems: "stretch",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    totalMetric: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.line,
      borderRadius: radii.control,
      borderWidth: 1,
      flex: 1,
      gap: 2,
      justifyContent: "center",
      minHeight: 54,
      minWidth: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    totalMetricLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    totalMetricMeta: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0,
    },
    totalMetricValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
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
