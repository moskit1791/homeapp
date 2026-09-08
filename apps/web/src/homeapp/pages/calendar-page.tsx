import type { CalendarEvent } from '../api';

import { Icon } from '@iconify/react';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Chip,
  Alert,
  Stack,
  Button,
  Divider,
  MenuItem,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { todayIso, shortDate } from '../utils/format';
import { usePermission } from '../auth/use-permission';
import { encryptRuntimePayload } from '../encryption-runtime';
import {
  Page,
  ErrorView,
  EmptyState,
  FormDialog,
  PageHeader,
  LoadingView,
  SectionCard,
  errorMessage,
  confirmDelete,
  PrimaryButton,
} from '../components/ui';
import {
  syncGoogleCalendar,
  listCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  connectGoogleCalendar,
  getGoogleCalendarStatus,
  commitGoogleCalendarEncryptedSync,
} from '../api';

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
  const permission = usePermission('calendar');
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(todayIso());
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [note, setNote] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState('');
  const [reminderOffset, setReminderOffset] = useState('1440');
  const [scopeType, setScopeType] = useState<'household' | 'member'>('household');
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const range = useMemo(() => monthRange(month), [month]);
  const events = useQuery({
    queryKey: ['calendar', range],
    queryFn: () => listCalendarEvents(range.from, range.to, { accessToken }),
  });
  const google = useQuery({
    queryKey: ['calendar', 'google'],
    queryFn: () => getGoogleCalendarStatus({ accessToken }),
  });
  const save = useMutation({
    mutationFn: () => {
      const input = {
        eventDate,
        eventTime: eventTime || null,
        locationName: location || null,
        locationUrl: locationUrl || null,
        note: note || null,
        recurrenceRule: recurrenceRule || null,
        reminderOffsetMinutes: reminderOffset ? Number(reminderOffset) : null,
        scopeType,
        title: title.trim(),
      };

      return editing
        ? updateCalendarEvent(editing.id, input, { accessToken })
        : createCalendarEvent(input, { accessToken });
    },
    onSuccess: async () => {
      closeForm();
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });
  const connectGoogle = useMutation({
    mutationFn: () => connectGoogleCalendar({ accessToken }),
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
  });
  const syncGoogle = useMutation({
    mutationFn: async () => {
      const result = await syncGoogleCalendar({ accessToken });
      if (!result.clientEncryptionRequired) return result;
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = result.skippedCount;
      const eventDates = new Set<string>();
      const batchSize = 50;

      for (let offset = 0; offset < result.events.length; offset += batchSize) {
        const batch = result.events.slice(offset, offset + batchSize);
        const encryptedEvents = await Promise.all(
          batch.map(async (event) => ({
            eventDate: event.eventDate,
            eventTime: event.eventTime,
            googleEventId: event.googleEventId,
            googleUpdatedAt: event.googleUpdatedAt,
            ...(await encryptRuntimePayload('calendar', 'calendar-event', {
              title: event.title,
              locationName: event.locationName,
              locationUrl: event.locationUrl,
              note: event.note,
            })),
          }))
        );
        const committed = await commitGoogleCalendarEncryptedSync(
          { events: encryptedEvents, finalize: offset + batchSize >= result.events.length },
          { accessToken }
        );
        importedCount += committed.importedCount;
        updatedCount += committed.updatedCount;
        skippedCount += committed.skippedCount;
        committed.eventDates.forEach((date) => eventDates.add(date));
      }

      return {
        clientEncryptionRequired: false as const,
        eventDates: [...eventDates].sort(),
        from: result.from,
        importedCount,
        skippedCount,
        to: result.to,
        updatedCount,
      };
    },
    onSuccess: async (result) => {
      setNotice(
        `Google: dodano ${result.importedCount}, zaktualizowano ${result.updatedCount}, pominięto ${result.skippedCount}.`
      );
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const grouped = (events.data ?? []).reduce<Record<string, typeof events.data>>((acc, event) => {
    (acc[event.eventDate] ??= []).push(event);
    return acc;
  }, {});

  function openCreate() {
    setEditing(null);
    setTitle('');
    setEventDate(todayIso());
    setEventTime('');
    setLocation('');
    setLocationUrl('');
    setNote('');
    setRecurrenceRule('');
    setReminderOffset('1440');
    setScopeType('household');
    setOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditing(event);
    setTitle(event.title);
    setEventDate(event.eventDate);
    setEventTime(event.eventTime?.slice(0, 5) ?? '');
    setLocation(event.locationName ?? '');
    setLocationUrl(event.locationUrl ?? '');
    setNote(event.note ?? '');
    setRecurrenceRule(event.recurrenceRule ?? '');
    setReminderOffset(String(event.reminderOffsetMinutes ?? ''));
    setScopeType(event.scopeType);
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
    save.reset();
  }

  return (
    <Page>
      <PageHeader
        title="Kalendarz"
        description="Wspólne i prywatne wydarzenia domowników."
        action={
          <PrimaryButton onClick={openCreate} disabled={!permission.canCreate}>
            Nowe wydarzenie
          </PrimaryButton>
        }
      />
      {notice && (
        <Alert severity="info" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      <SectionCard>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Box>
            <Typography variant="subtitle1">Kalendarz Google</Typography>
            <Typography variant="body2" color="text.secondary">
              {google.data?.connected
                ? `${google.data.googleAccountEmail ?? 'Połączono'} · ostatnia synchronizacja ${shortDate(google.data.lastSyncedAt)}`
                : 'Połącz konto Google, aby pobierać wydarzenia.'}
            </Typography>
          </Box>
          {google.data?.connected ? (
            <Button
              variant="outlined"
              startIcon={<Icon icon="solar:refresh-bold" />}
              onClick={() => syncGoogle.mutate()}
              disabled={syncGoogle.isPending}
            >
              Synchronizuj
            </Button>
          ) : (
            <Button
              variant="outlined"
              startIcon={<Icon icon="logos:google-icon" />}
              onClick={() => connectGoogle.mutate()}
              disabled={connectGoogle.isPending}
            >
              Połącz Google
            </Button>
          )}
        </Stack>
        {(google.error || connectGoogle.error || syncGoogle.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(google.error || connectGoogle.error || syncGoogle.error)}
          </Alert>
        )}
      </SectionCard>
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
                          <>
                            <IconButton
                              onClick={() => openEdit(event)}
                              aria-label="Edytuj wydarzenie"
                              disabled={!permission.canUpdate}
                            >
                              <Icon icon="solar:pen-bold-duotone" />
                            </IconButton>
                            <IconButton
                              color="error"
                              onClick={() => confirmDelete(event.title) && remove.mutate(event.id)}
                              aria-label="Usuń wydarzenie"
                              disabled={!permission.canDelete}
                            >
                              <Icon icon="solar:trash-bin-trash-bold-duotone" />
                            </IconButton>
                          </>
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
        title={editing ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}
        open={open}
        onClose={closeForm}
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        submitDisabled={!title.trim() || !eventDate}
      >
        {save.error && <Alert severity="error">{errorMessage(save.error)}</Alert>}
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
          label="Link do lokalizacji"
          value={locationUrl}
          onChange={(e) => setLocationUrl(e.target.value)}
          placeholder="https://maps.google.com/…"
        />
        <TextField
          label="Notatka"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={3}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            fullWidth
            select
            label="Przypomnienie"
            value={reminderOffset}
            onChange={(e) => setReminderOffset(e.target.value)}
          >
            <MenuItem value="">Bez przypomnienia</MenuItem>
            <MenuItem value="30">30 minut wcześniej</MenuItem>
            <MenuItem value="60">Godzinę wcześniej</MenuItem>
            <MenuItem value="1440">Dzień wcześniej</MenuItem>
            <MenuItem value="10080">Tydzień wcześniej</MenuItem>
          </TextField>
          <TextField
            fullWidth
            label="Powtarzanie (RRULE)"
            value={recurrenceRule}
            onChange={(e) => setRecurrenceRule(e.target.value)}
            placeholder="np. FREQ=WEEKLY"
          />
        </Stack>
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
