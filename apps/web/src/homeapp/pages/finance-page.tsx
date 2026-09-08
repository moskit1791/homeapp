import type { Theme } from '@mui/material/styles';
import type { FinanceDebt, BudgetCategory, BudgetItemSummary } from '../api';

import { Icon } from '@iconify/react';
import { useMemo, useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Tab,
  Tabs,
  Alert,
  Table,
  Stack,
  Button,
  Divider,
  Tooltip,
  TableRow,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TextField,
  IconButton,
  Typography,
  LinearProgress,
  TableContainer,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { usePermission } from '../auth/use-permission';
import { money, todayIso, shortDate } from '../utils/format';
import {
  Page,
  ErrorView,
  EmptyState,
  FormDialog,
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

const financeSurface = (theme: Theme) => ({
  border: '1px solid',
  borderColor: 'rgba(62,82,112,.18)',
  borderRadius: 2,
  bgcolor: 'rgba(255,255,255,.94)',
  boxShadow: '0 10px 34px rgba(34,51,84,.05)',
  ...theme.applyStyles('dark', {
    borderColor: 'rgba(139,166,206,.24)',
    bgcolor: 'rgba(12,27,45,.86)',
    boxShadow: '0 14px 38px rgba(0,0,0,.2)',
  }),
});

const categoryAccents = ['#FF9F43', '#55D99B', '#4C9AFF', '#A879E8'];

function budgetItemIcon(name: string) {
  if (/jedz|spoży|zakup/i.test(name)) return 'solar:chef-hat-heart-bold-duotone';
  if (/paliw/i.test(name)) return 'solar:gas-station-bold-duotone';
  if (/auto|samoch/i.test(name)) return 'solar:wheel-bold-duotone';
  if (/internet|wifi/i.test(name)) return 'solar:wi-fi-router-bold-duotone';
  if (/telefon/i.test(name)) return 'solar:phone-calling-bold-duotone';
  if (/gaz/i.test(name)) return 'solar:fire-bold-duotone';
  if (/wod/i.test(name)) return 'solar:waterdrops-bold-duotone';
  if (/dom/i.test(name)) return 'solar:home-smile-bold-duotone';
  if (/fryz/i.test(name)) return 'solar:scissors-square-bold-duotone';
  if (/poduszk|oszcz/i.test(name)) return 'solar:piggy-bank-bold-duotone';
  return 'solar:receipt-bold-duotone';
}

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
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [showIncomes, setShowIncomes] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
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
          : createBudgetItem({ ...input, budgetMonthId: budget.data.month.id }, { accessToken });
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

  const orderedMonths = [...(months.data ?? [])].sort(
    (left, right) => left.year - right.year || left.month - right.month
  );
  const currentMonthIndex = budget.data
    ? orderedMonths.findIndex((item) => item.id === budget.data.month.id)
    : -1;
  const budgetLimit = Number(budget.data?.summary.totalBudgetAmount ?? 0);
  const budgetSpent = Number(budget.data?.summary.totalSpentAmount ?? 0);
  const budgetUsage = budgetLimit > 0 ? Math.round((budgetSpent / budgetLimit) * 100) : 0;
  const monthLabel = budget.data
    ? new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(
        new Date(budget.data.month.year, budget.data.month.month - 1, 1)
      )
    : 'Bieżący miesiąc';
  const displayedCategories =
    budget.data?.categories
      .map((category) => ({
        ...category,
        items:
          ownerFilter === 'all'
            ? category.items
            : category.items.filter((item) => item.owner.memberId === ownerFilter),
      }))
      .filter((category) => ownerFilter === 'all' || category.items.length > 0) ?? [];

  function selectAdjacentMonth(offset: number) {
    const next = orderedMonths[currentMonthIndex + offset];
    if (next) setSelectedMonthId(next.id);
  }

  function toggleCategory(categoryIdToToggle: string) {
    setCollapsedCategories((previous) => {
      const next = new Set(previous);
      if (next.has(categoryIdToToggle)) next.delete(categoryIdToToggle);
      else next.add(categoryIdToToggle);
      return next;
    });
  }

  return (
    <Page>
      <PageHeader
        title="Finanse"
        description="Kontroluj wydatki i realizuj budżet."
        action={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {tab === 'budget' && budget.data && (
              <Stack
                direction="row"
                sx={(theme) => ({
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  bgcolor: 'background.paper',
                  ...theme.applyStyles('dark', { bgcolor: 'rgba(16,31,50,.82)' }),
                })}
              >
                <IconButton
                  aria-label="Poprzedni miesiąc"
                  disabled={currentMonthIndex <= 0}
                  onClick={() => selectAdjacentMonth(-1)}
                  sx={{ borderRadius: 0 }}
                >
                  <Icon icon="solar:alt-arrow-left-linear" />
                </IconButton>
                <Box
                  sx={{
                    px: 2,
                    minWidth: 190,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    color: 'text.primary',
                    textTransform: 'capitalize',
                  }}
                >
                  {monthLabel}
                </Box>
                <IconButton
                  aria-label="Następny miesiąc"
                  disabled={currentMonthIndex < 0 || currentMonthIndex >= orderedMonths.length - 1}
                  onClick={() => selectAdjacentMonth(1)}
                  sx={{ borderRadius: 0 }}
                >
                  <Icon icon="solar:alt-arrow-right-linear" />
                </IconButton>
              </Stack>
            )}
            <PrimaryButton
              onClick={() => setOpen(true)}
              disabled={!permission.canCreate || (tab === 'budget' && budgetItems.length === 0)}
            >
              Dodaj {tab === 'budget' ? 'wydatek' : tab === 'debts' ? 'zobowiązanie' : 'cel'}
            </PrimaryButton>
          </Stack>
        }
      />
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab value="budget" label="Budżet" />
        <Tab value="debts" label="Pożyczki" />
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
            <Box sx={(theme) => ({ ...financeSurface(theme), p: 1.25 })}>
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={1.25}
                sx={{ alignItems: { lg: 'center' } }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
                  Pokaż:
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant={ownerFilter === 'all' ? 'contained' : 'outlined'}
                    onClick={() => setOwnerFilter('all')}
                    sx={{ minWidth: 98 }}
                  >
                    Wszyscy
                  </Button>
                  {(members.data ?? [])
                    .filter((member) => member.isActive)
                    .map((member) => (
                      <Tooltip key={member.id} title={member.displayName}>
                        <Button
                          size="small"
                          variant={ownerFilter === member.id ? 'contained' : 'outlined'}
                          onClick={() => setOwnerFilter(member.id)}
                          sx={{ minWidth: 54 }}
                        >
                          {member.displayName.slice(0, 1).toUpperCase()}
                        </Button>
                      </Tooltip>
                    ))}
                </Stack>
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ display: { xs: 'none', lg: 'block' }, mx: 0.5 }}
                />
                <Button
                  size="small"
                  variant={showIncomes ? 'soft' : 'text'}
                  startIcon={<Icon icon="solar:users-group-rounded-bold-duotone" />}
                  onClick={() => setShowIncomes((value) => !value)}
                >
                  Podział na osoby
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Generuj kolejny miesiąc">
                    <span>
                      <IconButton
                        aria-label="Generuj kolejny miesiąc"
                        disabled={!permission.canCreate || generateMonth.isPending}
                        onClick={() => generateMonth.mutate()}
                      >
                        <Icon icon="solar:calendar-add-bold-duotone" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Ustaw dochód">
                    <span>
                      <IconButton
                        aria-label="Ustaw dochód"
                        disabled={!permission.canUpdate}
                        onClick={() => openManage('income')}
                      >
                        <Icon icon="solar:wad-of-money-bold-duotone" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Dodaj kategorię">
                    <span>
                      <IconButton
                        aria-label="Dodaj kategorię"
                        disabled={!permission.canCreate}
                        onClick={() => openManage('category')}
                      >
                        <Icon icon="solar:folder-add-bold-duotone" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Dodaj pozycję budżetu">
                    <span>
                      <IconButton
                        aria-label="Dodaj pozycję budżetu"
                        disabled={!permission.canCreate || activeCategories.length === 0}
                        onClick={() => openManage('item')}
                      >
                        <Icon icon="solar:list-plus-bold-duotone" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {selectedMonthId && (
                    <Tooltip title="Usuń miesiąc">
                      <span>
                        <IconButton
                          aria-label="Usuń miesiąc"
                          color="error"
                          disabled={!permission.canDelete}
                          onClick={() =>
                            confirmDelete('ten miesiąc budżetowy') &&
                            removeMonth.mutate(selectedMonthId)
                          }
                        >
                          <Icon icon="solar:trash-bin-trash-bold-duotone" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
              {(generateMonth.error || removeMonth.error) && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {(generateMonth.error ?? removeMonth.error)?.message}
                </Alert>
              )}
            </Box>

            <Box
              sx={(theme) => ({
                ...financeSurface(theme),
                px: { xs: 2, md: 4 },
                py: 2,
                display: 'grid',
                alignItems: 'center',
                gridTemplateColumns: { xs: '1fr', sm: '1fr auto 1fr' },
                gap: 2,
              })}
            >
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center', justifyContent: { sm: 'flex-start' } }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1.5,
                    color: '#52DA99',
                    bgcolor: 'rgba(82,218,153,.12)',
                  }}
                >
                  <Icon icon="solar:wallet-money-bold-duotone" width={27} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#52DA99' }}>
                    Do dyspozycji
                  </Typography>
                  <Typography variant="h3" sx={{ color: '#52DA99' }}>
                    {money(budget.data.summary.totalRemainingAmount, currency)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    z {money(budget.data.summary.totalBudgetAmount, currency)}
                  </Typography>
                </Box>
              </Stack>
              <Box
                sx={{
                  width: 98,
                  height: 98,
                  display: 'grid',
                  borderRadius: '50%',
                  placeItems: 'center',
                  background: `conic-gradient(#FF9F43 ${Math.min(budgetUsage, 100) * 3.6}deg, rgba(126,148,178,.18) 0deg)`,
                  '&::before': {
                    content: '""',
                    width: 74,
                    height: 74,
                    borderRadius: '50%',
                    bgcolor: 'background.paper',
                    gridArea: '1 / 1',
                  },
                }}
              >
                <Box sx={{ gridArea: '1 / 1', zIndex: 1, textAlign: 'center' }}>
                  <Typography variant="h5">{budgetUsage}%</Typography>
                  <Typography variant="caption" color="text.secondary">
                    wykorzystane
                  </Typography>
                </Box>
              </Box>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center', justifyContent: { sm: 'flex-end' } }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1.5,
                    color: '#FFAD32',
                    bgcolor: 'rgba(255,173,50,.12)',
                  }}
                >
                  <Icon icon="solar:receipt-bold-duotone" width={27} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#FFAD32' }}>
                    Wydano
                  </Typography>
                  <Typography variant="h3">
                    {money(budget.data.summary.totalSpentAmount, currency)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    z {money(budget.data.summary.totalBudgetAmount, currency)}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {showIncomes && (
              <Box sx={(theme) => ({ ...financeSurface(theme), p: 2.5 })}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Dochody domowników
                </Typography>
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
                        aria-label={`Edytuj dochód: ${income.displayName}`}
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
              </Box>
            )}

            <TableContainer sx={(theme) => ({ ...financeSurface(theme), overflowX: 'auto' })}>
              <Table
                size="small"
                sx={{ minWidth: 1050, '& .MuiTableCell-root': { borderColor: 'divider' } }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '31%' }}>Pozycja</TableCell>
                    <TableCell>Osoba</TableCell>
                    <TableCell align="right">Budżet</TableCell>
                    <TableCell align="right">Wydano</TableCell>
                    <TableCell align="right">Zostaje</TableCell>
                    <TableCell sx={{ width: 190 }}>%</TableCell>
                    <TableCell align="right" sx={{ width: 88 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedCategories.map((category, categoryIndex) => {
                    const categoryBudget = category.items.reduce(
                      (sum, item) => sum + Number(item.budgetAmount ?? 0),
                      0
                    );
                    const categorySpent = category.items.reduce(
                      (sum, item) => sum + Number(item.spentAmount),
                      0
                    );
                    const categoryRemaining = categoryBudget - categorySpent;
                    const categoryUsage =
                      categoryBudget > 0 ? Math.round((categorySpent / categoryBudget) * 100) : 0;
                    const accent = categoryAccents[categoryIndex % categoryAccents.length];
                    const collapsed = collapsedCategories.has(category.id);

                    return (
                      <Fragment key={category.id}>
                        <TableRow
                          sx={(theme) => ({
                            bgcolor: 'rgba(226,233,243,.48)',
                            ...theme.applyStyles('dark', { bgcolor: 'rgba(32,52,76,.64)' }),
                          })}
                        >
                          <TableCell>
                            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                              <IconButton
                                size="small"
                                aria-label={`${collapsed ? 'Rozwiń' : 'Zwiń'} kategorię ${category.name}`}
                                onClick={() => toggleCategory(category.id)}
                              >
                                <Icon
                                  icon={
                                    collapsed
                                      ? 'solar:alt-arrow-right-linear'
                                      : 'solar:alt-arrow-down-linear'
                                  }
                                  width={18}
                                />
                              </IconButton>
                              <Box
                                sx={{
                                  width: 38,
                                  height: 38,
                                  display: 'grid',
                                  placeItems: 'center',
                                  borderRadius: 1.25,
                                  color: '#102238',
                                  bgcolor: accent,
                                }}
                              >
                                <Icon icon="solar:folder-with-files-bold-duotone" width={23} />
                              </Box>
                              <Typography variant="subtitle1">{category.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {category.items.length} pozycji
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell />
                          <TableCell align="right">
                            <Typography variant="subtitle2">
                              {money(categoryBudget, currency)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="subtitle2">
                              {money(categorySpent, currency)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="subtitle2"
                              color={categoryRemaining < 0 ? 'error.main' : 'success.main'}
                            >
                              {money(categoryRemaining, currency)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                              <Typography variant="subtitle2" sx={{ minWidth: 40 }}>
                                {categoryUsage}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(categoryUsage, 100)}
                                color={categoryUsage >= 100 ? 'error' : 'warning'}
                                sx={{ flex: 1, height: 8, borderRadius: 4 }}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              aria-label={`Edytuj kategorię ${category.name}`}
                              disabled={!permission.canUpdate}
                              onClick={() =>
                                openCategoryEdit({ ...category, createdAt: '', updatedAt: '' })
                              }
                            >
                              <Icon icon="solar:pen-bold-duotone" width={19} />
                            </IconButton>
                            <IconButton
                              aria-label={`Usuń kategorię ${category.name}`}
                              color="error"
                              disabled={!permission.canDelete}
                              onClick={() =>
                                confirmDelete(category.name) &&
                                updateBudgetCategory(
                                  category.id,
                                  { isActive: false },
                                  { accessToken }
                                ).then(invalidate)
                              }
                            >
                              <Icon icon="solar:trash-bin-trash-bold-duotone" width={19} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                        {!collapsed &&
                          category.items.map((item) => {
                            const itemBudget = Number(item.budgetAmount ?? 0);
                            const itemSpent = Number(item.spentAmount);
                            const itemUsage =
                              itemBudget > 0 ? Math.round((itemSpent / itemBudget) * 100) : 0;
                            const remaining =
                              item.remainingAmount === null ? null : Number(item.remainingAmount);

                            return (
                              <TableRow key={item.id} hover>
                                <TableCell sx={{ pl: 10 }}>
                                  <Stack
                                    direction="row"
                                    spacing={1.25}
                                    sx={{ alignItems: 'center' }}
                                  >
                                    <Icon
                                      icon={budgetItemIcon(item.name)}
                                      width={22}
                                      color={accent}
                                    />
                                    <Typography>{item.name}</Typography>
                                  </Stack>
                                </TableCell>
                                <TableCell>{item.owner.displayName}</TableCell>
                                <TableCell align="right">
                                  {item.budgetAmount === null
                                    ? '—'
                                    : money(item.budgetAmount, currency)}
                                </TableCell>
                                <TableCell align="right">
                                  {money(item.spentAmount, currency)}
                                </TableCell>
                                <TableCell align="right">
                                  <Typography
                                    color={
                                      remaining !== null && remaining < 0
                                        ? 'error.main'
                                        : remaining
                                          ? 'success.main'
                                          : 'text.primary'
                                    }
                                  >
                                    {remaining === null ? '—' : money(remaining, currency)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Stack
                                    direction="row"
                                    spacing={1.25}
                                    sx={{ alignItems: 'center' }}
                                  >
                                    <Typography variant="body2" sx={{ minWidth: 40 }}>
                                      {item.budgetAmount === null ? '—' : `${itemUsage}%`}
                                    </Typography>
                                    <LinearProgress
                                      variant="determinate"
                                      value={Math.min(itemUsage, 100)}
                                      color={
                                        itemUsage >= 100
                                          ? 'error'
                                          : itemUsage >= 80
                                            ? 'warning'
                                            : 'info'
                                      }
                                      sx={{ flex: 1, height: 7, borderRadius: 4 }}
                                    />
                                  </Stack>
                                </TableCell>
                                <TableCell align="right">
                                  <IconButton
                                    size="small"
                                    aria-label={`Edytuj pozycję ${item.name}`}
                                    disabled={!permission.canUpdate}
                                    onClick={() => openItemEdit(item)}
                                  >
                                    <Icon icon="solar:pen-bold-duotone" width={18} />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    aria-label={`Usuń pozycję ${item.name}`}
                                    color="error"
                                    disabled={!permission.canDelete}
                                    onClick={() =>
                                      confirmDelete(item.name) &&
                                      deleteBudgetItem(item.id, { accessToken }).then(invalidate)
                                    }
                                  >
                                    <Icon icon="solar:trash-bin-trash-bold-duotone" width={18} />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                  <TableRow
                    sx={(theme) => ({
                      bgcolor: 'rgba(226,233,243,.4)',
                      ...theme.applyStyles('dark', { bgcolor: 'rgba(32,52,76,.55)' }),
                    })}
                  >
                    <TableCell>
                      <Typography variant="subtitle1">Razem</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {budgetItems.length} pozycji
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle1">
                        {money(budget.data.summary.totalBudgetAmount, currency)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle1">
                        {money(budget.data.summary.totalSpentAmount, currency)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="subtitle1"
                        color={
                          Number(budget.data.summary.totalRemainingAmount) < 0
                            ? 'error.main'
                            : 'success.main'
                        }
                      >
                        {money(budget.data.summary.totalRemainingAmount, currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                        <Typography variant="subtitle1" sx={{ minWidth: 40 }}>
                          {budgetUsage}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(budgetUsage, 100)}
                          color={budgetUsage >= 100 ? 'error' : 'warning'}
                          sx={{ flex: 1, height: 8, borderRadius: 4 }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
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
                        {shortDate(payment.paidAt ?? payment.createdAt)} ·{' '}
                        {money(payment.amount, currency)}
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
          !amount ||
          Number(amount) < 0 ||
          (tab === 'budget' && !editingDebt ? !budgetItemId : !name.trim())
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
