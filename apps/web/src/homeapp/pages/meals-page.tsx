import type { MealPlanEntry, MealPlanAiMessage, MealPlanAiDraftEntry } from '../api';

import { Icon } from '@iconify/react';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Chip,
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
import { Markdown } from '../../components/markdown';
import { usePermission } from '../auth/use-permission';
import { shortDate, weekStartIso } from '../utils/format';
import { useEncryption } from '../auth/encryption-context';
import { FoodNavigation } from '../components/food-navigation';
import {
  Page,
  ErrorView,
  EmptyState,
  FormDialog,
  LoadingView,
  SectionCard,
  confirmDelete,
  PrimaryButton,
} from '../components/ui';
import {
  listMealIdeas,
  createMealIdea,
  createMealPlan,
  updateMealPlan,
  deleteMealSlot,
  getMealPlanWeek,
  copyMealPlanWeek,
  deleteMealPlanWeek,
  chatMealPlanWithAi,
  listMealPlanHistory,
  getCurrentMealPlanWeek,
  finalizeMealPlanWithAi,
} from '../api';

const weekdays = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const slots = ['Śniadanie', 'Obiad', 'Kolacja'];

function nextWeekStart(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function MealsPage() {
  const { accessToken } = useSession();
  const permission = usePermission('meal_planner');
  const encryption = useEncryption();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MealPlanEntry | null>(null);
  const [mealName, setMealName] = useState('');
  const [note, setNote] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [weekday, setWeekday] = useState(1);
  const [slotIndex, setSlotIndex] = useState(0);
  const [targetWeek, setTargetWeek] = useState(weekStartIso());
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<MealPlanAiMessage[]>([]);
  const [aiDraft, setAiDraft] = useState<MealPlanAiDraftEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [aiDisclosureOpen, setAiDisclosureOpen] = useState(false);
  const [aiDisclosureAccepted, setAiDisclosureAccepted] = useState(false);
  const [pendingAiAction, setPendingAiAction] = useState<'chat' | 'save' | null>(null);

  const current = useQuery({
    queryKey: ['meal', 'current'],
    queryFn: () => getCurrentMealPlanWeek({ accessToken }),
  });
  const history = useQuery({
    queryKey: ['meal', 'history'],
    queryFn: () => listMealPlanHistory({ accessToken }),
  });
  const selected = useQuery({
    queryKey: ['meal', 'plan', selectedPlanId],
    queryFn: () => getMealPlanWeek(selectedPlanId!, { accessToken }),
    enabled: Boolean(selectedPlanId),
  });
  const ideas = useQuery({
    queryKey: ['meal', 'ideas'],
    queryFn: () => listMealIdeas({ accessToken }),
  });
  const plan = selectedPlanId ? selected.data : current.data;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['meal'] });

  const createWeek = useMutation({
    mutationFn: (weekStartDate: string) => createMealPlan({ weekStartDate }, { accessToken }),
    onSuccess: async (result) => {
      setSelectedPlanId(result.week.id);
      await invalidate();
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      let activePlan = plan?.week.weekStartDate === targetWeek ? plan : null;
      if (!activePlan) {
        const summary = history.data?.find((item) => item.weekStartDate === targetWeek);
        activePlan = summary
          ? await getMealPlanWeek(summary.id, { accessToken })
          : await createMealPlan({ weekStartDate: targetWeek }, { accessToken });
      }
      const entries = activePlan.entries
        .filter((item) =>
          editing
            ? item.id !== editing.id
            : !(item.weekday === weekday && item.slotIndex === slotIndex)
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
      return updateMealPlan(activePlan.week.id, { entries }, { accessToken });
    },
    onSuccess: async (result) => {
      setSelectedPlanId(result.week.id);
      closeMeal();
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: ({ planId, day, slot }: { planId: string; day: number; slot: number }) =>
      deleteMealSlot(planId, { weekday: day, slotIndex: slot }, { accessToken }),
    onSuccess: invalidate,
  });
  const copy = useMutation({
    mutationFn: () => {
      if (!plan) throw new Error('Nie wybrano planu.');
      return copyMealPlanWeek(plan.week.id, { targetWeekStartDate: targetWeek }, { accessToken });
    },
    onSuccess: async (result) => {
      setSelectedPlanId(result.week.id);
      setNotice('Skopiowano plan na wybrany tydzień.');
      await invalidate();
    },
  });
  const removeWeek = useMutation({
    mutationFn: () => deleteMealPlanWeek(plan!.week.id, { accessToken }),
    onSuccess: async () => {
      setSelectedPlanId(null);
      await invalidate();
    },
  });
  const addIdea = useMutation({
    mutationFn: () =>
      createMealIdea(
        { title: mealName.trim(), note: note || null, linkUrl: linkUrl || null },
        { accessToken }
      ),
    onSuccess: async () => {
      setIdeaOpen(false);
      resetFields();
      await queryClient.invalidateQueries({ queryKey: ['meal', 'ideas'] });
    },
  });
  const aiChat = useMutation({
    mutationFn: async () => {
      const messages: MealPlanAiMessage[] = [
        ...aiMessages,
        { role: 'user', content: aiInput.trim() },
      ];
      const response = await chatMealPlanWithAi(
        { messages, currentDraft: aiDraft, targetWeekStartDate: targetWeek },
        { accessToken }
      );
      return { messages, response };
    },
    onSuccess: ({ messages, response }) => {
      setAiMessages([...messages, { role: 'assistant', content: response.assistantMessage }]);
      if (response.entries.length) setAiDraft(response.entries);
      setAiInput('');
    },
  });
  const aiSave = useMutation({
    mutationFn: async () => {
      const response = aiMessages.some((message) => message.role === 'user')
        ? await finalizeMealPlanWithAi(
            { messages: aiMessages, currentDraft: aiDraft, targetWeekStartDate: targetWeek },
            { accessToken }
          )
        : { entries: aiDraft };
      if (!response.entries.length) throw new Error('AI nie przygotowało planu do zapisu.');
      const summary = history.data?.find((item) => item.weekStartDate === targetWeek);
      let detail = summary ? await getMealPlanWeek(summary.id, { accessToken }) : null;
      detail ??= await createMealPlan({ weekStartDate: targetWeek }, { accessToken });
      return updateMealPlan(
        detail.week.id,
        { entries: response.entries.map(({ sourceHint: _sourceHint, ...entry }) => entry) },
        { accessToken }
      );
    },
    onSuccess: async (result) => {
      setSelectedPlanId(result.week.id);
      setAiOpen(false);
      setAiDraft([]);
      setAiMessages([]);
      setAiDisclosureAccepted(false);
      setPendingAiAction(null);
      await invalidate();
    },
  });

  const weekOptions = useMemo(() => {
    const map = new Map((history.data ?? []).map((item) => [item.id, item]));
    if (current.data)
      map.set(current.data.week.id, {
        ...current.data.week,
        entriesCount: current.data.entries.length,
        entriesByWeekday: {},
      });
    return [...map.values()].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  }, [current.data, history.data]);

  function resetFields() {
    setMealName('');
    setNote('');
    setLinkUrl('');
  }
  function closeMeal() {
    setOpen(false);
    setEditing(null);
    resetFields();
  }
  function openCreate(day = 1) {
    setEditing(null);
    resetFields();
    setTargetWeek(plan?.week.weekStartDate ?? weekStartIso());
    setWeekday(day);
    const usedSlots = new Set(
      (plan?.entries ?? []).filter((entry) => entry.weekday === day).map((entry) => entry.slotIndex)
    );
    setSlotIndex([0, 1, 2].find((slot) => !usedSlots.has(slot)) ?? 0);
    setOpen(true);
  }
  function openEdit(entry: MealPlanEntry) {
    setEditing(entry);
    setMealName(entry.mealName);
    setNote(entry.note ?? '');
    setLinkUrl(entry.linkUrl ?? '');
    setTargetWeek(plan?.week.weekStartDate ?? weekStartIso());
    setWeekday(entry.weekday);
    setSlotIndex(entry.slotIndex);
    setOpen(true);
  }

  function closeAiPlanner() {
    setAiOpen(false);
    setAiDisclosureOpen(false);
    setAiDisclosureAccepted(false);
    setPendingAiAction(null);
    setAiInput('');
    setAiMessages([]);
    setAiDraft([]);
  }

  function requestAiAction(action: 'chat' | 'save') {
    const sendsDataToAi =
      action === 'chat' || aiMessages.some((message) => message.role === 'user');
    const needsDisclosure =
      encryption.settings?.enabledModules.includes('meal_planner') && sendsDataToAi;

    if (needsDisclosure && !aiDisclosureAccepted) {
      setPendingAiAction(action);
      setAiDisclosureOpen(true);
      return;
    }

    if (action === 'chat') aiChat.mutate();
    else aiSave.mutate();
  }

  function acceptAiDisclosure() {
    const action = pendingAiAction;
    setAiDisclosureAccepted(true);
    setAiDisclosureOpen(false);
    setPendingAiAction(null);
    if (action === 'chat') aiChat.mutate();
    if (action === 'save') aiSave.mutate();
  }

  const loading = current.isLoading || (selectedPlanId ? selected.isLoading : false);
  const error = current.error ?? selected.error;

  return (
    <Page>
      <FoodNavigation
        description={
          plan
            ? `Plan posiłków · tydzień od ${shortDate(plan.week.weekStartDate)}`
            : 'Planowanie i historia tygodni.'
        }
        actions={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<Icon icon="solar:magic-stick-3-bold-duotone" />}
              disabled={!permission.canCreate}
              onClick={() => {
                setTargetWeek(plan ? nextWeekStart(plan.week.weekStartDate) : weekStartIso());
                setAiMessages([]);
                setAiDraft([]);
                setAiInput('');
                setAiDisclosureAccepted(false);
                setAiOpen(true);
              }}
            >
              Ułóż z AI
            </Button>
            <PrimaryButton disabled={!permission.canCreate} onClick={() => openCreate()}>
              Dodaj posiłek
            </PrimaryButton>
            <Stack
              direction="row"
              sx={{ p: 0.4, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
            >
              <IconButton
                size="small"
                color={layout === 'grid' ? 'primary' : 'default'}
                aria-label="Widok kafelków"
                onClick={() => setLayout('grid')}
              >
                <Icon icon="solar:widget-4-bold-duotone" />
              </IconButton>
              <IconButton
                size="small"
                color={layout === 'list' ? 'primary' : 'default'}
                aria-label="Widok listy"
                onClick={() => setLayout('list')}
              >
                <Icon icon="solar:list-bold-duotone" />
              </IconButton>
            </Stack>
          </Stack>
        }
      />
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      <SectionCard>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { md: 'center' } }}
        >
          <TextField
            select
            label="Wyświetlany tydzień"
            value={selectedPlanId ?? ''}
            onChange={(event) => setSelectedPlanId(event.target.value || null)}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">Bieżący tydzień</MenuItem>
            {weekOptions.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {shortDate(item.weekStartDate)} · {item.entriesCount} posiłków
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Tydzień docelowy"
            type="date"
            value={targetWeek}
            onChange={(event) => setTargetWeek(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button
            variant="outlined"
            disabled={!permission.canCreate || !plan || copy.isPending}
            onClick={() => copy.mutate()}
          >
            Kopiuj tydzień
          </Button>
          <Button variant="text" disabled={!permission.canCreate} onClick={() => setIdeaOpen(true)}>
            Dodaj pomysł
          </Button>
          <Box sx={{ flex: 1 }} />
          {plan && (
            <IconButton
              color="error"
              disabled={!permission.canDelete}
              onClick={() => confirmDelete('cały plan tygodnia') && removeWeek.mutate()}
            >
              <Icon icon="solar:trash-bin-trash-bold-duotone" />
            </IconButton>
          )}
        </Stack>
        {(copy.error || removeWeek.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(copy.error ?? removeWeek.error)?.message}
          </Alert>
        )}
      </SectionCard>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 3fr) minmax(280px, 1fr)' },
          gap: 2.5,
        }}
      >
        <Box>
          {loading ? (
            <LoadingView />
          ) : error ? (
            <ErrorView error={error} />
          ) : !plan ? (
            <SectionCard>
              <EmptyState
                icon="solar:chef-hat-minimalistic-bold-duotone"
                text="Nie masz jeszcze planu na ten tydzień."
              />
              <Box sx={{ textAlign: 'center' }}>
                <PrimaryButton
                  onClick={() => createWeek.mutate(targetWeek)}
                  disabled={!permission.canCreate || createWeek.isPending}
                >
                  Utwórz plan tygodnia
                </PrimaryButton>
              </Box>
            </SectionCard>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns:
                  layout === 'list'
                    ? '1fr'
                    : {
                        xs: '1fr',
                        md: 'repeat(2, minmax(0, 1fr))',
                        lg: 'repeat(3, minmax(0, 1fr))',
                      },
                gap: 2,
              }}
            >
              {weekdays.map((label, index) => {
                const meals = plan.entries
                  .filter((entry) => entry.weekday === index + 1)
                  .sort((a, b) => a.slotIndex - b.slotIndex);
                const dayDate = new Date(`${plan.week.weekStartDate}T12:00:00`);
                dayDate.setDate(dayDate.getDate() + index);
                const dayLabel = new Intl.DateTimeFormat('pl-PL', {
                  day: '2-digit',
                  month: '2-digit',
                }).format(dayDate);
                return (
                  <SectionCard key={label} sx={{ minHeight: 210 }}>
                    <Stack direction="row" sx={{ mb: 1, alignItems: 'center' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h5">{label}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {dayLabel}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={`${meals.length}/3`}
                        color={meals.length === 3 ? 'success' : 'default'}
                      />
                    </Stack>
                    {meals.length === 0 ? (
                      <EmptyState icon="solar:plate-bold-duotone" text="Brak posiłków" />
                    ) : (
                      <Stack divider={<Divider flexItem />}>
                        {meals.map((meal) => (
                          <Stack
                            key={meal.id}
                            direction="row"
                            spacing={1}
                            sx={{ py: 1.2, alignItems: 'center' }}
                          >
                            <Chip
                              size="small"
                              title={slots[meal.slotIndex]}
                              label={
                                <>
                                  <Box
                                    component="span"
                                    sx={{ display: { xs: 'inline', sm: 'none' } }}
                                  >
                                    {meal.slotIndex + 1}
                                  </Box>
                                  <Box
                                    component="span"
                                    sx={{ display: { xs: 'none', sm: 'inline' } }}
                                  >
                                    {slots[meal.slotIndex] ?? meal.slotIndex + 1}
                                  </Box>
                                </>
                              }
                              color="warning"
                            />
                            <Box
                              onClick={() => permission.canUpdate && openEdit(meal)}
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                cursor: permission.canUpdate ? 'pointer' : 'default',
                              }}
                            >
                              <Typography sx={{ fontWeight: 700 }}>{meal.mealName}</Typography>
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
                              size="small"
                              disabled={!permission.canUpdate}
                              onClick={() => openEdit(meal)}
                              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                            >
                              <Icon icon="solar:pen-bold-duotone" />
                            </IconButton>
                            <IconButton
                              color="error"
                              size="small"
                              disabled={!permission.canDelete}
                              onClick={() =>
                                confirmDelete(meal.mealName) &&
                                remove.mutate({
                                  planId: plan.week.id,
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
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Icon icon="solar:plate-bold-duotone" />}
                      disabled={!permission.canCreate}
                      onClick={() => openCreate(index + 1)}
                      sx={{ mt: 1.5 }}
                    >
                      Dodaj
                    </Button>
                  </SectionCard>
                );
              })}
            </Box>
          )}
        </Box>
        <SectionCard title="Pomysły na posiłki">
          {ideas.isLoading ? (
            <LoadingView />
          ) : (ideas.data?.length ?? 0) === 0 ? (
            <EmptyState text="Dodaj bazę ulubionych dań." />
          ) : (
            <Stack divider={<Divider flexItem />}>
              {ideas.data?.map((idea) => (
                <Box key={idea.id} sx={{ py: 1.2 }}>
                  <Typography sx={{ fontWeight: 700 }}>{idea.title}</Typography>
                  {idea.note && (
                    <Typography variant="body2" color="text.secondary">
                      {idea.note}
                    </Typography>
                  )}
                  {idea.linkUrl && (
                    <Button size="small" component="a" href={idea.linkUrl} target="_blank">
                      Przepis
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>
      </Box>
      <FormDialog
        title={editing ? 'Edytuj posiłek' : 'Dodaj posiłek'}
        subtitle="Wybierz tydzień, dzień i miejsce w planie."
        icon="solar:chef-hat-heart-bold-duotone"
        open={open}
        onClose={closeMeal}
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        submitDisabled={!mealName.trim() || !targetWeek}
      >
        {save.error && <Alert severity="error">{save.error.message}</Alert>}
        <TextField
          label="Tydzień"
          type="date"
          value={targetWeek}
          onChange={(event) => setTargetWeek(event.target.value)}
          disabled={Boolean(editing)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select
          label="Dzień"
          value={weekday}
          onChange={(event) => setWeekday(Number(event.target.value))}
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
          onChange={(event) => setSlotIndex(Number(event.target.value))}
        >
          {slots.map((label, index) => (
            <MenuItem key={label} value={index}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Nazwa posiłku"
          value={mealName}
          onChange={(event) => setMealName(event.target.value)}
          required
          autoFocus
        />
        <TextField
          label="Notatka"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          multiline
          minRows={2}
        />
        <TextField
          label="Link do przepisu"
          type="url"
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
        />
      </FormDialog>
      <FormDialog
        title="Nowy pomysł"
        subtitle="Zapisz ulubione danie na później."
        icon="solar:lightbulb-bolt-bold-duotone"
        open={ideaOpen}
        onClose={() => {
          setIdeaOpen(false);
          resetFields();
        }}
        onSubmit={() => addIdea.mutate()}
        loading={addIdea.isPending}
        submitDisabled={!mealName.trim()}
      >
        {addIdea.error && <Alert severity="error">{addIdea.error.message}</Alert>}
        <TextField
          label="Nazwa dania"
          value={mealName}
          onChange={(event) => setMealName(event.target.value)}
          autoFocus
        />
        <TextField
          label="Notatka"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          multiline
          minRows={2}
        />
        <TextField
          label="Link do przepisu"
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
        />
      </FormDialog>
      <FormDialog
        title="Asystent planowania posiłków"
        subtitle="Ułóż cały tydzień na podstawie swoich potrzeb."
        icon="solar:magic-stick-3-bold-duotone"
        open={aiOpen}
        onClose={closeAiPlanner}
        onSubmit={() => requestAiAction('save')}
        loading={aiSave.isPending}
        submitLabel="Zapisz plan"
        submitDisabled={aiDraft.length === 0}
        maxWidth="md"
      >
        {(aiChat.error || aiSave.error) && (
          <Alert severity="error">{(aiChat.error ?? aiSave.error)?.message}</Alert>
        )}
        <TextField
          label="Tydzień docelowy"
          type="date"
          value={targetWeek}
          onChange={(event) => setTargetWeek(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Stack spacing={1} sx={{ maxHeight: 240, overflowY: 'auto' }}>
          {aiMessages.map((message, index) => (
            <Box
              key={`${message.role}-${index}`}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: message.role === 'user' ? 'primary.lighter' : 'background.neutral',
                alignSelf: message.role === 'user' ? 'flex-end' : 'stretch',
              }}
            >
              {message.role === 'assistant' ? (
                <Markdown
                  skipHtml
                  sx={{
                    typography: 'body2',
                    '& p': { m: 0 },
                    '& p + p, & ul, & ol': { mt: 1 },
                    '& li': { lineHeight: 1.6 },
                  }}
                >
                  {message.content}
                </Markdown>
              ) : (
                <Typography variant="body2">{message.content}</Typography>
              )}
            </Box>
          ))}
        </Stack>
        {aiDraft.length > 0 && (
          <Alert severity="info">
            Gotowy szkic: {aiDraft.length} posiłków. Możesz go doprecyzować albo od razu zapisać.
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            fullWidth
            label="Napisz, czego potrzebujesz"
            value={aiInput}
            onChange={(event) => setAiInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                aiInput.trim() &&
                !aiChat.isPending
              ) {
                event.preventDefault();
                requestAiAction('chat');
              }
            }}
            placeholder="Np. szybkie obiady, bez ryb, dla 4 osób"
          />
          <Button
            variant="contained"
            disabled={!aiInput.trim() || aiChat.isPending}
            onClick={() => requestAiAction('chat')}
          >
            Wyślij
          </Button>
        </Stack>
      </FormDialog>
      <FormDialog
        title="Wysłać dane do AI?"
        subtitle="Ta operacja wymaga jawnej zgody przy włączonym szyfrowaniu."
        icon="solar:shield-warning-bold-duotone"
        open={aiDisclosureOpen}
        onClose={() => {
          setAiDisclosureOpen(false);
          setPendingAiAction(null);
        }}
        onSubmit={acceptAiDisclosure}
        submitLabel="Zgadzam się i wyślij"
      >
        <Alert severity="warning">
          Udostępniasz treść chronioną szyfrowaniem. Na potrzeby tej funkcji zostanie ona
          odszyfrowana i wysłana do zewnętrznej usługi AI.
        </Alert>
      </FormDialog>
    </Page>
  );
}
