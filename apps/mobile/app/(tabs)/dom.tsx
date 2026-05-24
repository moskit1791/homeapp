import { REALTIME_EVENTS, type ModuleKey, type RealtimeEventType } from "@homeapp/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
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
  type Attachment,
  type CleaningTask,
  type DataEntry,
  type HouseholdMember,
  type NotificationPreference,
} from "../../src/api";
import { registerForPushNotifications } from "../../src/notifications/register-push-notifications";
import { useModulePermission, usePermissions } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import {
  accentColorOptions,
  useAppTheme,
  useThemePreferences,
  type AppPalette,
  type DarkAccentKey,
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
  FormModal,
  IconButton,
  InlineAlert,
  QueryState,
  SegmentedControl,
} from "../../src/ui";
import {
  Broom,
  ChartBar,
  Check,
  ChevronRight,
  Close,
  Cog,
  Database,
  Download,
  FileText,
  Folder,
  MailPlus,
  Pencil,
  Trash2,
  Users,
} from "../../src/ui/icon";

type HomeSegment = "cleaning" | "annual_costs" | "data_entries" | "attachments";
type SettingsView = "main" | "appearance" | "members";
type ImageAttachmentMimeType = Extract<Attachment["mimeType"], "image/jpeg" | "image/png" | "image/webp">;
const neutralAccentValues = new Set([
  "#A16207",
  "#92400E",
  "#7C2D12",
  "#F8FAFC",
  "#E5E7EB",
  "#94A3B8",
  "#475569",
  "#111827",
]);
const fontScaleSliderMin = 0.9;
const fontScaleSliderMax = 1.3;

type PickedAttachmentPhoto = {
  fileName: string;
  fileSize?: number;
  mimeType: ImageAttachmentMimeType;
  uri: string;
};

const imageAttachmentMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

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

const notificationPreferenceLabels: Record<RealtimeEventType, { label: string; meta: string }> = {
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
  const params = useLocalSearchParams<{ settings?: string }>();
  const permissionsQuery = usePermissions();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [activeSegment, setActiveSegment] = useState<HomeSegment>("cleaning");
  const availableTiles = useMemo(
    () =>
      moduleTiles.filter((tile) =>
        permissionsQuery.data?.find((permission) => permission.moduleKey === tile.moduleKey)?.canRead,
      ),
    [permissionsQuery.data],
  );

  useEffect(() => {
    if (
      permissionsQuery.isSuccess &&
      availableTiles.length > 0 &&
      !availableTiles.some((tile) => tile.value === activeSegment)
    ) {
      setActiveSegment(availableTiles[0]!.value);
    }
  }, [activeSegment, availableTiles, permissionsQuery.isSuccess]);

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Dom">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      actions={<SettingsRow openOnMount={params.settings === "1"} />}
      subtitle="Zarządzaj swoim domem"
      title="Dom"
    >
      {availableTiles.length === 0 ? (
        <InlineAlert text="Nie masz dostępu do modułów domowych." />
      ) : (
        <View style={styles.moduleGrid}>
          {availableTiles.map((tile, index) => (
            <ModuleTile
              active={tile.value === activeSegment}
              description={tile.description}
              key={tile.value}
              segment={tile.value}
              showDivider={index < availableTiles.length - 1}
              title={tile.title}
              onPress={() => setActiveSegment(tile.value)}
            />
          ))}
        </View>
      )}

      {availableTiles.length > 0 ? <ActiveModule segment={activeSegment} /> : null}
    </AppScreen>
  );
}

function ModuleTile({
  active,
  description,
  onPress,
  segment,
  showDivider,
  title,
}: {
  active: boolean;
  description: string;
  onPress: () => void;
  segment: HomeSegment;
  showDivider: boolean;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getSegmentAccent(theme.colors, segment);

  return (
    <Pressable
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.moduleTile,
        showDivider && styles.moduleTileDivider,
        active && styles.moduleTileActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.moduleTileTop}>
        <View style={styles.moduleTileIcon}>
          {getSegmentIcon(segment, accent.color, 30)}
        </View>
      </View>
      <Text numberOfLines={2} style={styles.moduleTitle}>{title}</Text>
    </Pressable>
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
  const accent = getSegmentAccent(theme.colors, "cleaning");
  const [name, setName] = useState("");
  const [frequencyDays, setFrequencyDays] = useState("7");
  const [nextDueAt, setNextDueAt] = useState(todayIso());
  const [editingTask, setEditingTask] = useState<CleaningTask | null>(null);
  const [completionNotice, setCompletionNotice] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const tasksQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listCleaningTasks({ accessToken }),
    queryKey: [...queryKeys.cleaning, "tasks"],
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createCleaningTask(
        {
          completionWindowDays: 0,
          frequencyDays: Number(frequencyDays) || 1,
          frequencyMode: "preset",
          name: name.trim(),
          nextDueAt,
        },
        { accessToken },
      ),
    onSuccess: async () => {
      setName("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cleaning });
    },
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      completeCleaningTask(id, { completedAt: todayIso() }, { accessToken }),
    onSuccess: async () => {
      setCompletionNotice("Zadanie oznaczone jako wykonane. Termin został przeliczony.");
      setTimeout(() => setCompletionNotice(""), 2200);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cleaning });
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
          name: name.trim(),
          nextDueAt,
        },
        { accessToken },
      );
    },
    onSuccess: async () => {
      setName("");
      setEditingTask(null);
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cleaning });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCleaningTask(id, { accessToken }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cleaning });
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
    setFrequencyDays("7");
    setNextDueAt(todayIso());
    setModalVisible(true);
  }

  function openEditTask(task: CleaningTask) {
    setEditingTask(task);
    setName(task.name);
    setFrequencyDays(String(task.frequencyDays));
    setNextDueAt(task.nextDueAt);
    setModalVisible(true);
  }

  function closeTaskModal() {
    setEditingTask(null);
    setModalVisible(false);
  }

  return (
    <ModulePanel
      accent={accent}
      action={
        permission.canCreate ? (
          <ActionButton onPress={openCreateTask} size="small" title="+ Dodaj" />
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
            canDelete={permission.canDelete}
            canUpdate={permission.canUpdate}
            completing={completeMutation.isPending}
            deleting={deleteMutation.isPending}
            key={task.id}
            onComplete={() => completeMutation.mutate(task.id)}
            onDelete={() => deleteMutation.mutate(task.id)}
            onEdit={() => openEditTask(task)}
            task={task}
          />
        ))}
      </View>
      <FormModal
        footer={
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
              onPress={() => (editingTask ? updateMutation.mutate() : createMutation.mutate())}
              style={styles.modalFooterButton}
              title={editingTask ? "Zapisz" : "Dodaj"}
            />
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
        <View style={styles.formRow}>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setFrequencyDays}
            placeholder="Co ile dni"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.flexInput]}
            value={frequencyDays}
          />
          <TextInput
            onChangeText={setNextDueAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.dateInput]}
            value={nextDueAt}
          />
        </View>
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
  const costsQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listAnnualCosts({ accessToken }),
    queryKey: [...queryKeys.annualCosts, "items"],
  });
  const historyQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listAnnualCostHistory(year, { accessToken }),
    queryKey: [...queryKeys.annualCosts, "history", year],
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
    onSuccess: async () => {
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
    onSuccess: async () => {
      setPaymentCost(null);
      setPaymentNotice("Koszt oznaczony jako opłacony. Następny termin został odświeżony.");
      setTimeout(() => setPaymentNotice(""), 2200);
      await queryClient.invalidateQueries({ queryKey: queryKeys.annualCosts });
    },
  });
  const costs = costsQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const currencyCode = normalizeCurrencyCode(householdQuery.data?.currencyCode);
  const paidCostIds = new Set(history.map((item) => item.annualCostId));
  const canAdd = permission.canCreate && Boolean(name.trim()) && !createMutation.isPending;
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
          <ActionButton onPress={() => setModalVisible(true)} size="small" title="+ Dodaj" />
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
        <View style={styles.formRow}>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder="Kwota"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.flexInput]}
            value={amount}
          />
          <TextInput
            onChangeText={setNextDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.dateInput]}
            value={nextDueDate}
          />
        </View>
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
        <View style={styles.formRow}>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setPaymentAmount}
            placeholder="Kwota"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.flexInput]}
            value={paymentAmount}
          />
          <TextInput
            onChangeText={setPaymentDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textSubtle}
            style={[styles.input, styles.dateInput]}
            value={paymentDate}
          />
        </View>
        {completeMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się zapisać opłaconego kosztu." />
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
  const [modalVisible, setModalVisible] = useState(false);
  const entriesQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listDataEntries(search.trim() || undefined, { accessToken }),
    queryKey: [...queryKeys.dataEntries, search.trim()],
  });
  const createMutation = useMutation({
    mutationFn: () => createDataEntry({ title: title.trim(), value: value.trim() }, { accessToken }),
    onSuccess: async () => {
      setTitle("");
      setValue("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.dataEntries });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDataEntry(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dataEntries }),
  });
  const entries = entriesQuery.data ?? [];
  const canAdd = permission.canCreate && Boolean(title.trim()) && !createMutation.isPending;

  return (
    <ModulePanel
      accent={accent}
      action={
        permission.canCreate ? (
          <ActionButton onPress={() => setModalVisible(true)} size="small" title="+ Dodaj" />
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
            canDelete={permission.canDelete}
            deleting={deleteMutation.isPending}
            entry={entry}
            key={entry.id}
            onDelete={() => deleteMutation.mutate(entry.id)}
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
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [pickedPhoto, setPickedPhoto] = useState<PickedAttachmentPhoto | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [openingAttachment, setOpeningAttachment] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [downloadNeedsSettings, setDownloadNeedsSettings] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadNeedsSettings, setUploadNeedsSettings] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const attachmentsQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listAttachments(search.trim() || undefined, { accessToken }),
    queryKey: [...queryKeys.attachments, search.trim()],
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
    onSuccess: async () => {
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
    onSuccess: async () => {
      setEditingAttachment(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.attachments });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAttachment(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.attachments }),
  });
  const attachments = attachmentsQuery.data ?? [];
  const canAdd = permission.canCreate && Boolean(pickedPhoto) && !createMutation.isPending;

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
      setPreviewError("Nie udało się otworzyć pliku. Spróbuj ponownie za chwilę.");
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
      setDownloadNotice(target === "gallery" ? "Zdjęcie zapisane w galerii." : "Plik zapisany w pamięci aplikacji.");
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
    const currentPermission = await MediaLibrary.getPermissionsAsync(false, ["photo"]);
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
          <ActionButton onPress={handlePickPhoto} size="small" title="+ Zdjęcie" />
        ) : undefined
      }
      icon={<Folder color={accent.color} size={18} />}
      subtitle={`${attachments.length} zapisanych plików`}
      title="Pliki"
    >
      {uploadError ? <InlineAlert tone="error" text={uploadError} /> : null}
      {uploadNeedsSettings ? (
        <ActionButton onPress={openAppSettings} size="small" title="Otwórz ustawienia" variant="secondary" />
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
            canDelete={permission.canDelete}
            canUpdate={permission.canUpdate}
            deleting={deleteMutation.isPending}
            downloading={downloadingAttachmentId === attachment.id}
            key={attachment.id}
            onDelete={() => deleteMutation.mutate(attachment.id)}
            onDownload={() => handleDownloadAttachment(attachment)}
            onEdit={() => openEditAttachment(attachment)}
            onPreview={() => openPreviewAttachment(attachment)}
          />
        ))}
      </View>
      {downloadNotice ? <InlineAlert text={downloadNotice} /> : null}
      {downloadError ? <InlineAlert tone="error" text={downloadError} /> : null}
      {downloadNeedsSettings ? (
        <ActionButton onPress={openAppSettings} size="small" title="Otwórz ustawienia" variant="secondary" />
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
            <Image source={{ uri: pickedPhoto.uri }} style={styles.photoPreview} />
            <View style={styles.photoMeta}>
              <Text numberOfLines={1} style={styles.itemName}>
                {pickedPhoto.fileName}
              </Text>
              <Text style={styles.itemMeta}>
                {pickedPhoto.mimeType.replace("image/", "").toUpperCase()}
                {pickedPhoto.fileSize ? ` / ${formatBytes(pickedPhoto.fileSize)}` : ""}
              </Text>
            </View>
          </View>
        ) : (
          <InlineAlert text="Wybierz zdjęcie z galerii." />
        )}
        <ActionButton onPress={handlePickPhoto} title="Zmień zdjęcie" variant="secondary" />
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
        onClose={closePreviewAttachment}
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
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={closePreviewAttachment}
              style={styles.modalFooterButton}
              title="Zamknij"
              variant="secondary"
            />
            {previewAttachment && !previewAttachment.mimeType.startsWith("image/") ? (
              <ActionButton
                loading={openingAttachment}
                onPress={handleOpenAttachmentFile}
                style={styles.modalFooterButton}
                title="Otwórz plik"
              />
            ) : null}
          </View>
        }
        onClose={closePreviewAttachment}
        subtitle={previewAttachment?.caption || "Podgląd pliku z domowego folderu."}
        title={previewAttachment?.fileName ?? "Podgląd pliku"}
        visible={Boolean(previewAttachment && !previewAttachment.mimeType.startsWith("image/"))}
      >
        {previewError ? <InlineAlert tone="error" text={previewError} /> : null}
        <View style={styles.attachmentPreviewPlaceholder}>
          <FileText color={accent.color} size={32} />
          <Text style={styles.itemName}>Ten plik nie jest zdjęciem.</Text>
          <Text style={styles.itemMeta}>Możesz otworzyć go w aplikacji obsługującej ten typ pliku.</Text>
        </View>
      </FormModal>
    </ModulePanel>
  );
}

function ZoomableImageModal({
  onClose,
  source,
  title,
  visible,
}: {
  onClose: () => void;
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
  }, [savedScale, savedX, savedY, scale, source, translateX, translateY, visible]);

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
  const composedGesture = Gesture.Exclusive(doubleTapGesture, Gesture.Simultaneous(pinchGesture, panGesture));
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <GestureHandlerRootView style={styles.zoomGestureRoot}>
        <View style={styles.zoomModal}>
        <View style={styles.zoomHeader}>
          <Text numberOfLines={1} style={styles.zoomTitle}>
            {title}
          </Text>
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
        <Text style={styles.zoomHint}>Uszczypnij, przesuń albo stuknij dwa razy.</Text>
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
  const { accent, fontScale, setAccent, setFontScale } = useThemePreferences();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>("main");
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [homeName, setHomeName] = useState("");
  const [currencyCode, setCurrencyCode] = useState<SupportedCurrencyCode>("PLN");
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
    mutationFn: () => inviteHouseholdMember({ email: memberInviteEmail.trim() }, { accessToken }),
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
    mutationFn: (memberId: string) => removeHouseholdMember(memberId, { accessToken }),
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
      showToast(token ? "Powiadomienia włączone" : "Nie udało się pobrać tokenu push");
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

  function toggleNotificationPreference(eventType: RealtimeEventType, enabled: boolean) {
    const next = notificationPreferences.map((preference) =>
      preference.eventType === eventType ? { ...preference, enabled } : preference,
    );

    notificationPreferencesMutation.mutate(next);
  }

  function handleAccentChange(accent: DarkAccentKey) {
    setAccent(accent);
    showToast("Kolor zapisany");
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
  const selectedAccent = normalizeHexAccent(accent) ?? "#B56CFF";
  const settingsTitle =
    settingsView === "appearance"
      ? "Kolor i czcionka"
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
    <IconButton accessibilityLabel="Otwórz ustawienia i konto" onPress={openSettings}>
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
                onChangeText={(value) => setMealSlotsPerDay(value.replace(/\D/g, "").slice(0, 1))}
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
            <InlineAlert tone="error" text="Nie udało się zapisać ustawień domu." />
          ) : null}
        </View>
        ) : null}
        {settingsView === "main" && householdPermission.canRead ? (
          <View style={styles.settingsPanelRow}>
            <View style={styles.settingsMembersHeader}>
              <View style={[styles.moduleIcon, { backgroundColor: theme.colors.softBlue }]}>
                <Users color={theme.colors.calendar} size={22} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.settingsPanelTitle}>Członkowie i zaproszenia</Text>
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
              <View style={[styles.moduleIcon, { backgroundColor: selectedAccent }]}>
                <Pencil color={getReadableSwatchText(selectedAccent)} size={21} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.settingsPanelTitle}>Kolor i rozmiar tekstu</Text>
                <Text style={styles.settingsPanelMeta}>
                  {selectedAccent} / {Math.round(fontScale * 100)}%
                </Text>
              </View>
              <View style={[styles.accentPalettePreview, { backgroundColor: selectedAccent }]} />
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
              <View style={[styles.moduleIcon, { backgroundColor: theme.colors.softBlue }]}>
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
                  <View style={[styles.moduleIcon, { backgroundColor: theme.colors.primarySoft }]}>
                    <MailPlus color={theme.colors.primaryDark} size={21} />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemName}>Zaproszenie do domu</Text>
                    <Text style={styles.itemMeta}>Wyślij zaproszenie na adres e-mail.</Text>
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
                      <Text style={styles.itemName}>{member.displayName}</Text>
                      <Text style={styles.itemMeta}>
                        {[member.email, member.role === "owner" ? "właściciel" : "domownik"]
                          .filter(Boolean)
                          .join(" / ")}
                      </Text>
                    </View>
                    <ChevronRight color={theme.colors.textSubtle} size={20} />
                  </Pressable>
                  <View style={styles.memberActions}>
                    {householdPermission.canDelete && member.role !== "owner" ? (
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
              <InlineAlert tone="error" text="Nie udało się usunąć domownika." />
            ) : null}
          </View>
        ) : null}
        {settingsView === "members" && !householdPermission.canRead ? (
          <InlineAlert tone="error" text="Nie masz uprawnień do podglądu domowników." />
        ) : null}
        {settingsView === "appearance" ? (
          <>
            <View style={styles.settingsPanelRow}>
              <Text style={styles.settingsPanelTitle}>Rozmiar tekstu</Text>
              <Text style={styles.settingsPanelMeta}>
                Przesuń suwak, żeby zwiększyć albo zmniejszyć czcionkę w aplikacji.
              </Text>
              <FontScaleControl value={fontScale} onChange={setFontScale} />
            </View>
            <View style={styles.settingsPanelRow}>
              <Text style={styles.settingsPanelTitle}>Kolor</Text>
              <Text style={styles.settingsPanelMeta}>Kolor akcentu aplikacji.</Text>
              <AccentPalettePicker accent={accent} onChange={handleAccentChange} />
            </View>
          </>
        ) : null}
        {settingsView === "main" ? (
          <>
        <View style={styles.settingsPanelRow}>
          <Text style={styles.settingsPanelTitle}>Powiadomienia konfiguracja</Text>
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
            Konto zostanie wylogowane, tokeny powiadomień zostaną wyłączone, a adres e-mail odłączony od profilu.
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
          <IconButton accessibilityLabel="Zamknij powiadomienia" onPress={() => setNotificationsVisible(false)}>
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
            <InlineAlert tone="error" text="Nie udało się pobrać tokenu push dla tego telefonu." />
          ) : null}
          {registerPushMutation.error ? (
            <InlineAlert tone="error" text="Rejestracja powiadomień nie powiodła się." />
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
            <InlineAlert tone="error" text="Nie udało się wysłać testowego powiadomienia." />
          ) : null}
        </View>
        <View style={styles.settingsPanelRow}>
          <Text style={styles.settingsPanelTitle}>Typy powiadomień</Text>
          <Text style={styles.settingsPanelMeta}>
            Wybierz, kiedy zmiany innych domowników mają wysyłać powiadomienie.
          </Text>
          <QueryState
            error={notificationPreferencesQuery.error}
            isLoading={notificationPreferencesQuery.isLoading}
          />
          <View style={styles.notificationPreferenceList}>
            {notificationPreferences
              .map((preference) => {
                const copy = notificationPreferenceLabels[preference.eventType];

                return (
                  <View key={preference.eventType} style={styles.notificationPreferenceRow}>
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
                        onPress={() => toggleNotificationPreference(preference.eventType, !preference.enabled)}
                        style={[
                          styles.preferenceToggle,
                          preference.enabled && styles.preferenceToggleActive,
                          notificationPreferencesMutation.isPending && styles.preferenceToggleDisabled,
                        ]}
                      >
                        <View
                          style={[
                            styles.preferenceToggleThumb,
                            preference.enabled && styles.preferenceToggleThumbActive,
                          ]}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
          </View>
          {notificationPreferencesMutation.error ? (
            <InlineAlert tone="error" text="Nie udało się zapisać ustawień powiadomień." />
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

function AccentPalettePicker({
  accent,
  onChange,
}: {
  accent: DarkAccentKey;
  onChange: (accent: DarkAccentKey) => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const selectedAccent = normalizeHexAccent(accent) ?? "#B56CFF";
  const colorOptions = accentColorOptions.filter((option) => !neutralAccentValues.has(option.value));
  const neutralOptions = accentColorOptions.filter((option) => neutralAccentValues.has(option.value));
  const renderSwatch = (option: (typeof accentColorOptions)[number]) => {
    const optionColor = normalizeHexAccent(option.value) ?? option.color;
    const active = optionColor === selectedAccent;

    return (
      <Pressable
        accessibilityLabel={`Kolor akcentu ${option.label}`}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        key={option.value}
        onPress={() => onChange(option.value)}
        style={({ pressed }) => [
          styles.accentSwatch,
          { backgroundColor: option.color },
          active && styles.accentSwatchActive,
          pressed && styles.pressed,
        ]}
      >
        {active ? <Check color={getReadableSwatchText(optionColor)} size={13} /> : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.accentPaletteCard}>
      <View style={styles.accentPaletteSection}>
        <Text style={styles.accentPaletteTitle}>Kolory</Text>
        <View style={styles.accentSwatchGrid}>{colorOptions.map(renderSwatch)}</View>
      </View>
      <View style={styles.accentPaletteSection}>
        <Text style={styles.accentPaletteTitle}>Neutralne i ziemiste</Text>
        <View style={styles.accentSwatchGrid}>{neutralOptions.map(renderSwatch)}</View>
      </View>
      <View style={styles.accentPalettePreviewRow}>
        <View style={[styles.accentPalettePreview, { backgroundColor: selectedAccent }]} />
        <Text style={styles.settingsPanelMeta}>{selectedAccent}</Text>
      </View>
    </View>
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
  const progress = (normalizedValue - fontScaleSliderMin) / (fontScaleSliderMax - fontScaleSliderMin);
  const progressWidth = Math.round(trackWidth * progress);

  function handleTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(Math.max(1, event.nativeEvent.layout.width));
  }

  function updateFromTrack(locationX: number) {
    const ratio = Math.min(1, Math.max(0, locationX / trackWidth));
    const nextValue = fontScaleSliderMin + (fontScaleSliderMax - fontScaleSliderMin) * ratio;

    onChange(clampFontScale(nextValue));
  }

  return (
    <View style={styles.fontScaleControl}>
      <View style={styles.fontScalePreview}>
        <Text style={styles.fontScalePreviewSmall}>Mały</Text>
        <Text style={styles.fontScalePreviewLarge}>Duży tekst</Text>
        <Text style={styles.fontScaleValue}>{Math.round(normalizedValue * 100)}%</Text>
      </View>
      <View
        accessibilityLabel="Rozmiar czcionki"
        accessibilityRole="adjustable"
        accessible
        onLayout={handleTrackLayout}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => updateFromTrack(event.nativeEvent.locationX)}
        onResponderMove={(event) => updateFromTrack(event.nativeEvent.locationX)}
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
    preferences?.map((preference) => [preference.eventType, preference.enabled]) ?? [],
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
        <View style={styles.panelActions}>
          {action}
        </View>
      </View>
      {children}
    </View>
  );
}

function CleaningRow({
  accent,
  canDelete,
  canUpdate,
  completing,
  deleting,
  onComplete,
  onDelete,
  onEdit,
  task,
}: {
  accent: Accent;
  canDelete: boolean;
  canUpdate: boolean;
  completing: boolean;
  deleting: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: () => void;
  task: CleaningTask;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.itemRow, task.isOverdue && styles.warningRow]}>
      <View style={[styles.itemMarker, { backgroundColor: task.isOverdue ? theme.colors.warning : accent.color }]} />
      <View style={styles.itemText}>
        <Text style={styles.itemName}>{task.name}</Text>
        <Text style={styles.itemMeta}>Termin: {task.nextDueAt} / co {task.frequencyDays} dni</Text>
      </View>
      <ActionButton
        disabled={!canUpdate || completing}
        onPress={onComplete}
        size="small"
        title="Wykonane"
        variant="secondary"
      />
      {canUpdate ? (
        <IconButton accessibilityLabel="Edytuj sprzatanie" onPress={onEdit}>
          <Pencil color={theme.colors.primary} size={17} />
        </IconButton>
      ) : null}
      {canDelete ? (
        <IconButton accessibilityLabel="Usun sprzatanie" disabled={deleting} onPress={onDelete}>
          <Trash2 color={theme.colors.danger} size={17} />
        </IconButton>
      ) : null}
    </View>
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
        <Text style={styles.itemMeta}>{cost.nextDueDate} / {formatMoney(cost.defaultAmount, currencyCode)}</Text>
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
  canDelete,
  deleting,
  entry,
  onDelete,
}: {
  accent: Accent;
  canDelete: boolean;
  deleting: boolean;
  entry: DataEntry;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemMarker, { backgroundColor: accent.color }]} />
      <View style={styles.itemText}>
        <Text style={styles.itemName}>{entry.title}</Text>
        <Text numberOfLines={2} style={styles.itemMeta}>{entry.value}</Text>
      </View>
      {canDelete ? (
        <IconButton disabled={deleting} onPress={onDelete}>
          <Trash2 color={theme.colors.danger} size={17} />
        </IconButton>
      ) : null}
    </View>
  );
}

function AttachmentRow({
  accessToken,
  accent,
  attachment,
  canDelete,
  canUpdate,
  deleting,
  downloading,
  onDelete,
  onDownload,
  onEdit,
  onPreview,
}: {
  accessToken?: string | null;
  accent: Accent;
  attachment: Attachment;
  canDelete: boolean;
  canUpdate: boolean;
  deleting: boolean;
  downloading: boolean;
  onDelete: () => void;
  onDownload: () => void;
  onEdit: () => void;
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
        style={({ pressed }) => [styles.attachmentPreviewArea, pressed && styles.pressed]}
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
      <IconButton accessibilityLabel={`Pobierz plik ${attachment.fileName}`} disabled={downloading} onPress={onDownload}>
        <Download color={theme.colors.primary} size={17} />
      </IconButton>
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
  );
}

function MiniAvatar({ member }: { member: HouseholdMember }) {
  const styles = createStyles(useAppTheme().colors);
  const initial = (member.displayName || member.email || "?").slice(0, 1).toUpperCase();

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

function getSegmentIcon(segment: HomeSegment, color: string, size: number): ReactNode {
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

function normalizePickedPhoto(asset: ImagePicker.ImagePickerAsset | undefined): PickedAttachmentPhoto | null {
  if (!asset?.uri) {
    return null;
  }

  const mimeType = normalizePickedImageMimeType(asset.mimeType, asset.fileName ?? asset.uri);

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
  if (mimeType && imageAttachmentMimeTypes.includes(mimeType as ImageAttachmentMimeType)) {
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

async function shareAttachmentFile(attachment: Attachment, accessToken?: string | null): Promise<void> {
  const cacheDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

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
  const cacheDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

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

    const permissions = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);

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
  await FileSystem.makeDirectoryAsync(downloadsDirectory, { intermediates: true });
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

function hasFullPhotoLibraryAccess(permission: { accessPrivileges?: string | null; granted: boolean }): boolean {
  return permission.granted && permission.accessPrivileges !== "limited" && permission.accessPrivileges !== "none";
}

function sanitizeCacheFileName(fileName: string): string {
  const sanitized = fileName.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");

  return sanitized || "attachment";
}

function getReadableSwatchText(color: string): string {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return "#FFFFFF";
  }

  const luminance = (rgb.red * 0.299 + rgb.green * 0.587 + rgb.blue * 0.114) / 255;

  return luminance > 0.62 ? "#111827" : "#FFFFFF";
}

function normalizeHexAccent(value: string): string | null {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("#") ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;

  return /^#[0-9A-F]{6}$/.test(hex) ? hex : null;
}

function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  const clamped = Math.min(fontScaleSliderMax, Math.max(fontScaleSliderMin, value));

  return Math.round(clamped * 20) / 20;
}

function parseHexColor(color: string): { blue: number; green: number; red: number } | null {
  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    return null;
  }

  return {
    blue: Number.parseInt(color.slice(5, 7), 16),
    green: Number.parseInt(color.slice(3, 5), 16),
    red: Number.parseInt(color.slice(1, 3), 16),
  };
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    accentPaletteCard: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    accentPalettePreview: {
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 26,
      width: 26,
    },
    accentPalettePreviewRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
    },
    accentPaletteSection: {
      gap: spacing.sm,
    },
    accentPaletteTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    accentSwatch: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    accentSwatchActive: {
      borderColor: colors.text,
      borderWidth: 2,
      transform: [{ scale: 1.08 }],
    },
    accentSwatchGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
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
    dateInput: {
      minWidth: 132,
    },
    flexInput: {
      flex: 1,
    },
    formRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    hidden: {
      display: "none",
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
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.card,
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
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 4,
      gap: spacing.md,
      padding: spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 12, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 30,
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
      backgroundColor: colors.warningSoft,
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
