import type { CalendarEvent } from '../api';

import { Icon } from '@iconify/react';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Card,
  Alert,
  Stack,
  Button,
  Avatar,
  Divider,
  Checkbox,
  MenuItem,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { usePermission } from '../auth/use-permission';
import { encryptRuntimePayload } from '../encryption-runtime';
import { todayIso, calendarWeekDates, calendarMonthDates } from '../utils/format';
import { Page, ErrorView, FormDialog, LoadingView, errorMessage, confirmDelete } from '../components/ui';
import {
  syncGoogleCalendar,
  listCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  listHouseholdMembers,
  connectGoogleCalendar,
  getGoogleCalendarStatus,
  commitGoogleCalendarEncryptedSync,
} from '../api';

type CalendarView = 'month' | 'week' | 'list';

const weekdays = ['Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob', 'Nie'];
const eventColors = ['#3B82F6', '#EC5F91', '#18A957', '#8B5CF6', '#F2A51A'];

function shiftMonth(value: string, amount: number) {
  const [year = 0, month = 1] = value.split('-').map(Number);
  const date = new Date(year, month - 1 + amount, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(
    new Date(`${value}-01T12:00:00`)
  );
}

function dateLabel(value: string) {
  const label = new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function eventOwnerId(event: CalendarEvent) {
  return event.ownerMemberId ?? event.googleCalendarOwnerMemberId;
}

function colorForEvent(event: CalendarEvent) {
  const seed = `${event.title}${eventOwnerId(event) ?? event.scopeType}`;
  const hash = [...seed].reduce((total, character) => total + character.charCodeAt(0), 0);
  return eventColors[hash % eventColors.length];
}

function CalendarGrid({
  dates,
  eventsByDate,
  month,
  onEdit,
  onSelect,
  selectedDate,
}: {
  dates: string[];
  eventsByDate: Record<string, CalendarEvent[]>;
  month: string;
  onEdit: (event: CalendarEvent) => void;
  onSelect: (date: string) => void;
  selectedDate: string;
}) {
  const today = todayIso();

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2.5 }}>
      <Box sx={{ display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {weekdays.map((day) => (
          <Box key={day} sx={{ py: 1.5, textAlign: 'center', borderBottom: '1px solid', borderRight: '1px solid', borderColor: 'divider', '&:nth-of-type(7)': { borderRight: 0 } }}>
            <Typography variant="subtitle2">{day}</Typography>
          </Box>
        ))}
        {dates.map((date, index) => {
          const dayEvents = eventsByDate[date] ?? [];
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const isCurrentMonth = date.startsWith(month);

          return (
            <Box
              key={date}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(date)}
              onKeyDown={(event) => event.key === 'Enter' && onSelect(date)}
              sx={(theme) => ({
                p: 1,
                minWidth: 0,
                minHeight: { sm: 104, lg: 122 },
                cursor: 'pointer',
                borderRight: index % 7 === 6 ? 0 : '1px solid',
                borderBottom: index >= dates.length - 7 ? 0 : '1px solid',
                borderColor: 'divider',
                bgcolor: isSelected ? 'rgba(59,130,246,.09)' : 'background.paper',
                opacity: isCurrentMonth ? 1 : 0.46,
                transition: theme.transitions.create('background-color'),
                '&:hover': { bgcolor: 'action.hover' },
                ...theme.applyStyles('dark', {
                  bgcolor: isSelected ? 'rgba(87,139,246,.16)' : 'background.paper',
                }),
              })}
            >
              <Box sx={{ mb: 0.75, width: 26, height: 26, display: 'grid', borderRadius: '50%', placeItems: 'center', color: isToday || isSelected ? '#fff' : 'text.primary', bgcolor: isToday || isSelected ? 'primary.main' : 'transparent', fontSize: 13, fontWeight: 800 }}>
                {Number(date.slice(-2))}
              </Box>
              <Stack spacing={0.5}>
                {dayEvents.slice(0, 3).map((event) => {
                  const color = colorForEvent(event);
                  return (
                    <Box
                      key={`${event.sourceType}-${event.id}`}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onEdit(event);
                      }}
                      sx={{ px: 0.75, py: 0.45, minWidth: 0, display: 'flex', gap: 0.6, borderRadius: 0.75, alignItems: 'center', bgcolor: `${color}14` }}
                    >
                      <Box sx={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', bgcolor: color }} />
                      <Typography variant="caption" noWrap sx={{ minWidth: 0, flex: 1, fontWeight: 650 }}>{event.title}</Typography>
                      {event.eventTime && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: { sm: 'none', lg: 'block' } }}>{event.eventTime.slice(0, 5)}</Typography>
                      )}
                    </Box>
                  );
                })}
                {dayEvents.length > 3 && <Typography variant="caption" color="text.secondary">+{dayEvents.length - 3} więcej</Typography>}
              </Stack>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: { xs: 'block', sm: 'none' }, p: 1.25 }}>
        <Box sx={{ mb: 0.75, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {weekdays.map((day) => <Typography key={day} variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>{day.slice(0, 2)}</Typography>)}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
          {dates.map((date) => {
            const dayEvents = eventsByDate[date] ?? [];
            const isSelected = date === selectedDate;
            const isToday = date === today;
            return (
              <Button key={date} onClick={() => onSelect(date)} color={isSelected || isToday ? 'primary' : 'inherit'} sx={{ p: 0, minWidth: 0, aspectRatio: '1', opacity: date.startsWith(month) ? 1 : 0.35, borderRadius: 1.25, bgcolor: isSelected ? 'action.selected' : 'transparent' }}>
                <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: isToday ? 800 : 600 }}>{Number(date.slice(-2))}</Typography>
                  <Stack direction="row" spacing={0.25}>
                    {dayEvents.slice(0, 3).map((event) => <Box key={`${event.sourceType}-${event.id}`} sx={{ width: 3.5, height: 3.5, borderRadius: '50%', bgcolor: colorForEvent(event) }} />)}
                  </Stack>
                </Stack>
              </Button>
            );
          })}
        </Box>
      </Box>
    </Card>
  );
}

export function CalendarPage() {
  const { accessToken } = useSession();
  const permission = usePermission('calendar');
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [view, setView] = useState<CalendarView>('month');
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(new Set());
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

  const monthDates = useMemo(() => calendarMonthDates(month), [month]);
  const weekDates = useMemo(() => calendarWeekDates(selectedDate), [selectedDate]);
  const range = { from: monthDates[0], to: monthDates.at(-1)! };
  const events = useQuery({ queryKey: ['calendar', range], queryFn: () => listCalendarEvents(range.from, range.to, { accessToken }) });
  const members = useQuery({ queryKey: ['household', 'members'], queryFn: () => listHouseholdMembers({ accessToken }) });
  const google = useQuery({ queryKey: ['calendar', 'google'], queryFn: () => getGoogleCalendarStatus({ accessToken }) });

  const save = useMutation({
    mutationFn: () => {
      const input = { eventDate, eventTime: eventTime || null, locationName: location || null, locationUrl: locationUrl || null, note: note || null, recurrenceRule: recurrenceRule || null, reminderOffsetMinutes: reminderOffset ? Number(reminderOffset) : null, scopeType, title: title.trim() };
      return editing ? updateCalendarEvent(editing.id, input, { accessToken }) : createCalendarEvent(input, { accessToken });
    },
    onSuccess: async () => {
      closeForm();
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteCalendarEvent(id, { accessToken }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }) });
  const connectGoogle = useMutation({ mutationFn: () => connectGoogleCalendar({ accessToken }), onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl) });
  const syncGoogle = useMutation({
    mutationFn: async () => {
      const result = await syncGoogleCalendar({ accessToken });
      if (!result.clientEncryptionRequired) return result;
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = result.skippedCount;
      const syncedDates = new Set<string>();
      for (let offset = 0; offset < result.events.length; offset += 50) {
        const batch = result.events.slice(offset, offset + 50);
        const encryptedEvents = await Promise.all(batch.map(async (event) => ({ eventDate: event.eventDate, eventTime: event.eventTime, googleEventId: event.googleEventId, googleUpdatedAt: event.googleUpdatedAt, ...(await encryptRuntimePayload('calendar', 'calendar-event', { title: event.title, locationName: event.locationName, locationUrl: event.locationUrl, note: event.note })) })));
        const committed = await commitGoogleCalendarEncryptedSync({ events: encryptedEvents, finalize: offset + 50 >= result.events.length }, { accessToken });
        importedCount += committed.importedCount;
        updatedCount += committed.updatedCount;
        skippedCount += committed.skippedCount;
        committed.eventDates.forEach((date) => syncedDates.add(date));
      }
      return { clientEncryptionRequired: false as const, eventDates: [...syncedDates].sort(), from: result.from, importedCount, skippedCount, to: result.to, updatedCount };
    },
    onSuccess: async (result) => {
      setNotice(`Google: dodano ${result.importedCount}, zaktualizowano ${result.updatedCount}, pominięto ${result.skippedCount}.`);
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const visibleEvents = useMemo(() => (events.data ?? []).filter((event) => { const memberId = eventOwnerId(event); return !memberId || !hiddenMemberIds.has(memberId); }), [events.data, hiddenMemberIds]);
  const grouped = useMemo(() => visibleEvents.reduce<Record<string, CalendarEvent[]>>((result, event) => { (result[event.eventDate] ??= []).push(event); return result; }, {}), [visibleEvents]);
  const selectedEvents = grouped[selectedDate] ?? [];
  const activeMembers = members.data?.filter((member) => member.isActive) ?? [];

  function openCreate(date = selectedDate) {
    setEditing(null); setTitle(''); setEventDate(date); setEventTime(''); setLocation(''); setLocationUrl(''); setNote(''); setRecurrenceRule(''); setReminderOffset('1440'); setScopeType('household'); setOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    if (event.sourceType !== 'manual') return;
    setEditing(event); setTitle(event.title); setEventDate(event.eventDate); setEventTime(event.eventTime?.slice(0, 5) ?? ''); setLocation(event.locationName ?? ''); setLocationUrl(event.locationUrl ?? ''); setNote(event.note ?? ''); setRecurrenceRule(event.recurrenceRule ?? ''); setReminderOffset(String(event.reminderOffsetMinutes ?? '')); setScopeType(event.scopeType); setOpen(true);
  }

  function closeForm() { setOpen(false); setEditing(null); save.reset(); }
  function changeMonth(amount: number) { const nextMonth = shiftMonth(month, amount); setMonth(nextMonth); setSelectedDate(`${nextMonth}-01`); }
  function selectDate(date: string) { setSelectedDate(date); if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7)); }
  function showToday() { const today = todayIso(); setMonth(today.slice(0, 7)); setSelectedDate(today); }
  function toggleMember(memberId: string) { setHiddenMemberIds((current) => { const next = new Set(current); if (next.has(memberId)) next.delete(memberId); else next.add(memberId); return next; }); }

  const displayedDates = view === 'week' ? weekDates : monthDates;

  return (
    <Page>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: { lg: 'center' }, justifyContent: 'space-between' }}>
        <Box><Typography variant="h2" sx={{ fontSize: { xs: 32, md: 38 } }}>Kalendarz</Typography><Typography color="text.secondary">Plan ułatwia codzienne życie.</Typography></Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <Button variant="outlined" startIcon={<Icon icon={google.data?.connected ? 'solar:refresh-bold' : 'logos:google-calendar'} />} onClick={() => google.data?.connected ? syncGoogle.mutate() : connectGoogle.mutate()} disabled={connectGoogle.isPending || syncGoogle.isPending}>{google.data?.connected ? 'Synchronizuj Google Calendar' : 'Połącz z Google Calendar'}</Button>
          <Button variant="contained" startIcon={<Icon icon="solar:add-circle-bold" />} onClick={() => openCreate()} disabled={!permission.canCreate}>Dodaj wydarzenie</Button>
        </Stack>
      </Stack>

      {notice && <Alert severity="info" onClose={() => setNotice(null)}>{notice}</Alert>}
      {(google.error || connectGoogle.error || syncGoogle.error) && <Alert severity="error">{errorMessage(google.error || connectGoogle.error || syncGoogle.error)}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <IconButton aria-label="Poprzedni miesiąc" onClick={() => changeMonth(-1)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.25 }}><Icon icon="solar:alt-arrow-left-linear" /></IconButton>
          <IconButton aria-label="Następny miesiąc" onClick={() => changeMonth(1)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.25 }}><Icon icon="solar:alt-arrow-right-linear" /></IconButton>
          <Button variant="outlined" onClick={showToday}>Dziś</Button>
          <Typography variant="h4" sx={{ ml: { xs: 0.5, sm: 2 }, textTransform: 'capitalize' }}>{monthLabel(month)}</Typography>
        </Stack>
        <Stack direction="row" sx={{ p: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
          {([['month', 'Miesiąc'], ['week', 'Tydzień'], ['list', 'Lista']] as const).map(([value, label]) => <Button key={value} size="small" onClick={() => setView(value)} variant={view === value ? 'contained' : 'text'} color={view === value ? 'primary' : 'inherit'} sx={{ minWidth: { xs: 88, sm: 108 }, boxShadow: 'none' }}>{label}</Button>)}
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gap: 2, alignItems: 'start', gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 310px' } }}>
        <Box sx={{ minWidth: 0 }}>
          {events.isLoading ? <LoadingView /> : events.error ? <ErrorView error={events.error} retry={() => void events.refetch()} /> : view === 'list' ? (
            <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2.5 }}>
              {visibleEvents.length === 0 ? <Typography color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>Brak wydarzeń w tym miesiącu.</Typography> : (
                <Stack divider={<Divider flexItem />}>
                  {Object.entries(grouped).sort(([first], [second]) => first.localeCompare(second)).map(([date, dayEvents]) => (
                    <Box key={date} sx={{ py: 2 }}><Typography variant="subtitle1" sx={{ mb: 1.25 }}>{dateLabel(date)}</Typography><Stack spacing={1}>
                      {dayEvents.map((event) => <Button key={`${event.sourceType}-${event.id}`} color="inherit" onClick={() => openEdit(event)} sx={{ p: 1.25, justifyContent: 'flex-start', bgcolor: 'action.hover' }}><Box sx={{ mr: 1.25, width: 8, height: 36, borderRadius: 4, bgcolor: colorForEvent(event) }} /><Box sx={{ minWidth: 0, textAlign: 'left' }}><Typography sx={{ fontWeight: 750 }}>{event.title}</Typography><Typography variant="caption" color="text.secondary">{event.eventTime?.slice(0, 5) || 'Cały dzień'}{event.locationName ? ` · ${event.locationName}` : ''}</Typography></Box></Button>)}
                    </Stack></Box>
                  ))}
                </Stack>
              )}
            </Card>
          ) : <CalendarGrid dates={displayedDates} eventsByDate={grouped} month={month} onEdit={openEdit} onSelect={selectDate} selectedDate={selectedDate} />}
        </Box>

        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Card variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h5">{dateLabel(selectedDate)}</Typography><IconButton size="small" aria-label="Więcej opcji dnia"><Icon icon="solar:menu-dots-bold" /></IconButton></Stack>
            <Stack spacing={0.25} divider={<Divider flexItem />} sx={{ mt: 1.25 }}>
              {selectedEvents.length === 0 ? <Typography color="text.secondary" sx={{ py: 2 }}>Brak wydarzeń tego dnia.</Typography> : selectedEvents.map((event) => {
                const color = colorForEvent(event); const owner = activeMembers.find((member) => member.id === eventOwnerId(event));
                return <Button key={`${event.sourceType}-${event.id}`} color="inherit" onClick={() => openEdit(event)} sx={{ px: 0, py: 1.25, gap: 1.25, justifyContent: 'flex-start', textAlign: 'left' }}><Box sx={{ width: 9, height: 9, flexShrink: 0, borderRadius: '50%', bgcolor: color }} /><Box sx={{ minWidth: 0, flex: 1 }}><Typography noWrap sx={{ fontWeight: 750 }}>{event.title}</Typography><Typography variant="caption" color="text.secondary">{event.eventTime?.slice(0, 5) || 'Cały dzień'}{event.locationName ? ` · ${event.locationName}` : ''}</Typography></Box>{owner && <Avatar sx={{ width: 32, height: 32, bgcolor: `${color}24`, color, fontSize: 12, fontWeight: 800 }}>{owner.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Avatar>}</Button>;
              })}
            </Stack>
            <Button fullWidth variant="outlined" startIcon={<Icon icon="solar:add-circle-linear" />} onClick={() => openCreate(selectedDate)} disabled={!permission.canCreate} sx={{ mt: 1.5 }}>Dodaj wydarzenie</Button>
          </Card>

          <Card variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Icon icon="solar:users-group-rounded-bold-duotone" width={22} /><Typography variant="h6">Domownicy</Typography></Stack><Button component={RouterLink} to="/dom" size="small">Zarządzaj</Button></Stack>
            <Stack sx={{ mt: 1 }}>
              <Stack direction="row" sx={{ alignItems: 'center' }}><Checkbox size="small" checked={hiddenMemberIds.size === 0} indeterminate={hiddenMemberIds.size > 0 && hiddenMemberIds.size < activeMembers.length} onChange={() => setHiddenMemberIds(hiddenMemberIds.size ? new Set() : new Set(activeMembers.map((member) => member.id)))} /><Typography variant="body2">Wszyscy</Typography></Stack>
              {activeMembers.map((member, index) => <Stack key={member.id} direction="row" sx={{ alignItems: 'center' }}><Checkbox size="small" checked={!hiddenMemberIds.has(member.id)} onChange={() => toggleMember(member.id)} /><Box sx={{ mr: 1, width: 8, height: 8, borderRadius: '50%', bgcolor: eventColors[index % eventColors.length] }} /><Typography variant="body2" noWrap>{member.displayName}</Typography></Stack>)}
            </Stack>
          </Card>

          <Card variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1.25 }}>Szybkie dodawanie</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
              {([['solar:calendar-add-bold-duotone', 'Wydarzenie', '#3B82F6', null], ['solar:cart-large-2-bold-duotone', 'Zakupy', '#F59E0B', '/zakupy'], ['solar:bill-list-bold-duotone', 'Wydatek', '#10B981', '/finanse'], ['solar:notes-bold-duotone', 'Notatka', '#8B5CF6', '/zadania']] as const).map(([icon, label, color, path]) => <Button key={label} component={path ? RouterLink : 'button'} to={path ?? undefined} onClick={path ? undefined : () => openCreate(selectedDate)} color="inherit" sx={{ px: 0.5, py: 1.25, minWidth: 0, display: 'flex', gap: 0.5, flexDirection: 'column', bgcolor: `${color}0D`, border: '1px solid', borderColor: `${color}20` }}><Icon icon={icon} width={25} color={color} /><Typography variant="caption" noWrap>{label}</Typography></Button>)}
            </Box>
          </Card>
        </Stack>
      </Box>

      <FormDialog title={editing ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'} open={open} onClose={closeForm} onSubmit={() => save.mutate()} loading={save.isPending} submitDisabled={!title.trim() || !eventDate}>
        {save.error && <Alert severity="error">{errorMessage(save.error)}</Alert>}
        <TextField label="Tytuł" value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField fullWidth label="Data" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField fullWidth label="Godzina" type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Stack>
        <TextField label="Miejsce" value={location} onChange={(event) => setLocation(event.target.value)} />
        <TextField label="Link do lokalizacji" value={locationUrl} onChange={(event) => setLocationUrl(event.target.value)} placeholder="https://maps.google.com/…" />
        <TextField label="Notatka" value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={3} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField fullWidth select label="Przypomnienie" value={reminderOffset} onChange={(event) => setReminderOffset(event.target.value)}><MenuItem value="">Bez przypomnienia</MenuItem><MenuItem value="30">30 minut wcześniej</MenuItem><MenuItem value="60">Godzinę wcześniej</MenuItem><MenuItem value="1440">Dzień wcześniej</MenuItem><MenuItem value="10080">Tydzień wcześniej</MenuItem></TextField><TextField fullWidth label="Powtarzanie (RRULE)" value={recurrenceRule} onChange={(event) => setRecurrenceRule(event.target.value)} placeholder="np. FREQ=WEEKLY" /></Stack>
        <TextField select label="Widoczność" value={scopeType} onChange={(event) => setScopeType(event.target.value as 'household' | 'member')}><MenuItem value="household">Wspólne dla domu</MenuItem><MenuItem value="member">Prywatne</MenuItem></TextField>
        {editing && permission.canDelete && <Button color="error" startIcon={<Icon icon="solar:trash-bin-trash-bold-duotone" />} onClick={() => { if (confirmDelete(editing.title)) { remove.mutate(editing.id); closeForm(); } }}>Usuń wydarzenie</Button>}
      </FormDialog>
    </Page>
  );
}
