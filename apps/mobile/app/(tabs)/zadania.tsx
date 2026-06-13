import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  updateTodoItem,
  type Note,
  type TodoItem,
} from "../../src/api";
import {
  hasModuleRead,
  useModulePermission,
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
  SegmentedControl,
} from "../../src/ui";
import {
  Check,
  CheckSquare,
  NotePlus,
  NotebookText,
} from "../../src/ui/icon";

type TaskSegment = "notes" | "todo";

const taskSegments: Array<{ label: string; value: TaskSegment }> = [
  { label: "Notatki", value: "notes" },
  { label: "Do zrobienia", value: "todo" },
];
const mockupGreen = "#4F8D2C";

function setTodoDoneValue(item: TodoItem, done: boolean): TodoItem {
  const now = new Date().toISOString();

  return {
    ...item,
    doneAt: done ? now : null,
    status: done ? "done" : "todo",
    updatedAt: now,
  };
}

export default function ZadaniaScreen() {
  const { session } = useSession();
  const params = useLocalSearchParams<{
    action?: string;
    segment?: TaskSegment;
  }>();
  const router = useRouter();
  const permissionsQuery = usePermissions();
  const notesPermission = useModulePermission("notes");
  const todoPermission = useModulePermission("todo");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [activeSegment, setActiveSegment] = useState<TaskSegment>("notes");
  const [noteAddOpenRequest, setNoteAddOpenRequest] = useState(0);
  const [todoAddOpenRequest, setTodoAddOpenRequest] = useState(0);
  const availableSegments = useMemo(
    () =>
      taskSegments
        .filter((segment) =>
          segment.value === "notes"
            ? notesPermission.canRead
            : todoPermission.canRead,
        )
        .map((segment) => ({
          ...segment,
          icon: (active: boolean): ReactNode =>
            segment.value === "notes" ? (
              <NotebookText
                color={active ? mockupGreen : theme.colors.textMuted}
                size={16}
              />
            ) : (
              <CheckSquare
                color={active ? mockupGreen : theme.colors.textMuted}
                size={16}
              />
            ),
        })),
    [notesPermission.canRead, theme.colors.textMuted, todoPermission.canRead],
  );
  const screenBackground =
    theme.colors.background === "#0C1220" ? theme.colors.background : "#FBFAF6";

  useEffect(() => {
    if (
      params.segment &&
      availableSegments.some((segment) => segment.value === params.segment)
    ) {
      setActiveSegment(params.segment);
      return;
    }

    if (
      availableSegments.length > 0 &&
      !availableSegments.some((segment) => segment.value === activeSegment)
    ) {
      setActiveSegment(availableSegments[0]!.value);
    }
  }, [activeSegment, availableSegments, params.segment]);

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen backgroundColor={screenBackground} title="Zadania">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (!hasModuleRead(permissionsQuery.data, ["notes", "todo"])) {
    return (
      <AppScreen backgroundColor={screenBackground} title="Zadania">
        <InlineAlert text="Nie masz dostępu do notatek ani listy do zrobienia." />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      actions={
        activeSegment === "notes" && notesPermission.canCreate ? (
          <IconButton
            accessibilityLabel="Dodaj notatkę"
            onPress={() => setNoteAddOpenRequest((value) => value + 1)}
            style={styles.headerIconButton}
          >
            <NotePlus color={mockupGreen} size={23} />
          </IconButton>
        ) : activeSegment === "todo" && todoPermission.canCreate ? (
          <IconButton
            accessibilityLabel="Dodaj zadanie"
            onPress={() => setTodoAddOpenRequest((value) => value + 1)}
            style={styles.headerIconButton}
          >
            <CheckSquare color={mockupGreen} size={23} />
          </IconButton>
        ) : undefined
      }
      backgroundColor={screenBackground}
      title="Zadania"
    >
      <SegmentedControl
        accentColor={mockupGreen}
        onChange={(segment) => {
          setActiveSegment(segment);
          router.setParams({ action: undefined, segment });
        }}
        options={availableSegments}
        presentation="mockup"
        value={activeSegment}
      />

      {activeSegment === "notes" ? (
        <NotesBoard
          accessToken={session?.accessToken}
          addOpenRequest={noteAddOpenRequest}
          action={params.segment === "notes" ? params.action : undefined}
          onRouteActionHandled={() => router.setParams({ action: undefined })}
        />
      ) : null}
      {activeSegment === "todo" ? (
        <TodoBoard
          accessToken={session?.accessToken}
          addOpenRequest={todoAddOpenRequest}
          action={params.segment === "todo" ? params.action : undefined}
          onRouteActionHandled={() => router.setParams({ action: undefined })}
        />
      ) : null}
    </AppScreen>
  );
}

function NotesBoard({
  accessToken,
  addOpenRequest,
  action,
  onRouteActionHandled,
}: {
  accessToken?: string | null;
  addOpenRequest: number;
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
  const [handledAddOpenRequest, setHandledAddOpenRequest] =
    useState(addOpenRequest);
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
        editingNote?.id ?? "",
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
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id, { accessToken }),
    onSuccess: async () => {
      reset();
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const notes = [...(notesQuery.data ?? [])].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );

  useEffect(() => {
    if (action === "note" && permission.canCreate) {
      openCreate();
      onRouteActionHandled();
    }
  }, [action, onRouteActionHandled, permission.canCreate]);
  useEffect(() => {
    if (addOpenRequest > handledAddOpenRequest) {
      setHandledAddOpenRequest(addOpenRequest);
      openCreate();
    }
  }, [addOpenRequest, handledAddOpenRequest]);

  function reset() {
    setTitle("");
    setDescription("");
    setEditingNote(null);
  }

  function openCreate() {
    reset();
    setModalVisible(true);
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
      </View>
      <QueryState
        emptyText="Brak notatek."
        error={notesQuery.error}
        isEmpty={!notesQuery.isLoading && notes.length === 0}
        isLoading={notesQuery.isLoading}
      />
      <View style={styles.cardList}>
        {notes.map((note) => (
          <Pressable
            disabled={!permission.canUpdate}
            key={note.id}
            onPress={() => openEdit(note)}
            style={({ pressed }) => [
              styles.noteCard,
              pressed && styles.pressedCard,
            ]}
          >
            <View style={styles.cardText}>
              <Text numberOfLines={1} style={styles.cardTitle}>
                {note.title}
              </Text>
              {note.description ? (
                <Text numberOfLines={3} style={styles.cardDescription}>
                  {note.description}
                </Text>
              ) : null}
              <Text style={styles.cardMeta}>
                {formatDateTime(note.updatedAt)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <NoteModal
        deleteLoading={deleteMutation.isPending}
        description={description}
        error={createMutation.error ?? updateMutation.error}
        isEditing={Boolean(editingNote)}
        loading={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          reset();
          setModalVisible(false);
        }}
        onDelete={
          editingNote && permission.canDelete
            ? () => deleteMutation.mutate(editingNote.id)
            : undefined
        }
        onDescriptionChange={setDescription}
        onSave={() =>
          editingNote ? updateMutation.mutate() : createMutation.mutate()
        }
        onTitleChange={setTitle}
        title={title}
        visible={modalVisible}
      />
    </>
  );
}

function TodoBoard({
  accessToken,
  addOpenRequest,
  action,
  onRouteActionHandled,
}: {
  accessToken?: string | null;
  addOpenRequest: number;
  action?: string;
  onRouteActionHandled: () => void;
}) {
  const queryClient = useQueryClient();
  const permission = useModulePermission("todo");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [toggleError, setToggleError] = useState("");
  const [handledAddOpenRequest, setHandledAddOpenRequest] =
    useState(addOpenRequest);
  const todoItemsQueryKey = useMemo(
    () => [...queryKeys.todo, "items"] as const,
    [],
  );
  const todoQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
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
      reset();
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.todo });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const updateMutation = useMutation({
    mutationFn: () =>
      updateTodoItem(
        editingTodo?.id ?? "",
        {
          description: description.trim(),
          scopeType: "household",
          title: title.trim(),
        },
        { accessToken },
      ),
    onSuccess: async () => {
      reset();
      setModalVisible(false);
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
      done
        ? completeTodoItem(id, { accessToken })
        : reopenTodoItem(id, { accessToken }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodoItem(id, { accessToken }),
    onSuccess: async () => {
      reset();
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.todo });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const todos = [...(todoQuery.data ?? [])].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "todo" ? -1 : 1;
    }

    return left.sortOrder - right.sortOrder || right.createdAt.localeCompare(left.createdAt);
  });

  useEffect(() => {
    if (action === "todo" && permission.canCreate) {
      openCreate();
      onRouteActionHandled();
    }
  }, [action, onRouteActionHandled, permission.canCreate]);
  useEffect(() => {
    if (addOpenRequest > handledAddOpenRequest) {
      setHandledAddOpenRequest(addOpenRequest);
      openCreate();
    }
  }, [addOpenRequest, handledAddOpenRequest]);

  function reset() {
    setTitle("");
    setDescription("");
    setEditingTodo(null);
  }

  function openCreate() {
    reset();
    setModalVisible(true);
  }

  function openEdit(todo: TodoItem) {
    setEditingTodo(todo);
    setTitle(todo.title);
    setDescription(todo.description ?? "");
    setModalVisible(true);
  }

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>Do zrobienia</Text>
          <Text style={styles.sectionSubtitle}>Wspólne dla całego domu.</Text>
        </View>
      </View>
      <QueryState
        emptyText="Brak rzeczy do zrobienia."
        error={todoQuery.error}
        isEmpty={!todoQuery.isLoading && todos.length === 0}
        isLoading={todoQuery.isLoading}
      />
      {toggleError ? <InlineAlert text={toggleError} tone="error" /> : null}
      <View style={styles.cardList}>
        {todos.map((todo) => {
          const done = todo.status === "done";

          return (
            <Pressable
              disabled={!permission.canUpdate && !permission.canDelete}
              key={todo.id}
              onPress={() => openEdit(todo)}
              style={({ pressed }) => [
                styles.todoCard,
                done && styles.todoCardDone,
                pressed && styles.pressedCard,
              ]}
            >
              <Pressable
                disabled={!permission.canUpdate || todoToggle.isSyncing(todo.id)}
                onPress={() => todoToggle.toggle(todo.id)}
                style={[styles.todoCheck, done && styles.todoCheckDone]}
              >
                {done ? <Check color={theme.colors.card} size={15} /> : null}
              </Pressable>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, done && styles.doneText]}>
                  {todo.title}
                </Text>
                {todo.description ? (
                  <Text numberOfLines={2} style={styles.cardDescription}>
                    {todo.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <TodoModal
        deleteLoading={deleteMutation.isPending}
        description={description}
        error={createMutation.error ?? updateMutation.error}
        isEditing={Boolean(editingTodo)}
        loading={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          reset();
          setModalVisible(false);
        }}
        onDelete={
          editingTodo && permission.canDelete
            ? () => {
                todoToggle.cancel(editingTodo.id);
                deleteMutation.mutate(editingTodo.id);
              }
            : undefined
        }
        onDescriptionChange={setDescription}
        onSave={() =>
          editingTodo ? updateMutation.mutate() : createMutation.mutate()
        }
        onTitleChange={setTitle}
        title={title}
        visible={modalVisible}
      />
    </>
  );
}

function NoteModal({
  deleteLoading,
  description,
  error,
  isEditing,
  loading,
  onClose,
  onDelete,
  onDescriptionChange,
  onSave,
  onTitleChange,
  title,
  visible,
}: {
  deleteLoading: boolean;
  description: string;
  error: Error | null;
  isEditing: boolean;
  loading: boolean;
  onClose: () => void;
  onDelete?: () => void;
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
        <ModalFooter
          deleteLoading={deleteLoading}
          deleteTitle="Usuń notatkę"
          isEditing={isEditing}
          loading={loading}
          onClose={onClose}
          onDelete={onDelete}
          onSave={onSave}
          saveTitle={isEditing ? "Zapisz" : "Dodaj"}
          submitDisabled={!title.trim()}
        />
      }
      onClose={onClose}
      subtitle={
        isEditing
          ? "Edytujesz swoją prywatną notatkę."
          : "Nowa notatka będzie widoczna tylko dla Ciebie."
      }
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
      {error ? (
        <InlineAlert text="Nie udało się zapisać notatki." tone="error" />
      ) : null}
    </FormModal>
  );
}

function TodoModal({
  deleteLoading,
  description,
  error,
  isEditing,
  loading,
  onClose,
  onDelete,
  onDescriptionChange,
  onSave,
  onTitleChange,
  title,
  visible,
}: {
  deleteLoading: boolean;
  description: string;
  error: Error | null;
  isEditing: boolean;
  loading: boolean;
  onClose: () => void;
  onDelete?: () => void;
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
        <ModalFooter
          deleteLoading={deleteLoading}
          deleteTitle="Usuń zadanie"
          isEditing={isEditing}
          loading={loading}
          onClose={onClose}
          onDelete={onDelete}
          onSave={onSave}
          saveTitle={isEditing ? "Zapisz" : "Dodaj"}
          submitDisabled={!title.trim()}
        />
      }
      onClose={onClose}
      subtitle={
        isEditing
          ? "Edytujesz wspólne zadanie domowe."
          : "Po zapisaniu będzie widoczne dla wszystkich domowników."
      }
      title={isEditing ? "Edytuj zadanie" : "Nowe zadanie"}
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
        placeholder="Opis"
        placeholderTextColor={theme.colors.textSubtle}
        style={[styles.input, styles.textArea]}
        value={description}
      />
      {error ? (
        <InlineAlert text="Nie udało się zapisać zadania." tone="error" />
      ) : null}
    </FormModal>
  );
}

function ModalFooter({
  deleteLoading,
  deleteTitle,
  isEditing,
  loading,
  onClose,
  onDelete,
  onSave,
  saveTitle,
  submitDisabled,
}: {
  deleteLoading: boolean;
  deleteTitle: string;
  isEditing: boolean;
  loading: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onSave: () => void;
  saveTitle: string;
  submitDisabled: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.modalFooterStack}>
      {isEditing && onDelete ? (
        <ActionButton
          labelStyle={styles.deleteButtonLabel}
          loading={deleteLoading}
          onPress={onDelete}
          style={styles.deleteButton}
          title={deleteTitle}
          variant="secondary"
        />
      ) : null}
      <View style={styles.modalFooter}>
        <ActionButton
          onPress={onClose}
          style={styles.modalFooterButton}
          title="Anuluj"
          variant="secondary"
        />
        <ActionButton
          disabled={submitDisabled}
          loading={loading}
          onPress={onSave}
          style={styles.modalFooterButton}
          title={saveTitle}
        />
      </View>
    </View>
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
  const isDark = colors.background === "#0C1220";

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
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 20,
    },
    deleteButton: {
      borderColor: colors.danger,
      minHeight: 42,
    },
    deleteButtonLabel: {
      color: colors.danger,
    },
    doneText: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    headerIconButton: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: isDark ? colors.border : "#E8DED2",
      borderRadius: 999,
      borderWidth: 1,
      elevation: 2,
      height: 48,
      justifyContent: "center",
      padding: 0,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 16,
      width: 48,
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
    modalFooterStack: {
      gap: spacing.sm,
    },
    noteCard: {
      backgroundColor: colors.card,
      borderColor: isDark ? colors.border : "#E8DED2",
      borderRadius: 12,
      borderWidth: 1,
      gap: spacing.sm,
      minHeight: 86,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: isDark ? 0.12 : 0.05,
      shadowRadius: 14,
    },
    pressedCard: {
      opacity: 0.78,
      transform: [{ scale: 0.995 }],
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      marginTop: spacing.xs,
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
      borderColor: isDark ? colors.border : "#E8DED2",
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: isDark ? 0.12 : 0.05,
      shadowRadius: 14,
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
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    todoCheckDone: {
      backgroundColor: mockupGreen,
      borderColor: mockupGreen,
    },
  });
}
