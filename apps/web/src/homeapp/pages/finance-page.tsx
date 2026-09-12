import type { Theme } from '@mui/material/styles';
import type { FinanceDebt, BudgetCategory, BudgetItemSummary } from '../api';

import { Icon } from '@iconify/react';
import { useSearchParams } from 'react-router';
import { useRef, useMemo, useState, Fragment, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Tab,
  Tabs,
  Chip,
  Alert,
  Table,
  Stack,
  Avatar,
  Button,
  Divider,
  Tooltip,
  Checkbox,
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
  InputAdornment,
  FormControlLabel,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { usePermission } from '../auth/use-permission';
import { money, todayIso, shortDate } from '../utils/format';
import savingsCarImage from '../../../../mobile/assets/savings-goal-car.png';
import savingsHomeImage from '../../../../mobile/assets/savings-goal-home.png';
import savingsGiftImage from '../../../../mobile/assets/savings-goal-gift.png';
import savingsPhoneImage from '../../../../mobile/assets/savings-goal-phone.png';
import savingsTravelImage from '../../../../mobile/assets/savings-goal-travel.png';
import savingsDefaultImage from '../../../../mobile/assets/savings-goal-default.png';
import savingsEmergencyImage from '../../../../mobile/assets/savings-goal-emergency.png';
import {
  groupDebtsByLender,
  resolveBudgetItemIcon,
  summarizeBudgetCategories,
  resolveBudgetItemCategories,
} from '../utils/finance';
import {
  Page,
  ErrorView,
  ActionMenu,
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

function savingsImage(name: string) {
  if (/auto|samoch/i.test(name)) return savingsCarImage;
  if (/dom|mieszkan/i.test(name)) return savingsHomeImage;
  if (/podró|wakac|urlop/i.test(name)) return savingsTravelImage;
  if (/telefon|komór/i.test(name)) return savingsPhoneImage;
  if (/prezent/i.test(name)) return savingsGiftImage;
  if (/poduszk|awaryj|rezerw/i.test(name)) return savingsEmergencyImage;
  return savingsDefaultImage;
}

function BudgetUsageRing({ value }: { value: number }) {
  const segmentCount = 36;
  const activeSegments = Math.round((Math.min(Math.max(value, 0), 100) / 100) * segmentCount);

  return (
    <Box
      sx={{ position: 'relative', width: 112, height: 112, flexShrink: 0, justifySelf: 'center' }}
    >
      <Box component="svg" viewBox="0 0 112 112" sx={{ width: 112, height: 112 }}>
        {Array.from({ length: segmentCount }, (_, index) => (
          <Box
            key={index}
            component="line"
            x1="56"
            y1="5"
            x2="56"
            y2="16"
            stroke={index < activeSegments ? '#FF9F43' : 'currentColor'}
            strokeWidth="5"
            strokeLinecap="round"
            transform={`rotate(${index * (360 / segmentCount)} 56 56)`}
            sx={{ color: 'rgba(126,148,178,.22)' }}
          />
        ))}
      </Box>
      <Stack
        spacing={0}
        sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
      >
        <Typography variant="h5" sx={{ lineHeight: 1 }}>
          {value}%
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.4 }}>
          wykorzystane
        </Typography>
      </Stack>
    </Box>
  );
}

export function FinancePage() {
  const { accessToken } = useSession();
  const permission = usePermission('finances');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<FinanceTab>('budget');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [noteText, setNoteText] = useState('');
  const [budgetItemId, setBudgetItemId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [manageKind, setManageKind] = useState<ManageKind | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [direction, setDirection] = useState<'add' | 'subtract'>('add');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [showIncomes, setShowIncomes] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [editingItem, setEditingItem] = useState<BudgetItemSummary | null>(null);
  const [historyItem, setHistoryItem] = useState<BudgetItemSummary | null>(null);
  const [editingDebt, setEditingDebt] = useState<FinanceDebt | null>(null);
  const [debtIsSettled, setDebtIsSettled] = useState(false);
  const [copyToNextMonth, setCopyToNextMonth] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateItemIds, setGenerateItemIds] = useState<Set<string>>(new Set());
  const [generateAmounts, setGenerateAmounts] = useState<Record<string, string>>({});
  const [generateReviewedItemIds, setGenerateReviewedItemIds] = useState<Set<string>>(new Set());
  const [resumeGenerateAfterManage, setResumeGenerateAfterManage] = useState(false);
  const generateAmountRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
    mutationFn: () =>
      generateNextBudgetMonth(
        {
          categories: (budget.data?.categories ?? []).map((category, displayOrder) => ({
            categoryId: category.id,
            displayOrder,
          })),
          items: budgetItems
            .filter((item) => generateItemIds.has(item.id))
            .map((item) => ({
              budgetAmount: generateAmounts[item.id] ? Number(generateAmounts[item.id]) : null,
              budgetItemId: item.id,
            })),
        },
        { accessToken }
      ),
    onSuccess: async (result) => {
      setSelectedMonthId(result.month.id);
      setGenerateOpen(false);
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
            purpose: targetAmount.trim() || 'Pożyczka',
            dueDate: dueDate || null,
            note: noteText.trim() || null,
          },
          { accessToken }
        );
      return createFinanceSavingsAccount(
        {
          amount: Number(amount || 0),
          name: name.trim().normalize('NFC'),
          note: noteText.trim() || null,
          ownerMemberId: memberId || null,
          targetAmount: targetAmount ? Number(targetAmount) : null,
          targetDate: targetDate || null,
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
      setTargetDate('');
      setNoteText('');
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
              { name: name.trim().normalize('NFC'), copyBudgetToNextMonth: copyToNextMonth },
              { accessToken }
            )
          : createBudgetCategory(
              { name: name.trim().normalize('NFC'), copyBudgetToNextMonth: copyToNextMonth },
              { accessToken }
            );
      }
      if (manageKind === 'item') {
        const input = {
          name: name.trim().normalize('NFC'),
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
    onSuccess: async (result) => {
      const resumeGenerator = resumeGenerateAfterManage;
      const generatedItemId =
        manageKind === 'item' && result && typeof result === 'object' && 'id' in result
          ? String(result.id)
          : null;
      const generatedItemAmount = amount;
      closeManage();
      await invalidate();
      if (resumeGenerator && generatedItemId) {
        setGenerateItemIds((current) => new Set(current).add(generatedItemId));
        setGenerateAmounts((current) => ({
          ...current,
          [generatedItemId]: generatedItemAmount,
        }));
      }
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
          isSettled: debtIsSettled,
          note: noteText.trim() || null,
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
    () => resolveBudgetItemCategories(budget.data?.categories ?? [], categories.data ?? []),
    [budget.data?.categories, categories.data]
  );

  useEffect(() => {
    if (searchParams.get('action') !== 'expense' || !permission.canCreate || !budget.data) {
      return;
    }

    const firstItem = budget.data.categories.flatMap((category) => category.items)[0];
    if (!firstItem) return;

    setTab('budget');
    setEditingDebt(null);
    setName('');
    setAmount('');
    setTargetAmount('');
    setTargetDate('');
    setDueDate('');
    setNoteText('');
    setDebtIsSettled(false);
    setBudgetItemId(firstItem.id);
    setCategoryId(firstItem.categoryId);
    setMemberId(firstItem.owner.memberId ?? members.data?.[0]?.id ?? '');
    setOpen(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });
  }, [budget.data, members.data, permission.canCreate, searchParams, setSearchParams]);

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
    setCopyToNextMonth(true);
  }

  function closeManage() {
    const reopenGenerator = resumeGenerateAfterManage;
    setManageKind(null);
    setSelectedId('');
    setEditingCategory(null);
    setEditingItem(null);
    setName('');
    setAmount('');
    setResumeGenerateAfterManage(false);
    if (reopenGenerator) setGenerateOpen(true);
  }

  function openCategoryEdit(category: BudgetCategory) {
    openManage('category');
    setEditingCategory(category);
    setName(category.name);
    setCopyToNextMonth(category.copyBudgetToNextMonth);
  }

  function openItemCreate(nextCategoryId?: string) {
    openManage('item');
    setCategoryId(nextCategoryId ?? activeCategories[0]?.id ?? '');
  }

  function openItemEdit(item: BudgetItemSummary) {
    openManage('item');
    setEditingItem(item);
    setName(item.name);
    setAmount(item.budgetAmount ?? '');
    setCategoryId(item.categoryId);
    setMemberId(item.owner.memberId);
  }

  function openPrimaryCreate(item?: BudgetItemSummary) {
    setEditingDebt(null);
    setName('');
    setAmount('');
    setTargetAmount('');
    setTargetDate('');
    setDueDate('');
    setNoteText('');
    setDebtIsSettled(false);

    if (tab === 'budget') {
      const firstItem = item ?? budgetItems[0];
      setBudgetItemId(firstItem?.id ?? '');
      setCategoryId(firstItem?.categoryId ?? '');
      setMemberId(firstItem?.owner.memberId ?? members.data?.[0]?.id ?? '');
    } else {
      setMemberId(members.data?.[0]?.id ?? '');
    }

    setOpen(true);
  }

  function openGenerateMonth() {
    setGenerateItemIds(new Set(budgetItems.map((item) => item.id)));
    setGenerateAmounts(
      Object.fromEntries(budgetItems.map((item) => [item.id, item.budgetAmount ?? '']))
    );
    setGenerateReviewedItemIds(new Set());
    setResumeGenerateAfterManage(false);
    generateAmountRefs.current = {};
    setGenerateOpen(true);
  }

  function manageItemFromGenerator(item?: BudgetItemSummary, nextCategoryId?: string) {
    setGenerateOpen(false);
    setResumeGenerateAfterManage(true);
    if (item) openItemEdit(item);
    else openItemCreate(nextCategoryId);
  }

  function markGenerateItemReviewed(itemId: string) {
    setGenerateReviewedItemIds((current) => {
      if (current.has(itemId)) return current;
      return new Set(current).add(itemId);
    });
  }

  function focusNextGenerateAmount(itemId: string) {
    const selectedItems = budgetItems.filter((item) => generateItemIds.has(item.id));
    const currentIndex = selectedItems.findIndex((item) => item.id === itemId);
    const nextItem = selectedItems[currentIndex + 1];
    const nextInput = nextItem ? generateAmountRefs.current[nextItem.id] : null;
    nextInput?.focus();
    nextInput?.select();
  }

  const orderedMonths = [...(months.data ?? [])].sort(
    (left, right) => left.year - right.year || left.month - right.month
  );
  const currentMonthIndex = budget.data
    ? orderedMonths.findIndex((item) => item.id === budget.data.month.id)
    : -1;
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
  const filteredBudget = summarizeBudgetCategories(displayedCategories);
  const budgetLimit = filteredBudget.budget;
  const budgetSpent = filteredBudget.spent;
  const budgetRemaining = filteredBudget.remaining;
  const budgetUsage = filteredBudget.usage;
  const debtTotals = (debts.data ?? []).reduce(
    (total, debt) => ({
      amount: total.amount + Number(debt.amount || 0),
      paid: total.paid + Number(debt.paidAmount || 0),
      remaining: total.remaining + Number(debt.remainingAmount || 0),
    }),
    { amount: 0, paid: 0, remaining: 0 }
  );
  const expenseCategories =
    budget.data?.categories.filter((category) =>
      category.items.some((item) => !memberId || item.owner.memberId === memberId)
    ) ?? [];
  const expenseItems = budgetItems.filter(
    (item) =>
      (!memberId || item.owner.memberId === memberId) &&
      (!categoryId || item.categoryId === categoryId)
  );

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
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { sm: 'center' } }}
          >
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
            {tab === 'budget' && budget.data && (
              <Button
                variant="outlined"
                startIcon={<Icon icon="solar:add-square-bold-duotone" />}
                onClick={() => openItemCreate()}
                disabled={!permission.canCreate || activeCategories.length === 0}
              >
                Dodaj pozycję
              </Button>
            )}
            <PrimaryButton
              onClick={() => openPrimaryCreate()}
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
                  {showIncomes ? 'Ukryj bilans osób' : 'Pokaż bilans osób'}
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <ActionMenu
                  label="Akcje budżetu"
                  actions={[
                    {
                      label: 'Generuj kolejny miesiąc',
                      icon: 'solar:calendar-add-bold-duotone',
                      disabled: !permission.canCreate || generateMonth.isPending,
                      onClick: openGenerateMonth,
                    },
                    {
                      label: 'Ustaw dochód',
                      icon: 'solar:wad-of-money-bold-duotone',
                      disabled: !permission.canUpdate,
                      onClick: () => openManage('income'),
                    },
                    {
                      label: 'Dodaj kategorię',
                      icon: 'solar:folder-add-bold-duotone',
                      disabled: !permission.canCreate,
                      onClick: () => openManage('category'),
                    },
                    {
                      label: 'Usuń miesiąc',
                      icon: 'solar:trash-bin-trash-bold-duotone',
                      tone: 'danger',
                      hidden: !selectedMonthId,
                      disabled: !permission.canDelete,
                      onClick: () =>
                        selectedMonthId &&
                        confirmDelete('ten miesiąc budżetowy') &&
                        removeMonth.mutate(selectedMonthId),
                    },
                  ]}
                />
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
                    {money(budgetRemaining, currency)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    z {money(budgetLimit, currency)}
                  </Typography>
                </Box>
              </Stack>
              <BudgetUsageRing value={budgetUsage} />
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
                  <Icon icon="solar:bill-list-bold-duotone" width={27} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#FFAD32' }}>
                    Wydano
                  </Typography>
                  <Typography variant="h3">{money(budgetSpent, currency)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    z {money(budgetLimit, currency)}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {showIncomes && (
              <Box sx={(theme) => ({ ...financeSurface(theme), p: 2.5 })}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Bilans dochodów i budżetu
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Różnica pokazuje, ile zostaje po odjęciu całego zaplanowanego budżetu danej osoby
                  od jej dochodu.
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  {budget.data.personSummary.map((person) => {
                    const difference =
                      Number(person.incomeAmount) - Number(person.totalBudgetAmount);

                    return (
                      <Box
                        key={person.ownerMemberId}
                        sx={(theme) => ({
                          p: 2,
                          border: '1px solid #8190A5',
                          borderRadius: 2,
                          bgcolor: 'background.default',
                          ...theme.applyStyles('dark', { bgcolor: 'rgba(7,17,31,.48)' }),
                        })}
                      >
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 800 }}>
                            {person.displayName.slice(0, 1).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 750 }}>{person.displayName}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {person.email}
                            </Typography>
                          </Box>
                          <ActionMenu
                            label={`Akcje dochodu ${person.displayName}`}
                            actions={[
                              {
                                label: 'Edytuj dochód',
                                icon: 'solar:pen-bold-duotone',
                                disabled: !permission.canUpdate,
                                onClick: () => {
                                  openManage('income');
                                  setMemberId(person.ownerMemberId);
                                  setAmount(person.incomeAmount);
                                },
                              },
                            ]}
                          />
                        </Stack>
                        <Box
                          sx={{
                            mt: 2,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: 1,
                          }}
                        >
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Dochód
                            </Typography>
                            <Typography variant="subtitle1">
                              {money(person.incomeAmount, currency)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Budżet
                            </Typography>
                            <Typography variant="subtitle1">
                              {money(person.totalBudgetAmount, currency)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Różnica
                            </Typography>
                            <Typography
                              variant="subtitle1"
                              color={difference >= 0 ? 'success.main' : 'error.main'}
                            >
                              {money(difference, currency)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            <Stack spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' } }}>
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
                  <SectionCard key={category.id}>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          display: 'grid',
                          flexShrink: 0,
                          placeItems: 'center',
                          borderRadius: 1.5,
                          color: '#102238',
                          bgcolor: accent,
                        }}
                      >
                        <Icon icon="solar:folder-with-files-bold-duotone" width={24} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6">{category.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {category.items.length} pozycji · wydano {money(categorySpent, currency)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="subtitle1">
                          {money(categoryBudget, currency)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color={categoryRemaining < 0 ? 'error.main' : 'success.main'}
                        >
                          {money(categoryRemaining, currency)}
                        </Typography>
                      </Box>
                      <ActionMenu
                        label={`Akcje kategorii ${category.name}`}
                        actions={[
                          {
                            label: 'Dodaj pozycję',
                            icon: 'solar:add-square-bold-duotone',
                            disabled: !permission.canCreate,
                            onClick: () => openItemCreate(category.id),
                          },
                          {
                            label: 'Edytuj kategorię',
                            icon: 'solar:pen-bold-duotone',
                            disabled: !permission.canUpdate,
                            onClick: () =>
                              openCategoryEdit({ ...category, createdAt: '', updatedAt: '' }),
                          },
                          {
                            label: 'Usuń kategorię',
                            icon: 'solar:trash-bin-trash-bold-duotone',
                            tone: 'danger',
                            disabled: !permission.canDelete,
                            onClick: () =>
                              confirmDelete(category.name) &&
                              updateBudgetCategory(
                                category.id,
                                { isActive: false },
                                { accessToken }
                              ).then(invalidate),
                          },
                        ]}
                      />
                      <IconButton
                        size="small"
                        aria-label={`${collapsed ? 'Rozwiń' : 'Zwiń'} kategorię ${category.name}`}
                        onClick={() => toggleCategory(category.id)}
                      >
                        <Icon
                          icon={
                            collapsed ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'
                          }
                        />
                      </IconButton>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(categoryUsage, 100)}
                      color={categoryUsage >= 100 ? 'error' : 'warning'}
                      sx={{ mt: 1.5, height: 7, borderRadius: 4 }}
                    />
                    {!collapsed && (
                      <Stack divider={<Divider flexItem />} sx={{ mt: 1.25 }}>
                        {category.items.map((item) => {
                          const remaining =
                            item.remainingAmount === null ? null : Number(item.remainingAmount);
                          return (
                            <Stack
                              key={item.id}
                              direction="row"
                              spacing={1}
                              sx={{ py: 1.2, alignItems: 'center' }}
                            >
                              <Icon
                                icon={resolveBudgetItemIcon(item.name, category.name)}
                                width={22}
                                color={accent}
                              />
                              <Box
                                role="button"
                                tabIndex={0}
                                onClick={() => setHistoryItem(item)}
                                onKeyDown={(event) => event.key === 'Enter' && setHistoryItem(item)}
                                sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                              >
                                <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  wydano {money(item.spentAmount, currency)}
                                </Typography>
                              </Box>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="subtitle2">
                                  {item.budgetAmount === null
                                    ? '—'
                                    : money(item.budgetAmount, currency)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color={
                                    remaining !== null && remaining < 0
                                      ? 'error.main'
                                      : 'primary.main'
                                  }
                                >
                                  {remaining === null ? '—' : money(remaining, currency)}
                                </Typography>
                              </Box>
                              <ActionMenu
                                label={`Akcje pozycji ${item.name}`}
                                actions={[
                                  {
                                    label: 'Edytuj',
                                    icon: 'solar:pen-bold-duotone',
                                    disabled: !permission.canUpdate,
                                    onClick: () => openItemEdit(item),
                                  },
                                  {
                                    label: 'Usuń',
                                    icon: 'solar:trash-bin-trash-bold-duotone',
                                    tone: 'danger',
                                    disabled: !permission.canDelete,
                                    onClick: () =>
                                      confirmDelete(item.name) &&
                                      deleteBudgetItem(item.id, { accessToken }).then(invalidate),
                                  },
                                ]}
                              />
                            </Stack>
                          );
                        })}
                      </Stack>
                    )}
                  </SectionCard>
                );
              })}
            </Stack>

            <TableContainer
              sx={(theme) => ({
                ...financeSurface(theme),
                display: { xs: 'none', md: 'block' },
                overflowX: 'auto',
              })}
            >
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
                            <ActionMenu
                              label={`Akcje kategorii ${category.name}`}
                              actions={[
                                {
                                  label: 'Dodaj pozycję',
                                  icon: 'solar:add-square-bold-duotone',
                                  disabled: !permission.canCreate,
                                  onClick: () => openItemCreate(category.id),
                                },
                                {
                                  label: 'Edytuj kategorię',
                                  icon: 'solar:pen-bold-duotone',
                                  disabled: !permission.canUpdate,
                                  onClick: () =>
                                    openCategoryEdit({
                                      ...category,
                                      createdAt: '',
                                      updatedAt: '',
                                    }),
                                },
                                {
                                  label: 'Usuń kategorię',
                                  icon: 'solar:trash-bin-trash-bold-duotone',
                                  tone: 'danger',
                                  disabled: !permission.canDelete,
                                  onClick: () =>
                                    confirmDelete(category.name) &&
                                    updateBudgetCategory(
                                      category.id,
                                      { isActive: false },
                                      { accessToken }
                                    ).then(invalidate),
                                },
                              ]}
                            />
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
                                      icon={resolveBudgetItemIcon(item.name, category.name)}
                                      width={22}
                                      color={accent}
                                    />
                                    <Button
                                      color="inherit"
                                      onClick={() => setHistoryItem(item)}
                                      sx={{ p: 0, minWidth: 0, justifyContent: 'flex-start' }}
                                    >
                                      {item.name}
                                    </Button>
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
                                  <ActionMenu
                                    label={`Akcje pozycji ${item.name}`}
                                    actions={[
                                      {
                                        label: 'Edytuj',
                                        icon: 'solar:pen-bold-duotone',
                                        disabled: !permission.canUpdate,
                                        onClick: () => openItemEdit(item),
                                      },
                                      {
                                        label: 'Usuń',
                                        icon: 'solar:trash-bin-trash-bold-duotone',
                                        tone: 'danger',
                                        disabled: !permission.canDelete,
                                        onClick: () =>
                                          confirmDelete(item.name) &&
                                          deleteBudgetItem(item.id, { accessToken }).then(
                                            invalidate
                                          ),
                                      },
                                    ]}
                                  />
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
                        {filteredBudget.itemCount} pozycji
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle1">{money(budgetLimit, currency)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle1">{money(budgetSpent, currency)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="subtitle1"
                        color={budgetRemaining < 0 ? 'error.main' : 'success.main'}
                      >
                        {money(budgetRemaining, currency)}
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
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              }}
            >
              {[
                {
                  label: 'Pozostało do spłaty',
                  value: debtTotals.remaining,
                  icon: 'solar:wallet-money-bold-duotone',
                  color: '#FF9F43',
                },
                {
                  label: 'Spłacono łącznie',
                  value: debtTotals.paid,
                  icon: 'solar:hand-money-bold-duotone',
                  color: '#52DA99',
                },
                {
                  label: 'Wartość zobowiązań',
                  value: debtTotals.amount,
                  icon: 'solar:document-text-bold-duotone',
                  color: '#6C8CFF',
                },
              ].map((metric) => (
                <Box key={metric.label} sx={(theme) => ({ ...financeSurface(theme), p: 2 })}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 1.5,
                        color: metric.color,
                        bgcolor: `${metric.color}1A`,
                      }}
                    >
                      <Icon icon={metric.icon} width={25} />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {metric.label}
                      </Typography>
                      <Typography variant="h5">{money(metric.value, currency)}</Typography>
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              {groupDebtsByLender(debts.data ?? []).map((group, index) => {
                const accent = categoryAccents[index % categoryAccents.length];
                return (
                  <Box
                    key={group.id}
                    sx={(theme) => ({
                      ...financeSurface(theme),
                      overflow: 'hidden',
                      alignSelf: 'start',
                      borderTop: `3px solid ${group.activeCount === 0 ? '#52DA99' : accent}`,
                    })}
                  >
                    <Stack spacing={1} sx={{ p: 2.5 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="h5" sx={{ flex: 1, overflowWrap: 'anywhere' }}>
                          {group.label}
                        </Typography>
                        <Chip size="small" label={group.debts.length} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {group.activeCount} aktywne / {group.settledCount} spłacone
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
                      >
                        <Typography variant="h3">{money(group.totalOpen, currency)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          pozostało łącznie
                        </Typography>
                      </Stack>
                    </Stack>
                    <Stack divider={<Divider />}>
                      {group.debts.map((debt) => (
                        <Stack
                          key={debt.id}
                          spacing={1}
                          sx={{ p: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}
                        >
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
                                {debt.purpose || 'Bez opisu celu'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Spłacono {money(debt.paidAmount, currency)} z{' '}
                                {money(debt.amount, currency)}
                              </Typography>
                            </Box>
                            <ActionMenu
                              label={`Akcje zobowiązania ${group.label}: ${debt.purpose}`}
                              actions={[
                                {
                                  label: 'Edytuj',
                                  icon: 'solar:pen-bold-duotone',
                                  disabled: !permission.canUpdate,
                                  onClick: () => {
                                    setEditingDebt(debt);
                                    setName(debt.lenderName);
                                    setTargetAmount(debt.purpose);
                                    setAmount(debt.amount);
                                    setDueDate(debt.dueDate ?? '');
                                    setNoteText(debt.note ?? '');
                                    setDebtIsSettled(debt.isSettled);
                                    setOpen(true);
                                  },
                                },
                                {
                                  label: 'Zapisz spłatę',
                                  icon: 'solar:hand-money-bold-duotone',
                                  disabled: !permission.canUpdate || debt.isSettled,
                                  onClick: () => openManage('debt-payment', debt.id),
                                },
                                {
                                  label: 'Usuń',
                                  icon: 'solar:trash-bin-trash-bold-duotone',
                                  tone: 'danger',
                                  disabled: !permission.canDelete,
                                  onClick: () =>
                                    confirmDelete(`${group.label}: ${debt.purpose}`) &&
                                    removeDebt.mutate(debt.id),
                                },
                              ]}
                            />
                          </Stack>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                            }}
                          >
                            <Typography variant="subtitle1">
                              {money(debt.remainingAmount, currency)}
                            </Typography>
                            {debt.isSettled && (
                              <Chip size="small" color="success" label="Spłacone" />
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Termin: {shortDate(debt.dueDate)}
                            </Typography>
                          </Stack>
                          {debt.note && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ overflowWrap: 'anywhere' }}
                            >
                              {debt.note}
                            </Typography>
                          )}
                          {debt.payments.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              Ostatnia spłata:{' '}
                              {shortDate(debt.payments[0].paidAt ?? debt.payments[0].createdAt)} ·{' '}
                              {money(debt.payments[0].amount, currency)}
                            </Typography>
                          )}
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Stack>
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
            {savings.data?.map((account) => {
              const progress =
                account.targetAmount && Number(account.targetAmount) > 0
                  ? Math.round((Number(account.currentAmount) / Number(account.targetAmount)) * 100)
                  : 0;
              const owner = members.data?.find((member) => member.id === account.ownerMemberId);
              return (
                <SectionCard key={account.id} sx={{ position: 'relative', overflow: 'hidden' }}>
                  <Stack
                    direction="row"
                    sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
                  >
                    <Box sx={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
                      <Typography variant="h4">{account.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {owner?.displayName ?? 'Wspólny cel'}
                        {account.targetDate ? ` · do ${shortDate(account.targetDate)}` : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ position: 'relative', zIndex: 2 }}>
                      <ActionMenu
                        label={`Akcje celu ${account.name}`}
                        actions={[
                          {
                            label: 'Dodaj lub odejmij środki',
                            icon: 'solar:wallet-money-bold-duotone',
                            disabled: !permission.canUpdate,
                            onClick: () => openManage('saving-transaction', account.id),
                          },
                          {
                            label: 'Usuń cel',
                            icon: 'solar:trash-bin-trash-bold-duotone',
                            tone: 'danger',
                            disabled: !permission.canDelete,
                            onClick: () =>
                              confirmDelete(account.name) && removeSaving.mutate(account.id),
                          },
                        ]}
                      />
                    </Box>
                  </Stack>
                  <Typography
                    variant="h2"
                    color="primary.main"
                    sx={{ mt: 2, position: 'relative', zIndex: 1 }}
                  >
                    {money(account.currentAmount, currency)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ position: 'relative', zIndex: 1 }}
                  >
                    {account.targetAmount
                      ? `cel: ${money(account.targetAmount, currency)} · ${Math.min(progress, 999)}%`
                      : 'Bez określonego celu'}
                  </Typography>
                  {account.targetAmount && (
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(progress, 100)}
                      color={progress >= 100 ? 'success' : 'primary'}
                      sx={{ mt: 1.5, mr: 12, height: 7, borderRadius: 4 }}
                    />
                  )}
                  <Box
                    component="img"
                    src={savingsImage(account.name)}
                    alt=""
                    sx={{
                      right: 8,
                      bottom: 52,
                      width: 115,
                      height: 100,
                      objectFit: 'contain',
                      position: 'absolute',
                      opacity: 0.9,
                      filter: 'drop-shadow(0 10px 12px rgba(0,0,0,.18))',
                    }}
                  />
                  {account.transactions.length > 0 && (
                    <Stack spacing={0.5} sx={{ mt: 1.5, position: 'relative', zIndex: 1 }}>
                      {account.transactions.slice(0, 3).map((transaction) => (
                        <Typography key={transaction.id} variant="caption" color="text.secondary">
                          {shortDate(transaction.changedAt)} ·{' '}
                          {transaction.direction === 'add' ? '+' : '-'}
                          {money(transaction.amount, currency)}
                          {transaction.note ? ` · ${transaction.note}` : ''}
                        </Typography>
                      ))}
                    </Stack>
                  )}
                </SectionCard>
              );
            })}
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
        subtitle={
          editingDebt
            ? 'Zmień dane, status i termin zobowiązania.'
            : tab === 'budget'
              ? 'Wybierz osobę, kategorię i pozycję, a następnie podaj kwotę.'
              : tab === 'debts'
                ? 'Zapisz kwotę, termin i szczegóły zobowiązania.'
                : 'Określ właściciela, cel i planowany termin.'
        }
        icon={
          tab === 'budget'
            ? 'solar:bill-list-bold-duotone'
            : tab === 'debts'
              ? 'solar:hand-money-bold-duotone'
              : 'solar:wallet-money-bold-duotone'
        }
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingDebt(null);
          setNoteText('');
        }}
        onSubmit={() => (editingDebt ? saveDebt.mutate() : create.mutate())}
        loading={create.isPending || saveDebt.isPending}
        submitDisabled={
          tab === 'budget' && !editingDebt
            ? !budgetItemId || !amount || Number(amount) <= 0
            : tab === 'debts' || editingDebt
              ? !name.trim() || !targetAmount.trim() || !amount || Number(amount) <= 0
              : !memberId ||
                !name.trim() ||
                !targetAmount ||
                Number(targetAmount) <= 0 ||
                !targetDate ||
                Number(amount || 0) < 0
        }
      >
        {(create.error || saveDebt.error) && (
          <Alert severity="error">{(create.error ?? saveDebt.error)?.message}</Alert>
        )}
        {tab === 'budget' && !editingDebt && (
          <>
            <TextField
              select
              label="1. Domownik"
              value={memberId}
              onChange={(event) => {
                const nextMemberId = event.target.value;
                const nextCategory = budget.data?.categories.find((category) =>
                  category.items.some((item) => item.owner.memberId === nextMemberId)
                );
                const nextItem = nextCategory?.items.find(
                  (item) => item.owner.memberId === nextMemberId
                );
                setMemberId(nextMemberId);
                setCategoryId(nextCategory?.id ?? '');
                setBudgetItemId(nextItem?.id ?? '');
              }}
              required
            >
              {(members.data ?? [])
                .filter((member) => member.isActive)
                .map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.displayName}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              label="2. Kategoria"
              value={categoryId}
              onChange={(event) => {
                const nextCategoryId = event.target.value;
                const nextItem = budgetItems.find(
                  (item) => item.categoryId === nextCategoryId && item.owner.memberId === memberId
                );
                setCategoryId(nextCategoryId);
                setBudgetItemId(nextItem?.id ?? '');
              }}
              required
            >
              {expenseCategories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="3. Pozycja budżetu"
              value={budgetItemId}
              onChange={(event) => setBudgetItemId(event.target.value)}
              required
            >
              {expenseItems.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
          </>
        )}
        {tab === 'savings' && !editingDebt && (
          <TextField
            select
            label="Domownik"
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            required
          >
            {(members.data ?? [])
              .filter((member) => member.isActive)
              .map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.displayName}
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
        {(tab === 'debts' || editingDebt) && (
          <TextField
            label="Notatka"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            multiline
            minRows={2}
          />
        )}
        {editingDebt && (
          <FormControlLabel
            label="Zobowiązanie spłacone"
            control={
              <Checkbox
                checked={debtIsSettled}
                onChange={(event) => setDebtIsSettled(event.target.checked)}
              />
            }
          />
        )}
        {tab === 'savings' && (
          <>
            <TextField
              label="Kwota docelowa"
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
            <TextField
              label="Termin celu"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Notatka"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              multiline
              minRows={2}
            />
          </>
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
        subtitle={
          manageKind === 'category'
            ? 'Nazwa i zasady przenoszenia do kolejnego miesiąca.'
            : manageKind === 'item'
              ? 'Przypisz limit do kategorii i domownika.'
              : manageKind === 'income'
                ? 'Ustaw dochód wybranego domownika.'
                : manageKind === 'debt-payment'
                  ? 'Dodaj spłatę do historii zobowiązania.'
                  : 'Dodaj albo odejmij środki od celu.'
        }
        icon={
          manageKind === 'category'
            ? 'solar:folder-add-bold-duotone'
            : manageKind === 'item'
              ? 'solar:add-square-bold-duotone'
              : manageKind === 'income'
                ? 'solar:wad-of-money-bold-duotone'
                : 'solar:wallet-money-bold-duotone'
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
        {manageKind === 'category' && (
          <FormControlLabel
            label="Przenoś tę kategorię do kolejnych miesięcy"
            control={
              <Checkbox
                checked={copyToNextMonth}
                onChange={(event) => setCopyToNextMonth(event.target.checked)}
              />
            }
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
      <FormDialog
        title={historyItem?.name ?? 'Historia wydatków'}
        subtitle="Wykorzystanie limitu i historia transakcji tej pozycji."
        icon="solar:history-bold-duotone"
        open={Boolean(historyItem)}
        onClose={() => setHistoryItem(null)}
        onSubmit={() => {
          const item = historyItem;
          setHistoryItem(null);
          if (item) openPrimaryCreate(item);
        }}
        cancelLabel="Zamknij"
        submitLabel="Dodaj wydatek"
        submitDisabled={!permission.canCreate}
      >
        {historyItem && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.paper' }}>
                <Typography variant="caption" color="text.secondary">
                  Budżet
                </Typography>
                <Typography variant="h6">
                  {historyItem.budgetAmount === null
                    ? '—'
                    : money(historyItem.budgetAmount, currency)}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.paper' }}>
                <Typography variant="caption" color="text.secondary">
                  Wydano
                </Typography>
                <Typography variant="h6">{money(historyItem.spentAmount, currency)}</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.paper' }}>
                <Typography variant="caption" color="text.secondary">
                  Zostaje
                </Typography>
                <Typography
                  variant="h6"
                  color={
                    Number(historyItem.remainingAmount ?? 0) < 0 ? 'error.main' : 'success.main'
                  }
                >
                  {historyItem.remainingAmount === null
                    ? '—'
                    : money(historyItem.remainingAmount, currency)}
                </Typography>
              </Box>
            </Box>
            <Typography variant="subtitle1">Historia transakcji</Typography>
            {historyItem.expenses.length === 0 ? (
              <EmptyState icon="solar:bill-list-bold-duotone" text="Brak zapisanych wydatków." />
            ) : (
              <Stack divider={<Divider flexItem />}>
                {[...historyItem.expenses]
                  .sort((left, right) =>
                    (right.occurredAt ?? right.createdAt).localeCompare(
                      left.occurredAt ?? left.createdAt
                    )
                  )
                  .map((expense) => (
                    <Stack
                      key={expense.id}
                      direction="row"
                      spacing={1.5}
                      sx={{ py: 1.1, alignItems: 'center' }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {expense.name || 'Wydatek'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {shortDate(expense.occurredAt ?? expense.createdAt)} ·{' '}
                          {expense.source === 'bank_notification'
                            ? 'Import z banku'
                            : 'Wpis ręczny'}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle1">{money(expense.amount, currency)}</Typography>
                    </Stack>
                  ))}
              </Stack>
            )}
          </>
        )}
      </FormDialog>
      <FormDialog
        title="Generuj kolejny miesiąc"
        subtitle="Wybierz pozycje i w razie potrzeby skoryguj ich limity."
        icon="solar:calendar-add-bold-duotone"
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={() => generateMonth.mutate()}
        loading={generateMonth.isPending}
        submitLabel="Utwórz miesiąc"
        submitDisabled={generateItemIds.size === 0}
        maxWidth="md"
      >
        {generateMonth.error && <Alert severity="error">{generateMonth.error.message}</Alert>}
        <Box
          sx={(theme) => ({
            p: 2,
            border: '1px solid #8190A5',
            borderRadius: 2,
            bgcolor: 'background.default',
            ...theme.applyStyles('dark', { bgcolor: 'rgba(7,17,31,.48)' }),
          })}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { sm: 'center' } }}
          >
            <Button
              variant="contained"
              startIcon={<Icon icon="solar:add-square-bold-duotone" />}
              onClick={() => manageItemFromGenerator()}
              disabled={!permission.canCreate || activeCategories.length === 0}
            >
              Dodaj pozycję
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setGenerateItemIds(new Set(budgetItems.map((item) => item.id)))}
            >
              Zaznacz wszystkie
            </Button>
            <Button size="small" onClick={() => setGenerateItemIds(new Set())}>
              Wyczyść wybór
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                variant="soft"
                color="primary"
                label={`Wybrano ${generateItemIds.size} z ${budgetItems.length}`}
              />
              <Chip
                size="small"
                variant="soft"
                color="success"
                icon={<Icon icon="solar:check-circle-bold" />}
                label={`Sprawdzono ${generateReviewedItemIds.size}`}
              />
            </Stack>
          </Stack>
        </Box>

        <Alert severity="info" variant="outlined">
          Wejdź w pole kwoty, aby oznaczyć pozycję jako sprawdzoną. Enter przechodzi do kolejnej
          wybranej pozycji.
        </Alert>

        <Stack spacing={2}>
          {(budget.data?.categories ?? []).map((category) => (
            <Box
              key={category.id}
              component="section"
              sx={(theme) => ({
                p: { xs: 1.25, sm: 2 },
                border: '1px solid #8190A5',
                borderRadius: 2.25,
                bgcolor: 'background.paper',
                boxShadow: '0 8px 24px rgba(34,51,84,.05)',
                ...theme.applyStyles('dark', { boxShadow: '0 10px 28px rgba(0,0,0,.18)' }),
              })}
            >
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ mb: 1.25, alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 1.25,
                      color: 'primary.main',
                      bgcolor: 'primary.lighter',
                    }}
                  >
                    <Icon icon="solar:folder-with-files-bold-duotone" width={21} />
                  </Box>
                  <Box>
                    <Typography component="h3" variant="subtitle1">
                      {category.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {category.items.length} pozycji
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  size="small"
                  startIcon={<Icon icon="solar:add-circle-linear" />}
                  onClick={() => manageItemFromGenerator(undefined, category.id)}
                  disabled={!permission.canCreate}
                >
                  Dodaj
                </Button>
              </Stack>
              <Stack spacing={1}>
                {category.items.map((item) => {
                  const selected = generateItemIds.has(item.id);
                  const reviewed = generateReviewedItemIds.has(item.id);
                  const ownerInitial = item.owner.displayName.slice(0, 1).toUpperCase();

                  return (
                    <Box
                      key={item.id}
                      sx={(theme) => ({
                        p: 1,
                        display: 'grid',
                        gap: 1,
                        alignItems: 'center',
                        border: '1px solid',
                        borderColor: reviewed ? 'success.main' : 'divider',
                        borderRadius: 1.75,
                        bgcolor: reviewed ? 'rgba(34,197,94,.08)' : 'background.default',
                        opacity: selected ? 1 : 0.62,
                        gridTemplateColumns: {
                          xs: 'auto 40px minmax(0, 1fr) auto',
                          sm: 'auto 40px minmax(180px, 1fr) auto 160px auto',
                        },
                        transition: theme.transitions.create([
                          'background-color',
                          'border-color',
                          'opacity',
                        ]),
                        ...theme.applyStyles('dark', {
                          bgcolor: reviewed ? 'rgba(34,197,94,.11)' : 'rgba(7,17,31,.4)',
                        }),
                      })}
                    >
                      <Checkbox
                        checked={selected}
                        slotProps={{
                          input: { 'aria-label': `Uwzględnij pozycję ${item.name}` },
                        }}
                        onChange={(event) =>
                          setGenerateItemIds((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            return next;
                          })
                        }
                      />
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 1.25,
                          color: 'primary.main',
                          bgcolor: 'primary.lighter',
                        }}
                      >
                        <Icon icon={resolveBudgetItemIcon(item.name, category.name)} width={22} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }} noWrap>
                          {item.name}
                        </Typography>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <Avatar
                            sx={{
                              width: 22,
                              height: 22,
                              fontSize: 11,
                              fontWeight: 800,
                              bgcolor: 'secondary.main',
                            }}
                          >
                            {ownerInitial}
                          </Avatar>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {item.owner.displayName}
                          </Typography>
                        </Stack>
                      </Box>
                      {reviewed ? (
                        <Chip
                          size="small"
                          color="success"
                          variant="soft"
                          icon={<Icon icon="solar:check-circle-bold" />}
                          label="Sprawdzone"
                          sx={{ gridColumn: { xs: '3', sm: 'auto' }, justifySelf: 'start' }}
                        />
                      ) : (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ gridColumn: { xs: '3', sm: 'auto' } }}
                        >
                          Do sprawdzenia
                        </Typography>
                      )}
                      <TextField
                        size="small"
                        label="Limit"
                        type="number"
                        value={generateAmounts[item.id] ?? ''}
                        inputRef={(node) => {
                          generateAmountRefs.current[item.id] = node;
                        }}
                        onFocus={() => markGenerateItemReviewed(item.id)}
                        onChange={(event) => {
                          markGenerateItemReviewed(item.id);
                          setGenerateAmounts((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }));
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          markGenerateItemReviewed(item.id);
                          focusNextGenerateAmount(item.id);
                        }}
                        disabled={!selected}
                        sx={{ width: 1, gridColumn: { xs: '2 / 5', sm: 'auto' } }}
                        slotProps={{
                          htmlInput: { min: 0, step: 0.01 },
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">{currency}</InputAdornment>
                            ),
                          },
                        }}
                      />
                      <Box
                        sx={{
                          gridColumn: { xs: '4', sm: 'auto' },
                          gridRow: { xs: '1', sm: 'auto' },
                        }}
                      >
                        <ActionMenu
                          label={`Akcje pozycji ${item.name}`}
                          actions={[
                            {
                              label: 'Edytuj pozycję',
                              icon: 'solar:pen-bold-duotone',
                              disabled: !permission.canUpdate,
                              onClick: () => manageItemFromGenerator(item),
                            },
                          ]}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </FormDialog>
    </Page>
  );
}
