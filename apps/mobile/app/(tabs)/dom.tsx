import type { ModuleKey } from "@homeapp/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  completeAnnualCost,
  completeCleaningTask,
  createAnnualCost,
  createAttachmentRecord,
  createAttachmentUploadUrl,
  createCleaningTask,
  createDataEntry,
  deleteAttachment,
  deleteMyAccount,
  deleteDataEntry,
  getAttachmentFileUrl,
  getMyHousehold,
  inviteHouseholdMember,
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
  updateMyHousehold,
  uploadAttachmentFile,
  type AnnualCost,
  type Attachment,
  type CleaningTask,
  type DataEntry,
  type HouseholdMember,
} from "../../src/api";
import { registerForPushNotifications } from "../../src/notifications/register-push-notifications";
import { useModulePermission, usePermissions } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import {
  ActionButton,
  AppScreen,
  AppToast,
  FormModal,
  IconButton,
  InlineAlert,
  QueryState,
} from "../../src/ui";
import {
  AccountCircle,
  Broom,
  ChartBar,
  Check,
  ChevronRight,
  Cog,
  Database,
  FileText,
  Folder,
  Pencil,
  RefreshCcw,
  Trash2,
  Users,
} from "../../src/ui/icon";

type HomeSegment = "cleaning" | "annual_costs" | "data_entries" | "attachments";
type ImageAttachmentMimeType = Extract<Attachment["mimeType"], "image/jpeg" | "image/png" | "image/webp">;

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
      actions={
        <View style={styles.avatar}>
          <AccountCircle color={theme.colors.text} size={27} />
        </View>
      }
      subtitle="Zarządzaj swoim domem"
      title="Dom"
    >
      {availableTiles.length === 0 ? (
        <InlineAlert text="Nie masz dostępu do modułów domowych." />
      ) : (
        <View style={styles.moduleGrid}>
          {availableTiles.map((tile) => (
            <ModuleTile
              active={tile.value === activeSegment}
              description={tile.description}
              key={tile.value}
              segment={tile.value}
              title={tile.title}
              onPress={() => setActiveSegment(tile.value)}
            />
          ))}
        </View>
      )}

      {availableTiles.length > 0 ? <ActiveModule segment={activeSegment} /> : null}

      <HouseholdCard />
      <SettingsRow openOnMount={params.settings === "1"} />
    </AppScreen>
  );
}

function ModuleTile({
  active,
  description,
  onPress,
  segment,
  title,
}: {
  active: boolean;
  description: string;
  onPress: () => void;
  segment: HomeSegment;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accent = getSegmentAccent(theme.colors, segment);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.moduleTile,
        active && { borderColor: accent.color, backgroundColor: accent.soft },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.moduleIcon, { backgroundColor: accent.soft }]}>
        {getSegmentIcon(segment, accent.color, 31)}
      </View>
      <Text style={styles.moduleTitle}>{title}</Text>
      <Text numberOfLines={3} style={styles.moduleDescription}>
        {description}
      </Text>
      <ChevronRight color={theme.colors.textMuted} size={18} />
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cleaning }),
  });
  const tasks = tasksQuery.data ?? [];
  const overdue = tasks.filter((task) => task.isOverdue).length;
  const canAdd = permission.canCreate && Boolean(name.trim()) && !createMutation.isPending;

  return (
    <ModulePanel
      accent={accent}
      action={
        permission.canCreate ? (
          <ActionButton onPress={() => setModalVisible(true)} size="small" title="+ Dodaj" />
        ) : undefined
      }
      icon={<Broom color={accent.color} size={18} />}
      onRefresh={() => tasksQuery.refetch()}
      subtitle={`${tasks.length} zadań / ${overdue} po terminie`}
      title="Sprzątanie"
    >
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
            completing={completeMutation.isPending}
            key={task.id}
            onComplete={() => completeMutation.mutate(task.id)}
            task={task}
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
    mutationFn: (cost: AnnualCost) =>
      completeAnnualCost(
        cost.id,
        {
          amount: parseOptionalNumber(String(cost.defaultAmount ?? "")),
          executedAt: todayIso(),
        },
        { accessToken },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.annualCosts }),
  });
  const costs = costsQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const canAdd = permission.canCreate && Boolean(name.trim()) && !createMutation.isPending;

  return (
    <ModulePanel
      accent={accent}
      action={
        permission.canCreate ? (
          <ActionButton onPress={() => setModalVisible(true)} size="small" title="+ Dodaj" />
        ) : undefined
      }
      icon={<ChartBar color={accent.color} size={18} />}
      onRefresh={() => {
        costsQuery.refetch();
        historyQuery.refetch();
      }}
      subtitle={`${costs.length} kosztów / ${history.length} wpisów w ${year}`}
      title="Koszty roczne"
    >
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
            key={cost.id}
            onComplete={() => completeMutation.mutate(cost)}
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
      onRefresh={() => entriesQuery.refetch()}
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
  const [uploadError, setUploadError] = useState("");
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

  async function handlePickPhoto() {
    setUploadError("");

    try {
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
      onRefresh={() => attachmentsQuery.refetch()}
      subtitle={`${attachments.length} zapisanych plików`}
      title="Pliki"
    >
      {uploadError ? <InlineAlert tone="error" text={uploadError} /> : null}
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
            key={attachment.id}
            onDelete={() => deleteMutation.mutate(attachment.id)}
            onEdit={() => openEditAttachment(attachment)}
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
    </ModulePanel>
  );
}

function HouseholdCard() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("household_members");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [email, setEmail] = useState("");
  const [inviteVisible, setInviteVisible] = useState(false);
  const [invitationNotice, setInvitationNotice] = useState<string | null>(null);
  const householdQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: [...queryKeys.household, "me"],
  });
  const membersQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listHouseholdMembers({ accessToken }),
    queryKey: [...queryKeys.household, "members"],
  });
  const inviteMutation = useMutation({
    mutationFn: () => inviteHouseholdMember({ email: email.trim() }, { accessToken }),
    onSuccess: async (invitation) => {
      setEmail("");
      setInviteVisible(false);
      setInvitationNotice(
        invitation.notificationSent && invitation.notificationSent > 0
          ? `Zaproszenie wysłane do ${invitation.email}. Wysłano też powiadomienie push.`
          : `Zaproszenie wysłane do ${invitation.email}.`
      );
      setTimeout(() => setInvitationNotice(null), 2600);
      await queryClient.invalidateQueries({ queryKey: queryKeys.household });
    },
  });
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeHouseholdMember(memberId, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.household }),
  });
  const members = membersQuery.data ?? [];
  const canInvite = permission.canCreate && Boolean(email.trim()) && !inviteMutation.isPending;
  const inviteErrorMessage =
    inviteMutation.error instanceof Error
      ? inviteMutation.error.message
      : "Nie udało się zaprosić osoby.";

  if (!permission.canRead) {
    return null;
  }

  return (
    <>
    <AppToast text={invitationNotice} />
    <View style={styles.householdCard}>
      <View style={[styles.moduleIcon, { backgroundColor: theme.colors.softBlue }]}>
        <Users color={theme.colors.calendar} size={25} />
      </View>
      <View style={styles.householdText}>
        <Text style={styles.householdTitle}>Członkowie domu</Text>
        <Text style={styles.householdMeta}>
          {householdQuery.data?.name ?? "Dom"} / {members.length} osób
        </Text>
      </View>
      <View style={styles.memberAvatars}>
        {members.slice(0, 3).map((member) => (
          <MiniAvatar key={member.id} member={member} />
        ))}
      </View>
      {permission.canCreate ? (
        <IconButton
          accessibilityLabel="Zaproś domownika"
          onPress={() => {
            inviteMutation.reset();
            setInvitationNotice(null);
            setInviteVisible(true);
          }}
        >
          <ChevronRight color={theme.colors.textMuted} size={20} />
        </IconButton>
      ) : null}
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setInviteVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canInvite}
              loading={inviteMutation.isPending}
              onPress={() => inviteMutation.mutate()}
              style={styles.modalFooterButton}
              title="Wyślij"
            />
          </View>
        }
        onClose={() => setInviteVisible(false)}
        subtitle="Zaproszona osoba dostanie możliwość dołączenia do domu."
        title="Zaproś domownika"
        visible={inviteVisible}
      >
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="email@dom.pl"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={email}
        />
        {members.map((member) =>
          permission.canDelete && member.role !== "owner" ? (
            <MemberDeleteRow
              deleting={removeMutation.isPending}
              key={member.id}
              member={member}
              onDelete={() => removeMutation.mutate(member.id)}
            />
          ) : null,
        )}
        {inviteMutation.error ? (
          <InlineAlert tone="error" text={inviteErrorMessage} />
        ) : null}
      </FormModal>
    </View>
    </>
  );
}

function SettingsRow({ openOnMount }: { openOnMount: boolean }) {
  const { logout, session } = useSession();
  const queryClient = useQueryClient();
  const householdPermission = useModulePermission("household_members");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [homeName, setHomeName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("PLN");
  const [mealSlotsPerDay, setMealSlotsPerDay] = useState("4");
  const [toast, setToast] = useState<string | null>(null);
  const householdQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: [...queryKeys.household, "me"],
  });

  useEffect(() => {
    if (openOnMount) {
      setSettingsVisible(true);
    }
  }, [openOnMount]);

  useEffect(() => {
    const household = householdQuery.data;

    if (!household) {
      return;
    }

    setHomeName(household.name);
    setCurrencyCode(household.currencyCode);
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
          currencyCode: currencyCode.trim().toUpperCase(),
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
  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteMyAccount({ accessToken }),
    onSuccess: async () => {
      setDeleteConfirmVisible(false);
      setSettingsVisible(false);
      queryClient.clear();
      await logout();
    },
  });

  async function handleLogout() {
    setSettingsVisible(false);
    queryClient.clear();
    await logout();
  }

  return (
    <>
    <AppToast text={toast} />
    <Pressable
      accessibilityLabel="Otwórz ustawienia i konto"
      accessibilityRole="button"
      onPress={() => setSettingsVisible(true)}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
    >
      <Cog color={theme.colors.textMuted} size={18} />
      <View style={styles.householdText}>
        <Text style={styles.settingsTitle}>Ustawienia i konto</Text>
        <Text style={styles.settingsMeta}>
          {session ? "Profil, powiadomienia, język, bezpieczeństwo" : "Brak aktywnej sesji"}
        </Text>
      </View>
      <ChevronRight color={theme.colors.textMuted} size={20} />
    </Pressable>
    <FormModal
      footer={
        <View style={styles.modalFooter}>
          <ActionButton
            onPress={() => setSettingsVisible(false)}
            style={styles.modalFooterButton}
            title="Zamknij"
            variant="secondary"
          />
          <ActionButton
            onPress={handleLogout}
            style={styles.modalFooterButton}
            title="Wyloguj"
            variant="secondary"
          />
        </View>
      }
      onClose={() => setSettingsVisible(false)}
      subtitle="Profil, powiadomienia i bezpieczeństwo konta."
      title="Ustawienia i konto"
      visible={settingsVisible}
    >
      <View style={styles.settingsPanel}>
        <View style={styles.settingsPanelRow}>
          <Text style={styles.settingsPanelTitle}>Dom</Text>
          <Text style={styles.settingsPanelMeta}>
            Nazwa domu, waluta i liczba slotów posiłków.
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
            <TextInput
              autoCapitalize="characters"
              editable={householdPermission.canUpdate}
              maxLength={3}
              onChangeText={setCurrencyCode}
              placeholder="PLN"
              placeholderTextColor={theme.colors.textSubtle}
              style={[styles.input, styles.flexInput]}
              value={currencyCode}
            />
            <TextInput
              editable={householdPermission.canUpdate}
              keyboardType="number-pad"
              maxLength={1}
              onChangeText={setMealSlotsPerDay}
              placeholder="4"
              placeholderTextColor={theme.colors.textSubtle}
              style={[styles.input, styles.timeInput]}
              value={mealSlotsPerDay}
            />
          </View>
          <ActionButton
            disabled={
              !householdPermission.canUpdate ||
              !homeName.trim() ||
              !/^[A-Za-z]{3}$/.test(currencyCode.trim()) ||
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
        <View style={styles.settingsPanelRow}>
          <Text style={styles.settingsPanelTitle}>Powiadomienia push</Text>
          <Text style={styles.settingsPanelMeta}>
            Wyślij test, żeby potwierdzić rejestrację tokenu push dla tego telefonu.
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
      </View>
    </FormModal>
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

function ModulePanel({
  accent,
  action,
  children,
  icon,
  onRefresh,
  subtitle,
  title,
}: {
  accent: Accent;
  action?: ReactNode;
  children: ReactNode;
  icon: ReactNode;
  onRefresh: () => void;
  subtitle: string;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  function handleRefresh() {
    onRefresh();
    setRefreshNotice("Widok odświeżony");
    setTimeout(() => setRefreshNotice(null), 1800);
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={[styles.panelIcon, { backgroundColor: accent.soft }]}>{icon}</View>
        <View style={styles.panelText}>
          <Text style={styles.panelTitle}>{title}</Text>
          <Text style={styles.panelSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.panelActions}>
          {action}
          <IconButton onPress={handleRefresh}>
            <RefreshCcw color={theme.colors.textMuted} size={17} />
          </IconButton>
        </View>
      </View>
      {refreshNotice ? <Text style={styles.refreshNotice}>{refreshNotice}</Text> : null}
      {children}
    </View>
  );
}

function CleaningRow({
  accent,
  canUpdate,
  completing,
  onComplete,
  task,
}: {
  accent: Accent;
  canUpdate: boolean;
  completing: boolean;
  onComplete: () => void;
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
      <IconButton disabled={!canUpdate || completing} onPress={onComplete}>
        <Check color={accent.color} size={17} />
      </IconButton>
    </View>
  );
}

function CostRow({
  accent,
  canUpdate,
  completing,
  cost,
  onComplete,
}: {
  accent: Accent;
  canUpdate: boolean;
  completing: boolean;
  cost: AnnualCost;
  onComplete: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemMarker, { backgroundColor: accent.color }]} />
      <View style={styles.itemText}>
        <Text style={styles.itemName}>{cost.name}</Text>
        <Text style={styles.itemMeta}>{cost.nextDueDate} / {formatMoney(cost.defaultAmount)}</Text>
      </View>
      <IconButton disabled={!canUpdate || completing} onPress={onComplete}>
        <Check color={accent.color} size={17} />
      </IconButton>
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
  onDelete,
  onEdit,
}: {
  accessToken?: string | null;
  accent: Accent;
  attachment: Attachment;
  canDelete: boolean;
  canUpdate: boolean;
  deleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const isImage = attachment.mimeType.startsWith("image/");

  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemMarker, { backgroundColor: accent.color }]} />
      {isImage ? (
        <Image
          source={{
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            uri: getAttachmentFileUrl(attachment.id),
          }}
          style={styles.attachmentThumb}
        />
      ) : (
        <FileText color={accent.color} size={17} />
      )}
      <View style={styles.itemText}>
        <Text style={styles.itemName}>{attachment.fileName}</Text>
        <Text numberOfLines={2} style={styles.itemMeta}>
          {attachment.caption || "Brak opisu"}
        </Text>
      </View>
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

function MemberDeleteRow({
  deleting,
  member,
  onDelete,
}: {
  deleting: boolean;
  member: HouseholdMember;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.memberDeleteRow}>
      <Text style={styles.itemName}>{member.displayName}</Text>
      <IconButton disabled={deleting} onPress={onDelete}>
        <Trash2 color={theme.colors.danger} size={17} />
      </IconButton>
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

  return `zdjecie-${Date.now()}.${extensionForMimeType(mimeType)}`;
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

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "bez kwoty";
  }

  return `${Number(value).toLocaleString("pl-PL", {
    maximumFractionDigits: 0,
  })} zł`;
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
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
    householdCard: {
      alignItems: "center",
      backgroundColor: colors.softBlue,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 82,
      padding: spacing.md,
    },
    householdMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    householdText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    householdTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
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
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    itemText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    memberAvatars: {
      flexDirection: "row",
      marginLeft: spacing.xs,
    },
    memberDeleteRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderRadius: radii.card,
      flexDirection: "row",
      justifyContent: "space-between",
      padding: spacing.sm,
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
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    moduleIcon: {
      alignItems: "center",
      borderRadius: radii.control,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    moduleTile: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      minHeight: 154,
      padding: spacing.md,
      width: "48.5%",
    },
    moduleTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    multilineInput: {
      minHeight: 92,
      paddingTop: spacing.sm,
      textAlignVertical: "top",
    },
    panel: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
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
      borderRadius: radii.control,
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
    refreshNotice: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      marginTop: -spacing.xs,
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
      backgroundColor: colors.card,
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
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
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
  });
}
