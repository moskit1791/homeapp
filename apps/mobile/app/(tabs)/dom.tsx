import {
  REALTIME_EVENTS,
  type ModuleKey,
  type RealtimeEventType,
} from "@homeapp/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  completeAnnualCost,
  completeCleaningTask,
  createAnnualCost,
  createAttachmentRecord,
  createAttachmentUploadUrl,
  createCleaningTask,
  createDataEntry,
  deleteAttachment,
  deleteCleaningTask,
  deleteDataEntry,
  deleteMyAccount,
  getAttachmentFileRequest,
  getMyHousehold,
  inviteHouseholdMember,
  listNotificationPreferences,
  listAnnualCostHistory,
  listAnnualCosts,
  listAttachments,
  listCleaningTasks,
  listDataEntries,
  listHouseholdMembers,
  queryKeys,
  removeHouseholdMember,
  sendTestPush,
  updateAttachment,
  updateCleaningTask,
  updateMyHousehold,
  updateNotificationPreferences,
  uploadAttachmentFile,
  type AnnualCost,
  type AnnualCostHistory,
  type Attachment,
  type CleaningTask,
  type DataEntry,
  type HouseholdMember,
  type NotificationPreference,
} from "../../src/api";
import { registerForPushNotifications } from "../../src/notifications/register-push-notifications";
import {
  useModulePermission,
  usePermissions,
} from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import {
  useAppTheme,
  useThemePreferences,
  type AppPalette,
  type ThemeMode,
} from "../../src/theme/use-app-theme";
import {
  currencyOptions,
  formatCurrencyAmount,
  normalizeCurrencyCode,
  type SupportedCurrencyCode,
} from "../../src/utils/currency";
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
  Broom,
  CalendarDays,
  ChartBar,
  ChevronLeft,
  ChevronRight,
  Close,
  Cog,
  Database,
  Download,
  FileText,
  Folder,
  MailPlus,
  MapPin,
  Pencil,
  Trash2,
  Users,
} from "../../src/ui/icon";

type HomeSegment = "cleaning" | "annual_costs" | "data_entries" | "attachments";
type SettingsView = "main" | "appearance" | "members";
type ImageAttachmentMimeType = Extract<
  Attachment["mimeType"],
  "image/jpeg" | "image/png" | "image/webp"
>;
const fontScaleSliderMin = 0.9;
const fontScaleSliderMax = 1.3;
const themeModeOptions: Array<{ label: string; value: ThemeMode }> = [
  { label: "System", value: "system" },
  { label: "Jasny", value: "light" },
  { label: "Ciemny", value: "dark" },
];

type PickedAttachmentPhoto = {
  fileName: string;
  fileSize?: number;
  mimeType: ImageAttachmentMimeType;
  uri: string;
};

const imageAttachmentMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const mockupGreen = "#4F8D2C";

type Accent = {
  color: string;
  soft: string;
};

const moduleTiles: Array<{
  description: string;
  label: string;
  moduleKey: ModuleKey;
  title: string;
  value: HomeSegment;
}> = [
  {
    description: "Plan zadań i harmonogram sprzątania",
    label: "Sprzątanie",
    moduleKey: "cleaning",
    title: "Sprzątanie",
    value: "cleaning",
  },
  {
    description: "Przegląd i analiza wydatków rocznych",
    label: "Koszty",
    moduleKey: "annual_costs",
    title: "Koszty roczne",
    value: "annual_costs",
  },
  {
    description: "Eksport, kopie zapasowe i dane",
    label: "Dane",
    moduleKey: "data_entries",
    title: "Dane",
    value: "data_entries",
  },
  {
    description: "Dokumenty i rachunki w jednym miejscu",
    label: "Pliki",
    moduleKey: "attachments",
    title: "Pliki",
    value: "attachments",
  },
];

const notificationPreferenceLabels: Record<
  RealtimeEventType,
  { label: string; meta: string }
> = {
  "annual_cost.changed": {
    label: "Koszty roczne",
    meta: "Nowe, zmienione i oznaczone koszty roczne.",
  },
  "attachment.changed": {
    label: "Pliki",
    meta: "Dodanie, opis i usunięcie plików.",
  },
  "calendar.changed": {
    label: "Kalendarz",
    meta: "Wydarzenia dodane lub zmienione przez domowników.",
  },
  "cleaning.changed": {
    label: "Sprzątanie",
    meta: "Zadania sprzątania i oznaczenia wykonania.",
  },
  "data.changed": {
    label: "Dane",
    meta: "Wpisy w domowym sejfie danych.",
  },
  "finance.changed": {
    label: "Finanse",
    meta: "Kategorie, budżety, wydatki i dochody.",
  },
  "finance.month.deleted": {
    label: "Usunięcie miesiąca finansów",
    meta: "Kiedy domownik usunie miesiąc budżetu.",
  },
  "finance.month.generated": {
    label: "Nowy miesiąc finansów",
    meta: "Kiedy domownik wygeneruje kolejny miesiąc.",
  },
  "household.changed": {
    label: "Dom",
    meta: "Zmiany ustawień domu i składu domowników.",
  },
  "meal.changed": {
    label: "Plan posiłków",
    meta: "Tygodnie, posiłki i inspiracje kulinarne.",
  },
  "note.changed": {
    label: "Notatki prywatne",
    meta: "Prywatne notatki nie wysyłają powiadomień domownikom.",
  },
  "permissions.changed": {
    label: "Uprawnienia",
    meta: "Zmiany dostępu do modułów.",
  },
  "shopping.changed": {
    label: "Zakupy",
    meta: "Produkty dodane, odhaczone lub usunięte z list.",
  },
  "todo.changed": {
    label: "Do zrobienia",
    meta: "Wspólne rzeczy dodane, zamknięte lub przywrócone.",
  },
};

const visibleNotificationEventTypes = REALTIME_EVENTS.filter(
  (eventType) => eventType !== "note.changed",
);

export default function DomScreen() {
  const params = useLocalSearchParams<{
    segment?: HomeSegment;
    settings?: string;
  }>();
  const permissionsQuery = usePermissions();
  const theme = useAppTheme();
  const [activeSegment, setActiveSegment] = useState<HomeSegment>("cleaning");
  const availableTiles = useMemo(
    () =>
      moduleTiles.filter(
        (tile) =>
          permissionsQuery.data?.find(
            (permission) => permission.moduleKey === tile.moduleKey,
          )?.canRead,
      ),
    [permissionsQuery.data],
  );
  const availableSegments = useMemo(
    () =>
      availableTiles.map((tile) => ({
        icon: (active: boolean): ReactNode =>
          getSegmentIcon(
            tile.value,
            active ? mockupGreen : theme.colors.textMuted,
            16,
          ),
        label: tile.label,
        value: tile.value,
      })),
    [availableTiles, theme.colors.textMuted],
  );
  const screenBackground =
    theme.colors.background === "#0C1220" ? theme.colors.background : "#FBFAF6";

  useEffect(() => {
    if (
      params.segment &&
      availableTiles.some((tile) => tile.value === params.segment)
    ) {
      setActiveSegment(params.segment);
      return;
    }

    if (
      permissionsQuery.isSuccess &&
      availableTiles.length > 0 &&
      !availableTiles.some((tile) => tile.value === activeSegment)
    ) {
      setActiveSegment(availableTiles[0]!.value);
    }
  }, [
    activeSegment,
    availableTiles,
    params.segment,
    permissionsQuery.isSuccess,
  ]);

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen backgroundColor={screenBackground} title="Dom">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      actions={<SettingsRow openOnMount={params.settings === "1"} />}
      backgroundColor={screenBackground}
      subtitle="Zarządzaj swoim domem"
      title="Dom"
    >
      {availableTiles.length === 0 ? (
        <InlineAlert text="Nie masz dostępu do modułów domowych." />
      ) : (
        <SegmentedControl
          accentColor={mockupGreen}
          onChange={setActiveSegment}
          options={availableSegments}
          presentation="mockup"
          value={activeSegment}
        />
      )}

      {availableTiles.length > 0 ? (
        <ActiveModule segment={activeSegment} />
      ) : null}
    </AppScreen>
  );
}

function ActiveModule({ segment }: { segment: HomeSegment }) {
  if (segment === "cleaning") {
    return <CleaningPanel />;
  }

  if (segment === "annual_costs") {
    return <AnnualCostsPanel />;
  }

  if (segment === "data_entries") {
    return <DataEntriesPanel />;
  }

  return <AttachmentsPanel />;
}

function CleaningPanel() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("cleaning");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const cleaningTasksQueryKey = [...queryKeys.cleaning, "tasks"] as const;
  const accent = getSegmentAccent(theme.colors, "cleaning");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [frequencyDays, setFrequencyDays] = useState("7");
  const [nextDueAt, setNextDueAt] = useState(todayIso());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() =>
    monthAnchor(new Date()),
  );
  const [editingTask, setEditingTask] = useState<CleaningTask | null>(null);
  const [completionNotice, setCompletionNotice] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const tasksQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listCleaningTasks({ accessToken }),
    queryKey: cleaningTasksQueryKey,
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createCleaningTask(
        {
          completionWindowDays: 0,
          frequencyDays: Number(frequencyDays) || 1,
          frequencyMode: "preset",
          location: location.trim() || undefined,
          name: name.trim(),
          nextDueAt,
        },
        { accessToken },
      ),
    onSuccess: async (task) => {
      queryClient.setQueryData<CleaningTask[]>(
        cleaningTasksQueryKey,
        (current = []) => sortCleaningTasksForDisplay([...current, task]),
      );
      setName("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cleaning });
    },
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      completeCleaningTask(id, { completedAt: todayIso() }, { accessToken }),
    onError: (
      _error,
      _id,
      context: { previousTasks?: CleaningTask[] } | undefined,
    ) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(cleaningTasksQueryKey, context.previousTasks);
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cleaning });
      const previousTasks = queryClient.getQueryData<CleaningTask[]>(
        cleaningTasksQueryKey,
      );
      const completedAt = todayIso();
      const updatedAt = new Date().toISOString();

      queryClient.setQueryData<CleaningTask[]>(
        cleaningTasksQueryKey,
        (current = []) =>
          sortCleaningTasksForDisplay(
            current.map((task) =>
              task.id === id
                ? {
                    ...task,
                    isOverdue: false,
                    nextDueAt: addDaysIsoDate(completedAt, task.frequencyDays),
                    reminderSentAt: null,
                    updatedAt,
                  }
                : task,
            ),
          ),
      );

      return { previousTasks };
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cleaning });
    },
    onSuccess: (task) => {
      queryClient.setQueryData<CleaningTask[]>(
        cleaningTasksQueryKey,
        (current = []) =>
          sortCleaningTasksForDisplay(
            current.map((item) => (item.id === task.id ? task : item)),
          ),
      );
      setCompletionNotice(
        "Zadanie oznaczone jako wykonane. Termin został przeliczony.",
      );
      setTimeout(() => setCompletionNotice(""), 2200);
    },
  });
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingTask) {
        throw new Error("Missing cleaning task");
      }

      return updateCleaningTask(
        editingTask.id,
        {
          completionWindowDays: editingTask.completionWindowDays,
          frequencyDays: Number(frequencyDays) || 1,
          frequencyMode: editingTask.frequencyMode,
          location: location.trim() || undefined,
          name: name.trim(),
          nextDueAt,
        },
        { accessToken },
      );
    },
    onSuccess: async (task) => {
      queryClient.setQueryData<CleaningTask[]>(
        cleaningTasksQueryKey,
        (current = []) =>
          sortCleaningTasksForDisplay(
            current.map((item) => (item.id === task.id ? task : item)),
          ),
      );
      setName("");
      setEditingTask(null);
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cleaning });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCleaningTask(id, { accessToken }),
    onError: (
      _error,
      _id,
      context: { previousTasks?: CleaningTask[] } | undefined,
    ) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(cleaningTasksQueryKey, context.previousTasks);
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cleaning });
      const previousTasks = queryClient.getQueryData<CleaningTask[]>(
        cleaningTasksQueryKey,
      );

      queryClient.setQueryData<CleaningTask[]>(
        cleaningTasksQueryKey,
        (current = []) => current.filter((task) => task.id !== id),
      );

      return { previousTasks };
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cleaning });
    },
    onSuccess: () => {
      setEditingTask(null);
      setModalVisible(false);
    },
  });
  const tasks = tasksQuery.data ?? [];
  const overdue = tasks.filter((task) => task.isOverdue).length;
  const canSave =
    (editingTask ? permission.canUpdate : permission.canCreate) &&
    Boolean(name.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(nextDueAt) &&
    !createMutation.isPending &&
    !updateMutation.isPending;

  function openCreateTask() {
    setEditingTask(null);
    setName("");
    setLocation("");
    setFrequencyDays("7");
    setNextDueAt(todayIso());
    setDatePickerMonth(monthAnchor(new Date()));
    setDatePickerVisible(false);
    setModalVisible(true);
  }

  function openEditTask(task: CleaningTask) {
    setEditingTask(task);
    setName(task.name);
    setLocation(task.location ?? "");
    setFrequencyDays(String(task.frequencyDays));
    setNextDueAt(task.nextDueAt);
    setDatePickerMonth(monthAnchor(parseIsoDate(task.nextDueAt)));
    setDatePickerVisible(false);
    setModalVisible(true);
  }

  function closeTaskModal() {
    setEditingTask(null);
    setDatePickerVisible(false);
    setModalVisible(false);
  }

  return (
    <ModulePanel
      accent={accent}
      action={
        permission.canCreate ? (
          <IconButton
            accessibilityLabel="Dodaj zadanie sprzątania"
            onPress={openCreateTask}
            style={styles.homeHeaderButton}
          >
            <Broom color={accent.color} size={22} />
          </IconButton>
        ) : undefined
      }
      icon={<Broom color={accent.color} size={18} />}
      subtitle={`${tasks.length} zadań / ${overdue} po terminie`}
      title="Sprzątanie"
    >
      {completionNotice ? <InlineAlert text={completionNotice} /> : null}
      <QueryState
        emptyText="Brak zadań sprzątania."
        error={tasksQuery.error}
        isEmpty={!tasksQuery.isLoading && tasks.length === 0}
        isLoading={tasksQuery.isLoading}
      />
      <View style={styles.itemList}>
        {tasks.map((task) => (
          <CleaningRow
            accent={accent}
            canUpdate={permission.canUpdate}
            completing={
              completeMutation.isPending &&
              completeMutation.variables === task.id
            }
            key={task.id}
            onComplete={() => completeMutation.mutate(task.id)}
            onEdit={() => openEditTask(task)}
            task={task}
          />
        ))}
      </View>
      <FormModal
        footer={
          <View style={styles.modalFooterStack}>
            {editingTask && permission.canDelete ? (
              <ActionButton
                labelStyle={styles.deleteButtonLabel}
                loading={deleteMutation.isPending}
                onPress={() => deleteMutation.mutate(editingTask.id)}
                style={styles.deleteButton}
                title="Usuń zadanie"
                variant="secondary"
              />
            ) : null}
            <View style={styles.modalFooter}>
              <ActionButton
                onPress={closeTaskModal}
                style={styles.modalFooterButton}
                title="Anuluj"
                variant="secondary"
              />
              <ActionButton
                disabled={!canSave}
                loading={createMutation.isPending || updateMutation.isPending}
                onPress={() =>
                  editingTask
                    ? updateMutation.mutate()
                    : createMutation.mutate()
                }
                style={styles.modalFooterButton}
                title={editingTask ? "Zapisz" : "Dodaj"}
              />
            </View>
          </View>
        }
        onClose={closeTaskModal}
        subtitle="Dodajesz cykliczne zadanie domowe z następnym terminem."
        title="Nowe zadanie sprzątania"
        visible={modalVisible}
      >
        <TextInput
          onChangeText={setName}
          placeholder="Nazwa zadania"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={name}
        />
        <TextInput
          onChangeText={setLocation}
          placeholder="Lokalizacja (np. Łazienka)"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={location}
        />
        <View style={styles.formRow}>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setFrequencyDays}
            placeholder="Co ile dni"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.flexInput]}
            value={frequencyDays}
          />
          <Pressable
            accessibilityLabel="Wybierz termin w kalendarzu"
            accessibilityRole="button"
            onPress={() => setDatePickerVisible((value) => !value)}
            style={[styles.input, styles.dateInput, styles.datePickerTrigger]}
          >
            <Text numberOfLines={1} style={styles.datePickerTriggerText}>
              {formatDateFull(nextDueAt)}
            </Text>
            <CalendarDays color={theme.colors.textMuted} size={18} />
          </Pressable>
        </View>
        {datePickerVisible ? (
          <InlineDatePicker
            month={datePickerMonth}
            onChangeMonth={setDatePickerMonth}
            onSelectDate={(date) => {
              setNextDueAt(date);
              setDatePickerMonth(monthAnchor(parseIsoDate(date)));
              setDatePickerVisible(false);
            }}
            selectedDate={nextDueAt}
          />
        ) : null}
        {updateMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się zapisać zadania." />
        ) : null}
        {createMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się dodać zadania." />
        ) : null}
      </FormModal>
    </ModulePanel>
  );
}

function InlineDatePicker({
  month,
  onChangeMonth,
  onSelectDate,
  selectedDate,
}: {
  month: Date;
  onChangeMonth: (month: Date) => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const days = getCalendarDays(month);

  return (
    <View style={styles.inlineDatePicker}>
      <View style={styles.inlineDatePickerHeader}>
        <IconButton
          accessibilityLabel="Poprzedni miesiąc"
          onPress={() => onChangeMonth(addMonths(month, -1))}
          style={styles.inlineDatePickerNav}
        >
          <ChevronLeft color={theme.colors.textMuted} size={18} />
        </IconButton>
        <Text style={styles.inlineDatePickerTitle}>
          {formatMonthTitle(month)}
        </Text>
        <IconButton
          accessibilityLabel="Następny miesiąc"
          onPress={() => onChangeMonth(addMonths(month, 1))}
          style={styles.inlineDatePickerNav}
        >
          <ChevronRight color={theme.colors.textMuted} size={18} />
        </IconButton>
      </View>
      <View style={styles.inlineDatePickerWeekRow}>
        {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((weekday) => (
          <Text key={weekday} style={styles.inlineDatePickerWeekLabel}>
            {weekday}
          </Text>
        ))}
      </View>
      <View style={styles.inlineDatePickerGrid}>
        {days.map((day, index) => {
          const selected = day.iso === selectedDate;
          const today = day.iso === todayIso();

          return (
            <Pressable
              accessibilityLabel={
                day.iso ? `Wybierz ${formatDateFull(day.iso)}` : undefined
              }
              accessibilityRole={day.iso ? "button" : undefined}
              disabled={!day.iso}
              key={`${day.iso ?? "empty"}-${day.label}-${index}`}
              onPress={() => {
                if (day.iso) {
                  onSelectDate(day.iso);
                }
              }}
              style={[
                styles.inlineDatePickerDay,
                !day.inMonth && styles.inlineDatePickerDayMuted,
                today && styles.inlineDatePickerDayToday,
                selected && styles.inlineDatePickerDaySelected,
              ]}
            >
              <Text
                style={[
                  styles.inlineDatePickerDayText,
                  !day.inMonth && styles.inlineDatePickerDayTextMuted,
                  (today || selected) && styles.inlineDatePickerDayTextActive,
                ]}
              >
                {day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AnnualCostsPanel() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("annual_costs");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const accent = getSegmentAccent(theme.colors, "annual_costs");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [nextDueDate, setNextDueDate] = useState(todayIso());
  const [paymentCost, setPaymentCost] = useState<AnnualCost | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentNotice, setPaymentNotice] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const year = new Date().getFullYear();
  const annualCostsQueryKey = [...queryKeys.annualCosts, "items"] as const;
  const annualCostHistoryQueryKey = [
    ...queryKeys.annualCosts,
    "history",
    year,
  ] as const;
  const costsQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listAnnualCosts({ accessToken }),
    queryKey: annualCostsQueryKey,
  });
  const historyQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listAnnualCostHistory(year, { accessToken }),
    queryKey: annualCostHistoryQueryKey,
  });
  const householdQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: [...queryKeys.household, "me"],
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createAnnualCost(
        {
          defaultAmount: parseOptionalNumber(amount),
          name: name.trim(),
          nextDueDate,
        },
        { accessToken },
      ),
    onSuccess: async (cost) => {
      queryClient.setQueryData<AnnualCost[]>(
        annualCostsQueryKey,
        (current = []) =>
          sortAnnualCostsForDisplay([
            ...current.filter((item) => item.id !== cost.id),
            cost,
          ]),
      );
      setName("");
      setAmount("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.annualCosts });
    },
  });
  const completeMutation = useMutation({
    mutationFn: () => {
      if (!paymentCost) {
        throw new Error("Missing annual cost");
      }

      return completeAnnualCost(
        paymentCost.id,
        {
          amount: parseOptionalNumber(paymentAmount),
          executedAt: paymentDate,
        },
        { accessToken },
      );
    },
    onError: (
      _error,
      _variables,
      context:
        | {
            previousCosts?: AnnualCost[];
            previousHistory?: AnnualCostHistory[];
          }
        | undefined,
    ) => {
      if (context?.previousCosts) {
        queryClient.setQueryData(annualCostsQueryKey, context.previousCosts);
      }

      if (context?.previousHistory) {
        queryClient.setQueryData(
          annualCostHistoryQueryKey,
          context.previousHistory,
        );
      }
    },
    onMutate: async () => {
      if (!paymentCost) {
        return {};
      }

      await queryClient.cancelQueries({ queryKey: queryKeys.annualCosts });
      const previousCosts =
        queryClient.getQueryData<AnnualCost[]>(annualCostsQueryKey);
      const previousHistory = queryClient.getQueryData<AnnualCostHistory[]>(
        annualCostHistoryQueryKey,
      );
      const updatedAt = new Date().toISOString();
      const parsedAmount = parseOptionalNumber(paymentAmount);
      const optimisticCost: AnnualCost = {
        ...paymentCost,
        nextDueDate: addYearsIsoDate(paymentDate, 1),
        updatedAt,
      };
      const optimisticHistory: AnnualCostHistory = {
        amount: parsedAmount === null ? null : String(parsedAmount),
        annualCostId: paymentCost.id,
        annualCostName: paymentCost.name,
        createdAt: updatedAt,
        executedAt: paymentDate,
        id: `pending-${paymentCost.id}-${paymentDate}`,
      };

      queryClient.setQueryData<AnnualCost[]>(
        annualCostsQueryKey,
        (current = []) =>
          sortAnnualCostsForDisplay(
            current.map((cost) =>
              cost.id === paymentCost.id ? optimisticCost : cost,
            ),
          ),
      );
      queryClient.setQueryData<AnnualCostHistory[]>(
        annualCostHistoryQueryKey,
        (current = []) =>
          sortAnnualCostHistoryForDisplay([
            optimisticHistory,
            ...current.filter(
              (item) =>
                item.annualCostId !== paymentCost.id ||
                item.executedAt !== paymentDate,
            ),
          ]),
      );

      return { previousCosts, previousHistory };
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.annualCosts });
    },
    onSuccess: (completion) => {
      queryClient.setQueryData<AnnualCost[]>(
        annualCostsQueryKey,
        (current = []) =>
          sortAnnualCostsForDisplay(
            current.map((cost) =>
              cost.id === completion.cost.id ? completion.cost : cost,
            ),
          ),
      );
      queryClient.setQueryData<AnnualCostHistory[]>(
        annualCostHistoryQueryKey,
        (current = []) =>
          sortAnnualCostHistoryForDisplay([
            completion.history,
            ...current.filter(
              (item) =>
                item.id !==
                `pending-${completion.cost.id}-${completion.history.executedAt}`,
            ),
          ]),
      );
      setPaymentCost(null);
      setPaymentNotice(
        "Koszt oznaczony jako opłacony. Następny termin został odświeżony.",
      );
      setTimeout(() => setPaymentNotice(""), 2200);
    },
  });
  const costs = costsQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const currencyCode = normalizeCurrencyCode(householdQuery.data?.currencyCode);
  const paidCostIds = new Set(history.map((item) => item.annualCostId));
  const canAdd =
    permission.canCreate && Boolean(name.trim()) && !createMutation.isPending;
  const canSavePayment =
    Boolean(paymentCost) &&
    /^\d{4}-\d{2}-\d{2}$/.test(paymentDate) &&
    !completeMutation.isPending;

  function openPaymentModal(cost: AnnualCost) {
    setPaymentCost(cost);
    setPaymentAmount(String(cost.defaultAmount ?? ""));
    setPaymentDate(todayIso());
  }

  return (
    <ModulePanel
      accent={accent}
      action={
        permission.canCreate ? (
          <IconButton
            accessibilityLabel="Dodaj koszt roczny"
            onPress={() => setModalVisible(true)}
            style={styles.homeHeaderButton}
          >
            <ChartBar color={accent.color} size={22} />
          </IconButton>
        ) : undefined
      }
      icon={<ChartBar color={accent.color} size={18} />}
      subtitle={`${costs.length} kosztów / ${history.length} wpisów w ${year}`}
      title="Koszty roczne"
    >
      {paymentNotice ? <InlineAlert text={paymentNotice} /> : null}
      <QueryState
        emptyText="Brak kosztów rocznych."
        error={costsQuery.error}
        isEmpty={!costsQuery.isLoading && costs.length === 0}
        isLoading={costsQuery.isLoading}
      />
      <View style={styles.itemList}>
        {costs.map((cost) => (
          <CostRow
            accent={accent}
            canUpdate={permission.canUpdate}
            completing={completeMutation.isPending}
            cost={cost}
            currencyCode={currencyCode}
            key={cost.id}
            onComplete={() => openPaymentModal(cost)}
            paidThisYear={paidCostIds.has(cost.id)}
          />
        ))}
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
              disabled={!canAdd}
              loading={createMutation.isPending}
              onPress={() => createMutation.mutate()}
              style={styles.modalFooterButton}
              title="Dodaj"
            />
          </View>
        }
        onClose={() => setModalVisible(false)}
        subtitle="Dodajesz koszt cykliczny z następnym terminem."
        title="Nowy koszt roczny"
        visible={modalVisible}
      >
        <TextInput
          onChangeText={setName}
          placeholder="Nazwa kosztu"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={name}
        />
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setAmount}
          placeholder="Kwota"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={amount}
        />
        <DatePickerField
          label="Następny termin"
          onChange={setNextDueDate}
          value={nextDueDate}
        />
        {createMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się dodać kosztu." />
        ) : null}
      </FormModal>
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setPaymentCost(null)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canSavePayment}
              loading={completeMutation.isPending}
              onPress={() => completeMutation.mutate()}
              style={styles.modalFooterButton}
              title="Opłacone"
            />
          </View>
        }
        onClose={() => setPaymentCost(null)}
        subtitle="Potwierdź datę i kwotę, bo koszt roczny może się różnić."
        title={paymentCost?.name ?? "Opłać koszt"}
        visible={Boolean(paymentCost)}
      >
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setPaymentAmount}
          placeholder="Kwota"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={paymentAmount}
        />
        <DatePickerField
          label="Data opłacenia"
          onChange={setPaymentDate}
          value={paymentDate}
        />
        {completeMutation.error ? (
          <InlineAlert
            tone="error"
            text="Nie udało się zapisać opłaconego kosztu."
          />
        ) : null}
      </FormModal>
    </ModulePanel>
  );
}

function DataEntriesPanel() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("data_entries");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const accent = getSegmentAccent(theme.colors, "data_entries");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<DataEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const dataEntriesQueryKey = [
    ...queryKeys.dataEntries,
    search.trim(),
  ] as const;
  const entriesQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listDataEntries(search.trim() || undefined, { accessToken }),
    queryKey: dataEntriesQueryKey,
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createDataEntry(
        { title: title.trim(), value: value.trim() },
        { accessToken },
      ),
    onSuccess: async (entry) => {
      queryClient.setQueryData<DataEntry[]>(
        dataEntriesQueryKey,
        (current = []) =>
          sortDataEntriesForDisplay([
            ...current.filter((item) => item.id !== entry.id),
            entry,
          ]),
      );
      setTitle("");
      setValue("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.dataEntries });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDataEntry(id, { accessToken }),
    onError: (
      _error,
      _id,
      context: { previousEntries?: DataEntry[] } | undefined,
    ) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(dataEntriesQueryKey, context.previousEntries);
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dataEntries });
      const previousEntries =
        queryClient.getQueryData<DataEntry[]>(dataEntriesQueryKey);

      queryClient.setQueryData<DataEntry[]>(
        dataEntriesQueryKey,
        (current = []) => current.filter((entry) => entry.id !== id),
      );

      return { previousEntries };
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.dataEntries }),
    onSuccess: () => setSelectedEntry(null),
  });
  const entries = entriesQuery.data ?? [];
  const canAdd =
    permission.canCreate && Boolean(title.trim()) && !createMutation.isPending;

  return (
    <ModulePanel
      accent={accent}
      action={
        permission.canCreate ? (
          <IconButton
            accessibilityLabel="Dodaj wpis danych"
            onPress={() => setModalVisible(true)}
            style={styles.homeHeaderButton}
          >
            <Database color={accent.color} size={22} />
          </IconButton>
        ) : undefined
      }
      icon={<Database color={accent.color} size={18} />}
      subtitle={`${entries.length} zapisanych wpisów`}
      title="Dane"
    >
      <TextInput
        onChangeText={setSearch}
        placeholder="Szukaj danych"
        placeholderTextColor={theme.colors.textSubtle}
        style={styles.searchInput}
        value={search}
      />
      <QueryState
        emptyText="Brak zapisanych danych."
        error={entriesQuery.error}
        isEmpty={!entriesQuery.isLoading && entries.length === 0}
        isLoading={entriesQuery.isLoading}
      />
      <View style={styles.itemList}>
        {entries.map((entry) => (
          <DataRow
            accent={accent}
            entry={entry}
            key={entry.id}
            onOpen={() => setSelectedEntry(entry)}
          />
        ))}
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
              disabled={!canAdd}
              loading={createMutation.isPending}
              onPress={() => createMutation.mutate()}
              style={styles.modalFooterButton}
              title="Dodaj"
            />
          </View>
        }
        onClose={() => setModalVisible(false)}
        subtitle="Wpis pojawi się w domowym sejfie danych."
        title="Nowy wpis"
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
          onChangeText={setValue}
          placeholder="Wartość"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.multilineInput]}
          value={value}
        />
        {createMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się dodać wpisu." />
        ) : null}
      </FormModal>
      <FormModal
        footer={
          <View style={styles.modalFooterStack}>
            {selectedEntry && permission.canDelete ? (
              <ActionButton
                labelStyle={styles.deleteButtonLabel}
                loading={deleteMutation.isPending}
                onPress={() => deleteMutation.mutate(selectedEntry.id)}
                style={styles.deleteButton}
                title="Usuń wpis"
                variant="secondary"
              />
            ) : null}
            <ActionButton
              onPress={() => setSelectedEntry(null)}
              title="Zamknij"
              variant="secondary"
            />
          </View>
        }
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry?.title ?? "Wpis"}
        visible={Boolean(selectedEntry)}
      >
        <Text style={styles.detailValue}>{selectedEntry?.value}</Text>
      </FormModal>
    </ModulePanel>
  );
}

function AttachmentsPanel() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("attachments");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const accent = getSegmentAccent(theme.colors, "attachments");
  const [search, setSearch] = useState("");
  const [caption, setCaption] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editFileName, setEditFileName] = useState("");
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(
    null,
  );
  const [pickedPhoto, setPickedPhoto] = useState<PickedAttachmentPhoto | null>(
    null,
  );
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null,
  );
  const [previewError, setPreviewError] = useState("");
  const [openingAttachment, setOpeningAttachment] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const [downloadError, setDownloadError] = useState("");
  const [downloadNeedsSettings, setDownloadNeedsSettings] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadNeedsSettings, setUploadNeedsSettings] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const attachmentsQueryKey = [
    ...queryKeys.attachments,
    search.trim(),
  ] as const;
  const attachmentsQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listAttachments(search.trim() || undefined, { accessToken }),
    queryKey: attachmentsQueryKey,
  });
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!pickedPhoto) {
        throw new Error("Wybierz zdjęcie z galerii.");
      }

      const uploadContract = await createAttachmentUploadUrl(
        {
          fileName: pickedPhoto.fileName,
          mimeType: pickedPhoto.mimeType,
        },
        { accessToken },
      );

      await uploadAttachmentFile(
        {
          fileName: uploadContract.fileName,
          fileUri: pickedPhoto.uri,
          mimeType: uploadContract.mimeType,
          storagePath: uploadContract.storagePath,
          uploadUrl: uploadContract.uploadUrl,
        },
        { accessToken },
      );

      return createAttachmentRecord(
        {
          caption: caption.trim() || undefined,
          fileName: uploadContract.fileName,
          mimeType: uploadContract.mimeType,
          storagePath: uploadContract.storagePath,
        },
        { accessToken },
      );
    },
    onSuccess: async (attachment) => {
      queryClient.setQueryData<Attachment[]>(
        attachmentsQueryKey,
        (current = []) =>
          sortAttachmentsForDisplay([
            ...current.filter((item) => item.id !== attachment.id),
            attachment,
          ]),
      );
      setPickedPhoto(null);
      setCaption("");
      setUploadError("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.attachments });
    },
  });
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingAttachment) {
        throw new Error("Missing attachment");
      }

      return updateAttachment(
        editingAttachment.id,
        {
          caption: editCaption.trim(),
          fileName: editFileName.trim(),
        },
        { accessToken },
      );
    },
    onSuccess: async (attachment) => {
      queryClient.setQueryData<Attachment[]>(
        attachmentsQueryKey,
        (current = []) =>
          sortAttachmentsForDisplay(
            current.map((item) =>
              item.id === attachment.id ? attachment : item,
            ),
          ),
      );
      setEditingAttachment(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.attachments });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAttachment(id, { accessToken }),
    onError: (
      _error,
      _id,
      context: { previousAttachments?: Attachment[] } | undefined,
    ) => {
      if (context?.previousAttachments) {
        queryClient.setQueryData(
          attachmentsQueryKey,
          context.previousAttachments,
        );
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.attachments });
      const previousAttachments =
        queryClient.getQueryData<Attachment[]>(attachmentsQueryKey);

      queryClient.setQueryData<Attachment[]>(
        attachmentsQueryKey,
        (current = []) => current.filter((attachment) => attachment.id !== id),
      );

      return { previousAttachments };
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.attachments }),
    onSuccess: () => {
      setEditingAttachment(null);
      setPreviewAttachment(null);
    },
  });
  const attachments = attachmentsQuery.data ?? [];
  const canAdd =
    permission.canCreate && Boolean(pickedPhoto) && !createMutation.isPending;

  function openEditAttachment(attachment: Attachment) {
    setEditingAttachment(attachment);
    setEditFileName(attachment.fileName);
    setEditCaption(attachment.caption);
  }

  function openPreviewAttachment(attachment: Attachment) {
    setPreviewAttachment(attachment);
    setPreviewError("");
  }

  function closePreviewAttachment() {
    setPreviewAttachment(null);
    setPreviewError("");
    setOpeningAttachment(false);
  }

  async function handleOpenAttachmentFile() {
    if (!previewAttachment) {
      return;
    }

    setOpeningAttachment(true);
    setPreviewError("");

    try {
      await shareAttachmentFile(previewAttachment, accessToken);
    } catch {
      setPreviewError(
        "Nie udało się otworzyć pliku. Spróbuj ponownie za chwilę.",
      );
    } finally {
      setOpeningAttachment(false);
    }
  }

  async function handleDownloadAttachment(attachment: Attachment) {
    setDownloadError("");
    setDownloadNeedsSettings(false);
    setDownloadNotice("");
    setDownloadingAttachmentId(attachment.id);

    try {
      const target = await downloadAttachmentFile(attachment, accessToken);
      setDownloadNotice(
        target === "gallery"
          ? "Zdjęcie zapisane w galerii."
          : "Plik zapisany w pamięci aplikacji.",
      );
    } catch (error) {
      if (error instanceof PhotoLibraryPermissionError) {
        setDownloadError(error.message);
        setDownloadNeedsSettings(true);
      } else {
        setDownloadError("Nie udało się pobrać pliku na telefon.");
      }
    } finally {
      setDownloadingAttachmentId(null);
    }
  }

  function openAppSettings() {
    void Linking.openSettings();
  }

  async function ensurePhotoLibraryPermission(): Promise<boolean> {
    const currentPermission = await MediaLibrary.getPermissionsAsync(false, [
      "photo",
    ]);
    const permissionResult = hasFullPhotoLibraryAccess(currentPermission)
      ? currentPermission
      : currentPermission.canAskAgain
        ? await MediaLibrary.requestPermissionsAsync(false, ["photo"])
        : currentPermission;

    if (hasFullPhotoLibraryAccess(permissionResult)) {
      setUploadNeedsSettings(false);
      return true;
    }

    const message = permissionResult.canAskAgain
      ? "Nadaj pełny dostęp do galerii zdjęć, żeby dodać załącznik."
      : "Dostęp do galerii zdjęć jest zablokowany albo ograniczony. Włącz pełny dostęp w ustawieniach telefonu.";

    setUploadError(message);
    setUploadNeedsSettings(true);

    Alert.alert("Brak dostępu do zdjęć", message, [
      { style: "cancel", text: "Anuluj" },
      { onPress: openAppSettings, text: "Ustawienia" },
    ]);

    return false;
  }

  async function handlePickPhoto() {
    setUploadError("");
    setUploadNeedsSettings(false);

    try {
      const hasPermission = await ensurePhotoLibraryPermission();

      if (!hasPermission) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ["images"],
        quality: 0.86,
        selectionLimit: 1,
      });

      if (result.canceled) {
        return;
      }

      const photo = normalizePickedPhoto(result.assets[0]);

      if (!photo) {
        setUploadError("Wybierz zdjęcie JPG, PNG albo WEBP.");
        return;
      }

      setPickedPhoto(photo);
      setModalVisible(true);
    } catch {
      setUploadError("Nie udało się otworzyć galerii zdjęć.");
      setUploadNeedsSettings(true);
    }
  }

  return (
    <ModulePanel
      accent={accent}
      action={
        permission.canCreate ? (
          <IconButton
            accessibilityLabel="Dodaj plik"
            onPress={handlePickPhoto}
            style={styles.homeHeaderButton}
          >
            <Folder color={accent.color} size={22} />
          </IconButton>
        ) : undefined
      }
      icon={<Folder color={accent.color} size={18} />}
      subtitle={`${attachments.length} zapisanych plików`}
      title="Pliki"
    >
      {uploadError ? <InlineAlert tone="error" text={uploadError} /> : null}
      {uploadNeedsSettings ? (
        <ActionButton
          onPress={openAppSettings}
          size="small"
          title="Otwórz ustawienia"
          variant="secondary"
        />
      ) : null}
      <TextInput
        onChangeText={setSearch}
        placeholder="Szukaj plików"
        placeholderTextColor={theme.colors.textSubtle}
        style={styles.searchInput}
        value={search}
      />
      <QueryState
        emptyText="Brak załączników."
        error={attachmentsQuery.error}
        isEmpty={!attachmentsQuery.isLoading && attachments.length === 0}
        isLoading={attachmentsQuery.isLoading}
      />
      <View style={styles.itemList}>
        {attachments.map((attachment) => (
          <AttachmentRow
            accessToken={accessToken}
            accent={accent}
            attachment={attachment}
            downloading={downloadingAttachmentId === attachment.id}
            key={attachment.id}
            onDownload={() => handleDownloadAttachment(attachment)}
            onPreview={() => openPreviewAttachment(attachment)}
          />
        ))}
      </View>
      {downloadNotice ? <InlineAlert text={downloadNotice} /> : null}
      {downloadError ? <InlineAlert tone="error" text={downloadError} /> : null}
      {downloadNeedsSettings ? (
        <ActionButton
          onPress={openAppSettings}
          size="small"
          title="Otwórz ustawienia"
          variant="secondary"
        />
      ) : null}
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
              disabled={!canAdd}
              loading={createMutation.isPending}
              onPress={() => createMutation.mutate()}
              style={styles.modalFooterButton}
              title="Zapisz"
            />
          </View>
        }
        onClose={() => setModalVisible(false)}
        subtitle="Zdjęcie trafi do domowego folderu i będzie widoczne dla uprawnionych domowników."
        title="Nowe zdjęcie"
        visible={modalVisible}
      >
        {pickedPhoto ? (
          <View style={styles.photoPreviewCard}>
            <Image
              source={{ uri: pickedPhoto.uri }}
              style={styles.photoPreview}
            />
            <View style={styles.photoMeta}>
              <Text numberOfLines={1} style={styles.itemName}>
                {pickedPhoto.fileName}
              </Text>
              <Text style={styles.itemMeta}>
                {pickedPhoto.mimeType.replace("image/", "").toUpperCase()}
                {pickedPhoto.fileSize
                  ? ` / ${formatBytes(pickedPhoto.fileSize)}`
                  : ""}
              </Text>
            </View>
          </View>
        ) : (
          <InlineAlert text="Wybierz zdjęcie z galerii." />
        )}
        <ActionButton
          onPress={handlePickPhoto}
          title="Zmień zdjęcie"
          variant="secondary"
        />
        <TextInput
          onChangeText={setCaption}
          placeholder="Opis zdjęcia (opcjonalnie)"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={caption}
        />
        {createMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się zapisać zdjęcia." />
        ) : null}
      </FormModal>
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setEditingAttachment(null)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!editFileName.trim()}
              loading={updateMutation.isPending}
              onPress={() => updateMutation.mutate()}
              style={styles.modalFooterButton}
              title="Zapisz"
            />
          </View>
        }
        onClose={() => setEditingAttachment(null)}
        subtitle="Zmień nazwę albo opis pliku."
        title="Opis pliku"
        visible={Boolean(editingAttachment)}
      >
        <TextInput
          onChangeText={setEditFileName}
          placeholder="Nazwa pliku"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={editFileName}
        />
        <TextInput
          multiline
          onChangeText={setEditCaption}
          placeholder="Opis, np. gwarancja komputer"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={editCaption}
        />
        {updateMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się zapisać opisu pliku." />
        ) : null}
      </FormModal>
      <ZoomableImageModal
        deleteLoading={deleteMutation.isPending}
        onClose={closePreviewAttachment}
        onDelete={
          previewAttachment && permission.canDelete
            ? () => deleteMutation.mutate(previewAttachment.id)
            : undefined
        }
        onEdit={
          previewAttachment && permission.canUpdate
            ? () => {
                const attachment = previewAttachment;

                closePreviewAttachment();
                openEditAttachment(attachment);
              }
            : undefined
        }
        source={
          previewAttachment?.mimeType.startsWith("image/")
            ? getAttachmentFileRequest(previewAttachment.id, { accessToken })
            : undefined
        }
        title={previewAttachment?.fileName ?? "Zdjęcie"}
        visible={Boolean(previewAttachment?.mimeType.startsWith("image/"))}
      />
      <FormModal
        footer={
          <View style={styles.modalFooterStack}>
            {previewAttachment &&
            (permission.canUpdate || permission.canDelete) ? (
              <View style={styles.modalFooter}>
                {permission.canUpdate ? (
                  <ActionButton
                    onPress={() => {
                      const attachment = previewAttachment;

                      closePreviewAttachment();
                      openEditAttachment(attachment);
                    }}
                    style={styles.modalFooterButton}
                    title="Edytuj opis"
                    variant="secondary"
                  />
                ) : null}
                {permission.canDelete ? (
                  <ActionButton
                    labelStyle={styles.deleteButtonLabel}
                    loading={deleteMutation.isPending}
                    onPress={() => deleteMutation.mutate(previewAttachment.id)}
                    style={[styles.modalFooterButton, styles.deleteButton]}
                    title="Usuń plik"
                    variant="secondary"
                  />
                ) : null}
              </View>
            ) : null}
            <View style={styles.modalFooter}>
              <ActionButton
                onPress={closePreviewAttachment}
                style={styles.modalFooterButton}
                title="Zamknij"
                variant="secondary"
              />
              {previewAttachment &&
              !previewAttachment.mimeType.startsWith("image/") ? (
                <ActionButton
                  loading={openingAttachment}
                  onPress={handleOpenAttachmentFile}
                  style={styles.modalFooterButton}
                  title="Otwórz plik"
                />
              ) : null}
            </View>
          </View>
        }
        onClose={closePreviewAttachment}
        subtitle={
          previewAttachment?.caption || "Podgląd pliku z domowego folderu."
        }
        title={previewAttachment?.fileName ?? "Podgląd pliku"}
        visible={Boolean(
          previewAttachment && !previewAttachment.mimeType.startsWith("image/"),
        )}
      >
        {previewError ? <InlineAlert tone="error" text={previewError} /> : null}
        <View style={styles.attachmentPreviewPlaceholder}>
          <FileText color={accent.color} size={32} />
          <Text style={styles.itemName}>Ten plik nie jest zdjęciem.</Text>
          <Text style={styles.itemMeta}>
            Możesz otworzyć go w aplikacji obsługującej ten typ pliku.
          </Text>
        </View>
      </FormModal>
    </ModulePanel>
  );
}

function ZoomableImageModal({
  deleteLoading,
  onClose,
  onDelete,
  onEdit,
  source,
  title,
  visible,
}: {
  deleteLoading: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  source?: { headers?: Record<string, string>; uri: string };
  title: string;
  visible: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const { height, width } = useWindowDimensions();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
    setError("");
    setLoading(Boolean(source));
  }, [
    savedScale,
    savedX,
    savedY,
    scale,
    source,
    translateX,
    translateY,
    visible,
  ]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, 1), 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value <= 1) {
        return;
      }

      translateX.value = savedX.value + event.translationX;
      translateY.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const shouldReset = scale.value > 1;
      scale.value = withTiming(shouldReset ? 1 : 2);
      savedScale.value = shouldReset ? 1 : 2;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    });
  const composedGesture = Gesture.Exclusive(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={styles.zoomGestureRoot}>
        <View style={styles.zoomModal}>
          <View style={styles.zoomHeader}>
            <Text numberOfLines={1} style={styles.zoomTitle}>
              {title}
            </Text>
            {onEdit ? (
              <IconButton
                accessibilityLabel="Edytuj opis zdjęcia"
                onPress={onEdit}
              >
                <Pencil color={theme.colors.primary} size={18} />
              </IconButton>
            ) : null}
            {onDelete ? (
              <IconButton
                accessibilityLabel="Usuń zdjęcie"
                disabled={deleteLoading}
                onPress={onDelete}
              >
                <Trash2 color={theme.colors.danger} size={18} />
              </IconButton>
            ) : null}
            <IconButton
              accessibilityLabel="Zamknij podgląd zdjęcia"
              onPress={onClose}
            >
              <Close color={theme.colors.text} size={20} />
            </IconButton>
          </View>
          <View style={styles.zoomCanvas}>
            {source ? (
              <GestureDetector gesture={composedGesture}>
                <Animated.Image
                  onError={() => {
                    setError("Nie udało się wczytać zdjęcia.");
                    setLoading(false);
                  }}
                  onLoadEnd={() => setLoading(false)}
                  onLoadStart={() => setLoading(true)}
                  resizeMode="contain"
                  source={source}
                  style={[
                    styles.zoomImage,
                    {
                      height: height * 0.78,
                      width,
                    },
                    animatedStyle,
                  ]}
                />
              </GestureDetector>
            ) : null}
            {loading ? (
              <View style={styles.zoomLoader}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : null}
            {error ? <InlineAlert tone="error" text={error} /> : null}
          </View>
          <Text style={styles.zoomHint}>
            Uszczypnij, przesuń albo stuknij dwa razy.
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function SettingsRow({ openOnMount }: { openOnMount: boolean }) {
  const { logout, session } = useSession();
  const queryClient = useQueryClient();
  const householdPermission = useModulePermission("household_members");
  const router = useRouter();
  const theme = useAppTheme();
  const { fontScale, setFontScale, setThemeMode, themeMode } =
    useThemePreferences();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>("main");
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [homeName, setHomeName] = useState("");
  const [currencyCode, setCurrencyCode] =
    useState<SupportedCurrencyCode>("PLN");
  const [mealSlotsPerDay, setMealSlotsPerDay] = useState("4");
  const [memberInviteEmail, setMemberInviteEmail] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const householdQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: [...queryKeys.household, "me"],
  });
  const membersQuery = useQuery({
    enabled: householdPermission.canRead && Boolean(accessToken),
    queryFn: () => listHouseholdMembers({ accessToken }),
    queryKey: [...queryKeys.household, "members"],
  });
  const notificationPreferencesQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listNotificationPreferences({ accessToken }),
    queryKey: [...queryKeys.permissions, "notification-preferences"],
  });
  const notificationPreferences = useMemo(
    () => mergeNotificationPreferences(notificationPreferencesQuery.data),
    [notificationPreferencesQuery.data],
  );
  const members = membersQuery.data ?? [];

  useEffect(() => {
    if (openOnMount) {
      setSettingsView("main");
      setSettingsVisible(true);
    }
  }, [openOnMount]);

  useEffect(() => {
    const household = householdQuery.data;

    if (!household) {
      return;
    }

    setHomeName(household.name);
    setCurrencyCode(normalizeCurrencyCode(household.currencyCode));
    setMealSlotsPerDay(String(household.mealSlotsPerDay));
  }, [householdQuery.data]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  const updateHouseholdMutation = useMutation({
    mutationFn: () =>
      updateMyHousehold(
        {
          currencyCode,
          mealSlotsPerDay: Number(mealSlotsPerDay),
          name: homeName.trim(),
        },
        { accessToken },
      ),
    onSuccess: async () => {
      showToast("Ustawienia domu zapisane");
      await queryClient.invalidateQueries({ queryKey: queryKeys.household });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const inviteMemberMutation = useMutation({
    mutationFn: () =>
      inviteHouseholdMember(
        { email: memberInviteEmail.trim() },
        { accessToken },
      ),
    onSuccess: async (invitation) => {
      setMemberInviteEmail("");
      showToast(
        invitation.notificationSent && invitation.notificationSent > 0
          ? `Zaproszenie wysłane do ${invitation.email}. Wysłano też powiadomienie push.`
          : `Zaproszenie wysłane do ${invitation.email}.`,
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.household });
    },
  });
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      removeHouseholdMember(memberId, { accessToken }),
    onSuccess: async () => {
      showToast("Domownik usunięty");
      await queryClient.invalidateQueries({ queryKey: queryKeys.household });
    },
  });
  const registerPushMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        return null;
      }

      return registerForPushNotifications(accessToken);
    },
    onSuccess: (token) => {
      showToast(
        token ? "Powiadomienia włączone" : "Nie udało się pobrać tokenu push",
      );
    },
  });
  const testPushMutation = useMutation({
    mutationFn: () =>
      sendTestPush(
        {
          body: "To testowe powiadomienie z ustawień HomeApp.",
          title: "HomeApp",
        },
        { accessToken },
      ),
    onSuccess: () => showToast("Powiadomienie wysłane"),
  });
  const notificationPreferencesMutation = useMutation({
    mutationFn: (preferences: NotificationPreference[]) =>
      updateNotificationPreferences({ preferences }, { accessToken }),
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({
        queryKey: [...queryKeys.permissions, "notification-preferences"],
      });
      queryClient.setQueryData(
        [...queryKeys.permissions, "notification-preferences"],
        preferences,
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...queryKeys.permissions, "notification-preferences"],
      });
    },
  });
  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteMyAccount({ accessToken }),
    onSuccess: async () => {
      setDeleteConfirmVisible(false);
      setSettingsVisible(false);
      setSettingsView("main");
      queryClient.clear();
      await logout();
    },
  });

  function openSettings() {
    setSettingsView("main");
    setSettingsVisible(true);
  }

  function closeSettings() {
    setSettingsVisible(false);
    setSettingsView("main");
  }

  async function handleLogout() {
    setSettingsVisible(false);
    setSettingsView("main");
    queryClient.clear();
    await logout();
  }

  function toggleNotificationPreference(
    eventType: RealtimeEventType,
    enabled: boolean,
  ) {
    const next = notificationPreferences.map((preference) =>
      preference.eventType === eventType
        ? { ...preference, enabled }
        : preference,
    );

    notificationPreferencesMutation.mutate(next);
  }

  function handleThemeModeChange(mode: ThemeMode) {
    setThemeMode(mode);
    showToast("Tryb zapisany");
  }

  function openNotificationConfiguration() {
    setSettingsVisible(false);
    setSettingsView("main");
    setNotificationsVisible(true);
  }

  function openMemberPermissions(member: HouseholdMember) {
    setSettingsVisible(false);
    router.push({
      pathname: "/member-permissions",
      params: { memberId: member.id },
    } as never);
  }

  const canInviteMember =
    householdPermission.canCreate &&
    Boolean(memberInviteEmail.trim()) &&
    !inviteMemberMutation.isPending;
  const themeModeLabel =
    themeModeOptions.find((option) => option.value === themeMode)?.label ??
    "System";
  const settingsTitle =
    settingsView === "appearance"
      ? "Wygląd aplikacji"
      : settingsView === "members"
        ? "Członkowie domu"
        : "Ustawienia i konto";
  const settingsSubtitle =
    settingsView === "appearance"
      ? "Personalizacja wyglądu aplikacji."
      : settingsView === "members"
        ? "Domownicy, zaproszenia i uprawnienia."
        : "Profil, powiadomienia i konfiguracja domu.";

  return (
    <>
      <IconButton
        accessibilityLabel="Otwórz ustawienia i konto"
        onPress={openSettings}
      >
        <Cog color={theme.colors.text} size={19} />
      </IconButton>
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            {settingsView === "main" ? (
              <ActionButton
                labelStyle={styles.logoutButtonLabel}
                onPress={handleLogout}
                style={[styles.modalFooterButton, styles.logoutButton]}
                title="Wyloguj się"
                variant="secondary"
              />
            ) : (
              <ActionButton
                onPress={() => setSettingsView("main")}
                style={styles.modalFooterButton}
                title="Wróć"
                variant="secondary"
              />
            )}
            <ActionButton
              onPress={closeSettings}
              style={styles.modalFooterButton}
              title="Zamknij"
              variant="secondary"
            />
          </View>
        }
        onClose={closeSettings}
        subtitle={settingsSubtitle}
        title={settingsTitle}
        visible={settingsVisible}
      >
        {toast ? (
          <View style={styles.settingsToast}>
            <Text style={styles.settingsToastText}>{toast}</Text>
          </View>
        ) : null}
        <View style={styles.settingsPanel}>
          {settingsView === "main" ? (
            <View style={styles.settingsPanelRow}>
              <Text style={styles.settingsPanelTitle}>Dom</Text>
              <Text style={styles.settingsPanelMeta}>
                Nazwa domu, waluta i liczba posiłków dziennie.
              </Text>
              <TextInput
                editable={householdPermission.canUpdate}
                onChangeText={setHomeName}
                placeholder="Nazwa domu"
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.input}
                value={homeName}
              />
              <View style={styles.formRow}>
                <View style={styles.flexInput}>
                  <Text style={styles.inputLabel}>Waluta</Text>
                  <SegmentedControl
                    onChange={setCurrencyCode}
                    options={currencyOptions.map((option) => ({
                      label: option.label,
                      value: option.value,
                    }))}
                    value={currencyCode}
                  />
                </View>
                <View style={styles.mealSlotsField}>
                  <Text style={styles.inputLabel}>Posiłków dziennie</Text>
                  <TextInput
                    editable={householdPermission.canUpdate}
                    keyboardType="number-pad"
                    maxLength={1}
                    onChangeText={(value) =>
                      setMealSlotsPerDay(value.replace(/\D/g, "").slice(0, 1))
                    }
                    placeholder="4"
                    placeholderTextColor={theme.colors.textSubtle}
                    style={styles.input}
                    value={mealSlotsPerDay}
                  />
                </View>
              </View>
              <ActionButton
                disabled={
                  !householdPermission.canUpdate ||
                  !homeName.trim() ||
                  Number(mealSlotsPerDay) < 1 ||
                  Number(mealSlotsPerDay) > 8
                }
                loading={updateHouseholdMutation.isPending}
                onPress={() => updateHouseholdMutation.mutate()}
                title="Zapisz ustawienia domu"
                variant="secondary"
              />
              {updateHouseholdMutation.error ? (
                <InlineAlert
                  tone="error"
                  text="Nie udało się zapisać ustawień domu."
                />
              ) : null}
            </View>
          ) : null}
          {settingsView === "main" && householdPermission.canRead ? (
            <View style={styles.settingsPanelRow}>
              <View style={styles.settingsMembersHeader}>
                <View
                  style={[
                    styles.moduleIcon,
                    { backgroundColor: theme.colors.softBlue },
                  ]}
                >
                  <Users color={theme.colors.calendar} size={22} />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.settingsPanelTitle}>
                    Członkowie i zaproszenia
                  </Text>
                  <Text style={styles.settingsPanelMeta}>
                    {householdQuery.data?.name ?? "Dom"} / {members.length} osób
                  </Text>
                </View>
                <View style={styles.memberAvatars}>
                  {members.slice(0, 3).map((member) => (
                    <MiniAvatar key={member.id} member={member} />
                  ))}
                </View>
              </View>
              <ActionButton
                onPress={() => setSettingsView("members")}
                title="Zarządzaj domownikami"
                variant="secondary"
              />
            </View>
          ) : null}
          {settingsView === "main" ? (
            <View style={styles.settingsPanelRow}>
              <View style={styles.settingsMembersHeader}>
                <View
                  style={[
                    styles.moduleIcon,
                    { backgroundColor: theme.colors.primarySoft },
                  ]}
                >
                  <Pencil color={theme.colors.primary} size={21} />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.settingsPanelTitle}>
                    Wygląd aplikacji
                  </Text>
                  <Text style={styles.settingsPanelMeta}>
                    {themeModeLabel} / tekst {Math.round(fontScale * 100)}%
                  </Text>
                </View>
              </View>
              <ActionButton
                onPress={() => setSettingsView("appearance")}
                title="Zmień wygląd"
                variant="secondary"
              />
            </View>
          ) : null}
          {settingsView === "members" && householdPermission.canRead ? (
            <View style={styles.settingsPanelRow}>
              <View style={styles.settingsMembersHeader}>
                <View
                  style={[
                    styles.moduleIcon,
                    { backgroundColor: theme.colors.softBlue },
                  ]}
                >
                  <Users color={theme.colors.calendar} size={22} />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.settingsPanelTitle}>Członkowie domu</Text>
                  <Text style={styles.settingsPanelMeta}>
                    {householdQuery.data?.name ?? "Dom"} / {members.length} osób
                  </Text>
                </View>
                <View style={styles.memberAvatars}>
                  {members.slice(0, 3).map((member) => (
                    <MiniAvatar key={member.id} member={member} />
                  ))}
                </View>
              </View>
              <QueryState
                error={membersQuery.error}
                isLoading={membersQuery.isLoading}
              />
              {householdPermission.canCreate ? (
                <View style={styles.inviteSection}>
                  <View style={styles.settingsMembersHeader}>
                    <View
                      style={[
                        styles.moduleIcon,
                        { backgroundColor: theme.colors.primarySoft },
                      ]}
                    >
                      <MailPlus color={theme.colors.primaryDark} size={21} />
                    </View>
                    <View style={styles.itemText}>
                      <Text style={styles.itemName}>Zaproszenie do domu</Text>
                      <Text style={styles.itemMeta}>
                        Wyślij zaproszenie na adres e-mail.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.formRow}>
                    <TextInput
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onChangeText={setMemberInviteEmail}
                      placeholder="email@dom.pl"
                      placeholderTextColor={theme.colors.textSubtle}
                      style={[styles.input, styles.flexInput]}
                      value={memberInviteEmail}
                    />
                    <ActionButton
                      disabled={!canInviteMember}
                      loading={inviteMemberMutation.isPending}
                      onPress={() => inviteMemberMutation.mutate()}
                      title="Zaproś"
                      variant="secondary"
                    />
                  </View>
                </View>
              ) : null}
              <View style={styles.itemList}>
                {members.map((member) => (
                  <View key={member.id} style={styles.memberDeleteRow}>
                    <Pressable
                      accessibilityLabel={`Otwórz uprawnienia: ${member.displayName}`}
                      accessibilityRole="button"
                      onPress={() => openMemberPermissions(member)}
                      style={({ pressed }) => [
                        styles.memberOpenArea,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.itemText}>
                        <Text style={styles.itemName}>
                          {member.displayName}
                        </Text>
                        <Text style={styles.itemMeta}>
                          {[
                            member.email,
                            member.role === "owner" ? "właściciel" : "domownik",
                          ]
                            .filter(Boolean)
                            .join(" / ")}
                        </Text>
                      </View>
                      <ChevronRight color={theme.colors.textSubtle} size={20} />
                    </Pressable>
                    <View style={styles.memberActions}>
                      {householdPermission.canDelete &&
                      member.role !== "owner" ? (
                        <IconButton
                          disabled={removeMemberMutation.isPending}
                          onPress={() => removeMemberMutation.mutate(member.id)}
                        >
                          <Trash2 color={theme.colors.danger} size={17} />
                        </IconButton>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
              {inviteMemberMutation.error ? (
                <InlineAlert
                  tone="error"
                  text={
                    inviteMemberMutation.error instanceof Error
                      ? inviteMemberMutation.error.message
                      : "Nie udało się zaprosić osoby."
                  }
                />
              ) : null}
              {removeMemberMutation.error ? (
                <InlineAlert
                  tone="error"
                  text="Nie udało się usunąć domownika."
                />
              ) : null}
            </View>
          ) : null}
          {settingsView === "members" && !householdPermission.canRead ? (
            <InlineAlert
              tone="error"
              text="Nie masz uprawnień do podglądu domowników."
            />
          ) : null}
          {settingsView === "appearance" ? (
            <>
              <View style={styles.settingsPanelRow}>
                <Text style={styles.settingsPanelTitle}>Tryb</Text>
                <Text style={styles.settingsPanelMeta}>
                  Wybierz jasny, ciemny albo systemowy wygląd aplikacji.
                </Text>
                <SegmentedControl
                  onChange={handleThemeModeChange}
                  options={themeModeOptions}
                  value={themeMode}
                />
              </View>
              <View style={styles.settingsPanelRow}>
                <Text style={styles.settingsPanelTitle}>Rozmiar tekstu</Text>
                <Text style={styles.settingsPanelMeta}>
                  Przesuń suwak, żeby zwiększyć albo zmniejszyć czcionkę w
                  aplikacji.
                </Text>
                <FontScaleControl value={fontScale} onChange={setFontScale} />
              </View>
            </>
          ) : null}
          {settingsView === "main" ? (
            <>
              <View style={styles.settingsPanelRow}>
                <Text style={styles.settingsPanelTitle}>
                  Powiadomienia konfiguracja
                </Text>
                <Text style={styles.settingsPanelMeta}>
                  Token telefonu, test push i typy zdarzeń w jednym miejscu.
                </Text>
                <ActionButton
                  onPress={openNotificationConfiguration}
                  title="Otwórz konfigurację"
                  variant="secondary"
                />
              </View>
              <View style={[styles.settingsPanelRow, styles.dangerPanel]}>
                <Text style={styles.settingsPanelTitle}>Usuwanie konta</Text>
                <Text style={styles.settingsPanelMeta}>
                  Konto zostanie wylogowane, tokeny powiadomień zostaną
                  wyłączone, a adres e-mail odłączony od profilu.
                </Text>
                <ActionButton
                  disabled={!accessToken}
                  onPress={() => setDeleteConfirmVisible(true)}
                  style={styles.dangerButton}
                  title="Usuń konto"
                />
                {deleteAccountMutation.error ? (
                  <InlineAlert
                    tone="error"
                    text={
                      deleteAccountMutation.error instanceof Error
                        ? deleteAccountMutation.error.message
                        : "Nie udało się usunąć konta."
                    }
                  />
                ) : null}
              </View>
            </>
          ) : null}
        </View>
      </FormModal>
      <Modal
        animationType="slide"
        onRequestClose={() => setNotificationsVisible(false)}
        visible={notificationsVisible}
      >
        <AppScreen
          actions={
            <IconButton
              accessibilityLabel="Zamknij powiadomienia"
              onPress={() => setNotificationsVisible(false)}
            >
              <Close color={theme.colors.textMuted} size={18} />
            </IconButton>
          }
          subtitle="Token, test push i typy zdarzeń."
          title="Powiadomienia"
        >
          {toast ? (
            <View style={styles.settingsToast}>
              <Text style={styles.settingsToastText}>{toast}</Text>
            </View>
          ) : null}
          <View style={styles.settingsPanel}>
            <View style={styles.settingsPanelRow}>
              <Text style={styles.settingsPanelTitle}>Telefon</Text>
              <Text style={styles.settingsPanelMeta}>
                Włącz albo odśwież token push dla tego telefonu.
              </Text>
              <ActionButton
                disabled={!accessToken}
                loading={registerPushMutation.isPending}
                onPress={() => registerPushMutation.mutate()}
                title="Włącz / odśwież powiadomienia"
                variant="secondary"
              />
              {registerPushMutation.data === null ? (
                <InlineAlert
                  tone="error"
                  text="Nie udało się pobrać tokenu push dla tego telefonu."
                />
              ) : null}
              {registerPushMutation.error ? (
                <InlineAlert
                  tone="error"
                  text="Rejestracja powiadomień nie powiodła się."
                />
              ) : null}
            </View>
            <View style={styles.settingsPanelRow}>
              <Text style={styles.settingsPanelTitle}>Test</Text>
              <Text style={styles.settingsPanelMeta}>
                Wyślij test, żeby potwierdzić, że powiadomienia działają.
              </Text>
              <ActionButton
                disabled={!accessToken}
                loading={testPushMutation.isPending}
                onPress={() => testPushMutation.mutate()}
                title="Wyślij test push"
                variant="secondary"
              />
              {testPushMutation.error ? (
                <InlineAlert
                  tone="error"
                  text="Nie udało się wysłać testowego powiadomienia."
                />
              ) : null}
            </View>
            <View style={styles.settingsPanelRow}>
              <Text style={styles.settingsPanelTitle}>Typy powiadomień</Text>
              <Text style={styles.settingsPanelMeta}>
                Wybierz, kiedy zmiany innych domowników mają wysyłać
                powiadomienie.
              </Text>
              <QueryState
                error={notificationPreferencesQuery.error}
                isLoading={notificationPreferencesQuery.isLoading}
              />
              <View style={styles.notificationPreferenceList}>
                {notificationPreferences.map((preference) => {
                  const copy =
                    notificationPreferenceLabels[preference.eventType];

                  return (
                    <View
                      key={preference.eventType}
                      style={styles.notificationPreferenceRow}
                    >
                      <View style={styles.notificationPreferenceText}>
                        <Text style={styles.itemName}>{copy.label}</Text>
                        <Text style={styles.itemMeta}>{copy.meta}</Text>
                      </View>
                      <View style={styles.notificationPreferenceSwitch}>
                        <Text style={styles.preferenceToggleLabel}>
                          {preference.enabled ? "Włączone" : "Wyłączone"}
                        </Text>
                        <Pressable
                          accessibilityRole="switch"
                          accessibilityState={{ checked: preference.enabled }}
                          disabled={notificationPreferencesMutation.isPending}
                          onPress={() =>
                            toggleNotificationPreference(
                              preference.eventType,
                              !preference.enabled,
                            )
                          }
                          style={[
                            styles.preferenceToggle,
                            preference.enabled && styles.preferenceToggleActive,
                            notificationPreferencesMutation.isPending &&
                              styles.preferenceToggleDisabled,
                          ]}
                        >
                          <View
                            style={[
                              styles.preferenceToggleThumb,
                              preference.enabled &&
                                styles.preferenceToggleThumbActive,
                            ]}
                          />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
              {notificationPreferencesMutation.error ? (
                <InlineAlert
                  tone="error"
                  text="Nie udało się zapisać ustawień powiadomień."
                />
              ) : null}
            </View>
          </View>
        </AppScreen>
      </Modal>
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setDeleteConfirmVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!accessToken}
              loading={deleteAccountMutation.isPending}
              onPress={() => deleteAccountMutation.mutate()}
              style={[styles.modalFooterButton, styles.dangerButton]}
              title="Usuń konto"
            />
          </View>
        }
        onClose={() => setDeleteConfirmVisible(false)}
        subtitle="Tej akcji nie da się cofnąć z aplikacji."
        title="Usuń konto"
        visible={deleteConfirmVisible}
      >
        <InlineAlert
          tone="error"
          text="Jeśli jesteś właścicielem domu z innymi domownikami, backend zatrzyma usuwanie konta, żeby nie zostawić domu bez właściciela."
        />
      </FormModal>
    </>
  );
}

function FontScaleControl({
  onChange,
  value,
}: {
  onChange: (value: number) => void;
  value: number;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [trackWidth, setTrackWidth] = useState(1);
  const normalizedValue = clampFontScale(value);
  const progress =
    (normalizedValue - fontScaleSliderMin) /
    (fontScaleSliderMax - fontScaleSliderMin);
  const progressWidth = Math.round(trackWidth * progress);

  function handleTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(Math.max(1, event.nativeEvent.layout.width));
  }

  function updateFromTrack(locationX: number) {
    const ratio = Math.min(1, Math.max(0, locationX / trackWidth));
    const nextValue =
      fontScaleSliderMin + (fontScaleSliderMax - fontScaleSliderMin) * ratio;

    onChange(clampFontScale(nextValue));
  }

  return (
    <View style={styles.fontScaleControl}>
      <View style={styles.fontScalePreview}>
        <Text style={styles.fontScalePreviewSmall}>Mały</Text>
        <Text style={styles.fontScalePreviewLarge}>Duży tekst</Text>
        <Text style={styles.fontScaleValue}>
          {Math.round(normalizedValue * 100)}%
        </Text>
      </View>
      <View
        accessibilityLabel="Rozmiar czcionki"
        accessibilityRole="adjustable"
        accessible
        onLayout={handleTrackLayout}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) =>
          updateFromTrack(event.nativeEvent.locationX)
        }
        onResponderMove={(event) =>
          updateFromTrack(event.nativeEvent.locationX)
        }
        onStartShouldSetResponder={() => true}
        style={styles.fontScaleTrack}
      >
        <View style={styles.fontScaleRail}>
          <View style={[styles.fontScaleFill, { width: progressWidth }]} />
        </View>
        <View style={[styles.fontScaleThumb, { left: progressWidth }]} />
      </View>
      <View style={styles.fontScaleLabels}>
        <Text style={styles.fontScaleLabel}>90%</Text>
        <Text style={styles.fontScaleLabel}>100%</Text>
        <Text style={styles.fontScaleLabel}>130%</Text>
      </View>
    </View>
  );
}

function mergeNotificationPreferences(
  preferences: NotificationPreference[] | undefined,
): NotificationPreference[] {
  const preferencesByType = new Map(
    preferences?.map((preference) => [
      preference.eventType,
      preference.enabled,
    ]) ?? [],
  );

  return visibleNotificationEventTypes.map((eventType) => ({
    enabled: preferencesByType.get(eventType) ?? true,
    eventType,
  }));
}

function ModulePanel({
  accent: _accent,
  action,
  children,
  icon,
  subtitle,
  title,
}: {
  accent: Accent;
  action?: ReactNode;
  children: ReactNode;
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelIcon}>{icon}</View>
        <View style={styles.panelText}>
          <Text style={styles.panelTitle}>{title}</Text>
          <Text style={styles.panelSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.panelActions}>{action}</View>
      </View>
      {children}
    </View>
  );
}

function CleaningRow({
  accent,
  canUpdate,
  completing,
  onComplete,
  onEdit,
  task,
}: {
  accent: Accent;
  canUpdate: boolean;
  completing: boolean;
  onComplete: () => void;
  onEdit: () => void;
  task: CleaningTask;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const daysRemaining = daysUntilIsoDate(task.nextDueAt);
  const canCompleteNow = daysRemaining < 7;
  const isInactive = !canCompleteNow;
  const isDueSoon = daysRemaining < 1;
  const isActionPending = completing;
  const markerColor =
    task.isOverdue || isDueSoon
      ? theme.colors.danger
      : canCompleteNow
        ? accent.color
        : theme.colors.textSubtle;
  const rowOpacity = useSharedValue(isInactive ? 0.72 : 1);
  const rowScale = useSharedValue(1);
  const animatedRowStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ scale: rowScale.value }],
  }));

  useEffect(() => {
    rowOpacity.value = withTiming(isInactive ? 0.72 : 1, { duration: 180 });
    rowScale.value = withTiming(isActionPending ? 0.985 : 1, { duration: 160 });
  }, [isActionPending, isInactive, rowOpacity, rowScale]);

  return (
    <Animated.View
      style={[
        styles.itemRow,
        styles.cleaningRow,
        isInactive && styles.inactiveCleaningRow,
        (task.isOverdue || isDueSoon) && styles.warningRow,
        animatedRowStyle,
      ]}
    >
      <View style={[styles.itemMarker, { backgroundColor: markerColor }]} />
      <Pressable
        accessibilityLabel={`Edytuj sprzątanie ${task.name}`}
        accessibilityRole="button"
        disabled={!canUpdate}
        onPress={onEdit}
        style={({ pressed }) => [styles.itemText, pressed && styles.pressed]}
      >
        <View style={styles.cleaningTitleRow}>
          <Text numberOfLines={2} style={styles.itemName}>
            {task.name}
          </Text>
          <View
            style={[
              styles.cleaningStatusPill,
              isInactive && styles.cleaningStatusPillMuted,
              isDueSoon && styles.cleaningStatusPillDanger,
            ]}
          >
            <Text
              style={[
                styles.cleaningStatusText,
                isDueSoon && styles.cleaningStatusTextDanger,
              ]}
            >
              {formatCleaningStatus(daysRemaining)}
            </Text>
          </View>
        </View>
        {task.location ? (
          <View style={styles.cleaningLocationBadge}>
            <MapPin color={theme.colors.primaryDark} size={14} />
            <Text numberOfLines={1} style={styles.cleaningLocationText}>
              {task.location}
            </Text>
          </View>
        ) : null}
        <Text style={styles.itemMeta}>
          Termin: {formatDateFull(task.nextDueAt)} / co {task.frequencyDays} dni
        </Text>
      </Pressable>
      {canCompleteNow ? (
        <ActionButton
          disabled={!canUpdate}
          loading={completing}
          onPress={onComplete}
          size="small"
          title="Wykonane"
          variant="secondary"
        />
      ) : null}
    </Animated.View>
  );
}

function CostRow({
  accent,
  canUpdate,
  completing,
  cost,
  currencyCode,
  onComplete,
  paidThisYear,
}: {
  accent: Accent;
  canUpdate: boolean;
  completing: boolean;
  cost: AnnualCost;
  currencyCode: SupportedCurrencyCode;
  onComplete: () => void;
  paidThisYear: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemMarker, { backgroundColor: accent.color }]} />
      <View style={styles.itemText}>
        <Text style={styles.itemName}>{cost.name}</Text>
        <Text style={styles.itemMeta}>
          {cost.nextDueDate} / {formatMoney(cost.defaultAmount, currencyCode)}
        </Text>
      </View>
      {paidThisYear ? (
        <View style={styles.paidBadge}>
          <Text style={styles.paidBadgeText}>Oplacone w tym roku</Text>
        </View>
      ) : null}
      <ActionButton
        disabled={paidThisYear || !canUpdate || completing}
        onPress={onComplete}
        size="small"
        style={paidThisYear ? styles.hidden : undefined}
        title="Opłacone"
        variant="secondary"
      />
    </View>
  );
}

function DataRow({
  accent,
  entry,
  onOpen,
}: {
  accent: Accent;
  entry: DataEntry;
  onOpen: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable
      accessibilityLabel={`Otwórz wpis ${entry.title}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}
    >
      <View style={[styles.itemMarker, { backgroundColor: accent.color }]} />
      <View style={styles.itemText}>
        <Text style={styles.itemName}>{entry.title}</Text>
        <Text numberOfLines={2} style={styles.itemMeta}>
          {entry.value}
        </Text>
      </View>
    </Pressable>
  );
}

function AttachmentRow({
  accessToken,
  accent,
  attachment,
  downloading,
  onDownload,
  onPreview,
}: {
  accessToken?: string | null;
  accent: Accent;
  attachment: Attachment;
  downloading: boolean;
  onDownload: () => void;
  onPreview: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const isImage = attachment.mimeType.startsWith("image/");
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    setThumbError(false);
  }, [attachment.id]);

  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemMarker, { backgroundColor: accent.color }]} />
      <Pressable
        accessibilityLabel={`Podgląd pliku ${attachment.fileName}`}
        accessibilityRole="button"
        onPress={onPreview}
        style={({ pressed }) => [
          styles.attachmentPreviewArea,
          pressed && styles.pressed,
        ]}
      >
        {isImage && !thumbError ? (
          <Image
            onError={() => setThumbError(true)}
            source={getAttachmentFileRequest(attachment.id, { accessToken })}
            style={styles.attachmentThumb}
          />
        ) : (
          <View style={styles.attachmentFileIcon}>
            <FileText color={accent.color} size={17} />
          </View>
        )}
        <View style={styles.itemText}>
          <Text style={styles.itemName}>{attachment.fileName}</Text>
          <Text numberOfLines={2} style={styles.itemMeta}>
            {attachment.caption || "Brak opisu"}
          </Text>
        </View>
      </Pressable>
      <IconButton
        accessibilityLabel={`Pobierz plik ${attachment.fileName}`}
        disabled={downloading}
        onPress={onDownload}
      >
        <Download color={theme.colors.primary} size={17} />
      </IconButton>
    </View>
  );
}

function MiniAvatar({ member }: { member: HouseholdMember }) {
  const styles = createStyles(useAppTheme().colors);
  const initial = (member.displayName || member.email || "?")
    .slice(0, 1)
    .toUpperCase();

  return (
    <View style={styles.miniAvatar}>
      <Text style={styles.miniAvatarText}>{initial}</Text>
    </View>
  );
}

function getSegmentAccent(colors: AppPalette, segment: HomeSegment): Accent {
  const accents: Record<HomeSegment, Accent> = {
    annual_costs: { color: colors.finance, soft: colors.softGreen },
    attachments: { color: colors.warning, soft: colors.warningSoft },
    cleaning: { color: colors.shopping, soft: colors.softPurple },
    data_entries: { color: colors.calendar, soft: colors.softBlue },
  };

  return accents[segment];
}

function getSegmentIcon(
  segment: HomeSegment,
  color: string,
  size: number,
): ReactNode {
  if (segment === "cleaning") {
    return <Broom color={color} size={size} />;
  }

  if (segment === "annual_costs") {
    return <ChartBar color={color} size={size} />;
  }

  if (segment === "data_entries") {
    return <Database color={color} size={size} />;
  }

  return <Folder color={color} size={size} />;
}

function normalizePickedPhoto(
  asset: ImagePicker.ImagePickerAsset | undefined,
): PickedAttachmentPhoto | null {
  if (!asset?.uri) {
    return null;
  }

  const mimeType = normalizePickedImageMimeType(
    asset.mimeType,
    asset.fileName ?? asset.uri,
  );

  if (!mimeType) {
    return null;
  }

  return {
    fileName: normalizePickedFileName(asset.fileName, mimeType),
    fileSize: asset.fileSize,
    mimeType,
    uri: asset.uri,
  };
}

function normalizePickedImageMimeType(
  mimeType: string | null | undefined,
  nameOrUri: string,
): ImageAttachmentMimeType | null {
  if (
    mimeType &&
    imageAttachmentMimeTypes.includes(mimeType as ImageAttachmentMimeType)
  ) {
    return mimeType as ImageAttachmentMimeType;
  }

  const lowerName = nameOrUri.toLowerCase();

  if (lowerName.endsWith(".png")) {
    return "image/png";
  }

  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }

  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return null;
}

function normalizePickedFileName(
  fileName: string | null | undefined,
  mimeType: ImageAttachmentMimeType,
): string {
  const normalized = fileName?.trim();

  if (normalized) {
    return normalized;
  }

  return `zdjęcie-${Date.now()}.${extensionForMimeType(mimeType)}`;
}

function extensionForMimeType(mimeType: ImageAttachmentMimeType): string {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function todayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
}

function parseIsoDate(value: string) {
  const [year = "0", month = "1", day = "1"] = value.split("-");

  return new Date(Number(year), Number(month) - 1, Number(day));
}

function monthAnchor(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isoFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

function formatMonthTitle(date: Date): string {
  const title = new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(date);

  return title.charAt(0).toUpperCase() + title.slice(1);
}

function formatDateFull(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseIsoDate(value));
}

function addDaysIsoDate(value: string, amount: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + amount);

  return isoFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

function addYearsIsoDate(value: string, amount: number): string {
  const date = parseIsoDate(value);
  date.setFullYear(date.getFullYear() + amount);

  return isoFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntilIsoDate(value: string): number {
  const millisecondsInDay = 24 * 60 * 60 * 1000;

  return Math.round(
    (parseIsoDate(value).getTime() - parseIsoDate(todayIso()).getTime()) /
      millisecondsInDay,
  );
}

function formatCleaningStatus(daysRemaining: number): string {
  if (daysRemaining < 0) {
    return "Po terminie";
  }

  if (daysRemaining < 1) {
    return "Dzisiaj";
  }

  if (daysRemaining === 1) {
    return "Jutro";
  }

  return `Za ${daysRemaining} dni`;
}

function sortCleaningTasksForDisplay(tasks: CleaningTask[]): CleaningTask[] {
  return [...tasks].sort((left, right) => {
    const overdueOrder = Number(right.isOverdue) - Number(left.isOverdue);

    if (overdueOrder !== 0) {
      return overdueOrder;
    }

    const dueOrder =
      parseIsoDate(left.nextDueAt).getTime() -
      parseIsoDate(right.nextDueAt).getTime();

    if (dueOrder !== 0) {
      return dueOrder;
    }

    return left.name.localeCompare(right.name, "pl");
  });
}

function sortAnnualCostsForDisplay(costs: AnnualCost[]): AnnualCost[] {
  return [...costs].sort((left, right) => {
    const dueOrder =
      parseIsoDate(left.nextDueDate).getTime() -
      parseIsoDate(right.nextDueDate).getTime();

    if (dueOrder !== 0) {
      return dueOrder;
    }

    return left.name.localeCompare(right.name, "pl");
  });
}

function sortAnnualCostHistoryForDisplay(
  history: AnnualCostHistory[],
): AnnualCostHistory[] {
  return [...history].sort((left, right) => {
    const dateOrder =
      parseIsoDate(right.executedAt).getTime() -
      parseIsoDate(left.executedAt).getTime();

    if (dateOrder !== 0) {
      return dateOrder;
    }

    return left.annualCostName.localeCompare(right.annualCostName, "pl");
  });
}

function sortDataEntriesForDisplay(entries: DataEntry[]): DataEntry[] {
  return [...entries].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function sortAttachmentsForDisplay(attachments: Attachment[]): Attachment[] {
  return [...attachments].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.replace(",", ".").trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(
  value: string | number | null | undefined,
  currencyCode: SupportedCurrencyCode,
): string {
  if (value === null || value === undefined || value === "") {
    return "bez kwoty";
  }

  return formatCurrencyAmount(value, currencyCode);
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

async function shareAttachmentFile(
  attachment: Attachment,
  accessToken?: string | null,
): Promise<void> {
  const cacheDirectory =
    FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

  if (!cacheDirectory) {
    throw new Error("File cache is unavailable");
  }

  const request = getAttachmentFileRequest(attachment.id, { accessToken });
  const localUri = `${cacheDirectory}${attachment.id}-${sanitizeCacheFileName(attachment.fileName)}`;
  const result = await FileSystem.downloadAsync(request.uri, localUri, {
    headers: request.headers,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Attachment download failed with status ${result.status}`);
  }

  const isAvailable = await Sharing.isAvailableAsync();

  if (!isAvailable) {
    throw new Error("Sharing is unavailable");
  }

  await Sharing.shareAsync(result.uri, {
    dialogTitle: attachment.fileName,
    mimeType: attachment.mimeType,
  });
}

async function downloadAttachmentFile(
  attachment: Attachment,
  accessToken?: string | null,
): Promise<"app" | "gallery"> {
  const cacheDirectory =
    FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

  if (!cacheDirectory) {
    throw new Error("File cache is unavailable");
  }

  const request = getAttachmentFileRequest(attachment.id, { accessToken });
  const fileName = sanitizeCacheFileName(attachment.fileName);
  const localUri = `${cacheDirectory}${attachment.id}-${fileName}`;
  const result = await FileSystem.downloadAsync(request.uri, localUri, {
    headers: request.headers,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Attachment download failed with status ${result.status}`);
  }

  if (attachment.mimeType.startsWith("image/")) {
    const isAvailable = await MediaLibrary.isAvailableAsync();

    if (!isAvailable) {
      throw new Error("Media library is unavailable");
    }

    const permissions = await MediaLibrary.requestPermissionsAsync(true, [
      "photo",
    ]);

    if (!hasFullPhotoLibraryAccess(permissions)) {
      throw new PhotoLibraryPermissionError(
        permissions.canAskAgain
          ? "Nadaj pełny dostęp do galerii zdjęć, żeby zapisać zdjęcie w telefonie."
          : "Dostęp do galerii zdjęć jest zablokowany albo ograniczony. Włącz pełny dostęp w ustawieniach telefonu.",
      );
    }

    await MediaLibrary.saveToLibraryAsync(result.uri);

    return "gallery";
  }

  const documentsDirectory = FileSystem.documentDirectory;

  if (!documentsDirectory) {
    throw new Error("Document directory is unavailable");
  }

  const downloadsDirectory = `${documentsDirectory}downloads/`;
  await FileSystem.makeDirectoryAsync(downloadsDirectory, {
    intermediates: true,
  });
  await FileSystem.copyAsync({
    from: result.uri,
    to: `${downloadsDirectory}${attachment.id}-${fileName}`,
  });

  return "app";
}

class PhotoLibraryPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoLibraryPermissionError";
  }
}

function hasFullPhotoLibraryAccess(permission: {
  accessPrivileges?: string | null;
  granted: boolean;
}): boolean {
  return (
    permission.granted &&
    permission.accessPrivileges !== "limited" &&
    permission.accessPrivileges !== "none"
  );
}

function sanitizeCacheFileName(fileName: string): string {
  const sanitized = fileName.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");

  return sanitized || "attachment";
}

function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  const clamped = Math.min(
    fontScaleSliderMax,
    Math.max(fontScaleSliderMin, value),
  );

  return Math.round(clamped * 20) / 20;
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    avatar: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderRadius: 999,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    attachmentThumb: {
      backgroundColor: colors.cardMuted,
      borderRadius: radii.control,
      height: 48,
      width: 48,
    },
    attachmentFileIcon: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderRadius: radii.control,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    attachmentPreviewArea: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
    },
    attachmentPreviewPlaceholder: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      minHeight: 220,
      justifyContent: "center",
      padding: spacing.lg,
    },
    cleaningLocationBadge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderColor: `${colors.primary}44`,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      maxWidth: "100%",
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    cleaningLocationText: {
      color: colors.primaryDark,
      flexShrink: 1,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 16,
    },
    cleaningRow: {
      alignItems: "center",
    },
    cleaningStatusPill: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.primarySoft,
      borderColor: `${colors.primary}33`,
      borderRadius: 999,
      borderWidth: 1,
      flexShrink: 0,
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    cleaningStatusPillDanger: {
      backgroundColor: colors.dangerSoft,
      borderColor: `${colors.danger}55`,
    },
    cleaningStatusPillMuted: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    cleaningStatusText: {
      color: colors.primaryDark,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 14,
    },
    cleaningStatusTextDanger: {
      color: colors.danger,
    },
    cleaningTitleRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    dateInput: {
      minWidth: 132,
    },
    datePickerTrigger: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      paddingVertical: 0,
    },
    datePickerTriggerText: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    flexInput: {
      flex: 1,
    },
    formRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    inlineDatePicker: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.sm,
    },
    inlineDatePickerDay: {
      alignItems: "center",
      borderRadius: 999,
      flexBasis: "14.285%",
      height: 36,
      justifyContent: "center",
    },
    inlineDatePickerDayMuted: {
      opacity: 0.42,
    },
    inlineDatePickerDaySelected: {
      backgroundColor: colors.primary,
    },
    inlineDatePickerDayText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    inlineDatePickerDayTextActive: {
      color: colors.inverseText,
    },
    inlineDatePickerDayTextMuted: {
      color: colors.textSubtle,
    },
    inlineDatePickerDayToday: {
      backgroundColor: colors.calendar,
    },
    inlineDatePickerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    inlineDatePickerHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    inlineDatePickerNav: {
      height: 34,
      width: 34,
    },
    inlineDatePickerTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "center",
      textTransform: "capitalize",
    },
    inlineDatePickerWeekLabel: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "center",
      textTransform: "uppercase",
    },
    inlineDatePickerWeekRow: {
      flexDirection: "row",
    },
    hidden: {
      display: "none",
    },
    homeHeaderButton: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.background === "#0C1220" ? colors.border : "#E8DED2",
      borderRadius: 999,
      borderWidth: 1,
      elevation: 2,
      height: 44,
      justifyContent: "center",
      padding: 0,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: colors.background === "#0C1220" ? 0.18 : 0.08,
      shadowRadius: 16,
      width: 44,
    },
    inactiveCleaningRow: {
      backgroundColor: colors.card,
      borderColor: colors.border,
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
    inputLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      marginBottom: spacing.xs,
    },
    fontScaleControl: {
      gap: spacing.sm,
    },
    fontScaleFill: {
      backgroundColor: colors.primary,
      height: "100%",
    },
    fontScaleLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
    },
    fontScaleLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    fontScalePreview: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    fontScalePreviewLarge: {
      color: colors.text,
      flex: 1,
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 0,
    },
    fontScalePreviewSmall: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    fontScaleRail: {
      backgroundColor: colors.cardMuted,
      borderRadius: 999,
      height: 8,
      overflow: "hidden",
    },
    fontScaleThumb: {
      backgroundColor: colors.primary,
      borderColor: colors.card,
      borderRadius: 999,
      borderWidth: 3,
      height: 24,
      marginLeft: -12,
      position: "absolute",
      top: 6,
      width: 24,
    },
    fontScaleTrack: {
      height: 36,
      justifyContent: "center",
      position: "relative",
    },
    fontScaleValue: {
      color: colors.primaryDark,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    inviteSection: {
      gap: spacing.sm,
    },
    itemList: {
      gap: spacing.sm,
    },
    itemMarker: {
      borderRadius: 999,
      height: 36,
      width: 4,
    },
    itemMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    itemName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 19,
    },
    itemRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.background === "#0C1220" ? colors.border : "#E8DED2",
      borderRadius: 12,
      borderWidth: 1,
      elevation: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      shadowColor: "#000000",
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
    },
    itemText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    logoutButton: {
      alignSelf: "stretch",
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    logoutButtonLabel: {
      color: colors.primaryDark,
      fontWeight: "900",
    },
    notificationPreferenceList: {
      gap: spacing.xs,
    },
    notificationPreferenceRow: {
      alignItems: "stretch",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      minHeight: 64,
      padding: spacing.md,
    },
    notificationPreferenceSwitch: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 28,
      width: "100%",
    },
    notificationPreferencesHeader: {
      gap: 2,
      paddingTop: spacing.xs,
    },
    notificationPreferenceText: {
      gap: 2,
      minWidth: 0,
    },
    preferenceToggleLabel: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    preferenceToggle: {
      alignItems: "center",
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 24,
      justifyContent: "center",
      padding: 2,
      width: 44,
    },
    preferenceToggleActive: {
      backgroundColor: colors.primary,
    },
    preferenceToggleDisabled: {
      opacity: 0.56,
    },
    preferenceToggleThumb: {
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderRadius: 999,
      height: 20,
      width: 20,
    },
    preferenceToggleThumbActive: {
      alignSelf: "flex-end",
    },
    memberAvatars: {
      flexDirection: "row",
      marginLeft: spacing.xs,
    },
    memberDeleteRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      padding: spacing.sm,
    },
    memberOpenArea: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minWidth: 0,
    },
    memberActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    miniAvatar: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 25,
      justifyContent: "center",
      marginLeft: -6,
      width: 25,
    },
    miniAvatarText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
    },
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    modalFooterStack: {
      gap: spacing.sm,
    },
    deleteButton: {
      borderColor: colors.danger,
      minHeight: 42,
    },
    deleteButtonLabel: {
      color: colors.danger,
    },
    detailValue: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      letterSpacing: 0,
      lineHeight: 22,
      padding: spacing.md,
    },
    moduleDescription: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
      lineHeight: 16,
    },
    moduleGrid: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      elevation: 0,
      flexDirection: "row",
      gap: 0,
      overflow: "hidden",
      shadowColor: colors.text,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
    },
    moduleIcon: {
      alignItems: "center",
      borderRadius: radii.control,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    moduleTile: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderColor: colors.border,
      borderRadius: 0,
      flex: 1,
      gap: 6,
      justifyContent: "center",
      minHeight: 90,
      overflow: "hidden",
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
      position: "relative",
    },
    moduleTileActive: {
      backgroundColor: colors.cardMuted,
      elevation: 0,
    },
    moduleTileDivider: {
      borderColor: colors.border,
      borderRightWidth: 1,
    },
    moduleTileIcon: {
      alignItems: "center",
      elevation: 0,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    moduleTileTop: {
      alignItems: "center",
      justifyContent: "center",
    },
    moduleTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 15,
      textAlign: "center",
    },
    mealSlotsField: {
      width: 116,
    },
    multilineInput: {
      minHeight: 92,
      paddingTop: spacing.sm,
      textAlignVertical: "top",
    },
    panel: {
      backgroundColor: colors.overlay,
      borderColor: colors.background === "#0C1220" ? colors.border : "#E8DED2",
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      gap: spacing.md,
      padding: spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: colors.background === "#0C1220" ? 0.16 : 0.08,
      shadowRadius: 18,
    },
    panelActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    panelHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    panelIcon: {
      alignItems: "center",
      borderRadius: 999,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    panelSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
    },
    panelText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    panelTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    paidBadge: {
      backgroundColor: colors.softGreen,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    paidBadgeText: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    photoMeta: {
      gap: 2,
      paddingHorizontal: spacing.xs,
    },
    photoPreview: {
      aspectRatio: 4 / 3,
      backgroundColor: colors.cardMuted,
      borderRadius: radii.control,
      width: "100%",
    },
    photoPreviewCard: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.sm,
    },
    pressed: {
      opacity: 0.78,
    },
    searchInput: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      letterSpacing: 0,
      minHeight: 42,
      paddingHorizontal: spacing.md,
    },
    textArea: {
      minHeight: 90,
      paddingTop: spacing.md,
      textAlignVertical: "top",
    },
    timeInput: {
      width: 82,
    },
    settingsMeta: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
      lineHeight: 15,
    },
    settingsRow: {
      alignItems: "center",
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    settingsPanel: {
      gap: spacing.md,
    },
    settingsToast: {
      backgroundColor: colors.softGreen,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    settingsToastText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 18,
    },
    dangerButton: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    dangerPanel: {
      borderColor: colors.danger,
    },
    settingsPanelMeta: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 19,
    },
    settingsPanelRow: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 2,
      gap: spacing.sm,
      padding: spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
    },
    settingsMembersHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 44,
    },
    settingsPanelTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    settingsTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    warningRow: {
      backgroundColor: colors.dangerSoft,
      borderColor: `${colors.danger}55`,
    },
    zoomCanvas: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      overflow: "hidden",
      width: "100%",
    },
    zoomHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      width: "100%",
    },
    zoomGestureRoot: {
      flex: 1,
    },
    zoomHint: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      paddingBottom: spacing.md,
      textAlign: "center",
    },
    zoomImage: {
      backgroundColor: colors.background,
    },
    zoomLoader: {
      alignItems: "center",
      backgroundColor: `${colors.background}CC`,
      bottom: 0,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    zoomModal: {
      backgroundColor: colors.background,
      flex: 1,
    },
    zoomTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
  });
}
