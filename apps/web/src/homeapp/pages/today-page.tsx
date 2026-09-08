import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';

import { Box, Chip, Grid, Stack, Button, Divider, Typography } from '@mui/material';

import { useSession } from '../auth/session-context';
import { getMyHousehold, getStartDashboard } from '../api';
import { money, todayIso, shortDate } from '../utils/format';
import {
  Page,
  ErrorView,
  EmptyState,
  MetricCard,
  PageHeader,
  LoadingView,
  SectionCard,
} from '../components/ui';

const weekdays = [
  '',
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
];

export function TodayPage() {
  const { accessToken } = useSession();
  const dashboard = useQuery({
    queryKey: ['start', 'dashboard'],
    queryFn: () => getStartDashboard({ accessToken }),
  });
  const household = useQuery({
    queryKey: ['household'],
    queryFn: () => getMyHousehold({ accessToken }),
  });

  if (dashboard.isLoading) return <LoadingView />;
  if (dashboard.error || !dashboard.data)
    return <ErrorView error={dashboard.error} retry={() => void dashboard.refetch()} />;

  const data = dashboard.data;
  const currentWeekday = ((new Date(`${todayIso()}T12:00:00`).getDay() + 6) % 7) + 1;
  const todaysMeals =
    data.mealPlan?.entries.filter((entry) => entry.weekday === currentWeekday) ?? [];
  const currency = household.data?.currencyCode ?? 'PLN';

  return (
    <Page>
      <PageHeader
        title="Dzień dobry!"
        description={new Intl.DateTimeFormat('pl-PL', {
          dateStyle: 'full',
        }).format(new Date())}
      />
      <SectionCard
        sx={{
          overflow: 'hidden',
          color: 'common.white',
          background: 'linear-gradient(135deg, #004B50 0%, #00A76F 58%, #5BE49B 140%)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: { md: 'center' } }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h2">Wszystko, co ważne w domu</Typography>
            <Typography sx={{ mt: 1, maxWidth: 620, opacity: 0.8 }}>
              Dodaj wydatek, zaplanuj obiad albo sprawdź dzisiejsze obowiązki — bez przechodzenia przez kilka ekranów.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button component={RouterLink} to="/finanse" variant="contained" color="inherit" startIcon={<Icon icon="solar:card-send-bold-duotone" />} sx={{ color: '#004B50', bgcolor: 'common.white', '&:hover': { bgcolor: 'grey.200' } }}>Dodaj wydatek</Button>
            <Button component={RouterLink} to="/zakupy" variant="outlined" startIcon={<Icon icon="solar:cart-plus-bold-duotone" />} sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,.5)' }}>Lista zakupów</Button>
            <Button component={RouterLink} to="/posilki" variant="outlined" startIcon={<Icon icon="solar:chef-hat-bold-duotone" />} sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,.5)' }}>Plan posiłków</Button>
          </Stack>
        </Stack>
      </SectionCard>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            icon="solar:checklist-minimalistic-bold-duotone"
            label="Zadania do zrobienia"
            value={data.todoCount}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            icon="solar:calendar-mark-bold-duotone"
            label="Najbliższe wydarzenia"
            value={data.upcomingEvents.length}
            color="info.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            icon="solar:chef-hat-heart-bold-duotone"
            label="Dzisiejsze posiłki"
            value={todaysMeals.length}
            color="warning.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            icon="solar:wallet-money-bold-duotone"
            label="Pozostało w budżecie"
            value={money(data.finance?.totalRemainingAmount, currency)}
            color="secondary.main"
          />
        </Grid>
      </Grid>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="Najbliższe wydarzenia" sx={{ height: '100%' }}>
            {data.upcomingEvents.length === 0 ? (
              <EmptyState text="Brak nadchodzących wydarzeń." />
            ) : (
              <Stack divider={<Divider flexItem />}>
                {data.upcomingEvents.map((event) => (
                  <Stack
                    key={`${event.sourceType}-${event.id}`}
                    direction="row"
                    spacing={2}
                    sx={{ py: 1.5, alignItems: 'center' }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(0,184,217,.12)',
                        color: 'info.dark',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon icon="solar:calendar-date-bold-duotone" width={24} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{event.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {shortDate(event.eventDate)}
                        {event.eventTime ? ` · ${event.eventTime.slice(0, 5)}` : ''}
                      </Typography>
                    </Box>
                    {event.sourceType === 'google' && (
                      <Chip size="small" label="Google" variant="outlined" />
                    )}
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Plan na dziś" sx={{ height: '100%' }}>
            {todaysMeals.length === 0 ? (
              <EmptyState
                icon="solar:chef-hat-minimalistic-bold-duotone"
                text={`Brak posiłków na ${weekdays[currentWeekday]?.toLowerCase()}.`}
              />
            ) : (
              <Stack spacing={1.5}>
                {todaysMeals
                  .sort((a, b) => a.slotIndex - b.slotIndex)
                  .map((meal) => (
                    <Stack
                      key={meal.id}
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: 'center' }}
                    >
                      <Chip label={meal.slotIndex + 1} color="warning" />
                      <Typography sx={{ fontWeight: 600 }}>{meal.mealName}</Typography>
                    </Stack>
                  ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="Zadania">
            {data.todoPreview.length === 0 ? (
              <EmptyState text="Wszystko zrobione — dobra robota!" />
            ) : (
              <Stack divider={<Divider flexItem />}>
                {data.todoPreview.map((todo) => (
                  <Stack
                    key={todo.id}
                    direction="row"
                    spacing={1.5}
                    sx={{ py: 1.25, alignItems: 'center' }}
                  >
                    <Icon icon="solar:record-circle-linear" color="#00A76F" />
                    <Typography>{todo.title}</Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Budżet miesiąca">
            {!data.finance ? (
              <EmptyState text="Nie utworzono jeszcze budżetu." />
            ) : (
              <Stack spacing={2}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Dochody</Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    {money(data.finance.incomeAmount, currency)}
                  </Typography>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Wydano</Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    {money(data.finance.totalSpentAmount, currency)}
                  </Typography>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Pozostało</Typography>
                  <Typography color="primary.main" sx={{ fontWeight: 800 }}>
                    {money(data.finance.totalRemainingAmount, currency)}
                  </Typography>
                </Stack>
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Page>
  );
}
