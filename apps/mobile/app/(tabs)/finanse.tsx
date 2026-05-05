import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  Archive,
  Banknote,
  ChevronLeft,
  ChevronRight,
  DotsVertical,
  Filter,
  Plus,
  ReceiptText,
  WalletCards,
} from "../../src/ui/icon";
import {
  createBudgetCategory,
  createBudgetItem,
  createExpense,
  generateNextBudgetMonth,
  getBudgetMonth,
  getFinanceSummary,
  listBudgetCategories,
  listBudgetMonths,
  queryKeys,
  type BudgetCategoryWithItems,
  type BudgetMonth,
  upsertIncome,
} from "../../src/api";
import { useModulePermission } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import {
  ActionButton,
  AppScreen,
  FormModal,
  InlineAlert,
  QueryState,
  SegmentedControl,
  TextField,
} from "../../src/ui";

type FinanceFormValues = {
  categoryName: string;
  expenseAmount: string;
  incomeAmount: string;
  itemAmount: string;
  itemName: string;
};

type BudgetItem = BudgetCategoryWithItems["items"][number];
type BudgetItemWithCategory = BudgetItem & {
  category: BudgetCategoryWithItems;
};

export default function FinanseScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const { canCreate, canRead, canUpdate, permissionsQuery } = useModulePermission("finances");
  const accessToken = session?.accessToken;
  const { control, setValue, watch } = useForm<FinanceFormValues>({
    defaultValues: {
      categoryName: "",
      expenseAmount: "",
      incomeAmount: "",
      itemAmount: "",
      itemName: "",
    },
  });

  const incomeAmount = watch("incomeAmount");
  const categoryName = watch("categoryName");
  const itemName = watch("itemName");
  const itemAmount = watch("itemAmount");
  const expenseAmount = watch("expenseAmount");
  const [selectedIncomeMemberId, setSelectedIncomeMemberId] = useState("");
  const [selectedItemCategoryId, setSelectedItemCategoryId] = useState("");
  const [selectedItemOwnerId, setSelectedItemOwnerId] = useState("");
  const [selectedExpenseItemId, setSelectedExpenseItemId] = useState("");
  const [copyCategory, setCopyCategory] = useState(true);
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [financeModal, setFinanceModal] = useState<
    "menu" | "income" | "category" | "item" | "expense" | null
  >(null);

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

  const currentSummary = currentQuery.data;
  const summary =
    selectedMonthId && selectedMonthId !== currentSummary?.month.id
      ? selectedArchiveQuery.data
      : currentSummary;
  const totals = summary?.summary;
  const incomes = currentSummary?.incomes ?? [];
  const categories = summary?.categories ?? [];
  const currentCategories = currentSummary?.categories ?? [];
  const flatItems = useMemo<BudgetItemWithCategory[]>(
    () =>
      currentCategories.flatMap((category) =>
        getCategoryItems(category).map((item) => ({ ...item, category })),
      ),
    [currentCategories],
  );
  const currentMonth = currentSummary?.month;
  const visibleMonth = summary?.month;
  const budgetAmount = Number(totals?.totalBudgetAmount ?? 0);
  const spentAmount = Number(totals?.totalSpentAmount ?? 0);
  const remainingAmount = Number(totals?.totalRemainingAmount ?? 0);
  const monthTabs = useMemo(() => {
    const months = [...(archiveQuery.data ?? []), ...(currentMonth ? [currentMonth] : [])];
    const unique = new Map<string, BudgetMonth>();

    months.forEach((month) => unique.set(month.id, month));

    return [...unique.values()]
      .sort((left, right) => left.year - right.year || left.month - right.month)
      .slice(-5);
  }, [archiveQuery.data, currentMonth]);

  useEffect(() => {
    if (!selectedMonthId && currentMonth?.id) {
      setSelectedMonthId(currentMonth.id);
    }
  }, [currentMonth?.id, selectedMonthId]);

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
    const firstCategoryId = categoriesQuery.data?.[0]?.id ?? currentCategories[0]?.id;

    if (!selectedItemCategoryId && firstCategoryId) {
      setSelectedItemCategoryId(firstCategoryId);
    }
  }, [categoriesQuery.data, currentCategories, selectedItemCategoryId]);

  useEffect(() => {
    if (!selectedExpenseItemId && flatItems[0]) {
      setSelectedExpenseItemId(flatItems[0].id);
    }
  }, [flatItems, selectedExpenseItemId]);

  const invalidateFinance = () => queryClient.invalidateQueries({ queryKey: queryKeys.finances });
  const incomeMutation = useMutation({
    mutationFn: () =>
      upsertIncome(
        selectedIncomeMemberId,
        { amount: parseMoney(incomeAmount) },
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
          budgetMonthId: currentMonth?.id ?? "",
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
      await invalidateFinance();
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });

  const canSaveIncome =
    canUpdate && Boolean(selectedIncomeMemberId) && isValidMoney(incomeAmount);
  const canSaveCategory = canCreate && Boolean(categoryName.trim());
  const canSaveItem =
    canCreate &&
    Boolean(currentMonth?.id) &&
    Boolean(itemName.trim()) &&
    Boolean(selectedItemCategoryId) &&
    Boolean(selectedItemOwnerId) &&
    (!itemAmount.trim() || isValidMoney(itemAmount));
  const canSaveExpense =
    canCreate && Boolean(selectedExpenseItemId) && isPositiveMoney(expenseAmount);

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
    <AppScreen
      actions={
        <View style={styles.headerActions}>
          <Filter color={theme.colors.text} size={19} />
          <DotsVertical color={theme.colors.text} size={19} />
        </View>
      }
      title="Finanse"
    >
      <QueryState
        emptyText="Brak danych finansowych."
        error={currentQuery.error ?? selectedArchiveQuery.error}
        isEmpty={!currentQuery.isLoading && !summary}
        isLoading={currentQuery.isLoading || selectedArchiveQuery.isLoading}
      />

      {summary ? (
        <>
          <View style={styles.monthSwitcher}>
            <ChevronLeft color={theme.colors.textMuted} size={20} />
            <Text style={styles.monthSwitcherTitle}>{visibleMonth ? formatMonthLong(visibleMonth) : "Miesiąc"}</Text>
            <ChevronRight color={theme.colors.textMuted} size={20} />
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.monthTabs}>
              {monthTabs.map((month) => {
                const active = month.id === selectedMonthId;

                return (
                  <Pressable
                    key={month.id}
                    onPress={() => setSelectedMonthId(month.id)}
                    style={[styles.monthTab, active && styles.monthTabActive]}
                  >
                    <Text style={[styles.monthTabText, active && styles.monthTabTextActive]}>
                      {formatMonthShort(month)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <FinanceSheet categories={categories} />

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
            onClose={() => setFinanceModal(null)}
            subtitle="Wybierz, co chcesz dopisać do finansów."
            title="Dodaj w finansach"
            visible={financeModal === "menu"}
          >
            <View style={styles.actionPicker}>
              {canUpdate ? (
                <ActionButton onPress={() => setFinanceModal("income")} title="Zmień dochód" variant="secondary" />
              ) : null}
              <ActionButton onPress={() => setFinanceModal("category")} title="Dodaj kategorię" variant="secondary" />
              <ActionButton onPress={() => setFinanceModal("item")} title="Dodaj pozycję budżetu" />
              <ActionButton onPress={() => setFinanceModal("expense")} title="Dodaj wydatek" variant="secondary" />
              <ActionButton
                disabled={nextMonthMutation.isPending}
                loading={nextMonthMutation.isPending}
                onPress={() => nextMonthMutation.mutate()}
                title="Wygeneruj kolejny miesiąc"
                variant="ghost"
              />
            </View>
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
                  onPress={() => setFinanceModal(null)}
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
              <Text style={styles.muted}>Kopiuj budżet do kolejnego miesiąca</Text>
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
                  onPress={() => setFinanceModal(null)}
                  style={styles.modalFooterButton}
                  title="Anuluj"
                  variant="secondary"
                />
                <ActionButton
                  disabled={!canSaveItem}
                  loading={itemMutation.isPending}
                  onPress={() => itemMutation.mutate()}
                  style={styles.modalFooterButton}
                  title="Dodaj"
                />
              </View>
            }
            onClose={() => setFinanceModal(null)}
            subtitle="Pozycja to konkretny limit lub koszt w aktualnym miesiącu."
            title="Dodaj pozycję budżetu"
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
              items={(categoriesQuery.data ?? currentCategories).map((category) => ({
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
            {itemMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się dodać pozycji." />
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
            subtitle="Wybierz pozycję budżetu i zaksięguj wydatek."
            title="Dodaj wydatek"
            visible={financeModal === "expense"}
          >
            <ChoiceSelector
              emptyText="Brak pozycji do wyboru."
              items={flatItems.map((item) => ({
                id: item.id,
                label: `${item.name} - ${formatOwner(item.owner)}`,
              }))}
              onSelect={setSelectedExpenseItemId}
              selectedId={selectedExpenseItemId}
            />
            <TextField
              control={control}
              keyboardType="decimal-pad"
              label="Kwota wydatku"
              name="expenseAmount"
              placeholder="0,00"
            />
            {expenseMutation.error ? (
              <InlineAlert tone="error" text="Nie udało się dodać wydatku." />
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

function FinanceSheet({ categories }: { categories: BudgetCategoryWithItems[] }) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  if (categories.length === 0) {
    return <InlineAlert text="Nie ma jeszcze kategorii budżetowych." />;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sheetScroller}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.headerCell, styles.personCell]}>Osoba</Text>
          <Text style={[styles.headerCell, styles.categoryCell]}>Kategoria</Text>
          <Text style={styles.amountHeaderCell}>Budżet</Text>
          <Text style={styles.amountHeaderCell}>Wydano</Text>
          <Text style={styles.amountHeaderCell}>Zostaje</Text>
        </View>
        {categories.map((category) => {
          const items = getCategoryItems(category);
          const planned = items.reduce((sum, item) => sum + Number(item.budgetAmount ?? 0), 0);
          const spent = items.reduce((sum, item) => sum + Number(item.spentAmount ?? 0), 0);
          const remaining = planned - spent;

          return (
            <View key={category.id}>
              <View style={styles.categoryRow}>
                <Text style={styles.categoryRowText}>{category.name.toUpperCase()}</Text>
              </View>
              {items.length === 0 ? (
                <View style={styles.sheetRow}>
                  <Text style={[styles.bodyCell, styles.personCell]}>-</Text>
                  <Text style={[styles.bodyCell, styles.categoryCell]}>Brak pozycji</Text>
                  <Text style={styles.amountCell}>-</Text>
                  <Text style={styles.amountCell}>-</Text>
                  <Text style={styles.amountCell}>-</Text>
                </View>
              ) : null}
              {items.map((item) => (
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
                </View>
              ))}
              <View style={styles.sumRow}>
                <Text style={[styles.sumCell, styles.personCell]}>Suma</Text>
                <Text style={[styles.sumCell, styles.categoryCell]}>{category.name}</Text>
                <Text style={styles.amountSumCell}>{formatMoney(planned)}</Text>
                <Text style={styles.amountSumCell}>{formatMoney(spent)}</Text>
                <Text style={[styles.amountSumCell, remaining < 0 && styles.dangerText]}>
                  {formatMoney(remaining)}
                </Text>
              </View>
            </View>
          );
        })}
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

function getCategoryItems(category: BudgetCategoryWithItems): BudgetItem[] {
  return Array.isArray(category.items) ? category.items : [];
}

function formatOwner(owner: BudgetItem["owner"] | null | undefined): string {
  return owner?.displayName || owner?.email || "Brak właściciela";
}

function parseMoney(value: string): number {
  return Number(value.replace(",", ".").trim());
}

function isValidMoney(value: string): boolean {
  const parsed = parseMoney(value);

  return value.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0;
}

function isPositiveMoney(value: string): boolean {
  const parsed = parseMoney(value);

  return value.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;
}

function formatMoney(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);

  return `${(Number.isFinite(amount) ? amount : 0).toLocaleString("pl-PL", {
    maximumFractionDigits: 0,
  })} zł`;
}

function formatMonthShort(month: BudgetMonth): string {
  const date = new Date(month.year, month.month - 1, 1);
  const label = new Intl.DateTimeFormat("pl-PL", {
    month: "short",
  }).format(date);

  return `${label.replace(".", "")} ${String(month.year).slice(2)}`;
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
      backgroundColor: colors.primarySoft,
      borderColor: colors.line,
      borderTopWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    categoryRowText: {
      color: colors.primaryDark,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    dangerText: {
      color: colors.danger,
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
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 34,
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
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 38,
      paddingHorizontal: spacing.sm,
    },
    monthSwitcherTitle: {
      color: colors.primaryDark,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
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
      backgroundColor: colors.primarySoft,
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
