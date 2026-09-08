import type { FinanceDebt, BudgetCategory, BudgetItemSummary } from '../api';

import { Icon } from '@iconify/react';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Tab,
  Chip,
  Grid,
  Tabs,
  Alert,
  Stack,
  Button,
  Divider,
  MenuItem,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { usePermission } from '../auth/use-permission';
import { money, todayIso, shortDate } from '../utils/format';
import {
  Page,
  ErrorView,
  EmptyState,
  FormDialog,
  MetricCard,
  PageHeader,
  LoadingView,
  SectionCard,
  confirmDelete,
  PrimaryButton,
} from '../components/ui';
import {
  upsertIncome,
  createExpense,
  getBudgetMonth,
  getMyHousehold,
  listBudgetMonths,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  listFinanceDebts,
  createBudgetMonth,
  deleteBudgetMonth,
  createFinanceDebt,
  updateFinanceDebt,
  deleteFinanceDebt,
  listFinanceSavings,
  listHouseholdMembers,
  listBudgetCategories,
  createBudgetCategory,
  updateBudgetCategory,
  getCurrentBudgetMonth,
  generateNextBudgetMonth,
  createFinanceDebtPayment,
  createFinanceSavingsAccount,
  deleteFinanceSavingsAccount,
  createFinanceSavingsTransaction,
} from '../api';

type FinanceTab = 'budget' | 'debts' | 'savings';
type ManageKind = 'category' | 'item' | 'income' | 'debt-payment' | 'saving-transaction';

export function FinancePage() {
  const { accessToken } = useSession();
  const permission = usePermission('finances');
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FinanceTab>('budget');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [budgetItemId, setBudgetItemId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [manageKind, setManageKind] = useState<ManageKind | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [direction, setDirection] = useState<'add' | 'subtract'>('add');
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [editingItem, setEditingItem] = useState<BudgetItemSummary | null>(null);
  const [editingDebt, setEditingDebt] = useState<FinanceDebt | null>(null);
  const household = useQuery({
    queryKey: ['household'],
    queryFn: () => getMyHousehold({ accessToken }),
  });
  const budget = useQuery({
    queryKey: ['finances', 'month', selectedMonthId],
    queryFn: () =>
      selectedMonthId
        ? getBudgetMonth(selectedMonthId, { accessToken })
        : getCurrentBudgetMonth({ accessToken }),
    retry: false,
  });
  const months = useQuery({
    queryKey: ['finances', 'months'],
    queryFn: () => listBudgetMonths({ accessToken }),
  });
  const categories = useQuery({
    queryKey: ['finances', 'categories'],
    queryFn: () => listBudgetCategories({ accessToken }),
  });
  const members = useQuery({
    queryKey: ['household', 'members'],
    queryFn: () => listHouseholdMembers({ accessToken }),
  });
  const debts = useQuery({
    queryKey: ['finances', 'debts'],
    queryFn: () => listFinanceDebts({ accessToken }),
  });
  const savings = useQuery({
    queryKey: ['finances', 'savings'],
    queryFn: () => listFinanceSavings({ accessToken }),
  });
  const currency = household.data?.currencyCode ?? 'PLN';
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['finances'] });
  const createMonth = useMutation({
    mutationFn: () => {
      const now = new Date();
      return createBudgetMonth(
        { year: now.getFullYear(), month: now.getMonth() + 1 },
        { accessToken }
      );
    },
    onSuccess: invalidate,
  });
  const generateMonth = useMutation({
    mutationFn: () => generateNextBudgetMonth({ accessToken }),
    onSuccess: async (result) => {
      setSelectedMonthId(result.month.id);
      await invalidate();
    },
  });
  const removeMonth = useMutation({
    mutationFn: (id: string) => deleteBudgetMonth(id, { accessToken }),
    onSuccess: async () => {
      setSelectedMonthId(null);
      await invalidate();
    },
  });
  const create = useMutation<unknown, Error>({
    mutationFn: () => {
      if (tab === 'budget')
        return createExpense(
          { amount: Number(amount), budgetItemId, name: name || undefined },
          { accessToken }
        );
      if (tab === 'debts')
        return createFinanceDebt(
          {
            amount: Number(amount),
            lenderName: name.trim(),
            purpose: 'Pożyczka',
            dueDate: dueDate || null,
          },
          { accessToken }
        );
      return createFinanceSavingsAccount(
        {
          amount: Number(amount || 0),
          name: name.trim(),
          targetAmount: targetAmount ? Number(targetAmount) : null,
          changedAt: todayIso(),
        },
        { accessToken }
      );
    },
    onSuccess: async () => {
      setOpen(false);
      setName('');
      setAmount('');
      setTargetAmount('');
      setDueDate('');
      await invalidate();
    },
  });
  const removeDebt = useMutation({
    mutationFn: (id: string) => deleteFinanceDebt(id, { accessToken }),
    onSuccess: invalidate,
  });
  const removeSaving = useMutation({
    mutationFn: (id: string) => deleteFinanceSavingsAccount(id, { accessToken }),
    onSuccess: invalidate,
  });
  const manage = useMutation<unknown, Error>({
    mutationFn: () => {
      if (!budget.data) throw new Error('Najpierw wybierz lub utwórz miesiąc budżetowy.');
      if (manageKind === 'category') {
        return editingCategory
          ? updateBudgetCategory(
              editingCategory.id,
              { name: name.trim(), copyBudgetToNextMonth: true },
              { accessToken }
            )
          : createBudgetCategory(
              { name: name.trim(), copyBudgetToNextMonth: true },
              { accessToken }
            );
      }
      if (manageKind === 'item') {
        const input = {
          name: name.trim(),
          categoryId,
          ownerMemberId: memberId,
          budgetAmount: amount ? Number(amount) : null,
        };
        return editingItem
          ? updateBudgetItem(editingItem.id, input, { accessToken })
          : createBudgetItem(
              { ...input, budgetMonthId: budget.data.month.id },
              { accessToken }
            );
      }
      if (manageKind === 'income') {
        return upsertIncome(
          memberId,
          { amount: Number(amount), budgetMonthId: budget.data.month.id },
          { accessToken }
        );
      }
      if (manageKind === 'debt-payment') {
        return createFinanceDebtPayment(
          selectedId,
          { amount: Number(amount), note: name.trim() || null, paidAt: todayIso() },
          { accessToken }
        );
      }
      if (manageKind === 'saving-transaction') {
        return createFinanceSavingsTransaction(
          selectedId,
          {
            amount: Number(amount),
            direction,
            note: name.trim() || null,
            changedAt: todayIso(),
          },
          { accessToken }
        );
      }
      throw new Error('Nie wybrano operacji.');
    },
    onSuccess: async () => {
      closeManage();
      await invalidate();
    },
  });
  const saveDebt = useMutation({
    mutationFn: () => {
      if (!editingDebt) throw new Error('Nie wybrano zobowiązania.');
      return updateFinanceDebt(
        editingDebt.id,
        {
          lenderName: name.trim(),
          purpose: targetAmount.trim() || 'Zobowiązanie',
          amount: Number(amount),
          dueDate: dueDate || null,
        },
        { accessToken }
      );
    },
    onSuccess: async () => {
      setEditingDebt(null);
      setOpen(false);
      await invalidate();
    },
  });
  const budgetItems =
    budget.data?.categories.flatMap((category) =>
      category.items.map((item) => ({ ...item, categoryName: category.name }))
    ) ?? [];
  const activeCategories = useMemo(
    () => (categories.data ?? []).filter((category) => category.isActive),
    [categories.data]
  );

  function openManage(kind: ManageKind, id = '') {
    setManageKind(kind);
    setSelectedId(id);
    setEditingCategory(null);
    setEditingItem(null);
    setName('');
    setAmount('');
    setCategoryId(activeCategories[0]?.id ?? '');
    setMemberId(members.data?.[0]?.id ?? '');
    setDirection('add');
  }

  function closeManage() {
    setManageKind(null);
    setSelectedId('');
    setEditingCategory(null);
    setEditingItem(null);
    setName('');
    setAmount('');
  }

  function openCategoryEdit(category: BudgetCategory) {
    openManage('category');
    setEditingCategory(category);
    setName(category.name);
  }

  function openItemEdit(item: BudgetItemSummary) {
    openManage('item');
    setEditingItem(item);
    setName(item.name);
    setAmount(item.budgetAmount ?? '');
    setCategoryId(item.categoryId);
    setMemberId(item.owner.memberId);
  }

  return (
    <Page>
      <PageHeader
        title="Finanse"
        description="Budżet domowy, zobowiązania i cele oszczędnościowe."
        action={
          <PrimaryButton
            onClick={() => setOpen(true)}
            disabled={
              !permission.canCreate || (tab === 'budget' && budgetItems.length === 0)
            }
          >
            Dodaj {tab === 'budget' ? 'wydatek' : tab === 'debts' ? 'zobowiązanie' : 'cel'}
          </PrimaryButton>
        }
      />
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab value="budget" label="Budżet" />
        <Tab value="debts" label="Zobowiązania" />
        <Tab value="savings" label="Oszczędności" />
      </Tabs>
      {tab === 'budget' &&
        (budget.isLoading ? (
          <LoadingView />
        ) : budget.error || !budget.data ? (
          <SectionCard>
            <ErrorView error={budget.error ?? new Error('Brak budżetu na bieżący miesiąc.')} />
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                variant="contained"
                onClick={() => createMonth.mutate()}
                disabled={createMonth.isPending}
              >
                Utwórz budżet na ten miesiąc
              </Button>
            </Box>
          </SectionCard>
        ) : (
          <>
            <SectionCard>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{ alignItems: { md: 'center' } }}
              >
                <TextField
                  select
                  label="Miesiąc budżetowy"
                  value={selectedMonthId ?? ''}
                  onChange={(event) => setSelectedMonthId(event.target.value || null)}
                  sx={{ minWidth: 230 }}
                >
                  <MenuItem value="">Bieżący miesiąc</MenuItem>
                  {(months.data ?? []).map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {String(item.month).padStart(2, '0')}/{item.year}
                      {item.isCurrent ? ' · bieżący' : ''}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  onClick={() => generateMonth.mutate()}
                  disabled={!permission.canCreate || generateMonth.isPending}
                >
                  Generuj kolejny miesiąc
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => openManage('income')}
                  disabled={!permission.canUpdate}
                >
                  Ustaw dochód
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => openManage('category')}
                  disabled={!permission.canCreate}
                >
                  Dodaj kategorię
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => openManage('item')}
                  disabled={!permission.canCreate || activeCategories.length === 0}
                >
                  Dodaj pozycję
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                {selectedMonthId && (
                  <IconButton
                    color="error"
                    disabled={!permission.canDelete}
                    onClick={() =>
                      confirmDelete('ten miesiąc budżetowy') &&
                      removeMonth.mutate(selectedMonthId)
                    }
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                )}
              </Stack>
              {(generateMonth.error || removeMonth.error) && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {(generateMonth.error ?? removeMonth.error)?.message}
                </Alert>
              )}
            </SectionCard>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard
                  icon="solar:wad-of-money-bold-duotone"
                  label="Dochody"
                  value={money(budget.data.summary.incomeAmount, currency)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard
                  icon="solar:card-send-bold-duotone"
                  label="Wydano"
                  value={money(budget.data.summary.totalSpentAmount, currency)}
                  color="error.main"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard
                  icon="solar:wallet-money-bold-duotone"
                  label="Pozostało"
                  value={money(budget.data.summary.totalRemainingAmount, currency)}
                  color="secondary.main"
                />
              </Grid>
            </Grid>
            <SectionCard title="Dochody domowników">
              <Stack divider={<Divider flexItem />}>
                {budget.data.incomes.map((income) => (
                  <Stack
                    key={income.ownerMemberId}
                    direction="row"
                    spacing={2}
                    sx={{ py: 1.2, alignItems: 'center' }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{income.displayName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {income.email}
                      </Typography>
                    </Box>
                    <Typography variant="h6">{money(income.amount, currency)}</Typography>
                    <IconButton
                      disabled={!permission.canUpdate}
                      onClick={() => {
                        openManage('income');
                        setMemberId(income.ownerMemberId);
                        setAmount(income.amount);
                      }}
                    >
                      <Icon icon="solar:pen-bold-duotone" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
            <Stack spacing={2.5}>
              {budget.data.categories.map((category) => (
                <SectionCard key={category.id}>
                  <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="h5" sx={{ flex: 1 }}>
                      {category.name}
                    </Typography>
                    <Stack direction="row">
                      <IconButton
                        disabled={!permission.canUpdate}
                        onClick={() =>
                          openCategoryEdit({
                            ...category,
                            createdAt: '',
                            updatedAt: '',
                          })
                        }
                      >
                        <Icon icon="solar:pen-bold-duotone" />
                      </IconButton>
                      <IconButton
                        color="error"
                        disabled={!permission.canDelete}
                        onClick={() =>
                          confirmDelete(category.name) &&
                          updateBudgetCategory(category.id, { isActive: false }, { accessToken }).then(
                            invalidate
                          )
                        }
                      >
                        <Icon icon="solar:trash-bin-trash-bold-duotone" />
                      </IconButton>
                    </Stack>
                  </Stack>
                  {category.items.length === 0 ? (
                    <EmptyState text="Brak pozycji w tej kategorii." />
                  ) : (
                    <Stack divider={<Divider flexItem />}>
                      {category.items.map((item) => (
                        <Stack
                          key={item.id}
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          sx={{ py: 1.25, alignItems: { sm: 'center' } }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.owner.displayName}
                            </Typography>
                          </Box>
                          <Typography color="text.secondary">
                            wydano {money(item.spentAmount, currency)}
                          </Typography>
                          <Chip
                            label={
                              item.remainingAmount === null
                                ? 'bez limitu'
                                : `zostało ${money(item.remainingAmount, currency)}`
                            }
                            color={Number(item.remainingAmount) < 0 ? 'error' : 'success'}
                            variant="outlined"
                          />
                          <IconButton
                            disabled={!permission.canUpdate}
                            onClick={() => openItemEdit(item)}
                          >
                            <Icon icon="solar:pen-bold-duotone" />
                          </IconButton>
                          <IconButton
                            color="error"
                            disabled={!permission.canDelete}
                            onClick={() =>
                              confirmDelete(item.name) &&
                              deleteBudgetItem(item.id, { accessToken }).then(invalidate)
                            }
                          >
                            <Icon icon="solar:trash-bin-trash-bold-duotone" />
                          </IconButton>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </SectionCard>
              ))}
            </Stack>
          </>
        ))}
      {tab === 'debts' &&
        (debts.isLoading ? (
          <LoadingView />
        ) : debts.error ? (
          <ErrorView error={debts.error} />
        ) : (debts.data?.length ?? 0) === 0 ? (
          <SectionCard>
            <EmptyState text="Brak zobowiązań." />
          </SectionCard>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2.5,
            }}
          >
            {debts.data?.map((debt) => (
              <SectionCard key={debt.id}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3">{debt.lenderName}</Typography>
                    <Typography color="text.secondary">{debt.purpose}</Typography>
                  </Box>
                  <IconButton
                    disabled={!permission.canUpdate}
                    onClick={() => {
                      setEditingDebt(debt);
                      setName(debt.lenderName);
                      setTargetAmount(debt.purpose);
                      setAmount(debt.amount);
                      setDueDate(debt.dueDate ?? '');
                      setOpen(true);
                    }}
                  >
                    <Icon icon="solar:pen-bold-duotone" />
                  </IconButton>
                  <IconButton
                    color="error"
                    disabled={!permission.canDelete}
                    onClick={() => confirmDelete(debt.lenderName) && removeDebt.mutate(debt.id)}
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                </Stack>
                <Typography variant="h2" sx={{ mt: 2 }}>
                  {money(debt.remainingAmount, currency)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  z {money(debt.amount, currency)} · termin {shortDate(debt.dueDate)}
                </Typography>
                <Button
                  size="small"
                  startIcon={<Icon icon="solar:hand-money-bold-duotone" />}
                  sx={{ mt: 2 }}
                  disabled={!permission.canUpdate || debt.isSettled}
                  onClick={() => openManage('debt-payment', debt.id)}
                >
                  Zapisz spłatę
                </Button>
                {debt.payments.length > 0 && (
                  <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                    {debt.payments.slice(0, 3).map((payment) => (
                      <Typography key={payment.id} variant="caption" color="text.secondary">
                        {shortDate(payment.paidAt ?? payment.createdAt)} · {money(payment.amount, currency)}
                        {payment.note ? ` · ${payment.note}` : ''}
                      </Typography>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            ))}
          </Box>
        ))}
      {tab === 'savings' &&
        (savings.isLoading ? (
          <LoadingView />
        ) : savings.error ? (
          <ErrorView error={savings.error} />
        ) : (savings.data?.length ?? 0) === 0 ? (
          <SectionCard>
            <EmptyState text="Brak celów oszczędnościowych." />
          </SectionCard>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2.5,
            }}
          >
            {savings.data?.map((account) => (
              <SectionCard key={account.id}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="h3">{account.name}</Typography>
                  <IconButton
                    color="error"
                    disabled={!permission.canDelete}
                    onClick={() => confirmDelete(account.name) && removeSaving.mutate(account.id)}
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                </Stack>
                <Typography variant="h2" color="primary.main" sx={{ mt: 2 }}>
                  {money(account.currentAmount, currency)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {account.targetAmount
                    ? `cel: ${money(account.targetAmount, currency)}`
                    : 'Bez określonego celu'}
                </Typography>
                <Button
                  size="small"
                  startIcon={<Icon icon="solar:wallet-money-bold-duotone" />}
                  sx={{ mt: 2 }}
                  disabled={!permission.canUpdate}
                  onClick={() => openManage('saving-transaction', account.id)}
                >
                  Wpłata / wypłata
                </Button>
                {account.transactions.length > 0 && (
                  <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                    {account.transactions.slice(0, 3).map((transaction) => (
                      <Typography key={transaction.id} variant="caption" color="text.secondary">
                        {shortDate(transaction.changedAt)} ·{' '}
                        {transaction.direction === 'add' ? '+' : '-'}
                        {money(transaction.amount, currency)}
                      </Typography>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            ))}
          </Box>
        ))}
      <FormDialog
        title={
          editingDebt
            ? 'Edytuj zobowiązanie'
            : tab === 'budget'
            ? 'Nowy wydatek'
            : tab === 'debts'
              ? 'Nowe zobowiązanie'
              : 'Nowy cel oszczędnościowy'
        }
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingDebt(null);
        }}
        onSubmit={() => (editingDebt ? saveDebt.mutate() : create.mutate())}
        loading={create.isPending || saveDebt.isPending}
        submitDisabled={
          !amount || Number(amount) < 0 || (tab === 'budget' && !editingDebt ? !budgetItemId : !name.trim())
        }
      >
        {(create.error || saveDebt.error) && (
          <Alert severity="error">{(create.error ?? saveDebt.error)?.message}</Alert>
        )}
        {tab === 'budget' && !editingDebt && (
          <TextField
            select
            label="Pozycja budżetu"
            value={budgetItemId}
            onChange={(e) => setBudgetItemId(e.target.value)}
            required
          >
            {budgetItems.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.categoryName} — {item.name}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          label={
            tab === 'budget'
              ? 'Opis (opcjonalnie)'
              : tab === 'debts'
                ? 'Pożyczkodawca'
                : 'Nazwa celu'
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          required={tab !== 'budget'}
        />
        {(tab === 'debts' || editingDebt) && (
          <TextField
            label="Cel zobowiązania"
            value={targetAmount}
            onChange={(event) => setTargetAmount(event.target.value)}
          />
        )}
        <TextField
          label={tab === 'savings' ? 'Kwota początkowa' : 'Kwota'}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
        {(tab === 'debts' || editingDebt) && (
          <TextField
            label="Termin"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
        {tab === 'savings' && (
          <TextField
            label="Kwota docelowa"
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        )}
      </FormDialog>
      <FormDialog
        title={
          manageKind === 'category'
            ? editingCategory
              ? 'Edytuj kategorię'
              : 'Nowa kategoria'
            : manageKind === 'item'
              ? editingItem
                ? 'Edytuj pozycję budżetu'
                : 'Nowa pozycja budżetu'
              : manageKind === 'income'
                ? 'Dochód domownika'
                : manageKind === 'debt-payment'
                  ? 'Spłata zobowiązania'
                  : 'Operacja na oszczędnościach'
        }
        open={manageKind !== null}
        onClose={closeManage}
        onSubmit={() => manage.mutate()}
        loading={manage.isPending}
        submitDisabled={
          manageKind === 'category'
            ? !name.trim()
            : manageKind === 'item'
              ? !name.trim() || !categoryId || !memberId
              : !amount || Number(amount) <= 0 || (manageKind === 'income' && !memberId)
        }
      >
        {manage.error && <Alert severity="error">{manage.error.message}</Alert>}
        {(manageKind === 'category' || manageKind === 'item') && (
          <TextField
            label={manageKind === 'category' ? 'Nazwa kategorii' : 'Nazwa pozycji'}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        )}
        {manageKind === 'item' && (
          <TextField
            select
            label="Kategoria"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {activeCategories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
        )}
        {(manageKind === 'item' || manageKind === 'income') && (
          <TextField
            select
            label="Domownik"
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
          >
            {(members.data ?? []).map((member) => (
              <MenuItem key={member.id} value={member.id}>
                {member.displayName}
              </MenuItem>
            ))}
          </TextField>
        )}
        {manageKind === 'saving-transaction' && (
          <TextField
            select
            label="Rodzaj operacji"
            value={direction}
            onChange={(event) => setDirection(event.target.value as 'add' | 'subtract')}
          >
            <MenuItem value="add">Wpłata</MenuItem>
            <MenuItem value="subtract">Wypłata</MenuItem>
          </TextField>
        )}
        {manageKind !== 'category' && (
          <TextField
            label={manageKind === 'item' ? 'Limit miesięczny' : 'Kwota'}
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        )}
        {(manageKind === 'debt-payment' || manageKind === 'saving-transaction') && (
          <TextField
            label="Notatka (opcjonalnie)"
            value={name}
            onChange={(event) => setName(event.target.value)}
            multiline
            minRows={2}
          />
        )}
      </FormDialog>
    </Page>
  );
}
