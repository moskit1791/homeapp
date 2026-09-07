import { Icon } from "@iconify/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

import {
  createBudgetMonth,
  createExpense,
  createFinanceDebt,
  createFinanceSavingsAccount,
  deleteFinanceDebt,
  deleteFinanceSavingsAccount,
  getCurrentBudgetMonth,
  getMyHousehold,
  listFinanceDebts,
  listFinanceSavings,
} from "../api";
import { useSession } from "../auth/session-context";
import {
  confirmDelete,
  EmptyState,
  ErrorView,
  FormDialog,
  LoadingView,
  MetricCard,
  Page,
  PageHeader,
  PrimaryButton,
  SectionCard,
} from "../components/ui";
import { money, shortDate, todayIso } from "../utils/format";

type FinanceTab = "budget" | "debts" | "savings";

export function FinancePage() {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FinanceTab>("budget");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [budgetItemId, setBudgetItemId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const household = useQuery({
    queryKey: ["household"],
    queryFn: () => getMyHousehold({ accessToken }),
  });
  const budget = useQuery({
    queryKey: ["finances", "current"],
    queryFn: () => getCurrentBudgetMonth({ accessToken }),
    retry: false,
  });
  const debts = useQuery({
    queryKey: ["finances", "debts"],
    queryFn: () => listFinanceDebts({ accessToken }),
  });
  const savings = useQuery({
    queryKey: ["finances", "savings"],
    queryFn: () => listFinanceSavings({ accessToken }),
  });
  const currency = household.data?.currencyCode ?? "PLN";
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["finances"] });
  const createMonth = useMutation({
    mutationFn: () => {
      const now = new Date();
      return createBudgetMonth(
        { year: now.getFullYear(), month: now.getMonth() + 1 },
        { accessToken },
      );
    },
    onSuccess: invalidate,
  });
  const create = useMutation<unknown, Error>({
    mutationFn: () => {
      if (tab === "budget")
        return createExpense(
          { amount: Number(amount), budgetItemId, name: name || undefined },
          { accessToken },
        );
      if (tab === "debts")
        return createFinanceDebt(
          {
            amount: Number(amount),
            lenderName: name.trim(),
            purpose: "Pożyczka",
            dueDate: dueDate || null,
          },
          { accessToken },
        );
      return createFinanceSavingsAccount(
        {
          amount: Number(amount || 0),
          name: name.trim(),
          targetAmount: targetAmount ? Number(targetAmount) : null,
          changedAt: todayIso(),
        },
        { accessToken },
      );
    },
    onSuccess: async () => {
      setOpen(false);
      setName("");
      setAmount("");
      setTargetAmount("");
      setDueDate("");
      await invalidate();
    },
  });
  const removeDebt = useMutation({
    mutationFn: (id: string) => deleteFinanceDebt(id, { accessToken }),
    onSuccess: invalidate,
  });
  const removeSaving = useMutation({
    mutationFn: (id: string) =>
      deleteFinanceSavingsAccount(id, { accessToken }),
    onSuccess: invalidate,
  });
  const budgetItems =
    budget.data?.categories.flatMap((category) =>
      category.items.map((item) => ({ ...item, categoryName: category.name })),
    ) ?? [];

  return (
    <Page>
      <PageHeader
        title="Finanse"
        description="Budżet domowy, zobowiązania i cele oszczędnościowe."
        action={
          <PrimaryButton
            onClick={() => setOpen(true)}
            disabled={tab === "budget" && budgetItems.length === 0}
          >
            Dodaj{" "}
            {tab === "budget"
              ? "wydatek"
              : tab === "debts"
                ? "zobowiązanie"
                : "cel"}
          </PrimaryButton>
        }
      />
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab value="budget" label="Budżet" />
        <Tab value="debts" label="Zobowiązania" />
        <Tab value="savings" label="Oszczędności" />
      </Tabs>
      {tab === "budget" &&
        (budget.isLoading ? (
          <LoadingView />
        ) : budget.error || !budget.data ? (
          <SectionCard>
            <ErrorView
              error={
                budget.error ?? new Error("Brak budżetu na bieżący miesiąc.")
              }
            />
            <Box sx={{ textAlign: "center", mt: 2 }}>
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
                  value={money(
                    budget.data.summary.totalRemainingAmount,
                    currency,
                  )}
                  color="secondary.main"
                />
              </Grid>
            </Grid>
            <Stack spacing={2.5}>
              {budget.data.categories.map((category) => (
                <SectionCard key={category.id} title={category.name}>
                  {category.items.length === 0 ? (
                    <EmptyState text="Brak pozycji w tej kategorii." />
                  ) : (
                    <Stack divider={<Divider flexItem />}>
                      {category.items.map((item) => (
                        <Stack
                          key={item.id}
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          sx={{ py: 1.25 }}
                          alignItems={{ sm: "center" }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography fontWeight={700}>
                              {item.name}
                            </Typography>
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
                                ? "bez limitu"
                                : `zostało ${money(item.remainingAmount, currency)}`
                            }
                            color={
                              Number(item.remainingAmount) < 0
                                ? "error"
                                : "success"
                            }
                            variant="outlined"
                          />
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </SectionCard>
              ))}
            </Stack>
          </>
        ))}
      {tab === "debts" &&
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
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
              gap: 2.5,
            }}
          >
            {debts.data?.map((debt) => (
              <SectionCard key={debt.id}>
                <Stack direction="row" justifyContent="space-between">
                  <Box>
                    <Typography variant="h3">{debt.lenderName}</Typography>
                    <Typography color="text.secondary">
                      {debt.purpose}
                    </Typography>
                  </Box>
                  <IconButton
                    color="error"
                    onClick={() =>
                      confirmDelete(debt.lenderName) &&
                      removeDebt.mutate(debt.id)
                    }
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                </Stack>
                <Typography variant="h2" sx={{ mt: 2 }}>
                  {money(debt.remainingAmount, currency)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  z {money(debt.amount, currency)} · termin{" "}
                  {shortDate(debt.dueDate)}
                </Typography>
              </SectionCard>
            ))}
          </Box>
        ))}
      {tab === "savings" &&
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
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
              gap: 2.5,
            }}
          >
            {savings.data?.map((account) => (
              <SectionCard key={account.id}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="h3">{account.name}</Typography>
                  <IconButton
                    color="error"
                    onClick={() =>
                      confirmDelete(account.name) &&
                      removeSaving.mutate(account.id)
                    }
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
                    : "Bez określonego celu"}
                </Typography>
              </SectionCard>
            ))}
          </Box>
        ))}
      <FormDialog
        title={
          tab === "budget"
            ? "Nowy wydatek"
            : tab === "debts"
              ? "Nowe zobowiązanie"
              : "Nowy cel oszczędnościowy"
        }
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={() => create.mutate()}
        loading={create.isPending}
        submitDisabled={
          !amount ||
          Number(amount) < 0 ||
          (tab === "budget" ? !budgetItemId : !name.trim())
        }
      >
        {create.error && <Alert severity="error">{create.error.message}</Alert>}
        {tab === "budget" && (
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
            tab === "budget"
              ? "Opis (opcjonalnie)"
              : tab === "debts"
                ? "Pożyczkodawca"
                : "Nazwa celu"
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          required={tab !== "budget"}
        />
        <TextField
          label={tab === "savings" ? "Kwota początkowa" : "Kwota"}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
        {tab === "debts" && (
          <TextField
            label="Termin"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
        {tab === "savings" && (
          <TextField
            label="Kwota docelowa"
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        )}
      </FormDialog>
    </Page>
  );
}
