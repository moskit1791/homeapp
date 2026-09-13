import type { Note, TodoItem } from '../api';

import { Icon } from '@iconify/react';
import { useSearchParams } from 'react-router';
import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Tab,
  Tabs,
  Chip,
  Alert,
  Stack,
  Tooltip,
  MenuItem,
  Checkbox,
  TextField,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

import { shortDate } from '../utils/format';
import { useSession } from '../auth/session-context';
import { usePermission } from '../auth/use-permission';
import { todoMovePlan, reorderTodosAfterDrop } from '../utils/todo-order';
import {
  Page,
  ErrorView,
  ActionMenu,
  EmptyState,
  FormDialog,
  PageHeader,
  LoadingView,
  SectionCard,
  confirmDelete,
  PrimaryButton,
} from '../components/ui';
import {
  listNotes,
  createNote,
  deleteNote,
  updateNote,
  moveTodoItem,
  listTodoItems,
  createTodoItem,
  deleteTodoItem,
  reopenTodoItem,
  updateTodoItem,
  completeTodoItem,
} from '../api';

type NoteSort = 'updated' | 'title';
type NoteView = 'grid' | 'list';

const NOTE_VIEW_STORAGE_KEY = 'homeapp.tasks.note-view';
const TODO_ACCENTS = ['#4F7DF3', '#8B5CF6', '#16A978', '#E99619', '#E6678A'] as const;

const NOTE_VISUALS = [
  {
    keywords: ['paliw', 'tankow', 'benzyn', 'diesel', 'auto', 'samoch'],
    icon: 'solar:gas-station-bold-duotone',
    accent: '#22B573',
  },
  {
    keywords: ['okular', 'wzrok', 'optyk'],
    icon: 'solar:glasses-bold-duotone',
    accent: '#8B5CF6',
  },
  {
    keywords: ['książ', 'ksiaz', 'czyta', 'lektur'],
    icon: 'solar:notebook-bold-duotone',
    accent: '#3B82F6',
  },
  {
    keywords: ['prezent', 'urodzin', 'święt', 'swiet'],
    icon: 'solar:gift-bold-duotone',
    accent: '#8B5CF6',
  },
  {
    keywords: ['pienią', 'pienia', 'zł', ' rata', 'spłat', 'koszt', 'odda'],
    icon: 'solar:money-bag-bold-duotone',
    accent: '#F59E0B',
  },
  {
    keywords: ['jedzen', 'obiad', 'przepis', 'kuch', 'kolac'],
    icon: 'solar:chef-hat-bold-duotone',
    accent: '#F97316',
  },
  {
    keywords: ['dom', 'mieszkan', 'remont'],
    icon: 'solar:home-2-bold-duotone',
    accent: '#06B6D4',
  },
  {
    keywords: ['todo', 'to do', 'lista', 'zrobi'],
    icon: 'solar:list-check-bold-duotone',
    accent: '#F59E0B',
  },
] as const;

function noteVisual(note: Note) {
  const content = `${note.title} ${note.description ?? ''}`.toLocaleLowerCase('pl');

  return (
    NOTE_VISUALS.find((visual) => visual.keywords.some((keyword) => content.includes(keyword))) ?? {
      icon: 'solar:notes-bold-duotone',
      accent: '#647DFF',
    }
  );
}

function todoAccent(todo: TodoItem) {
  const seed = `${todo.id}${todo.title}`;
  const hash = Array.from(seed).reduce((value, character) => value + character.charCodeAt(0), 0);

  return TODO_ACCENTS[hash % TODO_ACCENTS.length];
}

export function TasksPage() {
  const { accessToken } = useSession();
  const todoPermission = usePermission('todo');
  const notesPermission = usePermission('notes');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'notes' | 'todo'>('notes');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [noteSort, setNoteSort] = useState<NoteSort>('updated');
  const [noteView, setNoteView] = useState<NoteView>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(NOTE_VIEW_STORAGE_KEY) === 'list'
      ? 'list'
      : 'grid'
  );
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dragOverTodoId, setDragOverTodoId] = useState<string | null>(null);
  const todos = useQuery({
    queryKey: ['todo'],
    queryFn: () => listTodoItems(undefined, { accessToken }),
  });
  const notes = useQuery({
    queryKey: ['notes'],
    queryFn: () => listNotes({ accessToken }),
  });
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [tab] }),
      queryClient.invalidateQueries({ queryKey: ['start'] }),
    ]);
  };
  const save = useMutation<unknown, Error>({
    mutationFn: () =>
      tab === 'todo'
        ? editingTodo
          ? updateTodoItem(editingTodo.id, { title: title.trim(), description }, { accessToken })
          : createTodoItem(
              { title: title.trim(), description, scopeType: 'household' },
              { accessToken }
            )
        : editingNote
          ? updateNote(editingNote.id, { title: title.trim(), description }, { accessToken })
          : createNote({ title: title.trim(), description }, { accessToken }),
    onSuccess: async () => {
      closeForm();
      await invalidate();
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      done ? reopenTodoItem(id, { accessToken }) : completeTodoItem(id, { accessToken }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todo'] }),
        queryClient.invalidateQueries({ queryKey: ['start'] }),
      ]);
    },
  });
  const removeTodo = useMutation({
    mutationFn: (id: string) => deleteTodoItem(id, { accessToken }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todo'] }),
        queryClient.invalidateQueries({ queryKey: ['start'] }),
      ]);
    },
  });
  const removeNote = useMutation({
    mutationFn: (id: string) => deleteNote(id, { accessToken }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notes'] }),
        queryClient.invalidateQueries({ queryKey: ['start'] }),
      ]);
    },
  });
  const createQuickNote = useMutation({
    mutationFn: () => createNote({ title: quickNote.trim(), description: '' }, { accessToken }),
    onSuccess: async () => {
      setQuickNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notes'] }),
        queryClient.invalidateQueries({ queryKey: ['start'] }),
      ]);
    },
  });
  const moveTodo = useMutation({
    mutationFn: async ({ id, targetId }: { id: string; targetId: string }) => {
      const plan = todoMovePlan(todos.data ?? [], id, targetId);
      if (!plan) return;
      for (let step = 0; step < plan.steps; step += 1) {
        await moveTodoItem(id, { direction: plan.direction }, { accessToken });
      }
    },
    onMutate: async ({ id, targetId }) => {
      await queryClient.cancelQueries({ queryKey: ['todo'] });
      const previous = queryClient.getQueryData<TodoItem[]>(['todo']);
      queryClient.setQueryData<TodoItem[]>(['todo'], (current = []) =>
        reorderTodosAfterDrop(current, id, targetId)
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['todo'], context.previous);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todo'] }),
        queryClient.invalidateQueries({ queryKey: ['start'] }),
      ]);
    },
  });
  const active = tab === 'todo' ? todos : notes;
  const activePermission = tab === 'todo' ? todoPermission : notesPermission;
  const sortedNotes = useMemo(() => {
    const nextNotes = [...(notes.data ?? [])];

    return nextNotes.sort((left, right) =>
      noteSort === 'title'
        ? left.title.localeCompare(right.title, 'pl', { sensitivity: 'base' })
        : new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  }, [noteSort, notes.data]);

  useEffect(() => {
    window.localStorage.setItem(NOTE_VIEW_STORAGE_KEY, noteView);
  }, [noteView]);

  function openCreate() {
    setEditingTodo(null);
    setEditingNote(null);
    setTitle('');
    setDescription('');
    setOpen(true);
  }

  function openTodo(item: TodoItem) {
    setEditingTodo(item);
    setEditingNote(null);
    setTitle(item.title);
    setDescription(item.description ?? '');
    setOpen(true);
  }

  function openNote(item: Note) {
    setEditingNote(item);
    setEditingTodo(null);
    setTitle(item.title);
    setDescription(item.description ?? '');
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditingTodo(null);
    setEditingNote(null);
    setTitle('');
    setDescription('');
    save.reset();
  }

  const routeAction = searchParams.get('action');

  useEffect(() => {
    if (routeAction !== 'note' && routeAction !== 'todo') return;
    const nextTab = routeAction === 'note' ? 'notes' : 'todo';
    const canCreate = nextTab === 'notes' ? notesPermission.canCreate : todoPermission.canCreate;
    if (!canCreate) return;
    setTab(nextTab);
    setEditingTodo(null);
    setEditingNote(null);
    setTitle('');
    setDescription('');
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [
    notesPermission.canCreate,
    routeAction,
    searchParams,
    setSearchParams,
    todoPermission.canCreate,
  ]);

  return (
    <Page>
      <PageHeader
        title="Zadania"
        description={
          tab === 'notes'
            ? 'Prywatne notatki widoczne tylko dla Ciebie.'
            : 'Wspólna lista rzeczy do zrobienia.'
        }
        action={
          <PrimaryButton onClick={openCreate} disabled={!activePermission.canCreate}>
            Dodaj {tab === 'todo' ? 'zadanie' : 'notatkę'}
          </PrimaryButton>
        }
      />
      <SectionCard sx={{ overflow: 'visible' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ mb: 2.5, alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                borderRadius: 1.5,
                color: tab === 'notes' ? 'primary.main' : 'success.main',
                bgcolor: tab === 'notes' ? 'primary.lighter' : 'success.lighter',
              }}
            >
              <Icon
                icon={tab === 'notes' ? 'solar:notebook-bold-duotone' : 'solar:check-square-bold-duotone'}
                width={25}
              />
            </Box>
            <Box>
              <Typography variant="h5">{tab === 'notes' ? 'Notatki' : 'Do zrobienia'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {tab === 'notes'
                  ? 'Twoje prywatne notatki w jednym miejscu'
                  : 'Wspólne zadania wszystkich domowników'}
              </Typography>
            </Box>
          </Stack>

          {tab === 'notes' && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                select
                size="small"
                label="Sortuj"
                value={noteSort}
                onChange={(event) => setNoteSort(event.target.value as NoteSort)}
                sx={{ minWidth: { xs: 0, sm: 190 }, flex: { xs: 1, sm: 'initial' } }}
              >
                <MenuItem value="updated">Ostatnio edytowane</MenuItem>
                <MenuItem value="title">Nazwa A–Z</MenuItem>
              </TextField>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={noteView}
                onChange={(_, value: NoteView | null) => value && setNoteView(value)}
                aria-label="Sposób wyświetlania notatek"
              >
                <ToggleButton value="grid" aria-label="Widok siatki">
                  <Icon icon="solar:widget-2-bold-duotone" width={20} />
                </ToggleButton>
                <ToggleButton value="list" aria-label="Widok listy">
                  <Icon icon="solar:list-bold-duotone" width={20} />
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          )}
        </Stack>

        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{
            mb: 2.5,
            minHeight: 42,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': { minHeight: 42, px: { xs: 1.25, sm: 2.25 } },
          }}
        >
          <Tab value="notes" label={`Notatki (${notes.data?.length ?? 0})`} />
          <Tab value="todo" label={`Do zrobienia (${todos.data?.length ?? 0})`} />
        </Tabs>
        {moveTodo.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Nie udało się zapisać nowej kolejności. Przywrócono poprzedni układ.
          </Alert>
        )}
        {active.isLoading ? (
          <LoadingView />
        ) : active.error ? (
          <ErrorView error={active.error} retry={() => void active.refetch()} />
        ) : tab === 'todo' ? (
          (todos.data?.length ?? 0) === 0 ? (
            <EmptyState text="Brak zadań." />
          ) : (
            <Stack spacing={1}>
              {todos.data?.map((todo) => {
                const accent = todoAccent(todo);
                const isDone = todo.status === 'done';

                return (
                  <Stack
                  key={todo.id}
                  onDragEnter={() => todo.status !== 'done' && setDragOverTodoId(todo.id)}
                  onDragOver={(event) => {
                    if (todo.status === 'done') return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = draggedTodoId ?? event.dataTransfer.getData('text/plain');
                    if (sourceId && sourceId !== todo.id) {
                      moveTodo.mutate({ id: sourceId, targetId: todo.id });
                    }
                    setDraggedTodoId(null);
                    setDragOverTodoId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedTodoId(null);
                    setDragOverTodoId(null);
                  }}
                  direction="row"
                  spacing={1}
                  sx={(theme) => ({
                    px: { xs: 1, sm: 1.25 },
                    py: 1.15,
                    alignItems: 'center',
                    border: '1px solid',
                    borderColor:
                      dragOverTodoId === todo.id && draggedTodoId !== todo.id
                        ? 'primary.main'
                        : isDone
                          ? 'success.main'
                          : `${accent}52`,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    backgroundImage:
                      dragOverTodoId === todo.id && draggedTodoId !== todo.id
                        ? 'linear-gradient(90deg, rgba(99,102,241,.15), transparent)'
                        : isDone
                          ? 'linear-gradient(90deg, rgba(34,197,94,.1), transparent 70%)'
                          : `linear-gradient(90deg, ${accent}14, transparent 58%)`,
                    boxShadow: '0 6px 18px rgba(38,54,82,.04)',
                    opacity: draggedTodoId === todo.id ? 0.55 : isDone ? 0.78 : 1,
                    transition: theme.transitions.create([
                      'border-color',
                      'background-color',
                      'box-shadow',
                      'transform',
                    ]),
                    '&:hover': {
                      borderColor: isDone ? 'success.main' : accent,
                      boxShadow: `0 10px 26px ${isDone ? 'rgba(34,197,94,.12)' : `${accent}1A`}`,
                      transform: 'translateY(-1px)',
                    },
                    ...theme.applyStyles('dark', {
                      backgroundImage: isDone
                        ? 'linear-gradient(90deg, rgba(34,197,94,.2), rgba(30,53,79,.54) 72%)'
                        : `linear-gradient(90deg, ${accent}26, rgba(30,53,79,.54) 66%)`,
                      boxShadow: '0 8px 22px rgba(0,0,0,.14)',
                    }),
                  })}
                >
                  <Box
                    aria-label="Przeciągnij, aby zmienić kolejność"
                    draggable={todo.status !== 'done' && todoPermission.canUpdate}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', todo.id);
                      setDraggedTodoId(todo.id);
                    }}
                    sx={{
                      display: todo.status === 'done' ? 'none' : 'grid',
                      placeItems: 'center',
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      borderRadius: 1.25,
                      color: accent,
                      bgcolor: `${accent}18`,
                      cursor: todoPermission.canUpdate ? 'grab' : 'default',
                    }}
                  >
                    <Icon icon="solar:hamburger-menu-linear" width={22} />
                  </Box>
                  <Checkbox
                    checked={todo.status === 'done'}
                    onChange={() =>
                      toggle.mutate({
                        id: todo.id,
                        done: todo.status === 'done',
                      })
                    }
                    disabled={!todoPermission.canUpdate}
                    sx={{
                      color: accent,
                      '&.Mui-checked': { color: 'success.main' },
                    }}
                  />
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => todoPermission.canUpdate && openTodo(todo)}
                    onKeyDown={(event) =>
                      event.key === 'Enter' && todoPermission.canUpdate && openTodo(todo)
                    }
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      cursor: todoPermission.canUpdate ? 'pointer' : 'default',
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        textDecoration: todo.status === 'done' ? 'line-through' : 'none',
                      }}
                    >
                      {todo.title}
                    </Typography>
                    {todo.description && (
                      <Typography variant="body2" color="text.secondary">
                        {todo.description}
                      </Typography>
                    )}
                  </Box>
                  <ActionMenu
                    label={`Akcje zadania ${todo.title}`}
                    actions={[
                      {
                        label: 'Edytuj',
                        icon: 'solar:pen-bold-duotone',
                        disabled: !todoPermission.canUpdate,
                        onClick: () => openTodo(todo),
                      },
                      {
                        label: 'Usuń',
                        icon: 'solar:trash-bin-trash-bold-duotone',
                        tone: 'danger',
                        disabled: !todoPermission.canDelete,
                        onClick: () => confirmDelete(todo.title) && removeTodo.mutate(todo.id),
                      },
                    ]}
                  />
                  </Stack>
                );
              })}
            </Stack>
          )
        ) : (notes.data?.length ?? 0) === 0 ? (
          <EmptyState text="Brak notatek." />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns:
                noteView === 'grid'
                  ? { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }
                  : '1fr',
              gap: 1.75,
            }}
          >
            {sortedNotes.map((note) => {
              const visual = noteVisual(note);

              return (
                <Box
                  key={note.id}
                  sx={(theme) => ({
                    p: { xs: 2, sm: 2.25 },
                    minHeight: noteView === 'grid' ? 196 : 150,
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2.25,
                    bgcolor: 'background.paper',
                    backgroundImage: `linear-gradient(135deg, ${visual.accent}18 0%, transparent 68%)`,
                    boxShadow: '0 10px 28px rgba(38,54,82,.055)',
                    transition: theme.transitions.create([
                      'transform',
                      'box-shadow',
                      'border-color',
                    ]),
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: visual.accent,
                      boxShadow: `0 16px 38px ${visual.accent}20`,
                    },
                    ...theme.applyStyles('dark', {
                      backgroundImage: `linear-gradient(135deg, ${visual.accent}29 0%, rgba(30,53,79,.62) 72%)`,
                      boxShadow: '0 12px 30px rgba(0,0,0,.18)',
                    }),
                  })}
                >
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        borderRadius: 1.75,
                        color: visual.accent,
                        bgcolor: `${visual.accent}1F`,
                        boxShadow: `inset 0 0 0 1px ${visual.accent}18`,
                      }}
                    >
                      <Icon icon={visual.icon} width={29} />
                    </Box>
                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={() => notesPermission.canUpdate && openNote(note)}
                      onKeyDown={(event) =>
                        event.key === 'Enter' && notesPermission.canUpdate && openNote(note)
                      }
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        cursor: notesPermission.canUpdate ? 'pointer' : 'default',
                      }}
                    >
                      <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
                        {note.title}
                      </Typography>
                      <Chip
                        size="small"
                        label="Prywatna"
                        sx={{
                          mt: 0.65,
                          height: 22,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    </Box>
                    <ActionMenu
                      label={`Akcje notatki ${note.title}`}
                      actions={[
                        {
                          label: 'Edytuj',
                          icon: 'solar:pen-bold-duotone',
                          disabled: !notesPermission.canUpdate,
                          onClick: () => openNote(note),
                        },
                        {
                          label: 'Usuń',
                          icon: 'solar:trash-bin-trash-bold-duotone',
                          tone: 'danger',
                          disabled: !notesPermission.canDelete,
                          onClick: () => confirmDelete(note.title) && removeNote.mutate(note.id),
                        },
                      ]}
                    />
                  </Stack>
                  {note.description && (
                    <Typography
                      sx={{
                        mt: 1.75,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitLineClamp: noteView === 'grid' ? 5 : 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {note.description}
                    </Typography>
                  )}
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ mt: 'auto', pt: 2.25, alignItems: 'center', color: 'text.secondary' }}
                  >
                    <Icon icon="solar:clock-circle-linear" width={16} />
                    <Typography variant="caption">Edytowano {shortDate(note.updatedAt)}</Typography>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        )}
      </SectionCard>
      {tab === 'notes' && notesPermission.canCreate && (
        <SectionCard sx={{ '& .MuiCardContent-root': { p: { xs: 1.5, sm: 1.75 } } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { sm: 'center' } }}
          >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 245 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  borderRadius: 1.5,
                  color: 'warning.dark',
                  bgcolor: 'warning.lighter',
                }}
              >
                <Icon icon="solar:lightbulb-bolt-bold-duotone" width={26} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 750 }}>Szybka notatka</Typography>
                <Typography variant="caption" color="text.secondary">
                  Zapisz pomysł, zanim ucieknie.
                </Typography>
              </Box>
            </Stack>
            <TextField
              fullWidth
              size="small"
              value={quickNote}
              placeholder="O czym chcesz zapisać?"
              onChange={(event) => setQuickNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && quickNote.trim() && !createQuickNote.isPending) {
                  event.preventDefault();
                  createQuickNote.mutate();
                }
              }}
              error={Boolean(createQuickNote.error)}
              helperText={createQuickNote.error?.message}
              slotProps={{ htmlInput: { 'aria-label': 'Treść szybkiej notatki' } }}
            />
            <Tooltip title="Zapisz szybką notatkę">
              <span>
                <IconButton
                  color="primary"
                  aria-label="Zapisz szybką notatkę"
                  disabled={!quickNote.trim() || createQuickNote.isPending}
                  onClick={() => createQuickNote.mutate()}
                  sx={{
                    width: 44,
                    height: 44,
                    color: 'primary.contrastText',
                    bgcolor: 'primary.main',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&.Mui-disabled': { color: 'text.disabled', bgcolor: 'action.disabledBackground' },
                  }}
                >
                  <Icon
                    icon={
                      createQuickNote.isPending
                        ? 'solar:refresh-circle-linear'
                        : 'solar:arrow-right-linear'
                    }
                    width={22}
                  />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </SectionCard>
      )}
      <FormDialog
        title={
          editingTodo || editingNote
            ? `Edytuj ${tab === 'todo' ? 'zadanie' : 'notatkę'}`
            : `Now${tab === 'todo' ? 'e zadanie' : 'a notatka'}`
        }
        subtitle={
          tab === 'todo'
            ? 'Zadanie będzie widoczne dla domowników.'
            : 'Notatka pozostanie widoczna tylko dla Ciebie.'
        }
        icon={tab === 'todo' ? 'solar:check-square-bold-duotone' : 'solar:notebook-bold-duotone'}
        open={open}
        onClose={closeForm}
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        submitDisabled={!title.trim()}
      >
        {save.error && <Alert severity="error">{save.error.message}</Alert>}
        <TextField
          label="Tytuł"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
        <TextField
          label="Opis"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={4}
        />
      </FormDialog>
    </Page>
  );
}
