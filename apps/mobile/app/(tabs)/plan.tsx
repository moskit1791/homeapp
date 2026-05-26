import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModuleKey } from "@homeapp/shared-types";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Lightbulb,
  NotebookText,
  Pencil,
  Trash2,
  Utensils,
} from "../../src/ui/icon";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  completeTodoItem,
  copyMealPlanWeek,
  createCalendarEvent,
  createMealPlan,
  createNote,
  createTodoItem,
  deleteMealPlanWeek,
  deleteNote,
  deleteTodoItem,
  drawMealInspirations,
  getCurrentMealPlanWeek,
  getMealPlanWeek,
  getMyHousehold,
  listCalendarEvents,
  listCalendarUpcoming,
  listMealPlanHistory,
  listNotes,
  listTodoItems,
  queryKeys,
  reopenTodoItem,
  updateNote,
  type CalendarEvent,
  type EffectivePermission,
  type MealPlanEntry,
  type MealPlanSummary,
  type Note,
  type TodoItem,
  upsertMealSlot,
} from "../../src/api";
import {
  hasModuleRead,
  usePermissions,
} from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import { useDebouncedOptimisticToggle } from "../../src/utils/use-debounced-optimistic-toggle";
import {
  ActionButton,
  AppScreen,
  FormModal,
  IconButton,
  InlineAlert,
  QueryState,
  SectionCard,
} from "../../src/ui";

type SegmentKey = "food" | "calendar" | "todo" | "notes";

const segments: Array<{
  key: SegmentKey;
  label: string;
  moduleKey: ModuleKey;
}> = [
  { key: "food", label: "Jedzenie", moduleKey: "meal_planner" },
  { key: "calendar", label: "Kalendarz", moduleKey: "calendar" },
  { key: "todo", label: "Do zrobienia", moduleKey: "todo" },
  { key: "notes", label: "Notatki", moduleKey: "notes" },
];

function setTodoDoneValue(item: TodoItem, done: boolean): TodoItem {
  const now = new Date().toISOString();

  return {
    ...item,
    doneAt: done ? now : null,
    status: done ? "done" : "todo",
    updatedAt: now,
  };
}

export default function PlanScreen() {
  const { session } = useSession();
  const params = useLocalSearchParams<{ action?: string }>();
  const permissionsQuery = usePermissions();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [activeSegment, setActiveSegment] = useState<SegmentKey>("food");
  const [handledRouteAction, setHandledRouteAction] = useState<string | null>(null);
  const permissions = permissionsQuery.data;
  const accessToken = session?.accessToken;

  const canUsePlan = hasModuleRead(permissions, [
    "meal_planner",
    "calendar",
    "todo",
    "notes",
  ]);
  const activeConfig =
    segments.find((segment) => segment.key === activeSegment) ?? segments[0]!;
  const activePermission = getPermission(permissions, activeConfig.moduleKey);
  const readableSegments = segments.filter(
    (segment) => getPermission(permissions, segment.moduleKey).canRead,
  );

  useEffect(() => {
    if (!permissionsQuery.isSuccess) {
      return;
    }

    const currentCanRead = getPermission(
      permissions,
      activeConfig.moduleKey,
    ).canRead;
    const firstReadable = segments.find(
      (segment) => getPermission(permissions, segment.moduleKey).canRead,
    );

    if (!currentCanRead && firstReadable) {
      setActiveSegment(firstReadable.key);
    }
  }, [activeConfig.moduleKey, permissions, permissionsQuery.isSuccess]);

  useEffect(() => {
    if (!params.action) {
      setHandledRouteAction(null);
      return;
    }

    if (!permissionsQuery.isSuccess || !params.action || handledRouteAction === params.action) {
      return;
    }

    if (params.action === "meal" && getPermission(permissions, "meal_planner").canRead) {
      setActiveSegment("food");
      setHandledRouteAction(params.action);
      return;
    }

    if (params.action === "note" && getPermission(permissions, "notes").canRead) {
      setActiveSegment("notes");
      setHandledRouteAction(params.action);
    }
  }, [handledRouteAction, params.action, permissions, permissionsQuery.isSuccess]);

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Plan">
        <SectionCard title="Ładowanie planu">
          <QueryState isLoading />
        </SectionCard>
      </AppScreen>
    );
  }

  if (!canUsePlan) {
    return (
      <AppScreen title="Plan">
        <SectionCard title="Brak dostępu">
          <InlineAlert text="Nie masz uprawnień do modułów planu." />
        </SectionCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      subtitle="Jedzenie, kalendarz, wspólne do zrobienia i prywatne notatki."
      title="Plan"
    >
      <View style={styles.moduleStrip}>
        {readableSegments.map((segment) => {
          const active = segment.key === activeSegment;
          const accent = getSegmentAccent(theme.colors, segment.key);

          return (
            <Pressable
              key={segment.key}
              onPress={() => setActiveSegment(segment.key)}
              style={[
                styles.moduleTile,
                active && styles.moduleTileActive,
                { borderTopColor: accent.color },
              ]}
            >
              <View
                style={[styles.moduleIcon, { backgroundColor: accent.soft }]}
              >
                {getSegmentIcon(
                  segment.key,
                  active ? accent.color : theme.colors.textMuted,
                  17,
                )}
              </View>
              <Text
                style={[styles.moduleLabel, active && styles.moduleLabelActive]}
              >
                {segment.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!activePermission.canRead ? (
        <NoAccess moduleName={activeConfig.label} />
      ) : activeSegment === "food" ? (
        <FoodSegment
          accessToken={accessToken}
          canCreate={activePermission.canCreate}
          canDelete={activePermission.canDelete}
          canUpdate={activePermission.canUpdate}
          openCreateAction={params.action === "meal" && handledRouteAction === "meal"}
          onCreateActionHandled={() => router.setParams({ action: undefined })}
        />
      ) : activeSegment === "calendar" ? (
        <CalendarSegment
          accessToken={accessToken}
          canCreate={activePermission.canCreate}
        />
      ) : activeSegment === "todo" ? (
        <TodoSegment
          accessToken={accessToken}
          canCreate={activePermission.canCreate}
          canDelete={activePermission.canDelete}
          canUpdate={activePermission.canUpdate}
        />
      ) : (
        <NotesSegment
          accessToken={accessToken}
          canCreate={activePermission.canCreate}
          canDelete={activePermission.canDelete}
          canUpdate={activePermission.canUpdate}
          openCreateAction={params.action === "note" && handledRouteAction === "note"}
          onCreateActionHandled={() => router.setParams({ action: undefined })}
        />
      )}
    </AppScreen>
  );
}

function FoodSegment({
  accessToken,
  canCreate,
  canDelete,
  canUpdate,
  onCreateActionHandled,
  openCreateAction,
}: {
  accessToken?: string | null;
  canCreate: boolean;
  canDelete: boolean;
  canUpdate: boolean;
  onCreateActionHandled?: () => void;
  openCreateAction?: boolean;
}) {
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [weekday, setWeekday] = useState(1);
  const [slotIndex, setSlotIndex] = useState(0);
  const [mealName, setMealName] = useState("");
  const [note, setNote] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [weekStartInput, setWeekStartInput] = useState(currentWeekRange().from);
  const [deletePlanConfirmVisible, setDeletePlanConfirmVisible] =
    useState(false);
  const [mealModalVisible, setMealModalVisible] = useState(false);

  const householdQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: [...queryKeys.household, "me"],
  });
  const currentQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getCurrentMealPlanWeek({ accessToken }),
    queryKey: [...queryKeys.meal, "current"],
  });
  const historyQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listMealPlanHistory({ accessToken }),
    queryKey: [...queryKeys.meal, "history"],
  });
  const selectedPlanQuery = useQuery({
    enabled:
      Boolean(accessToken) &&
      Boolean(selectedPlanId) &&
      selectedPlanId !== currentQuery.data?.week.id,
    queryFn: () => getMealPlanWeek(selectedPlanId ?? "", { accessToken }),
    queryKey: [...queryKeys.meal, "detail", selectedPlanId],
  });
  const history = historyQuery.data ?? [];
  const activePlan =
    selectedPlanId && selectedPlanId !== currentQuery.data?.week.id
      ? selectedPlanQuery.data
      : currentQuery.data;
  const inspirationQuery = useQuery({
    enabled: false,
    queryFn: () =>
      drawMealInspirations(
        {
          slotIndex,
          targetWeekStartDate: activePlan?.week.weekStartDate,
          weekday,
        },
        { accessToken },
      ),
    queryKey: [...queryKeys.meal, "inspirations", activePlan?.week.weekStartDate, weekday, slotIndex],
  });

  useEffect(() => {
    if (selectedPlanId) {
      return;
    }

    const nextPlanId = currentQuery.data?.week.id ?? history[0]?.id;

    if (nextPlanId) {
      setSelectedPlanId(nextPlanId);
    }
  }, [currentQuery.data?.week.id, history, selectedPlanId]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const currentPlan =
        activePlan ??
        (await createMealPlan(
          { weekStartDate: normalizeWeekStartDate(weekStartInput) },
          { accessToken },
        ));
      const weekId = currentPlan?.week?.id;

      if (!weekId) {
        throw new Error("Missing meal plan week");
      }

      return upsertMealSlot(
        weekId,
        [
          {
            mealName: mealName.trim(),
            note: note.trim() || null,
            slotIndex,
            weekday,
          },
        ],
        { accessToken },
      );
    },
    onSuccess: async (plan) => {
      setSelectedPlanId(plan.week.id);
      setMealName("");
      setNote("");
      setMealModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.meal });
    },
  });

  const createWeekMutation = useMutation({
    mutationFn: () =>
      createMealPlan(
        { weekStartDate: normalizeWeekStartDate(weekStartInput) },
        { accessToken },
      ),
    onSuccess: async (plan) => {
      setSelectedPlanId(plan.week.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.meal });
    },
  });

  const copyMutation = useMutation({
    mutationFn: () => {
      const current = activePlan;

      if (!current) {
        throw new Error("Missing current meal plan");
      }

      return copyMealPlanWeek(
        current.week.id,
        { targetWeekStartDate: addDays(current.week.weekStartDate, 7) },
        { accessToken },
      );
    },
    onSuccess: async (plan) => {
      setSelectedPlanId(plan.week.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.meal });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: () => {
      const current = activePlan;

      if (!current) {
        throw new Error("Missing current meal plan");
      }

      return deleteMealPlanWeek(current.week.id, { accessToken });
    },
    onSuccess: async () => {
      setSelectedPlanId(null);
      setDeletePlanConfirmVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.meal });
    },
  });

  const entries = activePlan?.entries ?? [];
  const suggestions = inspirationQuery.data?.suggestions ?? [];
  const mealSlots = buildMealSlotIndexes(householdQuery.data?.mealSlotsPerDay);
  const canSave =
    canUpdate && Boolean(mealName.trim()) && !upsertMutation.isPending;

  useEffect(() => {
    if (!openCreateAction || !canUpdate) {
      return;
    }

    setMealModalVisible(true);
    onCreateActionHandled?.();
  }, [canUpdate, onCreateActionHandled, openCreateAction]);

  return (
    <>
      <Toolbar
        action={
          <View style={styles.toolbarActionGroup}>
            {canUpdate ? (
              <ActionButton
                onPress={() => setMealModalVisible(true)}
                size="small"
                title="+ Dodaj"
              />
            ) : null}
            {canDelete ? (
              <IconButton
                disabled={!activePlan || deletePlanMutation.isPending}
                onPress={() => setDeletePlanConfirmVisible(true)}
              >
                <Trash2 color={theme.colors.danger} size={18} />
              </IconButton>
            ) : null}
          </View>
        }
        title="Plan posiłków"
      />
      <SectionCard
        icon={<Utensils color={theme.colors.food} size={18} />}
        subtitle={
          activePlan?.week.weekStartDate
            ? `Od ${formatDate(activePlan.week.weekStartDate)}`
            : "Wybierz albo utwórz tydzień"
        }
        title="Tydzień"
      >
        <QueryState
          emptyText="Brak wpisów w planie."
          error={currentQuery.error ?? selectedPlanQuery.error}
          isEmpty={!currentQuery.isLoading && !selectedPlanQuery.isLoading && entries.length === 0}
          isLoading={currentQuery.isLoading || selectedPlanQuery.isLoading}
        />
        <View style={styles.itemList}>
          {groupMealEntries(entries).map((item) => (
            <View
              key={`${item.weekday}-${item.slotIndex}`}
              style={styles.itemRow}
            >
              <View style={styles.itemContent}>
                <Text style={styles.itemName}>{item.mealName}</Text>
                <Text style={styles.itemQuantity}>
                  {weekdayLabel(item.weekday)}, posiłek {item.slotIndex + 1}
                </Text>
                {item.note ? (
                  <Text style={styles.muted}>{item.note}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </SectionCard>

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setMealModalVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canSave}
              loading={upsertMutation.isPending}
              onPress={() => upsertMutation.mutate()}
              style={styles.modalFooterButton}
              title="Zapisz"
            />
          </View>
        }
        onClose={() => setMealModalVisible(false)}
        subtitle="Wybierz dzień i numer posiłku, potem wpisz nazwę."
        title="Ustaw posiłek"
        visible={mealModalVisible}
      >
        <View style={styles.chips}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <Chip
              active={weekday === day}
              key={day}
              onPress={() => setWeekday(day)}
              title={weekdayShort(day)}
            />
          ))}
        </View>
        <View style={styles.chips}>
          {mealSlots.map((slot) => (
            <Chip
              active={slotIndex === slot}
              key={slot}
              onPress={() => setSlotIndex(slot)}
              title={`Posiłek ${slot + 1}`}
            />
          ))}
        </View>
        <TextInput
          onChangeText={setMealName}
          placeholder="Nazwa posiłku"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={mealName}
        />
        <TextInput
          multiline
          onChangeText={setNote}
          placeholder="Notatka lub link"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={note}
        />
        <ActionButton
          disabled={inspirationQuery.isFetching}
          onPress={() => inspirationQuery.refetch()}
          title="Losuj inspiracje"
          variant="secondary"
        />
        {upsertMutation.error ? (
          <InlineAlert text="Nie udało się zapisać posiłku." tone="error" />
        ) : null}
      </FormModal>

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setDeletePlanConfirmVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!activePlan}
              loading={deletePlanMutation.isPending}
              onPress={() => deletePlanMutation.mutate()}
              style={styles.modalFooterButton}
              title="Usuń"
            />
          </View>
        }
        onClose={() => setDeletePlanConfirmVisible(false)}
        subtitle={
          activePlan?.week.weekStartDate
            ? `Tydzień od ${formatDate(activePlan.week.weekStartDate)} zostanie usunięty razem z posiłkami.`
            : "Brak aktywnego planu do usunięcia."
        }
        title="Usuń plan posiłków"
        visible={deletePlanConfirmVisible}
      >
        <View style={styles.deleteWarning}>
          <Trash2 color={theme.colors.danger} size={18} />
          <Text style={styles.deleteWarningText}>
            Ta akcja usuwa cały tydzień planu posiłków. Nie usuwa inspiracji ani historii innych tygodni.
          </Text>
        </View>
        {deletePlanMutation.error ? (
          <InlineAlert text="Nie udało się usunąć planu posiłków." tone="error" />
        ) : null}
      </FormModal>

      {suggestions.length ? (
        <SectionCard
          icon={<Lightbulb color={theme.colors.food} size={18} />}
          title="Inspiracje"
        >
          {suggestions.slice(0, 5).map((suggestion) => (
            <View
              key={`${suggestion.sourceWeekStartDate}-${suggestion.mealName}`}
              style={styles.compactRow}
            >
              <Text style={styles.itemName}>{suggestion.mealName}</Text>
              <Text style={styles.itemQuantity}>
                Z tygodnia {formatDate(suggestion.sourceWeekStartDate)}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      {canCreate ? (
        <SectionCard title="Historia">
          <View style={styles.weekPicker}>
            <TextInput
              onChangeText={setWeekStartInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textSubtle}
              style={[styles.input, styles.weekInput]}
              value={weekStartInput}
            />
            <ActionButton
              disabled={!/^\d{4}-\d{2}-\d{2}$/.test(weekStartInput) || createWeekMutation.isPending}
              loading={createWeekMutation.isPending}
              onPress={() => createWeekMutation.mutate()}
              title="Utwórz tydzień"
              variant="secondary"
            />
          </View>
          {createWeekMutation.error ? (
            <InlineAlert text="Nie udało się utworzyć tygodnia. Podaj datę z wybranego tygodnia." tone="error" />
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {history.map((week) => (
                <Chip
                  active={selectedPlanId === week.id}
                  key={week.id}
                  onPress={() => setSelectedPlanId(week.id)}
                  title={formatDate(week.weekStartDate)}
                />
              ))}
            </View>
          </ScrollView>
          <View style={styles.itemList}>
            {history.map((week) => (
              <HistoryRow
                active={selectedPlanId === week.id}
                key={week.id}
                onPress={() => setSelectedPlanId(week.id)}
                week={week}
              />
            ))}
          </View>
          {history.length === 0 ? (
            <InlineAlert text="Brak zapisanych tygodni." />
          ) : null}
          <ActionButton
            disabled={!activePlan || copyMutation.isPending}
            loading={copyMutation.isPending}
            onPress={() => copyMutation.mutate()}
            title="Skopiuj na kolejny tydzień"
            variant="secondary"
          />
          {copyMutation.error ? (
            <InlineAlert
              text="Nie udało się skopiować tygodnia."
              tone="error"
            />
          ) : null}
        </SectionCard>
      ) : null}
    </>
  );
}

function CalendarSegment({
  accessToken,
  canCreate,
}: {
  accessToken?: string | null;
  canCreate: boolean;
}) {
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(todayDate());
  const [eventTime, setEventTime] = useState("");
  const [note, setNote] = useState("");
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const range = useMemo(() => currentWeekRange(), []);

  const upcomingQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listCalendarUpcoming(8, { accessToken }),
    queryKey: [...queryKeys.calendar, "upcoming"],
  });
  const weekQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listCalendarEvents(range.from, range.to, { accessToken }),
    queryKey: [...queryKeys.calendar, "week", range.from, range.to],
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createCalendarEvent(
        {
          eventDate,
          eventTime: normalizeEventTime(eventTime),
          note: note.trim() || null,
          scopeType: "household",
          title: title.trim(),
        },
        { accessToken },
      ),
    onSuccess: async () => {
      setTitle("");
      setEventTime("");
      setNote("");
      setEventModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar });
    },
  });

  const canSave =
    canCreate &&
    Boolean(title.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(eventDate) &&
    isOptionalTimeInputValid(eventTime);

  return (
    <>
      <Toolbar
        action={
          canCreate ? (
            <ActionButton
              onPress={() => setEventModalVisible(true)}
              size="small"
              title="+ Dodaj"
            />
          ) : undefined
        }
        title="Kalendarz"
      />

      <EventList
        emptyText="Brak najbliższych wydarzeń."
        events={upcomingQuery.data ?? []}
        icon={<CalendarDays color={theme.colors.calendar} size={18} />}
        query={upcomingQuery}
        title="Nadchodzące"
      />
      <EventList
        emptyText="Brak wydarzeń w tym tygodniu."
        events={weekQuery.data ?? []}
        icon={<CalendarDays color={theme.colors.calendar} size={18} />}
        query={weekQuery}
        title={`Ten tydzień: ${formatDate(range.from)}-${formatDate(range.to)}`}
      />
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setEventModalVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canSave}
              loading={createMutation.isPending}
              onPress={() => createMutation.mutate()}
              style={styles.modalFooterButton}
              title="Dodaj"
            />
          </View>
        }
        onClose={() => setEventModalVisible(false)}
        subtitle="Wpis trafi do kalendarza domowego."
        title="Dodaj wydarzenie"
        visible={eventModalVisible}
      >
        <TextInput
          onChangeText={setTitle}
          placeholder="Tytuł"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={title}
        />
        <View style={styles.formRow}>
          <TextInput
            onChangeText={setEventDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.flex]}
            value={eventDate}
          />
          <TextInput
            keyboardType="number-pad"
            maxLength={5}
            onChangeText={(value) => setEventTime(formatTimeInput(value))}
            placeholder="HH:mm"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.timeInput]}
            value={eventTime}
          />
        </View>
        <TextInput
          multiline
          onChangeText={setNote}
          placeholder="Notatka"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={note}
        />
        {createMutation.error ? (
          <InlineAlert text="Nie udało się dodać wydarzenia." tone="error" />
        ) : null}
      </FormModal>
    </>
  );
}

function TodoSegment({
  accessToken,
  canCreate,
  canDelete,
  canUpdate,
}: {
  accessToken?: string | null;
  canCreate: boolean;
  canDelete: boolean;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [todoModalVisible, setTodoModalVisible] = useState(false);
  const [toggleError, setToggleError] = useState("");
  const todoItemsQueryKey = useMemo(() => [...queryKeys.todo, "items"] as const, []);
  const todoQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listTodoItems(undefined, { accessToken }),
    queryKey: todoItemsQueryKey,
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createTodoItem(
        {
          description: description.trim(),
          scopeType: "household",
          title: title.trim(),
        },
        { accessToken },
      ),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setTodoModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.todo });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const todoToggle = useDebouncedOptimisticToggle<TodoItem>({
    getId: (item) => item.id,
    getValue: (item) => item.status === "done",
    onError: () => {
      setToggleError("Nie udało się zapisać zmiany. Cofnąłem stan zadania.");
      setTimeout(() => setToggleError(""), 2600);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.todo });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
    queryClient,
    queryKey: todoItemsQueryKey,
    setValue: setTodoDoneValue,
    sync: (id, done) =>
      done ? completeTodoItem(id, { accessToken }) : reopenTodoItem(id, { accessToken }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodoItem(id, { accessToken }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.todo });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });

  const items = todoQuery.data ?? [];
  const openItems = items.filter((item) => item.status !== "done");
  const doneItems = items.filter((item) => item.status === "done");

  return (
    <>
      <Toolbar
        action={
          canCreate ? (
            <ActionButton
              onPress={() => setTodoModalVisible(true)}
              size="small"
              title="+ Dodaj"
            />
          ) : undefined
        }
        title="Do zrobienia"
      />
      <SectionCard
        icon={<CheckCircle2 color={theme.colors.primary} size={18} />}
        subtitle="Wspólna lista dla całego domu."
        title="Do zrobienia"
      >
        <QueryState
          emptyText="Brak rzeczy do zrobienia."
          error={todoQuery.error}
          isEmpty={!todoQuery.isLoading && items.length === 0}
          isLoading={todoQuery.isLoading}
        />
        {toggleError ? <InlineAlert text={toggleError} tone="error" /> : null}
        <View style={styles.itemList}>
          {[...openItems, ...doneItems].map((item) => (
            <TodoRow
              canDelete={canDelete}
              canUpdate={canUpdate}
              deleting={deleteMutation.isPending}
              item={item}
              key={item.id}
              onDelete={() => {
                todoToggle.cancel(item.id);
                deleteMutation.mutate(item.id);
              }}
              onToggle={() => todoToggle.toggle(item.id)}
              updating={todoToggle.isSyncing(item.id)}
            />
          ))}
        </View>
      </SectionCard>
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setTodoModalVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!title.trim()}
              loading={createMutation.isPending}
              onPress={() => createMutation.mutate()}
              style={styles.modalFooterButton}
              title="Dodaj"
            />
          </View>
        }
        onClose={() => setTodoModalVisible(false)}
        subtitle="Po zapisaniu będzie widoczne dla wszystkich domowników."
        title="Nowe do zrobienia"
        visible={todoModalVisible}
      >
        <TextInput
          onChangeText={setTitle}
          placeholder="Tytuł"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={title}
        />
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="Opis"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={description}
        />
        {createMutation.error ? (
          <InlineAlert text="Nie udało się dodać rzeczy do zrobienia." tone="error" />
        ) : null}
      </FormModal>
    </>
  );
}

function NotesSegment({
  accessToken,
  canCreate,
  canDelete,
  canUpdate,
  onCreateActionHandled,
  openCreateAction,
}: {
  accessToken?: string | null;
  canCreate: boolean;
  canDelete: boolean;
  canUpdate: boolean;
  onCreateActionHandled?: () => void;
  openCreateAction?: boolean;
}) {
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const notesQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listNotes({ accessToken }),
    queryKey: queryKeys.notes,
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createNote(
        { description: description.trim(), title: title.trim() },
        { accessToken },
      ),
    onSuccess: async () => {
      resetNoteForm();
      setNoteModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    },
  });
  const updateMutation = useMutation({
    mutationFn: () =>
      updateNote(
        editingId ?? "",
        { description: description.trim(), title: title.trim() },
        { accessToken },
      ),
    onSuccess: async () => {
      resetNoteForm();
      setNoteModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id, { accessToken }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notes }),
  });

  const notes = notesQuery.data ?? [];
  const isEditing = Boolean(editingId);

  function resetNoteForm() {
    setDescription("");
    setEditingId(null);
    setTitle("");
  }

  function editNote(note: Note) {
    setDescription(note.description ?? "");
    setEditingId(note.id);
    setTitle(note.title);
    setNoteModalVisible(true);
  }

  function closeNoteModal() {
    resetNoteForm();
    setNoteModalVisible(false);
  }

  useEffect(() => {
    if (!openCreateAction || !canCreate) {
      return;
    }

    resetNoteForm();
    setNoteModalVisible(true);
    onCreateActionHandled?.();
  }, [canCreate, onCreateActionHandled, openCreateAction]);

  return (
    <>
      <Toolbar
        action={
          canCreate ? (
            <ActionButton
              onPress={() => setNoteModalVisible(true)}
              size="small"
              title="+ Dodaj"
            />
          ) : undefined
        }
        title="Notatki prywatne"
      />
      <SectionCard
        icon={<NotebookText color={theme.colors.shopping} size={18} />}
        subtitle="Widoczne tylko dla Ciebie."
        title="Moje notatki"
      >
        <QueryState
          emptyText="Brak notatek."
          error={notesQuery.error}
          isEmpty={!notesQuery.isLoading && notes.length === 0}
          isLoading={notesQuery.isLoading}
        />
        <View style={styles.itemList}>
          {notes.map((note) => (
            <NoteRow
              canDelete={canDelete}
              canUpdate={canUpdate}
              deleting={deleteMutation.isPending}
              key={note.id}
              note={note}
              onDelete={() => deleteMutation.mutate(note.id)}
              onEdit={() => editNote(note)}
            />
          ))}
        </View>
      </SectionCard>
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={closeNoteModal}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!title.trim() || (isEditing && !canUpdate)}
              loading={createMutation.isPending || updateMutation.isPending}
              onPress={() =>
                isEditing ? updateMutation.mutate() : createMutation.mutate()
              }
              style={styles.modalFooterButton}
              title={isEditing ? "Zapisz" : "Dodaj"}
            />
          </View>
        }
        onClose={closeNoteModal}
        subtitle={
          isEditing
            ? "Edytujesz swoją prywatną notatkę."
            : "Nowa notatka będzie widoczna tylko dla Ciebie."
        }
        title={isEditing ? "Edytuj notatkę" : "Nowa notatka"}
        visible={noteModalVisible}
      >
        <TextInput
          onChangeText={setTitle}
          placeholder="Tytuł"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={title}
        />
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="Treść"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.largeTextArea]}
          value={description}
        />
        {createMutation.error || updateMutation.error ? (
          <InlineAlert text="Nie udało się zapisać notatki." tone="error" />
        ) : null}
      </FormModal>
    </>
  );
}

function EventList({
  emptyText,
  events,
  icon,
  query,
  title,
}: {
  emptyText: string;
  events: CalendarEvent[];
  icon?: ReactNode;
  query: { error: unknown; isLoading: boolean };
  title: string;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <SectionCard icon={icon} title={title}>
      <QueryState
        emptyText={emptyText}
        error={query.error}
        isEmpty={!query.isLoading && events.length === 0}
        isLoading={query.isLoading}
      />
      <View style={styles.itemList}>
        {events.map((event) => (
          <View key={event.id} style={styles.itemRow}>
            <View style={styles.itemContent}>
              <Text style={styles.itemName}>{event.title}</Text>
              <Text style={styles.itemQuantity}>
                {[formatDate(event.eventDate), event.eventTime?.slice(0, 5)]
                  .filter(Boolean)
                  .join(" - ")}
              </Text>
              {event.note ? (
                <Text style={styles.muted}>{event.note}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

function TodoRow({
  canDelete,
  canUpdate,
  deleting,
  item,
  onDelete,
  onToggle,
  updating,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  deleting: boolean;
  item: TodoItem;
  onDelete: () => void;
  onToggle: () => void;
  updating: boolean;
}) {
  const isDone = item.status === "done";
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <View style={[styles.itemRow, isDone && styles.itemRowChecked]}>
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, isDone && styles.itemNameChecked]}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={styles.muted}>{item.description}</Text>
        ) : null}
      </View>
      <View style={styles.itemActions}>
        <IconButton disabled={!canUpdate || updating} onPress={onToggle}>
          <Check color={theme.colors.primary} size={17} />
        </IconButton>
        {canDelete ? (
          <IconButton disabled={deleting} onPress={onDelete}>
            <Trash2 color={theme.colors.danger} size={17} />
          </IconButton>
        ) : null}
      </View>
    </View>
  );
}

function NoteRow({
  canDelete,
  canUpdate,
  deleting,
  note,
  onDelete,
  onEdit,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  deleting: boolean;
  note: Note;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{note.title}</Text>
        {note.description ? (
          <Text numberOfLines={3} style={styles.muted}>
            {note.description}
          </Text>
        ) : null}
        <Text style={styles.itemQuantity}>
          Aktualizacja {formatDateTime(note.updatedAt)}
        </Text>
      </View>
      <View style={styles.itemActions}>
        {canUpdate ? (
          <IconButton onPress={onEdit}>
            <Pencil color={theme.colors.primary} size={17} />
          </IconButton>
        ) : null}
        {canDelete ? (
          <IconButton disabled={deleting} onPress={onDelete}>
            <Trash2 color={theme.colors.danger} size={17} />
          </IconButton>
        ) : null}
      </View>
    </View>
  );
}

function Toolbar({
  action,
  title,
}: {
  action?: ReactNode;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <View style={styles.toolbar}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.toolbarActions}>
        {action}
      </View>
    </View>
  );
}

function HistoryRow({
  active,
  onPress,
  week,
}: {
  active: boolean;
  onPress: () => void;
  week: MealPlanSummary;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <Pressable onPress={onPress} style={[styles.compactRow, active && styles.compactRowActive]}>
      <Text style={styles.itemName}>
        Tydzień od {formatDate(week.weekStartDate)}
      </Text>
      <Text style={styles.itemQuantity}>{week.entriesCount} wpisów</Text>
    </Pressable>
  );
}

function Chip({
  active,
  onPress,
  title,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {title}
      </Text>
    </Pressable>
  );
}

function NoAccess({ moduleName }: { moduleName: string }) {
  return (
    <SectionCard title="Brak dostępu">
      <InlineAlert text={`Nie masz uprawnienia do sekcji ${moduleName}.`} />
    </SectionCard>
  );
}

function getPermission(
  permissions: EffectivePermission[] | undefined,
  moduleKey: ModuleKey,
) {
  const permission = permissions?.find((item) => item.moduleKey === moduleKey);

  return {
    canCreate: Boolean(permission?.canCreate),
    canDelete: Boolean(permission?.canDelete),
    canRead: Boolean(permission?.canRead),
    canUpdate: Boolean(permission?.canUpdate),
  };
}

function groupMealEntries(entries: MealPlanEntry[]): MealPlanEntry[] {
  return [...entries].sort(
    (left, right) =>
      left.weekday - right.weekday || left.slotIndex - right.slotIndex,
  );
}

function buildMealSlotIndexes(value: number | null | undefined): number[] {
  const count = Number.isFinite(value) ? Math.max(1, Math.min(8, Number(value))) : 4;

  return Array.from({ length: count }, (_, index) => index);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);

  return next.toISOString().slice(0, 10);
}

function currentWeekRange() {
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const from = new Date(today);
  from.setDate(today.getDate() - day + 1);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function normalizeWeekStartDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return currentWeekRange().from;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return currentWeekRange().from;
  }

  const day = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - day + 1);

  return date.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return `${value.slice(8, 10)}.${value.slice(5, 7)}`;
}

function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isOptionalTimeInputValid(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) {
    return true;
  }

  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return false;
  }

  const [hoursPart, minutesPart] = trimmed.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function normalizeEventTime(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return `${date.toLocaleDateString("pl-PL")} ${date.toLocaleTimeString(
    "pl-PL",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  )}`;
}

function weekdayLabel(day: number): string {
  return (
    [
      "Poniedziałek",
      "Wtorek",
      "Środa",
      "Czwartek",
      "Piątek",
      "Sobota",
      "Niedziela",
    ][day - 1] ?? `Dzień ${day}`
  );
}

function weekdayShort(day: number): string {
  return ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"][day - 1] ?? String(day);
}

function getSegmentAccent(colors: AppPalette, segment: SegmentKey) {
  if (segment === "food") {
    return { color: colors.warning, soft: colors.softOrange };
  }

  if (segment === "calendar") {
    return { color: colors.info, soft: colors.softBlue };
  }

  if (segment === "todo") {
    return { color: colors.primary, soft: colors.softGreen };
  }

  return { color: colors.shopping, soft: colors.softPurple };
}

function getSegmentIcon(
  segment: SegmentKey,
  color: string,
  size: number,
): ReactNode {
  if (segment === "food") {
    return <Utensils color={color} size={size} />;
  }

  if (segment === "calendar") {
    return <CalendarDays color={color} size={size} />;
  }

  if (segment === "todo") {
    return <CheckCircle2 color={color} size={size} />;
  }

  return <NotebookText color={color} size={size} />;
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    chip: {
      alignItems: "center",
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      minHeight: 36,
      minWidth: 48,
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
    },
    chipTextActive: {
      color: colors.inverseText,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    compactRow: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.control,
      gap: spacing.xs,
      padding: spacing.md,
    },
    compactRowActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    flex: {
      flex: 1,
    },
    formRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    deleteWarning: {
      alignItems: "flex-start",
      backgroundColor: colors.dangerSoft,
      borderColor: `${colors.danger}55`,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    deleteWarningText: {
      color: colors.danger,
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 18,
    },
    input: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      minHeight: 46,
      letterSpacing: 0,
      paddingHorizontal: spacing.md,
    },
    itemActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    itemContent: {
      flex: 1,
      gap: spacing.xs,
      paddingRight: spacing.sm,
    },
    itemList: {
      gap: spacing.sm,
    },
    itemName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0,
    },
    itemNameChecked: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    itemQuantity: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
    },
    itemRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.control,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    itemRowChecked: {
      opacity: 0.58,
    },
    largeTextArea: {
      minHeight: 128,
      paddingTop: spacing.md,
      textAlignVertical: "top",
    },
    lead: {
      color: colors.textMuted,
      fontSize: 14,
      letterSpacing: 0,
      marginTop: spacing.xs,
    },
    muted: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
    },
    moduleIcon: {
      alignItems: "center",
      borderRadius: radii.control,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    moduleLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    moduleLabelActive: {
      color: colors.text,
    },
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    moduleStrip: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    moduleTile: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderTopWidth: 3,
      borderWidth: 1,
      flex: 1,
      gap: spacing.xs,
      minHeight: 78,
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
    },
    moduleTileActive: {
      backgroundColor: colors.overlay,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 0,
    },
    textArea: {
      minHeight: 78,
      paddingTop: spacing.md,
      textAlignVertical: "top",
    },
    timeInput: {
      width: 96,
    },
    weekInput: {
      flex: 1,
      minWidth: 134,
    },
    weekPicker: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    toolbar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    toolbarActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    toolbarActionGroup: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
  });
}
