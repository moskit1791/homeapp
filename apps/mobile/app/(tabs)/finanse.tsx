import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, Switch, Text, View } from "react-native";
import {
  Archive,
  Banknote,
  CalendarPlus,
  FolderPlus,
  ReceiptText,
  RefreshCcw,
  WalletCards,
} from "../../src/ui/icon";
import {
  createBudgetCategory,
  createBudgetItem,
  createExpense,
  generateNextBudgetMonth,
  getFinanceSummary,
  listBudgetCategories,
  listBudgetMonths,
  upsertIncome,
  type BudgetCategoryWithItems,
  type BudgetMonth,
  queryKeys,
} from "../../src/api";
import { useModulePermission } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import {
  ActionButton,
  AppScreen,
  FormModal,
  IconButton,
  InlineAlert,
  MetricCard,
  QueryState,
  SectionCard,
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
  const { canCreate, canRead, canUpdate, permissionsQuery } =
    useModulePermission("finances");
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
  const [financeModal, setFinanceModal] = useState<
    "menu" | "income" | "category" | "item" | "expense" | null
  >(null);

  const summaryQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => getFinanceSummary({ accessToken }),
    queryKey: [...queryKeys.finances, "current"],
  });

  const categoriesQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listBudgetCategories({ accessToken }),
    queryKey: [...queryKeys.finances, "categories"],
  });

  const archiveQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listBudgetMonths({ accessToken }),
    queryKey: [...queryKeys.finances, "archive"],
  });

  const summary = summaryQuery.data;
  const totals = summary?.summary;
  const incomes = summary?.incomes ?? [];
  const categories = summary?.categories ?? [];
  const flatItems = useMemo<BudgetItemWithCategory[]>(
    () =>
      categories.flatMap((category) =>
        getCategoryItems(category).map((item) => ({ ...item, category })),
      ),
    [categories],
  );
  const currentMonth = summary?.month;
  const budgetAmount = Number(totals?.totalBudgetAmount ?? 0);
  const spentAmount = Number(totals?.totalSpentAmount ?? 0);
  const remainingAmount = Number(totals?.totalRemainingAmount ?? 0);
  const budgetUsagePercent =
    budgetAmount > 0
      ? Math.min(Math.max((spentAmount / budgetAmount) * 100, 0), 100)
      : 0;

  useEffect(() => {
    if (!selectedIncomeMemberId && incomes[0]) {
      setSelectedIncomeMemberId(incomes[0].ownerMemberId);
    }
  }, [incomes, selectedIncomeMemberId, setSelectedIncomeMemberId]);

  useEffect(() => {
    if (!selectedItemOwnerId && incomes[0]) {
      setSelectedItemOwnerId(incomes[0].ownerMemberId);
    }
  }, [incomes, selectedItemOwnerId, setSelectedItemOwnerId]);

  useEffect(() => {
    const firstCategoryId = categoriesQuery.data?.[0]?.id ?? categories[0]?.id;

    if (!selectedItemCategoryId && firstCategoryId) {
      setSelectedItemCategoryId(firstCategoryId);
    }
  }, [
    categories,
    categoriesQuery.data,
    selectedItemCategoryId,
    setSelectedItemCategoryId,
  ]);

  useEffect(() => {
    if (!selectedExpenseItemId && flatItems[0]) {
      setSelectedExpenseItemId(flatItems[0].id);
    }
  }, [flatItems, selectedExpenseItemId, setSelectedExpenseItemId]);

  const invalidateFinance = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.finances });

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
    },
  });

  const nextMonthMutation = useMutation({
    mutationFn: () => generateNextBudgetMonth({ accessToken }),
    onSuccess: async () => {
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
    canCreate &&
    Boolean(selectedExpenseItemId) &&
    isPositiveMoney(expenseAmount);

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
        <View style={styles.topActions}>
          {canCreate ? (
            <ActionButton
              onPress={() => setFinanceModal("menu")}
              size="small"
              title="+ Dodaj"
            />
          ) : null}
          <IconButton onPress={() => summaryQuery.refetch()}>
            <RefreshCcw color={theme.colors.textMuted} size={18} />
          </IconButton>
        </View>
      }
      subtitle={
        currentMonth
          ? `Budżet domowy, ${formatMonth(currentMonth)}`
          : "Brak bieżącego miesiąca"
      }
      title="Finanse"
    >
      <QueryState
        error={summaryQuery.error}
        isEmpty={!summaryQuery.isLoading && !summary}
        isLoading={summaryQuery.isLoading}
        emptyText="Brak danych finansowych."
      />

      {summary ? (
        <>
          <View style={styles.hero}>
            <View style={styles.heroHeader}>
              <View style={styles.heroIcon}>
                <WalletCards color={theme.colors.finance} size={22} />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroLabel}>Saldo miesiąca</Text>
                <Text
                  style={[
                    styles.heroValue,
                    remainingAmount < 0 && styles.heroValueDanger,
                  ]}
                >
                  {formatMoney(remainingAmount)}
                </Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  remainingAmount < 0 && styles.progressFillDanger,
                  { width: `${budgetUsagePercent}%` },
                ]}
              />
            </View>
            <View style={styles.heroMetaRow}>
              <Text style={styles.heroMeta}>
                Wydane {formatMoney(spentAmount)}
              </Text>
              <Text style={styles.heroMeta}>
                Budżet {formatMoney(budgetAmount)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <MetricCard
              icon={<Banknote color={theme.colors.finance} size={17} />}
              label="Dochody"
              style={[styles.metricCard, styles.metricIncome]}
              value={formatMoney(totals?.incomeAmount)}
            />
            <MetricCard
              icon={<WalletCards color={theme.colors.info} size={17} />}
              label="Budżet"
              style={[styles.metricCard, styles.metricBudget]}
              value={formatMoney(totals?.totalBudgetAmount)}
            />
            <MetricCard
              icon={<ReceiptText color={theme.colors.warning} size={17} />}
              label="Wydane"
              style={[styles.metricCard, styles.metricSpent]}
              value={formatMoney(totals?.totalSpentAmount)}
            />
            <MetricCard
              icon={
                <Archive
                  color={
                    remainingAmount < 0
                      ? theme.colors.danger
                      : theme.colors.primaryDark
                  }
                  size={17}
                />
              }
              label="Zostaje"
              style={[
                styles.metricCard,
                remainingAmount < 0
                  ? styles.metricDanger
                  : styles.metricRemaining,
              ]}
              value={formatMoney(totals?.totalRemainingAmount)}
            />
          </View>

          <SectionCard
            action={
              canUpdate ? (
                <ActionButton
                  onPress={() => setFinanceModal("income")}
                  size="small"
                  title="Zmień"
                  variant="secondary"
                />
              ) : null
            }
            icon={<Banknote color={theme.colors.finance} size={18} />}
            subtitle={`${incomes.length} osób`}
            title="Dochody"
          >
            <View style={styles.list}>
              {incomes.map((income) => (
                <MoneyRow
                  key={income.ownerMemberId}
                  label={income.displayName}
                  sublabel={income.email}
                  value={formatMoney(income.amount)}
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard
            action={
              canCreate ? (
                <View style={styles.sectionActions}>
                  <ActionButton
                    onPress={() => setFinanceModal("category")}
                    size="small"
                    title="Kategoria"
                    variant="secondary"
                  />
                  <ActionButton
                    onPress={() => setFinanceModal("item")}
                    size="small"
                    title="Pozycja"
                  />
                </View>
              ) : null
            }
            icon={<FolderPlus color={theme.colors.info} size={18} />}
            subtitle={`${categories.length} kategorii`}
            title="Kategorie i budżet"
          >
            <View style={styles.list}>
              {categories.length === 0 ? (
                <InlineAlert text="Nie ma jeszcze kategorii budżetowych." />
              ) : null}
              {categories.map((category) => (
                <CategoryBlock
                  category={category}
                  colors={theme.colors}
                  key={category.id}
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard
            action={
              canCreate ? (
                <ActionButton
                  onPress={() => setFinanceModal("expense")}
                  size="small"
                  title="Dodaj"
                />
              ) : null
            }
            icon={<ReceiptText color={theme.colors.warning} size={18} />}
            subtitle={`${flatItems.length} pozycji`}
            title="Wydatki"
          >
            <View style={styles.list}>
              {flatItems.length === 0 ? (
                <InlineAlert text="Dodaj pozycję, aby księgować wydatki." />
              ) : null}
              {flatItems.map((item) => (
                <MoneyRow
                  key={item.id}
                  label={item.name}
                  sublabel={`${item.category.name} - ${formatOwner(item.owner)}`}
                  value={`${formatMoney(item.spentAmount)} wydane`}
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard
            action={
              canCreate ? (
                <ActionButton
                  disabled={nextMonthMutation.isPending}
                  loading={nextMonthMutation.isPending}
                  onPress={() => nextMonthMutation.mutate()}
                  size="small"
                  title="Nowy miesiąc"
                  variant="secondary"
                />
              ) : null
            }
            icon={<CalendarPlus color={theme.colors.info} size={18} />}
            subtitle={`${archiveQuery.data?.length ?? 0} miesięcy`}
            title="Archiwum"
          >
            <Text style={styles.muted}>
              Nowy miesiąc przenosi pozycje budżetu i archiwizuje obecny.
            </Text>
            <QueryState
              error={archiveQuery.error}
              isLoading={archiveQuery.isLoading}
            />
            <View style={styles.list}>
              {(archiveQuery.data ?? []).slice(0, 6).map((month) => (
                <MoneyRow
                  key={month.id}
                  label={formatMonth(month)}
                  sublabel={
                    month.archivedAt
                      ? `Zamknięty ${formatDate(month.archivedAt)}`
                      : "Archiwum"
                  }
                  value=""
                />
              ))}
              {!archiveQuery.isLoading &&
              (archiveQuery.data ?? []).length === 0 ? (
                <InlineAlert text="Archiwum jest jeszcze puste." />
              ) : null}
            </View>
            {nextMonthMutation.error ? (
              <InlineAlert
                tone="error"
                text="Nie udało się wygenerować kolejnego miesiąca."
              />
            ) : null}
          </SectionCard>

          <FormModal
            onClose={() => setFinanceModal(null)}
            subtitle="Wybierz, co chcesz dopisać do finansów."
            title="Dodaj w finansach"
            visible={financeModal === "menu"}
          >
            <View style={styles.actionPicker}>
              <ActionButton
                onPress={() => setFinanceModal("category")}
                title="+ Dodaj kategorię"
                variant="secondary"
              />
              <ActionButton
                onPress={() => setFinanceModal("item")}
                title="+ Dodaj pozycję budżetu"
              />
              <ActionButton
                onPress={() => setFinanceModal("expense")}
                title="+ Dodaj wydatek"
                variant="secondary"
              />
              {canUpdate ? (
                <ActionButton
                  onPress={() => setFinanceModal("income")}
                  title="Zmień dochód"
                  variant="ghost"
                />
              ) : null}
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
              <Text style={styles.muted}>
                Kopiuj budżet do kolejnego miesiąca
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

function CategoryBlock({
  category,
  colors,
}: {
  category: BudgetCategoryWithItems;
  colors: AppPalette;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const items = getCategoryItems(category);
  const planned = items.reduce(
    (sum, item) => sum + Number(item.budgetAmount ?? 0),
    0,
  );
  const spent = items.reduce(
    (sum, item) => sum + Number(item.spentAmount ?? 0),
    0,
  );
  const remaining = planned - spent;

  return (
    <View style={styles.categoryBlock}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryTitle}>
          <Text style={styles.itemTitle}>{category.name}</Text>
          <Text style={styles.muted}>
            {items.length} pozycji -{" "}
            {category.copyBudgetToNextMonth ? "kopiowana" : "jednorazowa"}
          </Text>
        </View>
        <Text
          style={[
            styles.categoryTotal,
            remaining < 0 && styles.moneyValueDanger,
          ]}
        >
          {formatMoney(remaining)}
        </Text>
      </View>
      <View style={styles.list}>
        {items.length === 0 ? (
          <InlineAlert text="Brak pozycji w tej kategorii." />
        ) : null}
        {items.map((item) => (
          <MoneyRow
            key={item.id}
            label={item.name}
            sublabel={`${formatOwner(item.owner)} - wydane ${formatMoney(item.spentAmount)}`}
            value={
              item.budgetAmount
                ? formatMoney(item.remainingAmount ?? 0)
                : "Bez limitu"
            }
          />
        ))}
      </View>
    </View>
  );
}

function MoneyRow({
  label,
  sublabel,
  value,
}: {
  label: string;
  sublabel?: string;
  value: string;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <View style={styles.moneyRow}>
      <View style={styles.moneyRowText}>
        <Text style={styles.itemTitle}>{label}</Text>
        {sublabel ? <Text style={styles.muted}>{sublabel}</Text> : null}
      </View>
      {value ? <Text style={styles.moneyValue}>{value}</Text> : null}
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
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

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

  return new Intl.NumberFormat("pl-PL", {
    currency: "PLN",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatMonth(month: BudgetMonth): string {
  return `${String(month.month).padStart(2, "0")}.${month.year}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    boxTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    actionPicker: {
      gap: spacing.sm,
    },
    categoryBlock: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    categoryHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
    },
    categoryTitle: {
      flex: 1,
      gap: spacing.xs,
    },
    categoryTotal: {
      color: colors.primaryDark,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "right",
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    formBox: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    formField: {
      flex: 1,
    },
    formRow: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: spacing.sm,
    },
    hero: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
    },
    heroHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    heroIcon: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.control,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    heroLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    heroMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
    },
    heroMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    heroText: {
      flex: 1,
      gap: spacing.xs,
    },
    heroValue: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: 0,
    },
    heroValueDanger: {
      color: colors.danger,
    },
    inlineButton: {
      minWidth: 104,
    },
    itemTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    list: {
      gap: spacing.sm,
    },
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    metricCard: {
      borderColor: colors.border,
      borderWidth: 1,
      flexBasis: "47%",
      flexGrow: 1,
      minHeight: 96,
    },
    metricBudget: {
      backgroundColor: colors.infoSoft,
    },
    metricDanger: {
      backgroundColor: colors.dangerSoft,
    },
    metricIncome: {
      backgroundColor: colors.successSoft,
    },
    metricRemaining: {
      backgroundColor: colors.softGreen,
    },
    metricSpent: {
      backgroundColor: colors.warningSoft,
    },
    moneyRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      minHeight: 58,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    moneyRowText: {
      flex: 1,
      gap: spacing.xs,
      paddingRight: spacing.sm,
    },
    moneyValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "right",
    },
    moneyValueDanger: {
      color: colors.danger,
    },
    muted: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 19,
    },
    progressFill: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: "100%",
    },
    progressFillDanger: {
      backgroundColor: colors.danger,
    },
    progressTrack: {
      backgroundColor: colors.card,
      borderRadius: 999,
      height: 8,
      overflow: "hidden",
    },
    sectionActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      justifyContent: "flex-end",
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    topActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    switchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
    },
  });
}
