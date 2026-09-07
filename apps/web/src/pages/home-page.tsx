import { Icon } from "@iconify/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

import {
  completeAnnualCost,
  completeCleaningTask,
  createAnnualCost,
  createCleaningTask,
  createDataEntry,
  deleteCleaningTask,
  deleteDataEntry,
  getMyHousehold,
  listAnnualCosts,
  listCleaningTasks,
  listDataEntries,
} from "../api";
import { useSession } from "../auth/session-context";
import {
  confirmDelete,
  EmptyState,
  ErrorView,
  FormDialog,
  LoadingView,
  Page,
  PageHeader,
  PrimaryButton,
  SectionCard,
} from "../components/ui";
import { money, shortDate, todayIso } from "../utils/format";

type HomeTab = "cleaning" | "costs" | "data";

export function HomePage() {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<HomeTab>("cleaning");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("7");
  const cleaning = useQuery({
    queryKey: ["cleaning"],
    queryFn: () => listCleaningTasks({ accessToken }),
  });
  const costs = useQuery({
    queryKey: ["annualCosts"],
    queryFn: () => listAnnualCosts({ accessToken }),
  });
  const data = useQuery({
    queryKey: ["dataEntries"],
    queryFn: () => listDataEntries(undefined, { accessToken }),
  });
  const household = useQuery({
    queryKey: ["household"],
    queryFn: () => getMyHousehold({ accessToken }),
  });
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey:
        tab === "cleaning"
          ? ["cleaning"]
          : tab === "costs"
            ? ["annualCosts"]
            : ["dataEntries"],
    });
  const create = useMutation<unknown, Error>({
    mutationFn: () => {
      if (tab === "cleaning")
        return createCleaningTask(
          {
            name: name.trim(),
            location: detail || undefined,
            nextDueAt: date,
            frequencyDays: Number(days),
            frequencyMode: "custom_days",
            completionWindowDays: 1,
          },
          { accessToken },
        );
      if (tab === "costs")
        return createAnnualCost(
          {
            name: name.trim(),
            defaultAmount: amount ? Number(amount) : null,
            nextDueDate: date,
          },
          { accessToken },
        );
      return createDataEntry(
        { title: name.trim(), value: detail },
        { accessToken },
      );
    },
    onSuccess: async () => {
      setOpen(false);
      setName("");
      setDetail("");
      setAmount("");
      await invalidate();
    },
  });
  const completeCleaning = useMutation({
    mutationFn: (id: string) =>
      completeCleaningTask(
        id,
        { completedAt: new Date().toISOString() },
        { accessToken },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cleaning"] }),
  });
  const removeCleaning = useMutation({
    mutationFn: (id: string) => deleteCleaningTask(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cleaning"] }),
  });
  const completeCost = useMutation({
    mutationFn: (id: string) =>
      completeAnnualCost(id, { executedAt: todayIso() }, { accessToken }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["annualCosts"] }),
  });
  const removeData = useMutation({
    mutationFn: (id: string) => deleteDataEntry(id, { accessToken }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dataEntries"] }),
  });
  const active = tab === "cleaning" ? cleaning : tab === "costs" ? costs : data;
  const currency = household.data?.currencyCode ?? "PLN";

  return (
    <Page>
      <PageHeader
        title="Dom"
        description="Sprzątanie, cykliczne koszty i ważne dane."
        action={
          <PrimaryButton onClick={() => setOpen(true)}>Dodaj</PrimaryButton>
        }
      />
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab value="cleaning" label="Sprzątanie" />
        <Tab value="costs" label="Koszty roczne" />
        <Tab value="data" label="Ważne dane" />
      </Tabs>
      <SectionCard>
        {active.isLoading ? (
          <LoadingView />
        ) : active.error ? (
          <ErrorView error={active.error} retry={() => void active.refetch()} />
        ) : tab === "cleaning" ? (
          (cleaning.data?.length ?? 0) === 0 ? (
            <EmptyState text="Brak zaplanowanych prac." />
          ) : (
            <Stack divider={<Divider flexItem />}>
              {cleaning.data?.map((task) => (
                <Stack
                  key={task.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems={{ sm: "center" }}
                  sx={{ py: 1.5 }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={700}>{task.name}</Typography>
                      {task.isOverdue && (
                        <Chip size="small" color="error" label="Po terminie" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {task.location || "Cały dom"} · co {task.frequencyDays}{" "}
                      dni · termin {shortDate(task.nextDueAt)}
                    </Typography>
                  </Box>
                  <Button
                    startIcon={<Icon icon="solar:check-circle-bold" />}
                    onClick={() => completeCleaning.mutate(task.id)}
                  >
                    Wykonane
                  </Button>
                  <IconButton
                    color="error"
                    onClick={() =>
                      confirmDelete(task.name) && removeCleaning.mutate(task.id)
                    }
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )
        ) : tab === "costs" ? (
          (costs.data?.length ?? 0) === 0 ? (
            <EmptyState text="Brak kosztów rocznych." />
          ) : (
            <Stack divider={<Divider flexItem />}>
              {costs.data?.map((cost) => (
                <Stack
                  key={cost.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems={{ sm: "center" }}
                  sx={{ py: 1.5 }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={700}>{cost.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Termin {shortDate(cost.nextDueDate)}
                    </Typography>
                  </Box>
                  <Typography variant="h3">
                    {cost.defaultAmount
                      ? money(cost.defaultAmount, currency)
                      : "—"}
                  </Typography>
                  <Button onClick={() => completeCost.mutate(cost.id)}>
                    Opłacone
                  </Button>
                </Stack>
              ))}
            </Stack>
          )
        ) : (data.data?.length ?? 0) === 0 ? (
          <EmptyState text="Brak zapisanych danych." />
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
              gap: 2,
            }}
          >
            {data.data?.map((entry) => (
              <SectionCard key={entry.id} sx={{ bgcolor: "action.hover" }}>
                <Stack direction="row" justifyContent="space-between">
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      {entry.title}
                    </Typography>
                    <Typography variant="h3" sx={{ wordBreak: "break-word" }}>
                      {entry.value}
                    </Typography>
                  </Box>
                  <IconButton
                    color="error"
                    onClick={() =>
                      confirmDelete(entry.title) && removeData.mutate(entry.id)
                    }
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                </Stack>
              </SectionCard>
            ))}
          </Box>
        )}
      </SectionCard>
      <FormDialog
        title={
          tab === "cleaning"
            ? "Nowe zadanie domowe"
            : tab === "costs"
              ? "Nowy koszt roczny"
              : "Nowy wpis"
        }
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={() => create.mutate()}
        loading={create.isPending}
        submitDisabled={
          !name.trim() ||
          (tab === "data" && !detail.trim()) ||
          (tab !== "data" && !date)
        }
      >
        {create.error && <Alert severity="error">{create.error.message}</Alert>}
        <TextField
          label={tab === "data" ? "Nazwa pola" : "Nazwa"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        {tab !== "costs" && (
          <TextField
            label={tab === "cleaning" ? "Pomieszczenie" : "Wartość"}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            required={tab === "data"}
          />
        )}
        {tab === "cleaning" && (
          <TextField
            label="Powtarzaj co ile dni"
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            slotProps={{ htmlInput: { min: 1 } }}
          />
        )}
        {tab === "costs" && (
          <TextField
            label="Domyślna kwota"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        )}
        {tab !== "data" && (
          <TextField
            label={tab === "cleaning" ? "Następny termin" : "Termin płatności"}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
      </FormDialog>
    </Page>
  );
}
