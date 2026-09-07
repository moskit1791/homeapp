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
import {
  listNotes,
  createNote,
  deleteNote,
  listTodoItems,
  createTodoItem,
  deleteTodoItem,
  reopenTodoItem,
  completeTodoItem,
} from '../api';
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

export function TasksPage() {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'notes' | 'todo'>('todo');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const todos = useQuery({
    queryKey: ['todo'],
    queryFn: () => listTodoItems(undefined, { accessToken }),
  });
  const notes = useQuery({
    queryKey: ['notes'],
    queryFn: () => listNotes({ accessToken }),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [tab] });
  const create = useMutation<unknown, Error>({
    mutationFn: () =>
      tab === 'todo'
        ? createTodoItem(
            { title: title.trim(), description, scopeType: 'household' },
            { accessToken }
          )
        : createNote({ title: title.trim(), description }, { accessToken }),
    onSuccess: async () => {
      setOpen(false);
      setTitle('');
      setDescription('');
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
  const active = tab === 'todo' ? todos : notes;

  return (
    <Page>
      <PageHeader
        title="Zadania i notatki"
        description="Wszystko, o czym warto pamiętać."
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
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
                    color="error"
                    onClick={() => confirmDelete(todo.title) && removeTodo.mutate(todo.id)}
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
                    color="error"
                    size="small"
                    onClick={() => confirmDelete(note.title) && removeNote.mutate(note.id)}
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
        title={tab === 'todo' ? 'Nowe zadanie' : 'Nowa notatka'}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={() => create.mutate()}
        loading={create.isPending}
        submitDisabled={!title.trim()}
      >
        {create.error && <Alert severity="error">{create.error.message}</Alert>}
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
