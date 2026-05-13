import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  completeTodoItem,
  createNote,
  createTodoItem,
  deleteNote,
  deleteTodoItem,
  listNotes,
  listTodoItems,
  queryKeys,
  reopenTodoItem,
  updateNote,
  type Note,
  type TodoItem,
} from "../../src/api";
import { hasModuleRead, useModulePermission, usePermissions } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import { ActionButton, AppScreen, FormModal, IconButton, InlineAlert, QueryState, SegmentedControl } from "../../src/ui";
import { Check, Pencil, Trash2 } from "../../src/ui/icon";

type TaskSegment = "notes" | "todo";

const taskSegments: Array<{ label: string; value: TaskSegment }> = [
  { label: "Notatki", value: "notes" },
  { label: "Do zrobienia", value: "todo" },
];

export default function ZadaniaScreen() {
  const { session } = useSession();
  const params = useLocalSearchParams<{ action?: string; segment?: TaskSegment }>();
  const router = useRouter();
  const permissionsQuery = usePermissions();
  const notesPermission = useModulePermission("notes");
  const todoPermission = useModulePermission("todo");
  const [activeSegment, setActiveSegment] = useState<TaskSegment>("notes");
  const availableSegments = useMemo(
    () =>
      taskSegments.filter((segment) =>
        segment.value === "notes" ? notesPermission.canRead : todoPermission.canRead,
      ),
    [notesPermission.canRead, todoPermission.canRead],
  );

  useEffect(() => {
    if (params.segment && availableSegments.some((segment) => segment.value === params.segment)) {
      setActiveSegment(params.segment);
      return;
    }

    if (availableSegments.length > 0 && !availableSegments.some((segment) => segment.value === activeSegment)) {
      setActiveSegment(availableSegments[0]!.value);
    }
  }, [activeSegment, availableSegments, params.segment]);

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Notatki i do zrobienia">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (!hasModuleRead(permissionsQuery.data, ["notes", "todo"])) {
    return (
      <AppScreen title="Notatki i do zrobienia">
        <InlineAlert text="Nie masz dostępu do notatek ani listy do zrobienia." />
      </AppScreen>
    );
  }

  return (
    <AppScreen title="Notatki i do zrobienia">
      <SegmentedControl
        onChange={(segment) => {
          setActiveSegment(segment);
          router.setParams({ action: undefined, segment });
        }}
        options={availableSegments}
        value={activeSegment}
      />
      {activeSegment === "notes" ? (
        <NotesBoard
          accessToken={session?.accessToken}
          action={params.segment === "notes" ? params.action : undefined}
          onRouteActionHandled={() => router.setParams({ action: undefined })}
        />
      ) : null}
      {activeSegment === "todo" ? (
        <TodoBoard
          accessToken={session?.accessToken}
          action={params.segment === "todo" ? params.action : undefined}
          onRouteActionHandled={() => router.setParams({ action: undefined })}
        />
      ) : null}
    </AppScreen>
  );
}

function NotesBoard({
  accessToken,
  action,
  onRouteActionHandled,
}: {
  accessToken?: string | null;
  action?: string;
  onRouteActionHandled: () => void;
}) {
  const queryClient = useQueryClient();
  const permission = useModulePermission("notes");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
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
      updateNote(editingNote?.id ?? "", { description: description.trim(), title: title.trim() }, { accessToken }),
    onSuccess: async () => {
      reset();
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id, { accessToken }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const notes = [...(notesQuery.data ?? [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  useEffect(() => {
    if (action === "note" && permission.canCreate) {
      setModalVisible(true);
      onRouteActionHandled();
    }
  }, [action, onRouteActionHandled, permission.canCreate]);

  function reset() {
    setTitle("");
    setDescription("");
    setEditingNote(null);
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setTitle(note.title);
    setDescription(note.description ?? "");
    setModalVisible(true);
  }

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>Notatki prywatne</Text>
          <Text style={styles.sectionSubtitle}>Widoczne tylko dla Ciebie.</Text>
        </View>
        {permission.canCreate ? <ActionButton onPress={() => setModalVisible(true)} size="small" title="Dodaj" /> : null}
      </View>
      <QueryState
        emptyText="Brak notatek."
        error={notesQuery.error}
        isEmpty={!notesQuery.isLoading && notes.length === 0}
        isLoading={notesQuery.isLoading}
      />
      <View style={styles.cardList}>
        {notes.map((note) => (
          <View key={note.id} style={styles.noteCard}>
            <View style={styles.cardText}>
              <Text numberOfLines={1} style={styles.cardTitle}>
                {note.title}
              </Text>
              {note.description ? (
                <Text numberOfLines={3} style={styles.cardDescription}>
                  {note.description}
                </Text>
              ) : null}
              <Text style={styles.cardMeta}>{formatDateTime(note.updatedAt)}</Text>
            </View>
            <View style={styles.rowActions}>
              {permission.canUpdate ? (
                <IconButton accessibilityLabel="Edytuj notatkę" onPress={() => openEdit(note)}>
                  <Pencil color={theme.colors.primary} size={17} />
                </IconButton>
              ) : null}
              {permission.canDelete ? (
                <IconButton
                  accessibilityLabel="Usuń notatkę"
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

      <NoteModal
        description={description}
        error={createMutation.error ?? updateMutation.error}
        isEditing={Boolean(editingNote)}
        loading={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          reset();
          setModalVisible(false);
        }}
        onDescriptionChange={setDescription}
        onSave={() => (editingNote ? updateMutation.mutate() : createMutation.mutate())}
        onTitleChange={setTitle}
        title={title}
        visible={modalVisible}
      />
    </>
  );
}

function TodoBoard({
  accessToken,
  action,
  onRouteActionHandled,
}: {
  accessToken?: string | null;
  action?: string;
  onRouteActionHandled: () => void;
}) {
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
      createTodoItem({ description: description.trim(), scopeType: "household", title: title.trim() }, { accessToken }),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.todo });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const toggleMutation = useMutation({
    mutationFn: (item: TodoItem) =>
      item.status === "done" ? reopenTodoItem(item.id, { accessToken }) : completeTodoItem(item.id, { accessToken }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.todo });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodoItem(id, { accessToken }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.todo });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const todos = [...(todoQuery.data ?? [])].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "todo" ? -1 : 1;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

  useEffect(() => {
    if (action === "todo" && permission.canCreate) {
      setModalVisible(true);
      onRouteActionHandled();
    }
  }, [action, onRouteActionHandled, permission.canCreate]);

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>Do zrobienia</Text>
          <Text style={styles.sectionSubtitle}>Wspólne dla całego domu.</Text>
        </View>
        {permission.canCreate ? <ActionButton onPress={() => setModalVisible(true)} size="small" title="Dodaj" /> : null}
      </View>
      <QueryState
        emptyText="Brak rzeczy do zrobienia."
        error={todoQuery.error}
        isEmpty={!todoQuery.isLoading && todos.length === 0}
        isLoading={todoQuery.isLoading}
      />
      <View style={styles.cardList}>
        {todos.map((todo) => {
          const done = todo.status === "done";

          return (
            <View key={todo.id} style={[styles.todoCard, done && styles.todoCardDone]}>
              <Pressable
                disabled={!permission.canUpdate || toggleMutation.isPending}
                onPress={() => toggleMutation.mutate(todo)}
                style={[styles.todoCheck, done && styles.todoCheckDone]}
              >
                {done ? <Check color={theme.colors.card} size={15} /> : null}
              </Pressable>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, done && styles.doneText]}>{todo.title}</Text>
                {todo.description ? (
                  <Text numberOfLines={2} style={styles.cardDescription}>
                    {todo.description}
                  </Text>
                ) : null}
              </View>
              {permission.canDelete ? (
                <IconButton
                  accessibilityLabel="Usuń zadanie"
                  disabled={deleteMutation.isPending}
                  onPress={() => deleteMutation.mutate(todo.id)}
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
        {createMutation.error ? <InlineAlert text="Nie udało się dodać rzeczy do zrobienia." tone="error" /> : null}
      </FormModal>
    </>
  );
}

function NoteModal({
  description,
  error,
  isEditing,
  loading,
  onClose,
  onDescriptionChange,
  onSave,
  onTitleChange,
  title,
  visible,
}: {
  description: string;
  error: Error | null;
  isEditing: boolean;
  loading: boolean;
  onClose: () => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
  title: string;
  visible: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <FormModal
      footer={
        <View style={styles.modalFooter}>
          <ActionButton onPress={onClose} style={styles.modalFooterButton} title="Anuluj" variant="secondary" />
          <ActionButton
            disabled={!title.trim()}
            loading={loading}
            onPress={onSave}
            style={styles.modalFooterButton}
            title={isEditing ? "Zapisz" : "Dodaj"}
          />
        </View>
      }
      onClose={onClose}
      subtitle={isEditing ? "Edytujesz swoją prywatną notatkę." : "Nowa notatka będzie widoczna tylko dla Ciebie."}
      title={isEditing ? "Edytuj notatkę" : "Nowa notatka"}
      visible={visible}
    >
      <TextInput
        onChangeText={onTitleChange}
        placeholder="Tytuł"
        placeholderTextColor={theme.colors.textSubtle}
        style={styles.input}
        value={title}
      />
      <TextInput
        multiline
        onChangeText={onDescriptionChange}
        placeholder="Treść"
        placeholderTextColor={theme.colors.textSubtle}
        style={[styles.input, styles.textArea]}
        value={description}
      />
      {error ? <InlineAlert text="Nie udało się zapisać notatki." tone="error" /> : null}
    </FormModal>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
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
    cardDescription: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    cardList: {
      gap: spacing.sm,
    },
    cardMeta: {
      color: colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0,
    },
    cardText: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 19,
    },
    doneText: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
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
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    noteCard: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    rowActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
    },
    sectionHeaderText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    sectionSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    textArea: {
      minHeight: 92,
      paddingTop: spacing.md,
      textAlignVertical: "top",
    },
    todoCard: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    todoCardDone: {
      opacity: 0.72,
    },
    todoCheck: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 25,
      justifyContent: "center",
      width: 25,
    },
    todoCheckDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });
}
