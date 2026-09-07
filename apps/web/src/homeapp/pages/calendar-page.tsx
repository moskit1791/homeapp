import { Icon } from '@iconify/react';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Chip,
  Alert,
  Stack,
  Divider,
  MenuItem,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { todayIso, shortDate } from '../utils/format';
import { listCalendarEvents, createCalendarEvent, deleteCalendarEvent } from '../api';
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

function monthRange(value: string) {
  const [year = 0, month = 1] = value.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  return {
    from: `${value}-01`,
    to: `${value}-${String(last).padStart(2, '0')}`,
  };
}

export function CalendarPage() {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(todayIso());
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [scopeType, setScopeType] = useState<'household' | 'member'>('household');
  const range = useMemo(() => monthRange(month), [month]);
  const events = useQuery({
    queryKey: ['calendar', range],
    queryFn: () => listCalendarEvents(range.from, range.to, { accessToken }),
  });
  const create = useMutation({
    mutationFn: () =>
      createCalendarEvent(
        {
          eventDate,
          eventTime: eventTime || null,
          locationName: location || null,
          scopeType,
          title: title.trim(),
        },
        { accessToken }
      ),
    onSuccess: async () => {
      setOpen(false);
      setTitle('');
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const grouped = (events.data ?? []).reduce<Record<string, typeof events.data>>((acc, event) => {
    (acc[event.eventDate] ??= []).push(event);
    return acc;
  }, {});

  return (
    <Page>
      <PageHeader
        title="Kalendarz"
        description="Wspólne i prywatne wydarzenia domowników."
        action={<PrimaryButton onClick={() => setOpen(true)}>Nowe wydarzenie</PrimaryButton>}
      />
      <SectionCard>
        <TextField
          label="Miesiąc"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 220, mb: 3 }}
        />
        {events.isLoading ? (
          <LoadingView />
        ) : events.error ? (
          <ErrorView error={events.error} retry={() => void events.refetch()} />
        ) : Object.keys(grouped).length === 0 ? (
          <EmptyState text="Brak wydarzeń w tym miesiącu." />
        ) : (
          <Stack spacing={2.5}>
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, items]) => (
                <Box key={date}>
                  <Typography variant="overline" color="text.secondary">
                    {shortDate(date)}
                  </Typography>
                  <Stack divider={<Divider flexItem />}>
                    {items?.map((event) => (
                      <Stack
                        key={`${event.sourceType}-${event.id}`}
                        direction="row"
                        spacing={2}
                        sx={{ py: 1.5, alignItems: 'center' }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: event.sourceType === 'google' ? 'info.main' : 'primary.main',
                          }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 700 }}>{event.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {event.eventTime?.slice(0, 5) || 'Cały dzień'}
                            {event.locationName ? ` · ${event.locationName}` : ''}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={event.scopeType === 'member' ? 'Prywatne' : 'Dom'}
                          variant="outlined"
                        />
                        {event.sourceType === 'manual' && (
                          <IconButton
                            color="error"
                            onClick={() => confirmDelete(event.title) && remove.mutate(event.id)}
                            aria-label="Usuń wydarzenie"
                          >
                            <Icon icon="solar:trash-bin-trash-bold-duotone" />
                          </IconButton>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ))}
          </Stack>
        )}
      </SectionCard>
      <FormDialog
        title="Nowe wydarzenie"
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={() => create.mutate()}
        loading={create.isPending}
        submitDisabled={!title.trim() || !eventDate}
      >
        {create.error && <Alert severity="error">{create.error.message}</Alert>}
        <TextField
          label="Tytuł"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            fullWidth
            label="Data"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            fullWidth
            label="Godzina"
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
        <TextField label="Miejsce" value={location} onChange={(e) => setLocation(e.target.value)} />
        <TextField
          select
          label="Widoczność"
          value={scopeType}
          onChange={(e) => setScopeType(e.target.value as 'household' | 'member')}
        >
          <MenuItem value="household">Wspólne dla domu</MenuItem>
          <MenuItem value="member">Prywatne</MenuItem>
        </TextField>
      </FormDialog>
    </Page>
  );
}
