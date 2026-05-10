import type { ModuleKey } from "@homeapp/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  CalendarEvent,
  EffectivePermission,
  Note,
  TodoItem,
  completeTodoItem,
  createCalendarEvent,
  createNote,
  createTodoItem,
  deleteCalendarEvent,
  deleteNote,
  deleteTodoItem,
  listCalendarEvents,
  listCalendarUpcoming,
  listNotes,
  listTodoItems,
  queryKeys,
  reopenTodoItem,
  updateCalendarEvent,
  updateNote,
} from "../../src/api";
import { hasModuleRead, usePermissions } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import {
  ActionButton,
  AppScreen,
  FormModal,
  IconButton,
  InlineAlert,
  QueryState,
  SegmentedControl,
} from "../../src/ui";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RefreshCcw,
  Trash2,
} from "../../src/ui/icon";

type AgendaSegment = "notes" | "todo";

const agendaSegments: Array<{ label: string; moduleKey: ModuleKey; value: AgendaSegment }> = [
  { label: "Notatki", moduleKey: "notes", value: "notes" },
  { label: "To-do", moduleKey: "todo", value: "todo" },
];

export default function KalendarzScreen() {
  const { session } = useSession();
  const permissionsQuery = usePermissions();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [visibleMonth, setVisibleMonth] = useState(() => monthAnchor(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [activeSegment, setActiveSegment] = useState<AgendaSegment>("notes");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(todayIso());
  const [eventTime, setEventTime] = useState("");
  const [eventNote, setEventNote] = useState("");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const permissions = permissionsQuery.data;
  const readableAgenda = agendaSegments.filter(
    (segment) => getPermission(permissions, segment.moduleKey).canRead,
  );
  const calendarPermission = getPermission(permissions, "calendar");
  const canUseScreen = hasModuleRead(permissions, ["calendar", "notes", "todo"]);
  const range = useMemo(() => getMonthRange(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (!permissionsQuery.isSuccess || readableAgenda.length === 0) {
      return;
    }

    if (!readableAgenda.some((segment) => segment.value === activeSegment)) {
      setActiveSegment(readableAgenda[0]!.value);
    }
  }, [activeSegment, permissionsQuery.isSuccess, readableAgenda]);

  const monthEventsQuery = useQuery({
    enabled: calendarPermission.canRead && Boolean(accessToken),
    queryFn: () => listCalendarEvents(range.from, range.to, { accessToken }),
    queryKey: [...queryKeys.calendar, "month", range.from, range.to],
  });
  const upcomingQuery = useQuery({
    enabled: calendarPermission.canRead && Boolean(accessToken),
    queryFn: () => listCalendarUpcoming(4, { accessToken }),
    queryKey: [...queryKeys.calendar, "mobile-upcoming"],
  });
  const selectedDayEvents = (monthEventsQuery.data ?? []).filter(
    (event) => event.eventDate === selectedDate,
  );
  const queryClient = useQueryClient();
  const saveEventMutation = useMutation({
    mutationFn: () =>
      editingEvent
        ? updateCalendarEvent(
            getEditableCalendarEventId(editingEvent),
            {
              eventDate,
              eventTime: normalizeEventTime(eventTime),
              note: eventNote.trim() || null,
              scopeType: editingEvent.scopeType,
              title: eventTitle.trim(),
            },
            { accessToken },
          )
        : createCalendarEvent(
            {
              eventDate,
              eventTime: normalizeEventTime(eventTime),
              note: eventNote.trim() || null,
              scopeType: "household",
              title: eventTitle.trim(),
            },
            { accessToken },
          ),
    onSuccess: async () => {
      closeEventModal();
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const deleteEventMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      deleteCalendarEvent(getEditableCalendarEventId(event), { accessToken }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const canSaveEvent =
    (editingEvent ? calendarPermission.canUpdate : calendarPermission.canCreate) &&
    Boolean(eventTitle.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(eventDate) &&
    isOptionalTimeInputValid(eventTime);

  function openCreateEvent(date = selectedDate) {
    setEditingEvent(null);
    setEventTitle("");
    setEventDate(date);
    setEventTime("");
    setEventNote("");
    setEventModalVisible(true);
  }

  function openEditEvent(event: CalendarEvent) {
    setEditingEvent(event);
    setEventTitle(event.title);
    setEventDate(event.eventDate);
    setEventTime(event.eventTime?.slice(0, 5) ?? "");
    setEventNote(event.note ?? "");
    setEventModalVisible(true);
  }

  function closeEventModal() {
    setEditingEvent(null);
    setEventTitle("");
    setEventTime("");
    setEventNote("");
    setEventModalVisible(false);
  }

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Kalendarz">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (!canUseScreen) {
    return (
      <AppScreen title="Kalendarz">
        <InlineAlert text="Nie masz dostępu do kalendarza, notatek ani zadań." />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      actions={
        <View style={styles.headerActions}>
          {calendarPermission.canCreate ? (
            <IconButton
              accessibilityLabel="Dodaj wydarzenie"
              onPress={() => openCreateEvent()}
            >
              <CalendarPlus color={theme.colors.text} size={18} />
            </IconButton>
          ) : null}
          <IconButton
            accessibilityLabel="Odśwież kalendarz"
            onPress={() => {
              monthEventsQuery.refetch();
              upcomingQuery.refetch();
            }}
          >
            <RefreshCcw color={theme.colors.text} size={18} />
          </IconButton>
        </View>
      }
      title="Kalendarz"
    >
      <View style={styles.monthHeader}>
        <Text style={styles.monthTitle}>{formatMonthTitle(visibleMonth)}</Text>
        <View style={styles.monthNav}>
          <IconButton
            accessibilityLabel="Poprzedni miesiąc"
            onPress={() => setVisibleMonth(addMonths(visibleMonth, -1))}
          >
            <ChevronLeft color={theme.colors.textMuted} size={19} />
          </IconButton>
          <IconButton
            accessibilityLabel="Następny miesiąc"
            onPress={() => setVisibleMonth(addMonths(visibleMonth, 1))}
          >
            <ChevronRight color={theme.colors.textMuted} size={19} />
          </IconButton>
        </View>
      </View>

      {calendarPermission.canRead ? (
        <CalendarMonth
          events={monthEventsQuery.data ?? []}
          isLoading={monthEventsQuery.isLoading}
          month={visibleMonth}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setEventDate(date);
          }}
          selectedDate={selectedDate}
        />
      ) : (
        <InlineAlert text="Nie masz uprawnienia do kalendarza." />
      )}

      {calendarPermission.canRead ? (
        <UpcomingEvents
          canDelete={calendarPermission.canDelete}
          canUpdate={calendarPermission.canUpdate}
          date={selectedDate}
          deleting={deleteEventMutation.isPending}
          events={selectedDayEvents}
          onDelete={(event) => deleteEventMutation.mutate(event)}
          onEdit={openEditEvent}
          query={monthEventsQuery}
        />
      ) : null}

      {readableAgenda.length > 0 ? (
        <SegmentedControl
          onChange={setActiveSegment}
          options={readableAgenda.map(({ label, value }) => ({ label, value }))}
          value={activeSegment}
        />
      ) : null}

      {activeSegment === "notes" ? <NotesBoard accessToken={accessToken} /> : null}
      {activeSegment === "todo" ? <TodoBoard accessToken={accessToken} /> : null}

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={closeEventModal}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canSaveEvent}
              loading={saveEventMutation.isPending}
              onPress={() => saveEventMutation.mutate()}
              style={styles.modalFooterButton}
              title={editingEvent ? "Zapisz" : "Dodaj"}
            />
          </View>
        }
        onClose={closeEventModal}
        subtitle={editingEvent ? "Zmieniasz wpis w kalendarzu domowym." : "Wpis trafi do kalendarza domowego."}
        title={editingEvent ? "Edytuj wydarzenie" : "Dodaj wydarzenie"}
        visible={eventModalVisible}
      >
        <TextInput
          onChangeText={setEventTitle}
          placeholder="Tytuł"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={eventTitle}
        />
        <View style={styles.formRow}>
          <TextInput
            onChangeText={setEventDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.flexInput]}
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
          onChangeText={setEventNote}
          placeholder="Notatka"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={eventNote}
        />
        {saveEventMutation.error ? (
          <InlineAlert text="Nie udało się dodać wydarzenia." tone="error" />
        ) : null}
      </FormModal>
    </AppScreen>
  );
}

function CalendarMonth({
  events,
  isLoading,
  month,
  onSelectDate,
  selectedDate,
}: {
  events: CalendarEvent[];
  isLoading: boolean;
  month: Date;
  onSelectDate: (date: string) => void;
  selectedDate: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const days = getCalendarDays(month);
  const eventsByDate = new Map<string, number>();

  events.forEach((event) => {
    eventsByDate.set(event.eventDate, (eventsByDate.get(event.eventDate) ?? 0) + 1);
  });

  return (
    <View style={styles.calendarCard}>
      <View style={styles.weekRow}>
        {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((day) => (
          <Text key={day} style={styles.weekLabel}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.dayGrid}>
        {days.map((day) => {
          const isToday = day.iso === todayIso();
          const isSelected = day.iso === selectedDate;
          const hasEvents = day.iso ? (eventsByDate.get(day.iso) ?? 0) > 0 : false;

          return (
            <View key={`${day.iso}-${day.label}`} style={styles.dayCell}>
              <Pressable
                disabled={!day.iso}
                hitSlop={8}
                onPress={() => {
                  if (day.iso) {
                    onSelectDate(day.iso);
                  }
                }}
                style={[
                  styles.dayBubble,
                  !day.inMonth && styles.dayBubbleMuted,
                  isToday && styles.dayBubbleToday,
                  isSelected && styles.dayBubbleSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !day.inMonth && styles.dayTextMuted,
                    isToday && styles.dayTextToday,
                    isSelected && styles.dayTextSelected,
                  ]}
                >
                  {day.label}
                </Text>
              </Pressable>
              <View style={styles.dotSlot}>
                {hasEvents ? <View style={styles.eventDot} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      {isLoading ? (
        <Text style={styles.calendarLoading}>Ładuję wydarzenia...</Text>
      ) : null}
    </View>
  );
}

function UpcomingEvents({
  canDelete,
  canUpdate,
  date,
  deleting,
  events,
  onDelete,
  onEdit,
  query,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  date: string;
  deleting: boolean;
  events: CalendarEvent[];
  onDelete: (event: CalendarEvent) => void;
  onEdit: (event: CalendarEvent) => void;
  query: { error: unknown; isLoading: boolean };
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  if (query.isLoading || query.error || events.length === 0) {
    return (
      <QueryState
        emptyText={`Brak wydarzeń dla ${formatDate(date)}.`}
        error={query.error}
        isEmpty={!query.isLoading && events.length === 0}
        isLoading={query.isLoading}
      />
    );
  }

  return (
    <View style={styles.eventStrip}>
      {events.slice(0, 2).map((event) => (
        <View key={event.id} style={styles.eventPill}>
          <CalendarDays color={theme.colors.calendar} size={16} />
          <View style={styles.eventPillText}>
            <Text numberOfLines={1} style={styles.eventTitle}>
              {event.title}
            </Text>
            <Text style={styles.eventMeta}>
              {[formatDate(event.eventDate), event.eventTime?.slice(0, 5)].filter(Boolean).join(" / ")}
            </Text>
          </View>
          {canUpdate || canDelete ? (
            <View style={styles.eventPillActions}>
              {canUpdate ? (
                <IconButton accessibilityLabel="Edytuj wydarzenie" onPress={() => onEdit(event)}>
                  <Pencil color={theme.colors.textMuted} size={15} />
                </IconButton>
              ) : null}
              {canDelete ? (
                <IconButton
                  accessibilityLabel="Usuń wydarzenie"
                  disabled={deleting}
                  onPress={() => onDelete(event)}
                >
                  <Trash2 color={theme.colors.danger} size={15} />
                </IconButton>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function NotesBoard({ accessToken }: { accessToken?: string | null }) {
  const queryClient = useQueryClient();
  const permission = useModulePermission("notes");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const notesQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listNotes({ accessToken }),
    queryKey: queryKeys.notes,
  });
  const createMutation = useMutation({
    mutationFn: () => createNote({ description: description.trim(), title: title.trim() }, { accessToken }),
    onSuccess: async () => {
      reset();
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const updateMutation = useMutation({
    mutationFn: () =>
      updateNote(editingId ?? "", { description: description.trim(), title: title.trim() }, { accessToken }),
    onSuccess: async () => {
      reset();
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notes }),
  });
  const notes = notesQuery.data ?? [];
  const isEditing = Boolean(editingId);

  function reset() {
    setDescription("");
    setEditingId(null);
    setTitle("");
  }

  function openEdit(note: Note) {
    setDescription(note.description ?? "");
    setEditingId(note.id);
    setTitle(note.title);
    setModalVisible(true);
  }

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Notatki</Text>
        {permission.canCreate ? (
          <ActionButton onPress={() => setModalVisible(true)} size="small" title="+ Dodaj" />
        ) : null}
      </View>
      <QueryState
        emptyText="Brak notatek."
        error={notesQuery.error}
        isEmpty={!notesQuery.isLoading && notes.length === 0}
        isLoading={notesQuery.isLoading}
      />
      <View style={styles.noteList}>
        {notes.slice(0, 8).map((note) => (
          <View key={note.id} style={[styles.noteCard, { backgroundColor: theme.colors.warningSoft }]}>
            <View style={styles.noteContent}>
              <Text numberOfLines={1} style={styles.noteTitle}>
                {note.title}
              </Text>
              {note.description ? (
                <Text numberOfLines={3} style={styles.noteText}>
                  {note.description}
                </Text>
              ) : null}
              <Text style={styles.noteMeta}>{formatDateTime(note.updatedAt)}</Text>
            </View>
            <View style={styles.rowActions}>
              {permission.canUpdate ? (
                <IconButton onPress={() => openEdit(note)}>
                  <Pencil color={theme.colors.primary} size={17} />
                </IconButton>
              ) : null}
              {permission.canDelete ? (
                <IconButton disabled={deleteMutation.isPending} onPress={() => deleteMutation.mutate(note.id)}>
                  <Trash2 color={theme.colors.danger} size={17} />
                </IconButton>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => {
                reset();
                setModalVisible(false);
              }}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!title.trim() || (isEditing && !permission.canUpdate)}
              loading={createMutation.isPending || updateMutation.isPending}
              onPress={() => (isEditing ? updateMutation.mutate() : createMutation.mutate())}
              style={styles.modalFooterButton}
              title={isEditing ? "Zapisz" : "Dodaj"}
            />
          </View>
        }
        onClose={() => {
          reset();
          setModalVisible(false);
        }}
        subtitle={isEditing ? "Edytujesz zapisaną notatkę." : "Nowa notatka zostanie pod ręką w kalendarzu."}
        title={isEditing ? "Edytuj notatkę" : "Nowa notatka"}
        visible={modalVisible}
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

function TodoBoard({ accessToken }: { accessToken?: string | null }) {
  const queryClient = useQueryClient();
  const permission = useModulePermission("todo");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const todoQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listTodoItems(undefined, { accessToken }),
    queryKey: [...queryKeys.todo, "items"],
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
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.todo });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const updateMutation = useMutation({
    mutationFn: (item: TodoItem) =>
      item.status === "done"
        ? reopenTodoItem(item.id, { accessToken })
        : completeTodoItem(item.id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.todo }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodoItem(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.todo }),
  });
  const items = todoQuery.data ?? [];
  const sorted = [...items].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "todo" ? -1 : 1;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Do zrobienia dzisiaj</Text>
        {permission.canCreate ? (
          <ActionButton onPress={() => setModalVisible(true)} size="small" title="+ Dodaj" />
        ) : null}
      </View>
      <QueryState
        emptyText="Brak zadań."
        error={todoQuery.error}
        isEmpty={!todoQuery.isLoading && sorted.length === 0}
        isLoading={todoQuery.isLoading}
      />
      <View style={styles.noteList}>
        {sorted.slice(0, 10).map((item) => {
          const done = item.status === "done";

          return (
            <View key={item.id} style={[styles.todoCard, done && styles.todoCardDone]}>
              <Pressable
                disabled={!permission.canUpdate || updateMutation.isPending}
                onPress={() => updateMutation.mutate(item)}
                style={[styles.todoCheck, done && styles.todoCheckDone]}
              >
                {done ? <Check color={theme.colors.card} size={15} /> : null}
              </Pressable>
              <View style={styles.noteContent}>
                <Text style={[styles.noteTitle, done && styles.doneText]}>{item.title}</Text>
                {item.description ? (
                  <Text numberOfLines={2} style={styles.noteText}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              {permission.canDelete ? (
                <IconButton disabled={deleteMutation.isPending} onPress={() => deleteMutation.mutate(item.id)}>
                  <Trash2 color={theme.colors.danger} size={17} />
                </IconButton>
              ) : null}
            </View>
          );
        })}
      </View>

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setModalVisible(false)}
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
        onClose={() => setModalVisible(false)}
        subtitle="Zadanie pojawi się na wspólnej liście domowej."
        title="Nowe zadanie"
        visible={modalVisible}
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
          <InlineAlert text="Nie udało się dodać zadania." tone="error" />
        ) : null}
      </FormModal>
    </>
  );
}

function useModulePermission(moduleKey: ModuleKey) {
  const permissionsQuery = usePermissions();
  return getPermission(permissionsQuery.data, moduleKey);
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

function getCalendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const firstOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, monthIndex, 0).getDate();
  const days: Array<{ inMonth: boolean; iso: string | null; label: number }> = [];

  for (let index = firstOffset - 1; index >= 0; index -= 1) {
    days.push({
      inMonth: false,
      iso: null,
      label: daysInPreviousMonth - index,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      inMonth: true,
      iso: isoFromParts(year, monthIndex, day),
      label: day,
    });
  }

  while (days.length % 7 !== 0) {
    days.push({
      inMonth: false,
      iso: null,
      label: days.length - firstOffset - daysInMonth + 1,
    });
  }

  return days;
}

function monthAnchor(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthRange(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  return {
    from: isoFromParts(year, month, 1),
    to: isoFromParts(year, month, new Date(year, month + 1, 0).getDate()),
  };
}

function isoFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayIso() {
  const today = new Date();
  return isoFromParts(today.getFullYear(), today.getMonth(), today.getDate());
}

function formatMonthTitle(date: Date): string {
  const title = new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(date);

  return title.charAt(0).toUpperCase() + title.slice(1);
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

function getEditableCalendarEventId(event: CalendarEvent): string {
  return event.sourceEventId ?? event.id.split(":")[0] ?? event.id;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    calendarCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      padding: spacing.xs,
    },
    calendarLoading: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
    },
    dayBubble: {
      alignItems: "center",
      borderRadius: 999,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    dayBubbleMuted: {
      opacity: 0.42,
    },
    dayBubbleSelected: {
      backgroundColor: colors.calendar,
    },
    dayBubbleToday: {
      backgroundColor: colors.primary,
    },
    dayCell: {
      alignItems: "center",
      flexBasis: "14.285%",
      height: 44,
      justifyContent: "center",
    },
    dayGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    dayText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
    },
    dayTextMuted: {
      color: colors.textSubtle,
    },
    dayTextSelected: {
      color: colors.inverseText,
    },
    dayTextToday: {
      color: colors.inverseText,
    },
    doneText: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    dotSlot: {
      alignItems: "center",
      height: 8,
      justifyContent: "center",
    },
    eventDot: {
      backgroundColor: colors.warning,
      borderRadius: 999,
      height: 4,
      width: 4,
    },
    eventMeta: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
    },
    eventPill: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 52,
      padding: spacing.sm,
    },
    eventPillActions: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 0,
      gap: spacing.xs,
    },
    eventPillText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    eventStrip: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    eventTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    flexInput: {
      flex: 1,
    },
    formRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    input: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      letterSpacing: 0,
      minHeight: 46,
      paddingHorizontal: spacing.md,
    },
    largeTextArea: {
      minHeight: 126,
      paddingTop: spacing.md,
      textAlignVertical: "top",
    },
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    monthHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    monthNav: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    monthTitle: {
      color: colors.primaryDark,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    noteCard: {
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    noteContent: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
    },
    noteList: {
      gap: spacing.sm,
    },
    noteMeta: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
    },
    noteText: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    noteTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 19,
    },
    rowActions: {
      alignItems: "center",
      gap: spacing.xs,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 38,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    textArea: {
      minHeight: 86,
      paddingTop: spacing.md,
      textAlignVertical: "top",
    },
    timeInput: {
      width: 92,
    },
    todoCard: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    todoCardDone: {
      backgroundColor: colors.surfaceMuted,
      opacity: 0.74,
    },
    todoCheck: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 24,
      justifyContent: "center",
      width: 24,
    },
    todoCheckDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    weekLabel: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
      textAlign: "center",
    },
    weekRow: {
      flexDirection: "row",
      paddingBottom: spacing.xs,
    },
  });
}
