import type { ModuleKey } from "@homeapp/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  CalendarEvent,
  EffectivePermission,
  Note,
  TodoItem,
  completeTodoItem,
  connectGoogleCalendar,
  createCalendarEvent,
  createNote,
  createTodoItem,
  deleteCalendarEvent,
  deleteNote,
  deleteTodoItem,
  getGoogleCalendarStatus,
  listCalendarEvents,
  listNotes,
  listTodoItems,
  queryKeys,
  reopenTodoItem,
  syncGoogleCalendar,
  updateCalendarEvent,
  updateNote,
} from "../../src/api";
import {
  hasModuleRead,
  usePermissions,
} from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import {
  ActionButton,
  AppScreen,
  DatePickerField,
  FormModal,
  IconButton,
  InlineAlert,
  QueryState,
  SegmentedControl,
} from "../../src/ui";
import {
  CalendarDays,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "../../src/ui/icon";
import googleGImage from "../../assets/google-logo.webp";

type CalendarViewMode = "month" | "week";
type _AgendaSegment = "notes" | "todo";
type ReminderValue = "none" | "15" | "30" | "60" | "1440";

const _agendaSegments: Array<{
  label: string;
  moduleKey: ModuleKey;
  value: _AgendaSegment;
}> = [
  { label: "Notatki", moduleKey: "notes", value: "notes" },
  { label: "Do zrobienia", moduleKey: "todo", value: "todo" },
];

const reminderOptions: Array<{ label: string; value: ReminderValue }> = [
  { label: "Brak", value: "none" },
  { label: "15 min", value: "15" },
  { label: "30 min", value: "30" },
  { label: "1 h", value: "60" },
  { label: "1 dzień", value: "1440" },
];

const calendarViewOptions: Array<{ label: string; value: CalendarViewMode }> = [
  { label: "Miesiąc", value: "month" },
  { label: "Tydzień", value: "week" },
];

const weekdayLabels = ["Pon", "Wto", "Śro", "Czw", "Pią", "Sob", "Nie"];
const googleCalendarMarkerColors = [
  "#22D3EE",
  "#A78BFA",
  "#F472B6",
  "#FBBF24",
  "#34D399",
  "#FB7185",
];
const localCalendarMarkerColors = [
  "#B4232D",
  "#FFC438",
  "#F27A98",
  "#FF943D",
  "#667CE8",
];
const mockupGreen = "#4F8D2C";

export default function KalendarzScreen() {
  const { session } = useSession();
  const routeParams = useLocalSearchParams<{
    action?: string | string[];
    date?: string | string[];
    intent?: string | string[];
  }>();
  const permissionsQuery = usePermissions();
  const { screenBackground, styles, theme } = useCalendarStyles();
  const readableGreen = theme.isDark ? theme.colors.primaryDarker : mockupGreen;
  const accessToken = session?.accessToken;
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthAnchor(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("month");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(todayIso());
  const [eventTime, setEventTime] = useState("");
  const [eventLocationName, setEventLocationName] = useState("");
  const [eventLocationUrl, setEventLocationUrl] = useState("");
  const [eventNote, setEventNote] = useState("");
  const [eventReminder, setEventReminder] = useState<ReminderValue>("1440");
  const [calendarToast, setCalendarToast] = useState<{
    text: string;
    tone: "info" | "success";
  } | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [handledRouteDate, setHandledRouteDate] = useState<string | null>(null);
  const [handledRouteAction, setHandledRouteAction] = useState<string | null>(
    null,
  );
  const permissions = permissionsQuery.data;
  const calendarPermission = getPermission(permissions, "calendar");
  const canUseScreen = hasModuleRead(permissions, ["calendar"]);
  const routeDate = getRouteParam(routeParams.date);
  const routeAction = getRouteParam(routeParams.action);
  const routeIntent = getRouteParam(routeParams.intent);
  const range = useMemo(
    () => getVisibleRange(visibleMonth, selectedDate, calendarView),
    [calendarView, selectedDate, visibleMonth],
  );

  const monthEventsQuery = useQuery({
    enabled: calendarPermission.canRead && Boolean(accessToken),
    queryFn: () => listCalendarEvents(range.from, range.to, { accessToken }),
    queryKey: [
      ...queryKeys.calendar,
      "range",
      calendarView,
      range.from,
      range.to,
    ],
  });
  const selectedDayEvents = (monthEventsQuery.data ?? []).filter(
    (event) => event.eventDate === selectedDate,
  );
  const queryClient = useQueryClient();
  const googleCalendarQuery = useQuery({
    enabled: calendarPermission.canRead && Boolean(accessToken),
    queryFn: () => getGoogleCalendarStatus({ accessToken }),
    queryKey: [...queryKeys.calendar, "google", "status"],
  });
  const saveEventMutation = useMutation({
    mutationFn: () =>
      editingEvent
        ? updateCalendarEvent(
            getEditableCalendarEventId(editingEvent),
            {
              eventDate,
              eventTime: normalizeEventTime(eventTime),
              locationName: normalizeOptionalText(eventLocationName),
              locationUrl: normalizeLocationUrlInput(
                eventLocationUrl || eventLocationName,
              ),
              note: eventNote.trim() || null,
              reminderOffsetMinutes: reminderValueToMinutes(eventReminder),
              scopeType: editingEvent.scopeType,
              title: eventTitle.trim(),
            },
            { accessToken },
          )
        : createCalendarEvent(
            {
              eventDate,
              eventTime: normalizeEventTime(eventTime),
              locationName: normalizeOptionalText(eventLocationName),
              locationUrl: normalizeLocationUrlInput(
                eventLocationUrl || eventLocationName,
              ),
              note: eventNote.trim() || null,
              reminderOffsetMinutes: reminderValueToMinutes(eventReminder),
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
      closeEventModal();
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const connectGoogleMutation = useMutation({
    mutationFn: () => connectGoogleCalendar({ accessToken }),
    onSuccess: async (result) => {
      showCalendarToast(
        "Otwieram Google. Po akceptacji wróć do aplikacji.",
        "info",
      );
      await Linking.openURL(result.authorizationUrl);
    },
  });
  const syncGoogleMutation = useMutation({
    mutationFn: () => syncGoogleCalendar({ accessToken }),
    onSuccess: async (result) => {
      const focusDate = pickGoogleSyncFocusDate(result.eventDates);

      showCalendarToast(
        `Google Calendar: dodano ${result.importedCount}, zaktualizowano ${result.updatedCount}.`,
      );
      await googleCalendarQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });

      if (focusDate) {
        const focusMonth = monthAnchor(parseIsoDate(focusDate));
        const focusRange = getMonthRange(focusMonth);

        setCalendarView("month");
        selectDate(focusDate);
        await queryClient.prefetchQuery({
          queryFn: () =>
            listCalendarEvents(focusRange.from, focusRange.to, { accessToken }),
          queryKey: [
            ...queryKeys.calendar,
            "range",
            "month",
            focusRange.from,
            focusRange.to,
          ],
        });
      }
    },
  });
  const canSaveEvent =
    (editingEvent
      ? calendarPermission.canUpdate
      : calendarPermission.canCreate) &&
    Boolean(eventTitle.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(eventDate) &&
    isOptionalTimeInputValid(eventTime);

  useEffect(() => {
    const targetDate = routeDate && isIsoDate(routeDate) ? routeDate : null;
    const dateKey = `${targetDate ?? ""}:${routeIntent ?? ""}`;

    if (
      targetDate &&
      handledRouteDate !== dateKey &&
      targetDate !== selectedDate
    ) {
      selectDate(targetDate);
    }

    if (targetDate && handledRouteDate !== dateKey) {
      setHandledRouteDate(dateKey);
    }

    if (
      routeAction !== "create" ||
      !targetDate ||
      !calendarPermission.canCreate
    ) {
      return;
    }

    const actionKey = `${routeAction}:${targetDate}:${routeIntent ?? ""}`;

    if (handledRouteAction === actionKey) {
      return;
    }

    setHandledRouteAction(actionKey);
    openCreateEvent(targetDate);
  }, [
    calendarPermission.canCreate,
    handledRouteAction,
    handledRouteDate,
    routeAction,
    routeDate,
    routeIntent,
    selectedDate,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (calendarPermission.canRead && accessToken) {
        void googleCalendarQuery.refetch();
      }
    }, [accessToken, calendarPermission.canRead, googleCalendarQuery.refetch]),
  );

  useEffect(() => {
    if (!calendarToast) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setCalendarToast(null), 3600);

    return () => clearTimeout(timeoutId);
  }, [calendarToast]);

  function showCalendarToast(
    text: string,
    tone: "info" | "success" = "success",
  ) {
    setCalendarToast({ text, tone });
  }

  function openCreateEvent(date = selectedDate) {
    setEditingEvent(null);
    setEventTitle("");
    setEventDate(date);
    setEventTime("");
    setEventLocationName("");
    setEventLocationUrl("");
    setEventNote("");
    setEventReminder("1440");
    setEventModalVisible(true);
  }

  function openEditEvent(event: CalendarEvent) {
    setEditingEvent(event);
    setEventTitle(event.title);
    setEventDate(event.eventDate);
    setEventTime(event.eventTime?.slice(0, 5) ?? "");
    setEventLocationName(event.locationName ?? "");
    setEventLocationUrl(event.locationUrl ?? "");
    setEventNote(event.note ?? "");
    setEventReminder(minutesToReminderValue(event.reminderOffsetMinutes));
    setEventModalVisible(true);
  }

  function closeEventModal() {
    setEditingEvent(null);
    setEventTitle("");
    setEventTime("");
    setEventLocationName("");
    setEventLocationUrl("");
    setEventNote("");
    setEventReminder("1440");
    setEventModalVisible(false);
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    setEventDate(date);
    setVisibleMonth(monthAnchor(parseIsoDate(date)));
  }

  function shiftVisiblePeriod(direction: -1 | 1) {
    if (calendarView === "month") {
      const nextMonth = addMonths(visibleMonth, direction);
      const nextDate = isoFromParts(
        nextMonth.getFullYear(),
        nextMonth.getMonth(),
        1,
      );

      setVisibleMonth(nextMonth);
      setSelectedDate(nextDate);
      setEventDate(nextDate);
      return;
    }

    const daysToMove = direction * 7;
    const nextDate = dateToIso(addDays(parseIsoDate(selectedDate), daysToMove));

    selectDate(nextDate);
  }

  function handleGoogleCalendarPress() {
    if (googleCalendarQuery.data?.connected) {
      syncGoogleMutation.mutate();
      return;
    }

    connectGoogleMutation.mutate();
  }

  const googleCalendarConnected = Boolean(googleCalendarQuery.data?.connected);
  const googleCalendarPending =
    connectGoogleMutation.isPending || syncGoogleMutation.isPending;

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
        calendarPermission.canCreate || calendarPermission.canRead ? (
          <View style={styles.headerActions}>
            {calendarPermission.canRead ? (
              <IconButton
                accessibilityLabel={
                  googleCalendarConnected
                    ? "Synchronizuj Google Calendar"
                    : "Połącz Google Calendar"
                }
                disabled={
                  googleCalendarPending ||
                  (googleCalendarConnected && !calendarPermission.canCreate)
                }
                onPress={handleGoogleCalendarPress}
                style={[
                  styles.headerIconButton,
                  styles.googleHeaderButton,
                  googleCalendarConnected && styles.googleHeaderButtonConnected,
                ]}
              >
                <Image
                  resizeMode="contain"
                  source={googleGImage}
                  style={[
                    styles.googleHeaderImage,
                    googleCalendarPending && styles.googleHeaderImageDisabled,
                  ]}
                />
              </IconButton>
            ) : null}
            {calendarPermission.canCreate ? (
              <IconButton
                accessibilityLabel="Dodaj wydarzenie"
                onPress={() => openCreateEvent()}
                style={[styles.headerIconButton, styles.addHeaderButton]}
              >
                <CalendarPlus color={readableGreen} size={20} />
              </IconButton>
            ) : null}
          </View>
        ) : undefined
      }
      backgroundColor={screenBackground}
      contentStyle={styles.calendarScreenContent}
      title="Kalendarz"
    >
      <CalendarViewToggle onChange={setCalendarView} value={calendarView} />

      <View style={styles.periodHeader}>
        <IconButton
          accessibilityLabel="Poprzedni miesiąc"
          onPress={() => shiftVisiblePeriod(-1)}
          style={styles.periodNavButton}
        >
          <ChevronLeft color={theme.colors.text} size={18} />
        </IconButton>
        <View style={styles.periodText}>
          <Text style={styles.periodTitle}>
            {formatPeriodTitle(calendarView, visibleMonth, selectedDate)}
          </Text>
        </View>
        <IconButton
          accessibilityLabel="Następny miesiąc"
          onPress={() => shiftVisiblePeriod(1)}
          style={styles.periodNavButton}
        >
          <ChevronRight color={theme.colors.text} size={18} />
        </IconButton>
      </View>

      {calendarToast ? (
        <View
          pointerEvents="none"
          style={[
            styles.calendarToast,
            calendarToast.tone === "info" && styles.calendarToastInfo,
          ]}
        >
          <Text style={styles.calendarToastText}>{calendarToast.text}</Text>
        </View>
      ) : null}
      {connectGoogleMutation.error || syncGoogleMutation.error ? (
        <InlineAlert
          text="Nie udało się zsynchronizować Google Calendar."
          tone="error"
        />
      ) : null}

      {calendarPermission.canRead ? (
        calendarView === "month" ? (
          <CalendarMonth
            events={monthEventsQuery.data ?? []}
            isLoading={monthEventsQuery.isLoading}
            month={visibleMonth}
            onSelectDate={selectDate}
            selectedDate={selectedDate}
          />
        ) : (
          <CalendarWeek
            events={monthEventsQuery.data ?? []}
            isLoading={monthEventsQuery.isLoading}
            onSelectDate={selectDate}
            selectedDate={selectedDate}
          />
        )
      ) : (
        <InlineAlert text="Nie masz uprawnienia do kalendarza." />
      )}

      {calendarPermission.canRead ? (
        <UpcomingEvents
          canUpdate={calendarPermission.canUpdate}
          date={selectedDate}
          events={selectedDayEvents}
          canCreate={calendarPermission.canCreate}
          onEdit={openEditEvent}
          onCreate={() => openCreateEvent(selectedDate)}
          query={monthEventsQuery}
        />
      ) : null}

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              labelStyle={styles.calendarCancelButtonLabel}
              onPress={closeEventModal}
              style={[styles.modalFooterButton, styles.calendarCancelButton]}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canSaveEvent}
              labelStyle={styles.calendarSaveButtonLabel}
              loading={saveEventMutation.isPending}
              onPress={() => saveEventMutation.mutate()}
              style={[styles.modalFooterButton, styles.calendarSaveButton]}
              title={editingEvent ? "Zapisz" : "Dodaj"}
            />
            {editingEvent && calendarPermission.canDelete ? (
              <IconButton
                accessibilityLabel="Usuń wydarzenie"
                disabled={deleteEventMutation.isPending}
                onPress={() => deleteEventMutation.mutate(editingEvent)}
                style={styles.modalDeleteButton}
              >
                <Trash2 color={theme.colors.danger} size={19} />
              </IconButton>
            ) : null}
          </View>
        }
        onClose={closeEventModal}
        subtitle={
          editingEvent
            ? "Zmieniasz wpis w kalendarzu domowym."
            : "Wpis trafi do kalendarza domowego."
        }
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
        <DatePickerField
          label="Data wydarzenia"
          onChange={setEventDate}
          value={eventDate}
        />
        <View style={styles.formRow}>
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
          onChangeText={setEventLocationName}
          placeholder="Lokalizacja albo adres"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={eventLocationName}
        />
        <TextInput
          autoCapitalize="none"
          keyboardType="url"
          onChangeText={setEventLocationUrl}
          placeholder="Link do lokalizacji / Google Maps"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={eventLocationUrl}
        />
        <TextInput
          multiline
          onChangeText={setEventNote}
          placeholder="Notatka"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={eventNote}
        />
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Przypomnienie</Text>
          <SegmentedControl
            accentColor={readableGreen}
            onChange={setEventReminder}
            options={reminderOptions}
            presentation="mockup"
            value={eventReminder}
          />
        </View>
        {saveEventMutation.error ? (
          <InlineAlert text="Nie udało się dodać wydarzenia." tone="error" />
        ) : null}
      </FormModal>
    </AppScreen>
  );
}

function useCalendarStyles() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const screenBackground =
    theme.colors.background === "#0C1220" ? theme.colors.background : "#FBFAF6";
  const styles = createStyles(theme.colors, width);

  return { screenBackground, styles, theme };
}

function CalendarViewToggle({
  onChange,
  value,
}: {
  onChange: (value: CalendarViewMode) => void;
  value: CalendarViewMode;
}) {
  const { styles, theme } = useCalendarStyles();
  const readableGreen = theme.isDark ? theme.colors.primaryDarker : mockupGreen;

  return (
    <View style={styles.calendarModeCard}>
      {calendarViewOptions.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.calendarModeOption,
              active && styles.calendarModeOptionActive,
              pressed && styles.calendarModeOptionPressed,
            ]}
          >
            <CalendarDays
              color={active ? readableGreen : theme.colors.text}
              size={16}
            />
            <Text
              style={[
                styles.calendarModeText,
                active && styles.calendarModeTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  const { styles, theme } = useCalendarStyles();
  const days = getCalendarDays(month);
  const eventMarkersByDate = useMemo(
    () => buildEventMarkersByDate(events, theme.colors),
    [events, theme.colors],
  );

  return (
    <View style={styles.calendarCard}>
      <View style={styles.weekRow}>
        {weekdayLabels.map((day, index) => (
          <Text
            key={day}
            style={[styles.weekLabel, index >= 5 && styles.weekLabelWeekend]}
          >
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.dayGrid}>
        {days.map((day, index) => {
          const isToday = day.iso === todayIso();
          const isSelected = day.iso === selectedDate;
          const isWeekend = index % 7 >= 5;
          const markers = day.iso
            ? (eventMarkersByDate.get(day.iso) ?? [])
            : [];

          return (
            <View
              key={`${day.iso}-${day.label}`}
              style={[styles.dayCell, index >= 7 && styles.dayCellWeekDivider]}
            >
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
                    isWeekend && styles.dayTextWeekend,
                    !day.inMonth && styles.dayTextMuted,
                    isToday && styles.dayTextToday,
                    isSelected && styles.dayTextSelected,
                  ]}
                >
                  {day.label}
                </Text>
              </Pressable>
              <View style={styles.dotSlot}>
                {markers.length > 0 ? (
                  <View style={styles.eventDotsRow}>
                    {markers.map((color, index) => (
                      <View
                        key={`${day.iso}-${color}-${index}`}
                        style={[styles.eventDot, { backgroundColor: color }]}
                      />
                    ))}
                  </View>
                ) : null}
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

function CalendarWeek({
  events,
  isLoading,
  onSelectDate,
  selectedDate,
}: {
  events: CalendarEvent[];
  isLoading: boolean;
  onSelectDate: (date: string) => void;
  selectedDate: string;
}) {
  const { styles, theme } = useCalendarStyles();
  const days = getWeekDays(selectedDate);
  const eventMarkersByDate = useMemo(
    () => buildEventMarkersByDate(events, theme.colors),
    [events, theme.colors],
  );

  return (
    <View style={styles.calendarCard}>
      <View style={styles.weekRow}>
        {weekdayLabels.map((day, index) => (
          <Text
            key={day}
            style={[styles.weekLabel, index >= 5 && styles.weekLabelWeekend]}
          >
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.dayGrid}>
        {days.map((day, index) => {
          const isToday = day === todayIso();
          const isSelected = day === selectedDate;
          const isWeekend = index >= 5;
          const markers = eventMarkersByDate.get(day) ?? [];

          return (
            <View key={day} style={styles.dayCell}>
              <Pressable
                hitSlop={8}
                onPress={() => onSelectDate(day)}
                style={[
                  styles.dayBubble,
                  isToday && styles.dayBubbleToday,
                  isSelected && styles.dayBubbleSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isWeekend && styles.dayTextWeekend,
                    isToday && styles.dayTextToday,
                    isSelected && styles.dayTextSelected,
                  ]}
                >
                  {parseIsoDate(day).getDate()}
                </Text>
              </Pressable>
              <View style={styles.dotSlot}>
                {markers.length > 0 ? (
                  <View style={styles.eventDotsRow}>
                    {markers.map((color, markerIndex) => (
                      <View
                        key={`${day}-${color}-${markerIndex}`}
                        style={[styles.eventDot, { backgroundColor: color }]}
                      />
                    ))}
                  </View>
                ) : null}
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

function _AgendaTimeline({
  canCreate,
  canDelete,
  canUpdate,
  date,
  deleting,
  error,
  events,
  isLoading,
  onCreate,
  onDelete,
  onEdit,
}: {
  canCreate: boolean;
  canDelete: boolean;
  canUpdate: boolean;
  date: string;
  deleting: boolean;
  error: unknown;
  events: CalendarEvent[];
  isLoading: boolean;
  onCreate: () => void;
  onDelete: (event: CalendarEvent) => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  const { styles, theme } = useCalendarStyles();
  const sortedEvents = [...events].sort(compareCalendarEvents);

  if (isLoading || error) {
    return <QueryState error={error} isLoading={isLoading} />;
  }

  if (sortedEvents.length === 0) {
    return (
      <View style={styles.agendaEmpty}>
        <View style={styles.agendaEmptyIcon}>
          <CalendarClock color={theme.colors.primary} size={22} />
        </View>
        <Text style={styles.agendaEmptyTitle}>Brak wydarzeń</Text>
        <Text style={styles.agendaEmptyText}>{formatDateLong(date)}</Text>
        {canCreate ? (
          <ActionButton
            onPress={onCreate}
            size="small"
            title="Dodaj wydarzenie"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.timeline}>
      {sortedEvents.map((event, index) => {
        const accent = getAgendaAccent(theme.colors, event, index);
        const secondaryText =
          event.note?.trim() || formatTimelineHour(event.eventTime);
        const locationUrl = getCalendarEventMapsUrl(event);
        const locationLabel = getCalendarEventLocationLabel(event);

        return (
          <View key={event.id} style={styles.timelineRow}>
            <View style={styles.timelineTime}>
              <Text style={styles.timelineHour}>
                {formatTimelineHour(event.eventTime)}
              </Text>
            </View>
            <Pressable
              accessibilityRole={canUpdate ? "button" : undefined}
              disabled={!canUpdate}
              onPress={() => onEdit(event)}
              style={({ pressed }) => [
                styles.agendaCard,
                { backgroundColor: accent.soft, borderColor: accent.border },
                pressed && styles.agendaCardPressed,
              ]}
            >
              <View
                style={[styles.agendaAccent, { backgroundColor: accent.color }]}
              />
              <View style={styles.agendaContent}>
                <View style={styles.agendaHeader}>
                  <View
                    style={[
                      styles.agendaIcon,
                      { backgroundColor: accent.iconSoft },
                    ]}
                  >
                    <CalendarDays color={accent.color} size={15} />
                  </View>
                  <View style={styles.agendaTitleBlock}>
                    <Text numberOfLines={2} style={styles.agendaTitle}>
                      {event.title}
                    </Text>
                    <Text numberOfLines={2} style={styles.agendaScope}>
                      {secondaryText}
                    </Text>
                  </View>
                </View>
                <View style={styles.agendaFooter}>
                  {event.reminderOffsetMinutes ? (
                    <Text style={styles.agendaMeta}>Przypomnienie</Text>
                  ) : null}
                  {locationUrl ? (
                    <Pressable
                      accessibilityLabel="Otwórz lokalizację w Google Maps"
                      accessibilityRole="link"
                      onPress={(pressEvent) => {
                        pressEvent.stopPropagation();
                        void openCalendarEventLocation(event);
                      }}
                      style={styles.locationPill}
                    >
                      <ExternalLink color={accent.color} size={12} />
                      <Text numberOfLines={1} style={styles.locationPillText}>
                        {locationLabel}
                      </Text>
                    </Pressable>
                  ) : null}
                  <View style={styles.agendaFooterSpacer} />
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
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function UpcomingEvents({
  canCreate,
  canUpdate,
  date,
  events,
  onCreate,
  onEdit,
  query,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  date: string;
  events: CalendarEvent[];
  onCreate: () => void;
  onEdit: (event: CalendarEvent) => void;
  query: { error: unknown; isLoading: boolean };
}) {
  const { styles, theme } = useCalendarStyles();
  const readableGreen = theme.isDark ? theme.colors.primaryDarker : mockupGreen;

  const sortedEvents = [...events].sort(compareCalendarEvents);

  return (
    <View style={styles.selectedEventsPanel}>
      <View style={styles.selectedEventsHeader}>
        <Text style={styles.selectedEventsTitle}>
          {formatSelectedDayTitle(date)}
        </Text>
        {date === todayIso() ? (
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>Dziś</Text>
          </View>
        ) : null}
      </View>

      {query.isLoading || query.error ? (
        <QueryState error={query.error} isLoading={query.isLoading} />
      ) : sortedEvents.length === 0 ? (
        <Text style={styles.selectedEventsEmpty}>
          Brak wydarzeń dla tego dnia.
        </Text>
      ) : (
        <View style={styles.eventStrip}>
          {sortedEvents.map((event, index) => {
            const accent = getAgendaAccent(theme.colors, event, index);
            const locationUrl = getCalendarEventMapsUrl(event);
            const meta = [
              event.eventTime?.slice(0, 5),
              event.sourceType === "google" ? "Google Calendar" : null,
            ]
              .filter(Boolean)
              .join(" / ");

            return (
              <Pressable
                accessibilityRole={canUpdate ? "button" : undefined}
                disabled={!canUpdate}
                key={event.id}
                onPress={() => onEdit(event)}
                style={({ pressed }) => [
                  styles.eventPill,
                  pressed && styles.eventPillPressed,
                ]}
              >
                <View
                  style={[
                    styles.eventSourceLine,
                    { backgroundColor: accent.color },
                  ]}
                />
                <View style={styles.eventIconFrame}>
                  <CalendarDays color={accent.color} size={19} />
                </View>
                <View style={styles.eventPillText}>
                  <Text numberOfLines={1} style={styles.eventTitle}>
                    {event.title}
                  </Text>
                  <Text style={styles.eventMeta}>{meta}</Text>
                  {locationUrl ? (
                    <Pressable
                      accessibilityLabel="Otwórz lokalizację w Google Maps"
                      accessibilityRole="link"
                      onPress={() => void openCalendarEventLocation(event)}
                      style={styles.eventLocationLink}
                    >
                      <ExternalLink color={accent.color} size={12} />
                      <Text numberOfLines={1} style={styles.eventLocationText}>
                        {getCalendarEventLocationLabel(event)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <ChevronRight color={theme.colors.text} size={19} />
              </Pressable>
            );
          })}
        </View>
      )}

      {canCreate ? (
        <Pressable
          accessibilityLabel="Dodaj wydarzenie"
          accessibilityRole="button"
          onPress={onCreate}
          style={({ pressed }) => [
            styles.addEventDashed,
            pressed && styles.addEventDashedPressed,
          ]}
        >
          <Plus color={readableGreen} size={22} />
          <Text style={styles.addEventDashedText}>Dodaj wydarzenie</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function _NotesBoard({ accessToken }: { accessToken?: string | null }) {
  const queryClient = useQueryClient();
  const permission = useModulePermission("notes");
  const { styles, theme } = useCalendarStyles();
  const readableGreen = theme.isDark ? theme.colors.primaryDarker : mockupGreen;
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
    mutationFn: () =>
      createNote(
        { description: description.trim(), title: title.trim() },
        { accessToken },
      ),
    onSuccess: async () => {
      reset();
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
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
      reset();
      setModalVisible(false);
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
        <Text style={styles.sectionTitle}>Notatki prywatne</Text>
        {permission.canCreate ? (
          <IconButton
            accessibilityLabel="Dodaj notatkę"
            onPress={() => setModalVisible(true)}
            style={styles.sectionIconButton}
          >
            <Plus color={readableGreen} size={20} />
          </IconButton>
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
          <View
            key={note.id}
            style={[
              styles.noteCard,
              { backgroundColor: theme.colors.warningSoft },
            ]}
          >
            <View style={styles.noteContent}>
              <Text numberOfLines={1} style={styles.noteTitle}>
                {note.title}
              </Text>
              {note.description ? (
                <Text numberOfLines={3} style={styles.noteText}>
                  {note.description}
                </Text>
              ) : null}
              <Text style={styles.noteMeta}>
                {formatDateTime(note.updatedAt)}
              </Text>
            </View>
            <View style={styles.rowActions}>
              {permission.canUpdate ? (
                <IconButton onPress={() => openEdit(note)}>
                  <Pencil color={theme.colors.primary} size={17} />
                </IconButton>
              ) : null}
              {permission.canDelete ? (
                <IconButton
                  disabled={deleteMutation.isPending}
                  onPress={() => deleteMutation.mutate(note.id)}
                >
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
              onPress={() =>
                isEditing ? updateMutation.mutate() : createMutation.mutate()
              }
              style={styles.modalFooterButton}
              title={isEditing ? "Zapisz" : "Dodaj"}
            />
          </View>
        }
        onClose={() => {
          reset();
          setModalVisible(false);
        }}
        subtitle={
          isEditing
            ? "Edytujesz swoją prywatną notatkę."
            : "Nowa notatka będzie widoczna tylko dla Ciebie."
        }
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

function _TodoBoard({ accessToken }: { accessToken?: string | null }) {
  const queryClient = useQueryClient();
  const permission = useModulePermission("todo");
  const { styles, theme } = useCalendarStyles();
  const readableGreen = theme.isDark ? theme.colors.primaryDarker : mockupGreen;
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.todo }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodoItem(id, { accessToken }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.todo }),
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
          <IconButton
            accessibilityLabel="Dodaj zadanie"
            onPress={() => setModalVisible(true)}
            style={styles.sectionIconButton}
          >
            <Plus color={readableGreen} size={20} />
          </IconButton>
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
            <View
              key={item.id}
              style={[styles.todoCard, done && styles.todoCardDone]}
            >
              <Pressable
                disabled={!permission.canUpdate || updateMutation.isPending}
                onPress={() => updateMutation.mutate(item)}
                style={[styles.todoCheck, done && styles.todoCheckDone]}
              >
                {done ? <Check color={theme.colors.card} size={15} /> : null}
              </Pressable>
              <View style={styles.noteContent}>
                <Text style={[styles.noteTitle, done && styles.doneText]}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text numberOfLines={2} style={styles.noteText}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              {permission.canDelete ? (
                <IconButton
                  disabled={deleteMutation.isPending}
                  onPress={() => deleteMutation.mutate(item.id)}
                >
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
        subtitle="Po zapisaniu będzie widoczne dla wszystkich domowników."
        title="Nowe do zrobienia"
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
          <InlineAlert
            text="Nie udało się dodać rzeczy do zrobienia."
            tone="error"
          />
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

function getVisibleRange(
  month: Date,
  selectedDate: string,
  view: CalendarViewMode,
) {
  if (view === "month") {
    return getMonthRange(month);
  }

  return getWeekRange(selectedDate);
}

function pickGoogleSyncFocusDate(eventDates: string[]) {
  const validDates = eventDates.filter(isIsoDate).sort();

  return validDates.find((date) => date >= todayIso()) ?? validDates[0] ?? null;
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getCalendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const firstOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, monthIndex, 0).getDate();
  const days: Array<{ inMonth: boolean; iso: string | null; label: number }> =
    [];

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

function getWeekRange(value: string) {
  const weekStart = getWeekStart(parseIsoDate(value));
  const weekEnd = addDays(weekStart, 6);

  return {
    from: dateToIso(weekStart),
    to: dateToIso(weekEnd),
  };
}

function getWeekDays(value: string) {
  const weekStart = getWeekStart(parseIsoDate(value));

  return Array.from({ length: 7 }, (_, index) =>
    dateToIso(addDays(weekStart, index)),
  );
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  const offset = (start.getDay() + 6) % 7;

  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);

  return start;
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + amount);

  return nextDate;
}

function parseIsoDate(value: string) {
  const [year = "0", month = "1", day = "1"] = value.split("-");

  return new Date(Number(year), Number(month) - 1, Number(day));
}

function dateToIso(date: Date) {
  return isoFromParts(date.getFullYear(), date.getMonth(), date.getDate());
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

function formatPeriodTitle(
  view: CalendarViewMode,
  visibleMonth: Date,
  selectedDate: string,
): string {
  if (view === "month") {
    return formatMonthTitle(visibleMonth);
  }

  const range = getWeekRange(selectedDate);

  return `${formatDate(range.from)} - ${formatDate(range.to)}`;
}

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return `${value.slice(8, 10)}.${value.slice(5, 7)}`;
}

function formatDateLong(value: string): string {
  const date = parseIsoDate(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(date);
}

function formatSelectedDayTitle(value: string): string {
  const title = formatDateLong(value);

  return title.charAt(0).toUpperCase() + title.slice(1);
}

function _formatEventCount(count: number): string {
  if (count === 0) {
    return "Brak wydarzeń w tym dniu";
  }

  if (count === 1) {
    return "1 wydarzenie w tym dniu";
  }

  if (count >= 2 && count <= 4) {
    return `${count} wydarzenia w tym dniu`;
  }

  return `${count} wydarzeń w tym dniu`;
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

  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
}

function normalizeEventTime(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function normalizeLocationUrlInput(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return buildGoogleMapsSearchUrl(trimmed);
}

function getCalendarEventMapsUrl(event: CalendarEvent): string | null {
  const rawUrl = event.locationUrl?.trim() || "";
  const rawLocation = event.locationName?.trim() || "";

  if (rawUrl) {
    return normalizeLocationUrlInput(rawUrl);
  }

  if (rawLocation) {
    return normalizeLocationUrlInput(rawLocation);
  }

  return null;
}

function getCalendarEventLocationLabel(event: CalendarEvent): string {
  const rawLocation = event.locationName?.trim();

  if (rawLocation && !/^https?:\/\//i.test(rawLocation)) {
    return rawLocation;
  }

  return "Google Maps";
}

async function openCalendarEventLocation(event: CalendarEvent): Promise<void> {
  const url = getCalendarEventMapsUrl(event);

  if (url) {
    await Linking.openURL(url);
  }
}

function buildGoogleMapsSearchUrl(value: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

function compareCalendarEvents(left: CalendarEvent, right: CalendarEvent) {
  const leftTime = left.eventTime ?? "99:99";
  const rightTime = right.eventTime ?? "99:99";

  if (leftTime !== rightTime) {
    return leftTime.localeCompare(rightTime);
  }

  return left.title.localeCompare(right.title);
}

function formatTimelineHour(value: string | null): string {
  if (!value) {
    return "Cały dzień";
  }

  return value.slice(0, 5);
}

function buildEventMarkersByDate(
  events: CalendarEvent[],
  colors: AppPalette,
): Map<string, string[]> {
  const markersByDate = new Map<string, string[]>();
  const seenMarkersByDate = new Map<string, Set<string>>();

  events.forEach((event, index) => {
    const marker = getCalendarEventMarkerColor(colors, event, index);
    const markerKey = `${event.sourceType}:${getCalendarEventSourceKey(event)}:${marker}`;
    const seen = seenMarkersByDate.get(event.eventDate) ?? new Set<string>();

    if (seen.has(markerKey)) {
      return;
    }

    seen.add(markerKey);
    seenMarkersByDate.set(event.eventDate, seen);
    markersByDate.set(
      event.eventDate,
      [...(markersByDate.get(event.eventDate) ?? []), marker].slice(0, 4),
    );
  });

  return markersByDate;
}

function getAgendaAccent(
  colors: AppPalette,
  event: CalendarEvent,
  index: number,
) {
  const color =
    event.sourceType === "google"
      ? getCalendarEventMarkerColor(colors, event, index)
      : mockupGreen;

  return {
    border: withAlpha(color, event.sourceType === "google" ? 0.36 : 0.22),
    color,
    iconSoft: withAlpha(color, 0.12),
    soft: event.sourceType === "google" ? withAlpha(color, 0.08) : colors.card,
  };
}

function getCalendarEventMarkerColor(
  colors: AppPalette,
  event: CalendarEvent,
  index = 0,
): string {
  if (event.sourceType !== "google") {
    const markerKey = `${event.eventDate}:${event.title}:${event.id}:${index}`;

    return (
      localCalendarMarkerColors[
        hashString(markerKey) % localCalendarMarkerColors.length
      ] ?? colors.calendar
    );
  }

  const sourceKey = getCalendarEventSourceKey(event);

  return (
    googleCalendarMarkerColors[
      hashString(sourceKey) % googleCalendarMarkerColors.length
    ] ?? "#22D3EE"
  );
}

function getCalendarEventSourceKey(event: CalendarEvent): string {
  return (
    event.googleCalendarOwnerMemberId ??
    event.ownerMemberId ??
    event.googleCalendarConnectionId ??
    event.googleCalendarAccountEmail ??
    event.id
  );
}

function hashString(value: string): number {
  return value
    .split("")
    .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 0);
}

function withAlpha(color: string, opacity: number) {
  if (!color.startsWith("#")) {
    return color;
  }

  const normalized =
    color.length === 4
      ? color
          .slice(1)
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : color.slice(1, 7);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return color;
  }

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function reminderValueToMinutes(value: ReminderValue): number | null {
  return value === "none" ? null : Number(value);
}

function minutesToReminderValue(
  value: number | null | undefined,
): ReminderValue {
  if (value === 15 || value === 30 || value === 60 || value === 1440) {
    return String(value) as ReminderValue;
  }

  return "none";
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

function createStyles(colors: AppPalette, viewportWidth: number) {
  const isDark = colors.background === "#0C1220";
  const displayFontFamily = Platform.select({
    android: "serif",
    ios: "Georgia",
  });
  const isCompact = viewportWidth < 430;
  const panelBackground = isDark ? colors.card : "#FFFFFF";
  const panelBorder = isDark ? colors.border : "#E8DED2";
  const panelShadowOpacity = isDark ? 0.18 : 0.065;
  const selectedDayBackground = isDark ? "rgba(155, 212, 124, 0.2)" : "#EEF7E8";
  const selectedDayBorder = isDark
    ? "rgba(199, 242, 174, 0.5)"
    : "rgba(79, 141, 44, 0.2)";
  const selectedDayText = isDark ? colors.primaryDarker : "#2F641F";
  const readableGreen = isDark ? colors.primaryDarker : mockupGreen;
  const filledGreen = isDark ? colors.primary : mockupGreen;
  const filledGreenText = isDark ? colors.inverseText : "#FFFFFF";

  return StyleSheet.create({
    addEventDashed: {
      alignItems: "center",
      backgroundColor: panelBackground,
      borderColor: isDark ? colors.border : "#DDE7D7",
      borderRadius: 12,
      borderStyle: "solid",
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: isCompact ? 42 : 54,
      paddingHorizontal: spacing.md,
    },
    addEventDashedPressed: {
      opacity: 0.76,
    },
    addEventDashedText: {
      color: readableGreen,
      fontSize: isCompact ? 14 : 16,
      fontWeight: "700",
      letterSpacing: 0,
    },
    addHeaderButton: {
      backgroundColor: panelBackground,
      borderColor: isDark ? colors.border : "#DDE7D7",
    },
    calendarCancelButton: {
      backgroundColor: panelBackground,
      borderColor: isDark ? colors.border : "#DDE7D7",
    },
    calendarCancelButtonLabel: {
      color: readableGreen,
    },
    calendarSaveButton: {
      backgroundColor: filledGreen,
      borderColor: filledGreen,
      shadowColor: filledGreen,
    },
    calendarSaveButtonLabel: {
      color: filledGreenText,
    },
    calendarCard: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      overflow: "hidden",
      paddingHorizontal: isCompact ? 6 : spacing.sm,
      paddingVertical: isCompact ? 9 : spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 24,
    },
    calendarModeCard: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      flexDirection: "row",
      gap: 3,
      padding: 4,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 20,
    },
    calendarModeOption: {
      alignItems: "center",
      borderColor: "transparent",
      borderRadius: 11,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      gap: 5,
      justifyContent: "center",
      minHeight: isCompact ? 42 : 48,
    },
    calendarModeOptionActive: {
      backgroundColor: isDark ? colors.cardMuted : "#F6FAF0",
      borderColor: isDark ? colors.border : "#E2EAD9",
    },
    calendarModeOptionPressed: {
      opacity: 0.78,
    },
    calendarModeText: {
      color: colors.text,
      fontSize: isCompact ? 14 : 17,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: isCompact ? 21 : 25,
    },
    calendarModeTextActive: {
      color: readableGreen,
    },
    calendarLoading: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
    },
    calendarToast: {
      alignSelf: "center",
      backgroundColor: colors.successSoft,
      borderColor: `${colors.primary}33`,
      borderRadius: radii.control,
      borderWidth: 1,
      elevation: 6,
      maxWidth: "92%",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      position: "absolute",
      top: 62,
      zIndex: 20,
    },
    calendarToastInfo: {
      backgroundColor: colors.softBlue,
      borderColor: colors.border,
    },
    calendarToastText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 18,
      textAlign: "center",
    },
    calendarScreenContent: {
      gap: isCompact ? 8 : spacing.md,
      paddingHorizontal: spacing.md,
      paddingTop: isCompact ? 0 : spacing.sm,
    },
    agendaAccent: {
      alignSelf: "stretch",
      width: 5,
    },
    agendaCard: {
      borderRadius: radii.card,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      minHeight: 86,
      overflow: "hidden",
    },
    agendaCardPressed: {
      opacity: 0.82,
    },
    agendaContent: {
      flex: 1,
      gap: spacing.sm,
      justifyContent: "space-between",
      minWidth: 0,
      padding: spacing.md,
    },
    agendaEmpty: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg,
    },
    agendaEmptyIcon: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    agendaEmptyText: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 18,
      textAlign: "center",
    },
    agendaEmptyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    agendaFooter: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      minHeight: 28,
    },
    agendaFooterSpacer: {
      flex: 1,
    },
    agendaHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
    },
    agendaIcon: {
      alignItems: "center",
      borderRadius: 999,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    agendaMeta: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "400",
      letterSpacing: 0,
    },
    agendaScope: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "400",
      letterSpacing: 0,
      lineHeight: 16,
    },
    agendaTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 19,
    },
    agendaTitleBlock: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    calendarTopPanel: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    dayBubble: {
      alignItems: "center",
      borderRadius: 999,
      height: isCompact ? 28 : 42,
      justifyContent: "center",
      width: isCompact ? 28 : 42,
    },
    dayBubbleMuted: {
      opacity: 0.42,
    },
    dayBubbleSelected: {
      backgroundColor: selectedDayBackground,
      borderColor: selectedDayBorder,
      borderWidth: 1,
    },
    dayBubbleToday: {
      backgroundColor: isDark ? colors.cardMuted : "transparent",
    },
    dayCell: {
      alignItems: "center",
      flexBasis: "14.285%",
      height: isCompact ? 50 : 64,
      justifyContent: "flex-start",
    },
    dayCellWeekDivider: {
      borderTopColor: isDark ? colors.border : "#F1ECE4",
      borderTopWidth: 1,
      paddingTop: isCompact ? 2 : 4,
    },
    dayGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    dayText: {
      color: colors.text,
      fontSize: isCompact ? 14 : 19,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: isCompact ? 20 : 30,
    },
    dayTextMuted: {
      color: colors.textSubtle,
    },
    dayTextSelected: {
      color: selectedDayText,
    },
    dayTextToday: {
      color: colors.text,
    },
    dayTextWeekend: {
      color: colors.textMuted,
    },
    doneText: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    dotSlot: {
      alignItems: "center",
      height: isCompact ? 11 : 16,
      justifyContent: "center",
    },
    eventDotsRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 2,
      justifyContent: "center",
    },
    eventDot: {
      backgroundColor: colors.warning,
      borderRadius: 999,
      height: isCompact ? 3 : 4,
      width: isCompact ? 13 : 20,
    },
    eventMeta: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "400",
      letterSpacing: 0,
    },
    eventIconFrame: {
      alignItems: "center",
      backgroundColor: isDark ? colors.cardMuted : colors.successSoft,
      borderRadius: 11,
      height: isCompact ? 38 : 48,
      justifyContent: "center",
      width: isCompact ? 38 : 48,
    },
    eventLocationLink: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 4,
      marginTop: 2,
      maxWidth: "100%",
    },
    eventLocationText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
    },
    eventPill: {
      alignItems: "center",
      alignSelf: "stretch",
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: isCompact ? spacing.sm : spacing.md,
      minHeight: isCompact ? 58 : 80,
      overflow: "hidden",
      paddingHorizontal: isCompact ? 10 : spacing.md,
      paddingVertical: isCompact ? 5 : spacing.sm,
    },
    eventPillPressed: {
      opacity: 0.78,
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
      flexDirection: "column",
      gap: isCompact ? spacing.sm : spacing.md,
    },
    eventSourceLine: {
      alignSelf: "stretch",
      borderRadius: 999,
      width: isCompact ? 5 : 7,
    },
    eventSourceDot: {
      borderRadius: 999,
      height: 8,
      width: 8,
    },
    eventTitle: {
      color: colors.text,
      fontSize: isCompact ? 13 : 15,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: isCompact ? 18 : 23,
    },
    fab: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 56,
      justifyContent: "center",
      width: 56,
    },
    fabPressed: {
      opacity: 0.82,
      transform: [{ scale: 0.98 }],
    },
    fabRow: {
      alignItems: "flex-end",
      paddingHorizontal: spacing.xs,
      paddingTop: spacing.xs,
    },
    flexInput: {
      flex: 1,
    },
    formGroup: {
      gap: spacing.xs,
    },
    formLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    formRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    googleHeaderButton: {
      backgroundColor: isDark ? colors.card : "#FFFFFF",
      borderColor: isDark ? colors.border : "#E6DFD4",
    },
    googleHeaderImage: {
      height: isCompact ? 26 : 30,
      width: isCompact ? 26 : 30,
    },
    googleHeaderImageDisabled: {
      opacity: 0.48,
    },
    googleHeaderButtonConnected: {
      borderColor: isDark ? colors.border : "#EDE7DC",
    },
    headerIconButton: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderWidth: 1,
      elevation: 1,
      borderRadius: 999,
      height: isCompact ? 40 : 48,
      padding: 0,
      shadowColor: "#000000",
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 10,
      width: isCompact ? 40 : 48,
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 5,
    },
    input: {
      backgroundColor: panelBackground,
      borderColor: isDark ? colors.border : "#E1E7DD",
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
    locationPill: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: 4,
      maxWidth: 150,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    locationPillText: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
    },
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    modalDeleteButton: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      height: 44,
      width: 44,
    },
    periodHeader: {
      alignItems: "center",
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: isCompact ? 48 : 68,
      paddingHorizontal: isCompact ? 7 : spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 20,
    },
    periodNavButton: {
      alignItems: "center",
      backgroundColor: isDark ? colors.cardMuted : "#FFFEFC",
      borderColor: panelBorder,
      borderRadius: 9,
      borderWidth: 1,
      elevation: 1,
      height: isCompact ? 30 : 44,
      justifyContent: "center",
      padding: 0,
      shadowColor: "#000000",
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 10,
      width: isCompact ? 30 : 44,
    },
    periodSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "400",
      letterSpacing: 0,
      lineHeight: 17,
      textAlign: "center",
    },
    periodText: {
      alignItems: "center",
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    periodTitle: {
      color: colors.text,
      fontSize: isCompact ? 18 : 25,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "center",
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
    sectionIconButton: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderWidth: 1,
      height: 38,
      width: 38,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    selectedDayIcon: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    selectedDayMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "400",
      letterSpacing: 0,
      lineHeight: 17,
    },
    selectedDaySummary: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 56,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    selectedDayText: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    selectedDayTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 19,
      textTransform: "capitalize",
    },
    selectedEventsEmpty: {
      color: colors.textMuted,
      fontSize: isCompact ? 12 : 15,
      fontWeight: "400",
      letterSpacing: 0,
      lineHeight: isCompact ? 17 : 21,
      paddingVertical: isCompact ? spacing.sm : spacing.md,
    },
    selectedEventsHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    selectedEventsPanel: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      gap: isCompact ? 8 : spacing.md,
      padding: isCompact ? 9 : spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: panelShadowOpacity,
      shadowRadius: 24,
    },
    selectedEventsTitle: {
      color: colors.text,
      flex: 1,
      fontSize: isCompact ? 17 : 22,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: isCompact ? 22 : 28,
      minWidth: 0,
    },
    textArea: {
      minHeight: 86,
      paddingTop: spacing.md,
      textAlignVertical: "top",
    },
    timeline: {
      gap: spacing.md,
      paddingTop: spacing.xs,
    },
    timelineHour: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 20,
      textAlign: "right",
    },
    timelineRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    timelineTime: {
      alignItems: "flex-end",
      paddingTop: spacing.sm,
      width: 64,
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
      color: colors.text,
      flex: 1,
      fontFamily: displayFontFamily,
      fontSize: isCompact ? 11 : 14,
      fontWeight: "400",
      letterSpacing: 0,
      textAlign: "center",
    },
    weekLabelWeekend: {
      color: colors.textMuted,
    },
    weekDay: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flex: 1,
      gap: 3,
      justifyContent: "center",
      minHeight: 58,
      paddingVertical: spacing.xs,
    },
    weekDayActive: {
      backgroundColor: colors.card,
      borderColor: colors.primaryLight,
    },
    weekDayName: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0,
    },
    weekDayNameActive: {
      color: colors.primaryDark,
    },
    weekDayNumber: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    weekDayNumberActive: {
      color: colors.primaryDarker,
    },
    weekDayNumberToday: {
      color: colors.primaryDark,
    },
    weekDayPressed: {
      opacity: 0.78,
    },
    weekRow: {
      flexDirection: "row",
      paddingBottom: isCompact ? 6 : spacing.md,
    },
    weekPanel: {
      backgroundColor: panelBackground,
      borderColor: panelBorder,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    weekStrip: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    todayBadge: {
      alignItems: "center",
      backgroundColor: isDark ? colors.cardMuted : "#F7FAF0",
      borderColor: panelBorder,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 1,
      justifyContent: "center",
      minHeight: isCompact ? 32 : 38,
      paddingHorizontal: spacing.sm,
    },
    todayBadgeText: {
      color: readableGreen,
      fontFamily: displayFontFamily,
      fontSize: isCompact ? 14 : 16,
      fontWeight: "400",
      letterSpacing: 0,
    },
  });
}
