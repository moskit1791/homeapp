import { Icon } from "@iconify/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

import {
  createMealPlan,
  deleteMealSlot,
  getCurrentMealPlanWeek,
  updateMealPlan,
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
import { shortDate, weekStartIso } from "../utils/format";

const weekdays = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
];

export function MealsPage() {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mealName, setMealName] = useState("");
  const [note, setNote] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [slotIndex, setSlotIndex] = useState(0);
  const query = useQuery({
    queryKey: ["meal", "current"],
    queryFn: () => getCurrentMealPlanWeek({ accessToken }),
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["meal"] });
  const createWeek = useMutation({
    mutationFn: () =>
      createMealPlan({ weekStartDate: weekStartIso() }, { accessToken }),
    onSuccess: invalidate,
  });
  const save = useMutation({
    mutationFn: async () => {
      const plan =
        query.data ??
        (await createMealPlan(
          { weekStartDate: weekStartIso() },
          { accessToken },
        ));
      const entries = plan.entries
        .filter(
          (item) => !(item.weekday === weekday && item.slotIndex === slotIndex),
        )
        .map((item) => ({
          weekday: item.weekday,
          slotIndex: item.slotIndex,
          mealName: item.mealName,
          note: item.note,
          linkUrl: item.linkUrl,
        }));
      entries.push({
        weekday,
        slotIndex,
        mealName: mealName.trim(),
        note: note || null,
        linkUrl: linkUrl || null,
      });
      return updateMealPlan(plan.week.id, { entries }, { accessToken });
    },
    onSuccess: async () => {
      setOpen(false);
      setMealName("");
      setNote("");
      setLinkUrl("");
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: ({
      planId,
      day,
      slot,
    }: {
      planId: string;
      day: number;
      slot: number;
    }) =>
      deleteMealSlot(
        planId,
        { weekday: day, slotIndex: slot },
        { accessToken },
      ),
    onSuccess: invalidate,
  });

  return (
    <Page>
      <PageHeader
        title="Plan posiłków"
        description={
          query.data
            ? `Tydzień od ${shortDate(query.data.week.weekStartDate)}`
            : "Zaplanuj posiłki na bieżący tydzień."
        }
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            Dodaj posiłek
          </PrimaryButton>
        }
      />
      {query.isLoading ? (
        <LoadingView />
      ) : query.error ? (
        <ErrorView error={query.error} retry={() => void query.refetch()} />
      ) : !query.data ? (
        <SectionCard>
          <EmptyState
            icon="solar:chef-hat-minimalistic-bold-duotone"
            text="Nie masz jeszcze planu na ten tydzień."
          />
          <Box sx={{ textAlign: "center" }}>
            <PrimaryButton
              onClick={() => createWeek.mutate()}
              disabled={createWeek.isPending}
            >
              Utwórz plan tygodnia
            </PrimaryButton>
          </Box>
        </SectionCard>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, 1fr)",
              xl: "repeat(3, 1fr)",
            },
            gap: 2.5,
          }}
        >
          {weekdays.map((label, index) => {
            const meals = query
              .data!.entries.filter((entry) => entry.weekday === index + 1)
              .sort((a, b) => a.slotIndex - b.slotIndex);
            return (
              <SectionCard key={label} title={label} sx={{ minHeight: 180 }}>
                {meals.length === 0 ? (
                  <EmptyState
                    icon="solar:plate-bold-duotone"
                    text="Brak posiłków"
                  />
                ) : (
                  <Stack divider={<Divider flexItem />}>
                    {meals.map((meal) => (
                      <Stack
                        key={meal.id}
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{ py: 1.25 }}
                      >
                        <Chip
                          size="small"
                          label={meal.slotIndex + 1}
                          color="warning"
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography fontWeight={700}>
                            {meal.mealName}
                          </Typography>
                          {meal.note && (
                            <Typography variant="body2" color="text.secondary">
                              {meal.note}
                            </Typography>
                          )}
                        </Box>
                        {meal.linkUrl && (
                          <IconButton
                            component="a"
                            href={meal.linkUrl}
                            target="_blank"
                            size="small"
                          >
                            <Icon icon="solar:link-bold" />
                          </IconButton>
                        )}
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() =>
                            confirmDelete(meal.mealName) &&
                            remove.mutate({
                              planId: query.data!.week.id,
                              day: meal.weekday,
                              slot: meal.slotIndex,
                            })
                          }
                        >
                          <Icon icon="solar:trash-bin-trash-bold-duotone" />
                        </IconButton>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            );
          })}
        </Box>
      )}
      <FormDialog
        title="Dodaj posiłek"
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        submitDisabled={!mealName.trim()}
      >
        {save.error && <Alert severity="error">{save.error.message}</Alert>}
        <TextField
          select
          label="Dzień"
          value={weekday}
          onChange={(e) => setWeekday(Number(e.target.value))}
        >
          {weekdays.map((label, index) => (
            <MenuItem key={label} value={index + 1}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Posiłek"
          value={slotIndex}
          onChange={(e) => setSlotIndex(Number(e.target.value))}
        >
          <MenuItem value={0}>Śniadanie</MenuItem>
          <MenuItem value={1}>Obiad</MenuItem>
          <MenuItem value={2}>Kolacja</MenuItem>
        </TextField>
        <TextField
          label="Nazwa posiłku"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          required
          autoFocus
        />
        <TextField
          label="Notatka"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={2}
        />
        <TextField
          label="Link do przepisu"
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
        />
      </FormDialog>
    </Page>
  );
}
