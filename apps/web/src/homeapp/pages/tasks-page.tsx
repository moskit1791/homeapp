import type { Note, TodoItem } from '../api';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Tab,
  Tabs,
  Alert,
  Stack,
  Divider,
  Checkbox,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';

import { shortDate } from '../utils/format';
import { useSession } from '../auth/session-context';
import { usePermission } from '../auth/use-permission';
import {
  Page,
  ErrorView,
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

export function TasksPage() {
  const { accessToken } = useSession();
  const todoPermission = usePermission('todo');
  const notesPermission = usePermission('notes');
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'notes' | 'todo'>('todo');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const todos = useQuery({
    queryKey: ['todo'],
    queryFn: () => listTodoItems(undefined, { accessToken }),
  });
  const notes = useQuery({
    queryKey: ['notes'],
    queryFn: () => listNotes({ accessToken }),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [tab] });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todo'] }),
  });
  const removeTodo = useMutation({
    mutationFn: (id: string) => deleteTodoItem(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todo'] }),
  });
  const removeNote = useMutation({
    mutationFn: (id: string) => deleteNote(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });
  const moveTodo = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'down' | 'up' }) =>
      moveTodoItem(id, { direction }, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todo'] }),
  });
  const active = tab === 'todo' ? todos : notes;
  const activePermission = tab === 'todo' ? todoPermission : notesPermission;

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

  return (
    <Page>
      <PageHeader
        title="Zadania i notatki"
        description="Wszystko, o czym warto pamiętać."
        action={
          <PrimaryButton onClick={openCreate} disabled={!activePermission.canCreate}>
            Dodaj {tab === 'todo' ? 'zadanie' : 'notatkę'}
          </PrimaryButton>
        }
      />
      <SectionCard>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
          <Tab value="todo" label={`Zadania (${todos.data?.length ?? 0})`} />
          <Tab value="notes" label={`Notatki (${notes.data?.length ?? 0})`} />
        </Tabs>
        {active.isLoading ? (
          <LoadingView />
        ) : active.error ? (
          <ErrorView error={active.error} retry={() => void active.refetch()} />
        ) : tab === 'todo' ? (
          (todos.data?.length ?? 0) === 0 ? (
            <EmptyState text="Brak zadań." />
          ) : (
            <Stack divider={<Divider flexItem />}>
              {todos.data?.map((todo) => (
                <Stack key={todo.id} direction="row" sx={{ py: 1.25, alignItems: 'center' }}>
                  <Checkbox
                    checked={todo.status === 'done'}
                    onChange={() =>
                      toggle.mutate({
                        id: todo.id,
                        done: todo.status === 'done',
                      })
                    }
                    disabled={!todoPermission.canUpdate}
                  />
                  <Box sx={{ flex: 1 }}>
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
                  <IconButton
                    aria-label="Przesuń zadanie w górę"
                    onClick={() => moveTodo.mutate({ id: todo.id, direction: 'up' })}
                    disabled={!todoPermission.canUpdate}
                  >
                    <Icon icon="solar:alt-arrow-up-bold" />
                  </IconButton>
                  <IconButton
                    aria-label="Przesuń zadanie w dół"
                    onClick={() => moveTodo.mutate({ id: todo.id, direction: 'down' })}
                    disabled={!todoPermission.canUpdate}
                  >
                    <Icon icon="solar:alt-arrow-down-bold" />
                  </IconButton>
                  <IconButton
                    aria-label="Edytuj zadanie"
                    onClick={() => openTodo(todo)}
                    disabled={!todoPermission.canUpdate}
                  >
                    <Icon icon="solar:pen-bold-duotone" />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => confirmDelete(todo.title) && removeTodo.mutate(todo.id)}
                    disabled={!todoPermission.canDelete}
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )
        ) : (notes.data?.length ?? 0) === 0 ? (
          <EmptyState text="Brak notatek." />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            {notes.data?.map((note) => (
              <SectionCard key={note.id} sx={{ bgcolor: 'rgba(255,171,0,.08)' }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3">{note.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {shortDate(note.updatedAt)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label="Edytuj notatkę"
                    onClick={() => openNote(note)}
                    disabled={!notesPermission.canUpdate}
                  >
                    <Icon icon="solar:pen-bold-duotone" />
                  </IconButton>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => confirmDelete(note.title) && removeNote.mutate(note.id)}
                    disabled={!notesPermission.canDelete}
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" />
                  </IconButton>
                </Stack>
                {note.description && (
                  <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>{note.description}</Typography>
                )}
              </SectionCard>
            ))}
          </Box>
        )}
      </SectionCard>
      <FormDialog
        title={
          editingTodo || editingNote
            ? `Edytuj ${tab === 'todo' ? 'zadanie' : 'notatkę'}`
            : `Now${tab === 'todo' ? 'e zadanie' : 'a notatka'}`
        }
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
