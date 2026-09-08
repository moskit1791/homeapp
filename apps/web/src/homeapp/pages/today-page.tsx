import type { Theme } from '@mui/material/styles';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { useSession } from '../auth/session-context';
import { money, todayIso, shortDate } from '../utils/format';
import { Page, ErrorView, LoadingView } from '../components/ui';
import mealCardImage from '../../../../mobile/assets/today-meal-card.png';
import { getMyHousehold, getStartDashboard, listShoppingItems } from '../api';
import calendarCardImage from '../../../../mobile/assets/today-calendar-card.png';
import shoppingCardImage from '../../../../mobile/assets/today-shopping-card.png';

const positivePhrases = [
  'Dobre rzeczy dzieją się w domu',
  'Tu zaczyna się dobry dzień',
  'Małe kroki robią wielką różnicę',
  'Razem wszystko smakuje lepiej',
  'Spokój też jest dobrym planem',
  'Twój dom, Twoje dobre tempo',
  'Dziś wydarzy się coś miłego',
  'Najlepsze chwile są blisko',
  'Zrób dziś miejsce na radość',
  'Każdy dzień ma coś dobrego',
  'Ciepło domu tworzą ludzie',
  'Dobrze, że jesteśmy razem',
  'Niech dziś będzie lekko',
  'Masz więcej powodów do uśmiechu',
  'Codzienność też bywa piękna',
  'To będzie naprawdę dobry dzień',
  'Dom jest tam, gdzie jesteśmy razem',
  'Zwolnij, wszystko jest w porządku',
  'Dziś wybieramy dobre myśli',
  'Miłe chwile są tuż obok',
  'Uśmiech pasuje do każdego planu',
  'W domu zawsze jest miejsce na dobro',
  'Nie musisz zrobić wszystkiego naraz',
  'Najważniejsze już masz blisko',
  'Drobne radości budują piękne dni',
  'Niech ten dzień dobrze się układa',
  'Jesteś dokładnie tam, gdzie trzeba',
  'Wspólny czas to najlepszy plan',
  'Dziś też może być wyjątkowo',
  'Czasem wystarczy chwila razem',
  'Dobry dom rośnie z dobrych chwil',
  'Zacznij od jednej miłej rzeczy',
  'Dzisiaj liczą się małe zwycięstwa',
  'Wszystko po kolei, bez pośpiechu',
  'Tu mieszkają dobre wspomnienia',
  'Zwykły dzień też może zachwycić',
  'Niech w domu będzie dziś spokojnie',
  'Jeden uśmiech zmienia cały dzień',
  'Razem łatwiej spełniać plany',
  'Piękne chwile nie potrzebują okazji',
  'Dziś zadbaj także o siebie',
  'W domu dobrze być sobą',
  'Masz prawo do spokojnego dnia',
  'Niech dobro wraca dziś podwójnie',
  'Najlepszy moment może być właśnie teraz',
  'Zostaw trochę miejsca na niespodzianki',
  'Wdzięczność dobrze urządza dzień',
  'Każdy wspólny posiłek ma znaczenie',
  'Dom pełen śmiechu to dobry dom',
  'Dziś wystarczy zrobić tyle, ile możesz',
  'Nawet mały plan może dać wielką radość',
  'Niech dzisiejszy dzień będzie Twój',
  'To, co ważne, jest bliżej niż myślisz',
  'Czułość mieszka w małych gestach',
  'Dobre słowo zawsze znajdzie miejsce',
  'Każdy dzień dopisuje coś pięknego',
  'Niech dzisiaj będzie po prostu dobrze',
  'Najpiękniej jest wracać do siebie',
  'Wspólne chwile zostają na długo',
  'Dom to nasza mała dobra historia',
] as const;

const phraseSymbols = ['♡', '✦', '☀', '⌂', '☺'] as const;

const dashboardCard = (theme: Theme) => ({
  border: '1px solid rgba(62, 82, 112, 0.18)',
  borderRadius: 2.5,
  bgcolor: 'rgba(255,255,255,.92)',
  boxShadow: '0 10px 34px rgba(34, 51, 84, .06)',
  ...theme.applyStyles('dark', {
    borderColor: 'rgba(139, 166, 206, .28)',
    bgcolor: 'rgba(14, 28, 46, .84)',
    boxShadow: '0 14px 42px rgba(0, 0, 0, .24)',
  }),
});

const accentBackground = (color: string, darkColor: string) => (theme: Theme) => ({
  bgcolor: color,
  ...theme.applyStyles('dark', { bgcolor: darkColor }),
});

function QuickAction({
  accent,
  darkAccent,
  description,
  icon,
  path,
  title,
}: {
  accent: string;
  darkAccent: string;
  description: string;
  icon: string;
  path: string;
  title: string;
}) {
  return (
    <Box
      component={RouterLink}
      to={path}
      sx={(theme) => ({
        ...dashboardCard(theme),
        p: 2,
        gap: 1.75,
        minHeight: 94,
        display: 'flex',
        alignItems: 'center',
        color: 'text.primary',
        textDecoration: 'none',
        transition: theme.transitions.create(['transform', 'border-color', 'box-shadow']),
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: accent,
          boxShadow: '0 15px 38px rgba(31, 53, 92, .12)',
        },
      })}
    >
      <Box
        sx={(theme) => ({
          ...accentBackground(`${accent}18`, darkAccent)(theme),
          width: 52,
          height: 52,
          display: 'grid',
          flexShrink: 0,
          borderRadius: 1.75,
          placeItems: 'center',
          color: accent,
        })}
      >
        <Icon icon={icon} width={29} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {description}
        </Typography>
      </Box>
      <Icon icon="solar:alt-arrow-right-linear" width={20} color={accent} />
    </Box>
  );
}

function MiniOverviewCard({
  accent,
  action,
  description,
  icon,
  image,
  path,
  title,
  value,
}: {
  accent: string;
  action: string;
  description: string;
  icon: string;
  image: string;
  path: string;
  title: string;
  value: string;
}) {
  return (
    <Box
      sx={(theme) => ({
        ...dashboardCard(theme),
        p: 2.25,
        minHeight: 154,
        position: 'relative',
        overflow: 'hidden',
      })}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            display: 'grid',
            borderRadius: 1.35,
            placeItems: 'center',
            color: accent,
            bgcolor: `${accent}17`,
          }}
        >
          <Icon icon={icon} width={23} />
        </Box>
        <Typography variant="h6">{title}</Typography>
      </Stack>
      <Typography variant="h3" sx={{ mt: 1.15, position: 'relative', zIndex: 1 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ position: 'relative', zIndex: 1 }}>
        {description}
      </Typography>
      <Button
        component={RouterLink}
        to={path}
        variant="text"
        size="small"
        endIcon={<Icon icon="solar:arrow-right-linear" />}
        sx={{ mt: 0.5, px: 0, color: accent, position: 'relative', zIndex: 2 }}
      >
        {action}
      </Button>
      <Box
        component="img"
        src={image}
        alt=""
        sx={{
          right: -8,
          bottom: -12,
          width: 155,
          height: 130,
          objectFit: 'contain',
          position: 'absolute',
          pointerEvents: 'none',
          filter: 'drop-shadow(0 13px 14px rgba(0,0,0,.2))',
        }}
      />
    </Box>
  );
}

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
  const shopping = useQuery({
    queryKey: ['shopping', 'items', 'daily'],
    queryFn: () => listShoppingItems('daily', { accessToken }),
  });
  const [phraseIndex] = useState(() => {
    const randomValue = new Uint32Array(1);
    crypto.getRandomValues(randomValue);
    return randomValue[0]! % positivePhrases.length;
  });

  if (dashboard.isLoading) return <LoadingView />;
  if (dashboard.error || !dashboard.data) {
    return <ErrorView error={dashboard.error} retry={() => void dashboard.refetch()} />;
  }

  const data = dashboard.data;
  const currentWeekday = ((new Date(`${todayIso()}T12:00:00`).getDay() + 6) % 7) + 1;
  const todaysMeals =
    data.mealPlan?.entries
      .filter((entry) => entry.weekday === currentWeekday)
      .sort((a, b) => a.slotIndex - b.slotIndex) ?? [];
  const openShopping = shopping.data?.filter((item) => !item.isChecked) ?? [];
  const nextEvent = data.upcomingEvents[0];
  const positivePhrase = positivePhrases[phraseIndex];
  const currency = household.data?.currencyCode ?? 'PLN';
  const formattedToday = new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(new Date());

  const summaryRows = [
    nextEvent && {
      accent: '#5687F5',
      icon: 'solar:calendar-date-bold-duotone',
      title: nextEvent.eventTime ? nextEvent.eventTime.slice(0, 5) : 'Cały dzień',
      description: nextEvent.title,
      path: '/kalendarz',
    },
    data.finance && {
      accent: '#51D59A',
      icon: 'solar:wallet-money-bold-duotone',
      title: 'Budżet miesiąca',
      description: `${money(data.finance.totalRemainingAmount, currency)} do dyspozycji`,
      path: '/finanse',
    },
    {
      accent: '#F4B957',
      icon: 'solar:cart-3-bold-duotone',
      title: `${openShopping.length} ${openShopping.length === 1 ? 'produkt' : 'produkty'} na liście`,
      description: openShopping.length
        ? openShopping.slice(0, 3).map((item) => item.name).join(', ')
        : 'Lista zakupów jest pusta',
      path: '/zakupy',
    },
  ].filter(Boolean) as Array<{
    accent: string;
    description: string;
    icon: string;
    path: string;
    title: string;
  }>;

  return (
    <Page>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'flex-end' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 44 }, letterSpacing: -1.3 }}>
            Dzień dobry!
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 18 }}>
            Masz dziś kilka planów do realizacji.
          </Typography>
        </Box>
        <Stack spacing={1} sx={{ alignItems: { md: 'flex-end' } }}>
          <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
            {formattedToday}
          </Typography>
          <Button
            component={RouterLink}
            to="/kalendarz"
            variant="outlined"
            size="small"
            startIcon={<Icon icon="solar:calendar-bold-duotone" />}
            endIcon={<Icon icon="solar:alt-arrow-right-linear" />}
            sx={{ borderRadius: 10, color: 'text.secondary', borderColor: 'divider' }}
          >
            Zobacz cały kalendarz
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <QuickAction accent="#5687F5" darkAccent="rgba(69,112,210,.25)" icon="solar:calendar-add-bold-duotone" title="Wydarzenie" description="Dodaj wydarzenie" path="/kalendarz" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <QuickAction accent="#43C88A" darkAccent="rgba(38,157,105,.25)" icon="solar:bill-list-bold-duotone" title="Wydatek" description="Dodaj wydatek" path="/finanse" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <QuickAction accent="#F3B64E" darkAccent="rgba(188,126,32,.26)" icon="solar:cart-large-2-bold-duotone" title="Zakupy" description="Dodaj do listy" path="/zakupy" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <QuickAction accent="#A879E8" darkAccent="rgba(123,72,190,.26)" icon="solar:notes-bold-duotone" title="Notatka" description="Zapisz notatkę" path="/zadania" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box
            sx={(theme) => ({
              ...dashboardCard(theme),
              p: { xs: 2.5, sm: 3 },
              minHeight: { xs: 370, sm: 350 },
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
              background:
                'radial-gradient(circle at 78% 28%, rgba(86,135,245,.12), transparent 38%), rgba(255,255,255,.94)',
              ...theme.applyStyles('dark', {
                background:
                  'radial-gradient(circle at 78% 28%, rgba(86,135,245,.16), transparent 42%), linear-gradient(145deg, rgba(18,34,54,.96), rgba(12,25,42,.96))',
              }),
            })}
          >
            <Typography variant="overline" sx={{ color: '#7298F7', fontWeight: 800, letterSpacing: 1.2 }}>
              Plan dnia
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.25, fontSize: { xs: 27, sm: 34 }, maxWidth: 500 }}>
              Najbliższe wydarzenie
            </Typography>
            <Stack spacing={1.25} sx={{ mt: 2.25, maxWidth: { xs: '100%', sm: '52%' }, position: 'relative', zIndex: 2 }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                <Icon icon="solar:calendar-bold-duotone" width={27} color="#7298F7" />
                <Typography variant="h6">
                  {nextEvent
                    ? `${shortDate(nextEvent.eventDate)} / ${nextEvent.eventTime?.slice(0, 5) ?? 'cały dzień'}`
                    : 'Brak zaplanowanych wydarzeń'}
                </Typography>
              </Stack>
              {nextEvent && (
                <>
                  <Typography variant="h4">{nextEvent.title}</Typography>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <Icon icon="solar:users-group-rounded-bold-duotone" width={21} />
                    <Typography variant="body2">
                      {nextEvent.scopeType === 'household' ? 'Wszyscy domownicy' : 'Wydarzenie prywatne'}
                    </Typography>
                  </Stack>
                </>
              )}
              <Button component={RouterLink} to="/kalendarz" variant="outlined" endIcon={<Icon icon="solar:arrow-right-linear" />} sx={{ mt: 1.5, alignSelf: 'flex-start', borderRadius: 8, px: 2.5 }}>
                {nextEvent ? 'Zobacz szczegóły' : 'Dodaj wydarzenie'}
              </Button>
            </Stack>
            <Box
              component="img"
              src={calendarCardImage}
              alt="Kalendarz"
              sx={{
                right: { xs: -55, sm: 74 },
                bottom: -16,
                width: { xs: 285, sm: 370 },
                height: { xs: 230, sm: 320 },
                objectFit: 'contain',
                position: 'absolute',
                opacity: { xs: 0.52, sm: 1 },
                pointerEvents: 'none',
                filter: 'drop-shadow(0 22px 24px rgba(0,0,0,.2))',
              }}
            />
            <Box
              aria-hidden="true"
              sx={(theme) => ({
                top: 42,
                right: 20,
                zIndex: 1,
                width: 145,
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                textAlign: 'center',
                pointerEvents: 'none',
                color: 'rgba(56,77,105,.72)',
                transform: `rotate(${(phraseIndex % 5) - 2}deg)`,
                fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
                ...theme.applyStyles('dark', { color: 'rgba(190,204,225,.82)' }),
              })}
            >
              <Typography
                component="p"
                sx={{
                  m: 0,
                  font: 'inherit',
                  fontSize: 17,
                  lineHeight: 1.35,
                  letterSpacing: 0.25,
                }}
              >
                {positivePhrase}
              </Typography>
              <Typography component="span" sx={{ mt: 0.5, display: 'block', font: 'inherit', fontSize: 25 }}>
                {phraseSymbols[phraseIndex % phraseSymbols.length]}
              </Typography>
            </Box>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <MiniOverviewCard accent="#43C88A" icon="solar:cart-3-bold-duotone" title="Zakupy" value={`${openShopping.length} ${openShopping.length === 1 ? 'produkt' : 'produkty'}`} description="na liście zakupów" action="Otwórz listę" path="/zakupy" image={shoppingCardImage} />
            <MiniOverviewCard accent="#7298F7" icon="solar:chef-hat-heart-bold-duotone" title="Plan posiłków" value={`${todaysMeals.length} ${todaysMeals.length === 1 ? 'posiłek' : 'posiłków'}`} description="na dziś" action="Zaplanuj" path="/posilki" image={mealCardImage} />
          </Stack>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box sx={(theme) => ({ ...dashboardCard(theme), p: { xs: 2.25, sm: 3 }, height: '100%' })}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                <Typography variant="h5">Do zrobienia</Typography>
                <Chip label={data.todoCount} size="small" color="primary" />
              </Stack>
              <Button component={RouterLink} to="/zadania" variant="outlined" size="small" startIcon={<Icon icon="solar:add-circle-linear" />} sx={{ borderRadius: 8 }}>
                Dodaj zadanie
              </Button>
            </Stack>
            <Divider sx={{ my: 1.75 }} />
            <Stack divider={<Divider flexItem />}>
              {data.todoPreview.length ? (
                data.todoPreview.slice(0, 4).map((todo) => (
                  <Stack key={todo.id} direction="row" spacing={1.5} sx={{ py: 1.25, alignItems: 'center' }}>
                    <Box sx={{ width: 26, height: 26, border: '2px solid', flexShrink: 0, borderRadius: '50%', borderColor: 'text.secondary' }} />
                    <Typography sx={{ flex: 1, fontWeight: 600 }}>{todo.title}</Typography>
                    <Chip label={todo.scopeType === 'household' ? 'Dom' : 'Prywatne'} size="small" variant="soft" />
                    <Typography variant="body2" color="text.secondary">Dzisiaj</Typography>
                  </Stack>
                ))
              ) : (
                <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  Wszystko zrobione — dobra robota!
                </Typography>
              )}
            </Stack>
            <Button component={RouterLink} to="/zadania" endIcon={<Icon icon="solar:arrow-right-linear" />} sx={{ mt: 1.25, px: 0 }}>
              Zobacz wszystkie zadania
            </Button>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Box sx={(theme) => ({ ...dashboardCard(theme), p: { xs: 2.25, sm: 3 }, height: '100%' })}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h5">Dzisiaj w skrócie</Typography>
              <Icon icon="solar:menu-dots-bold" color="#8292AA" />
            </Stack>
            <Divider sx={{ my: 1.75 }} />
            <Stack divider={<Divider flexItem />}>
              {summaryRows.map((row) => (
                <Box
                  key={`${row.path}-${row.title}`}
                  component={RouterLink}
                  to={row.path}
                  sx={{ py: 1.25, gap: 1.4, display: 'flex', color: 'text.primary', alignItems: 'center', textDecoration: 'none', '&:hover': { color: row.accent } }}
                >
                  <Box sx={{ width: 42, height: 42, display: 'grid', flexShrink: 0, borderRadius: 1.35, placeItems: 'center', color: row.accent, bgcolor: `${row.accent}16` }}>
                    <Icon icon={row.icon} width={24} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" noWrap>{row.title}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{row.description}</Typography>
                  </Box>
                  <Icon icon="solar:alt-arrow-right-linear" width={19} />
                </Box>
              ))}
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Page>
  );
}
