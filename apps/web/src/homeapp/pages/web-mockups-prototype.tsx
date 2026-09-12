// PROTOTYPE: Three desktop directions for every HomeApp view, switchable with ?variant= and ?view=.
import type { ComponentProps } from 'react';

import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';

import {
  Box,
  Tab,
  Card,
  Chip,
  Tabs,
  Paper,
  Avatar,
  Button,
  Dialog,
  Divider,
  Tooltip,
  TextField,
  IconButton,
  Typography,
  DialogTitle,
  DialogActions,
  DialogContent,
  InputAdornment,
  LinearProgress,
  CircularProgress,
  Stack as MuiStack,
} from '@mui/material';

type VariantKey = 'A' | 'B' | 'C';
type ViewKey =
  | 'dashboard'
  | 'calendar'
  | 'finances'
  | 'shopping'
  | 'pantry'
  | 'meals'
  | 'tasks'
  | 'home'
  | 'settings';

const variants: { key: VariantKey; name: string }[] = [
  { key: 'A', name: 'Domowe centrum' },
  { key: 'B', name: 'Obszar roboczy' },
  { key: 'C', name: 'Konsola danych' },
];

const views: { key: ViewKey; label: string; description: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dzisiaj', description: 'Najważniejsze sprawy domu w jednym miejscu', icon: 'solar:home-smile-bold-duotone' },
  { key: 'calendar', label: 'Kalendarz', description: 'Wydarzenia, terminy i plan rodziny', icon: 'solar:calendar-bold-duotone' },
  { key: 'finances', label: 'Finanse', description: 'Budżet, wydatki, pożyczki i oszczędności', icon: 'solar:wallet-money-bold-duotone' },
  { key: 'shopping', label: 'Zakupy', description: 'Listy na dziś, jutro i później', icon: 'solar:cart-3-bold-duotone' },
  { key: 'pantry', label: 'Spiżarnia', description: 'Zapasy, kategorie i daty ważności', icon: 'solar:box-bold-duotone' },
  { key: 'meals', label: 'Posiłki', description: 'Tygodniowy plan i pomysły AI', icon: 'solar:chef-hat-bold-duotone' },
  { key: 'tasks', label: 'Zadania', description: 'Wspólne zadania i prywatne notatki', icon: 'solar:checklist-bold-duotone' },
  { key: 'home', label: 'Dom', description: 'Sprzątanie, koszty, dane i pliki', icon: 'solar:sofa-2-bold-duotone' },
  { key: 'settings', label: 'Ustawienia', description: 'Domownicy, uprawnienia i bezpieczeństwo', icon: 'solar:settings-bold-duotone' },
];

const palette = {
  green: '#00A76F',
  blue: '#078DEE',
  orange: '#FFAB00',
  red: '#FF5630',
  purple: '#8E33FF',
};

type PrototypeStackProps = ComponentProps<typeof MuiStack> & {
  alignItems?: string | Record<string, string>;
  justifyContent?: string | Record<string, string>;
};

// PROTOTYPE ONLY: MUI 9 moved system props off Stack, so map the two layout
// conveniences used by the mockups to sx instead of leaking DOM attributes.
function Stack({ alignItems, justifyContent, sx, ...props }: PrototypeStackProps) {
  return (
    <MuiStack
      {...props}
      sx={{
        ...(sx as Record<string, unknown>),
        alignItems,
        justifyContent,
      }}
    />
  );
}

export function WebMockupsPrototype() {
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const variant = variants.some((item) => item.key === params.get('variant'))
    ? (params.get('variant') as VariantKey)
    : 'A';
  const view = views.some((item) => item.key === params.get('view'))
    ? (params.get('view') as ViewKey)
    : 'dashboard';
  const currentView = views.find((item) => item.key === view)!;

  const updateParam = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(name, value);
    setParams(next, { replace: true });
  };

  const cycleVariant = (direction: -1 | 1) => {
    const currentIndex = variants.findIndex((item) => item.key === variant);
    const nextIndex = (currentIndex + direction + variants.length) % variants.length;
    updateParam('variant', variants[nextIndex].key);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
      if (event.key === 'ArrowLeft') cycleVariant(-1);
      if (event.key === 'ArrowRight') cycleVariant(1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F4F6F8', color: 'text.primary' }}>
      <PrototypeShell
        variant={variant}
        view={view}
        currentView={currentView}
        onViewChange={(nextView) => updateParam('view', nextView)}
        onAdd={() => setFormOpen(true)}
      />

      {import.meta.env.DEV && (
        <Paper
          elevation={24}
          sx={{
            position: 'fixed',
            zIndex: 1500,
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1,
            py: 0.75,
            borderRadius: 99,
            bgcolor: '#161C24',
            color: 'common.white',
            boxShadow: '0 16px 48px rgba(0,0,0,.28)',
          }}
        >
          <IconButton size="small" color="inherit" onClick={() => cycleVariant(-1)} aria-label="Poprzedni wariant">
            <Icon icon="solar:alt-arrow-left-linear" />
          </IconButton>
          <Stack alignItems="center" sx={{ minWidth: { xs: 150, sm: 210 } }}>
            <Typography variant="caption" sx={{ color: 'grey.500', lineHeight: 1 }}>MAKIETA • STRZAŁKI ← →</Typography>
            <Typography variant="subtitle2">{variant} — {variants.find((item) => item.key === variant)?.name}</Typography>
          </Stack>
          <IconButton size="small" color="inherit" onClick={() => cycleVariant(1)} aria-label="Następny wariant">
            <Icon icon="solar:alt-arrow-right-linear" />
          </IconButton>
        </Paper>
      )}

      <PrototypeFormDialog view={view} open={formOpen} onClose={() => setFormOpen(false)} />
    </Box>
  );
}

function PrototypeShell({
  variant,
  view,
  currentView,
  onViewChange,
  onAdd,
}: {
  variant: VariantKey;
  view: ViewKey;
  currentView: (typeof views)[number];
  onViewChange: (view: ViewKey) => void;
  onAdd: () => void;
}) {
  if (variant === 'C') {
    return (
      <Box>
        <Paper square elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Box sx={{ maxWidth: 1600, mx: 'auto', px: { xs: 2, md: 4 } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 72 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <BrandMark />
                <Divider orientation="vertical" flexItem />
                <Chip size="small" color="warning" label="PROTOTYP" />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" placeholder="Szukaj w HomeApp…" sx={{ width: 260, display: { xs: 'none', md: 'block' } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Icon icon="solar:magnifer-linear" /></InputAdornment> } }} />
                <IconButton aria-label="Powiadomienia"><Icon icon="solar:bell-bing-bold-duotone" /></IconButton>
                <Avatar src="/assets/images/mock/avatar/avatar-4.webp" sx={{ width: 36, height: 36 }} />
              </Stack>
            </Stack>
            <Tabs value={view} onChange={(_, next: ViewKey) => onViewChange(next)} variant="scrollable" scrollButtons={false}>
              {views.map((item) => <Tab key={item.key} value={item.key} icon={<Icon icon={item.icon} />} iconPosition="start" label={item.label} />)}
            </Tabs>
          </Box>
        </Paper>
        <Box sx={{ maxWidth: 1600, mx: 'auto', px: { xs: 2, md: 4 }, py: 4, pb: 12 }}>
          <ScreenHeader currentView={currentView} onAdd={onAdd} compact />
          <ScreenContent view={view} variant={variant} />
        </Box>
      </Box>
    );
  }

  const workspace = variant === 'B';
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: workspace ? '88px minmax(0, 1fr) 320px' : '280px minmax(0, 1fr)' }, minHeight: '100vh' }}>
      <Paper
        square
        elevation={0}
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          borderRight: '1px dashed',
          borderColor: 'divider',
          px: workspace ? 1 : 2,
          py: 2.5,
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 3 }}>
          <BrandMark compact={workspace} />
        </Stack>
        <Stack spacing={0.75}>
          {views.map((item) => {
            const selected = item.key === view;
            const button = (
              <Button
                key={item.key}
                color={selected ? 'primary' : 'inherit'}
                onClick={() => onViewChange(item.key)}
                startIcon={workspace ? undefined : <Icon width={22} icon={item.icon} />}
                sx={{
                  minWidth: 0,
                  justifyContent: workspace ? 'center' : 'flex-start',
                  px: workspace ? 0 : 1.5,
                  py: 1.25,
                  bgcolor: selected ? 'primary.lighter' : 'transparent',
                  color: selected ? 'primary.dark' : 'text.secondary',
                  borderRadius: 1.5,
                }}
              >
                {workspace ? <Icon width={24} icon={item.icon} /> : item.label}
              </Button>
            );
            return workspace ? <Tooltip key={item.key} title={item.label} placement="right">{button}</Tooltip> : button;
          })}
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        {!workspace && (
          <Card sx={{ p: 2, bgcolor: 'primary.lighter', boxShadow: 'none' }}>
            <Typography variant="subtitle2">Porabki Home</Typography>
            <Typography variant="caption" color="text.secondary">2 domowników • wszystko zsynchronizowane</Typography>
          </Card>
        )}
        <Avatar src="/assets/images/mock/avatar/avatar-4.webp" sx={{ alignSelf: 'center', mt: 2 }} />
      </Paper>

      <Box component="main" sx={{ minWidth: 0, px: { xs: 2, md: 4 }, py: 3.5, pb: 12 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Chip size="small" color="warning" label="PROTOTYP • TYLKO PODGLĄD" />
          <Stack direction="row" spacing={1}>
            <IconButton aria-label="Szukaj"><Icon icon="solar:magnifer-linear" /></IconButton>
            <IconButton aria-label="Powiadomienia"><Icon icon="solar:bell-bing-bold-duotone" /></IconButton>
          </Stack>
        </Stack>
        <ScreenHeader currentView={currentView} onAdd={onAdd} />
        <ScreenContent view={view} variant={variant} />
      </Box>

      {workspace && <WorkspaceAside view={view} onAdd={onAdd} />}
    </Box>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box sx={{ width: 38, height: 38, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'common.white' }}>
        <Icon width={25} icon="solar:home-2-bold-duotone" />
      </Box>
      {!compact && <Typography variant="h5">HomeApp</Typography>}
    </Stack>
  );
}

function ScreenHeader({ currentView, onAdd, compact = false }: { currentView: (typeof views)[number]; onAdd: () => void; compact?: boolean }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: compact ? 2.5 : 4 }}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant={compact ? 'h4' : 'h3'}>{currentView.label}</Typography>
          <Chip size="small" variant="soft" color="primary" label="Porabki Home" />
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>{currentView.description}</Typography>
      </Box>
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" startIcon={<Icon icon="solar:filter-bold-duotone" />}>Filtry</Button>
        <Button variant="contained" onClick={onAdd} startIcon={<Icon icon="mingcute:add-line" />}>Dodaj</Button>
      </Stack>
    </Stack>
  );
}

function WorkspaceAside({ view, onAdd }: { view: ViewKey; onAdd: () => void }) {
  return (
    <Paper square elevation={0} sx={{ display: { xs: 'none', md: 'block' }, borderLeft: '1px dashed', borderColor: 'divider', p: 2.5, position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}>
      <Typography variant="overline" color="text.secondary">KONTEKST WIDOKU</Typography>
      <Typography variant="h6" sx={{ mt: 0.5, mb: 2 }}>Na dziś</Typography>
      <Stack spacing={1.25}>
        <AsideItem icon="solar:calendar-mark-bold-duotone" color={palette.blue} title="Dentysta — Bartek" caption="16:30 • Stacja Zakole" />
        <AsideItem icon="solar:cart-large-2-bold-duotone" color={palette.green} title="3 produkty" caption="Lista zakupów na dziś" />
        <AsideItem icon="solar:danger-triangle-bold-duotone" color={palette.red} title="1 termin minął" caption="Rury w zlewie" />
      </Stack>
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Szybkie dodawanie</Typography>
      <Button fullWidth variant="contained" onClick={onAdd} startIcon={<Icon icon="mingcute:add-line" />}>Dodaj do: {views.find((item) => item.key === view)?.label}</Button>
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2">Domownicy</Typography>
      <Stack direction="row" spacing={-0.75} sx={{ mt: 1.5 }}>
        <Avatar src="/assets/images/mock/avatar/avatar-4.webp" />
        <Avatar src="/assets/images/mock/avatar/avatar-7.webp" />
        <Avatar sx={{ bgcolor: 'grey.300', color: 'text.secondary' }}>+1</Avatar>
      </Stack>
      <Card sx={{ mt: 3, p: 2, boxShadow: 'none', bgcolor: 'grey.100' }}>
        <Typography variant="subtitle2">Wskazówka</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>Panel boczny daje szybki kontekst bez opuszczania aktualnego obszaru pracy.</Typography>
      </Card>
    </Paper>
  );
}

function AsideItem({ icon, color, title, caption }: { icon: string; color: string; title: string; caption: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box sx={{ width: 40, height: 40, borderRadius: 1.25, display: 'grid', placeItems: 'center', color, bgcolor: `${color}14` }}><Icon width={22} icon={icon} /></Box>
      <Box sx={{ minWidth: 0 }}><Typography variant="subtitle2" noWrap>{title}</Typography><Typography variant="caption" color="text.secondary">{caption}</Typography></Box>
    </Stack>
  );
}

function ScreenContent({ view, variant }: { view: ViewKey; variant: VariantKey }) {
  switch (view) {
    case 'calendar': return <CalendarMockup variant={variant} />;
    case 'finances': return <FinanceMockup variant={variant} />;
    case 'shopping': return <ShoppingMockup variant={variant} />;
    case 'pantry': return <PantryMockup variant={variant} />;
    case 'meals': return <MealsMockup variant={variant} />;
    case 'tasks': return <TasksMockup variant={variant} />;
    case 'home': return <HomeMockup variant={variant} />;
    case 'settings': return <SettingsMockup variant={variant} />;
    default: return <DashboardMockup variant={variant} />;
  }
}

function DashboardMockup({ variant }: { variant: VariantKey }) {
  const metricGrid = variant === 'C' ? 'repeat(4, 1fr)' : { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' };
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gridTemplateColumns: metricGrid, gap: 2 }}>
        <MetricCard icon="solar:calendar-mark-bold-duotone" color={palette.blue} label="Wydarzenia" value="2 dzisiaj" note="Najbliższe o 16:30" />
        <MetricCard icon="solar:checklist-minimalistic-bold-duotone" color={palette.purple} label="Do zrobienia" value="5 zadań" note="2 pilne" />
        <MetricCard icon="solar:cart-large-2-bold-duotone" color={palette.green} label="Zakupy" value="3 produkty" note="Lista na dziś" />
        <MetricCard icon="solar:wallet-money-bold-duotone" color={palette.orange} label="Budżet" value="241,94 zł" note="Pozostało w miesiącu" />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: variant === 'B' ? '1fr' : { xs: '1fr', lg: '1.65fr 1fr' }, gap: 3 }}>
        <Card sx={{ p: 3, minHeight: 280, color: 'common.white', background: 'linear-gradient(135deg, #183028 0%, #00A76F 120%)', position: 'relative', overflow: 'hidden' }}>
          <Typography variant="overline" sx={{ color: 'primary.lighter' }}>PLAN DNIA</Typography>
          <Typography variant="h3" sx={{ maxWidth: 480, mt: 1 }}>Wspólne mieszkanie</Typography>
          <Typography variant="h6" sx={{ mt: 2 }}>23 września • cały dzień</Typography>
          <Typography sx={{ opacity: 0.72, mt: 0.5 }}>Najbliższe wydarzenie rodzinne</Typography>
          <Button variant="contained" color="inherit" sx={{ color: 'grey.900', mt: 4 }}>Zobacz szczegóły</Button>
          <Icon icon="solar:calendar-bold-duotone" width={190} style={{ position: 'absolute', right: 28, bottom: -25, opacity: 0.16 }} />
        </Card>
        <SectionCard title="Realizacja miesiąca" action="Szczegóły">
          <Stack direction="row" spacing={3} alignItems="center">
            <ProgressRing value={76} color={palette.green} />
            <Stack spacing={1.5} sx={{ flex: 1 }}>
              <Legend color={palette.green} label="Zadania" value="14 / 18" />
              <Legend color={palette.blue} label="Plan posiłków" value="12 / 21" />
              <Legend color={palette.orange} label="Budżet" value="96%" />
            </Stack>
          </Stack>
        </SectionCard>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: variant === 'C' ? '2fr 1fr 1fr' : '1.4fr 1fr' }, gap: 3 }}>
        <SectionCard title="Do zrobienia" action="Wszystkie zadania">
          <SimpleRows rows={[
            ['Sprawdź maila', 'Dzisiaj, 10:00', 'Pilne'],
            ['Kupić kalosze dla Bartka', 'Dzisiaj', 'Dom'],
            ['City break — rezerwacja', 'Jutro', 'Plan'],
          ]} />
        </SectionCard>
        <SectionCard title="Dzisiejsze posiłki" action="Plan tygodnia">
          <SimpleRows rows={[
            ['Owsianka kokosowa', 'Śniadanie', 'Gotowe'],
            ['Pierogi', 'Obiad', '14:30'],
            ['Śledź z pieczywem', 'Kolacja', '19:00'],
          ]} />
        </SectionCard>
        {variant === 'C' && <SectionCard title="Aktywność"><ActivityList /></SectionCard>}
      </Box>
    </Stack>
  );
}

function CalendarMockup({ variant }: { variant: VariantKey }) {
  const days = Array.from({ length: 35 }, (_, index) => index < 2 ? 29 + index : index - 1);
  return (
    <Stack spacing={3}>
      <Card sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
          <Tabs value={variant === 'B' ? 'week' : 'month'}><Tab value="month" label="Miesiąc" /><Tab value="week" label="Tydzień" /><Tab value="agenda" label="Agenda" /></Tabs>
          <Stack direction="row" alignItems="center" spacing={1}><IconButton aria-label="Poprzedni miesiąc"><Icon icon="solar:alt-arrow-left-linear" /></IconButton><Typography variant="h6">Wrzesień 2026</Typography><IconButton aria-label="Następny miesiąc"><Icon icon="solar:alt-arrow-right-linear" /></IconButton></Stack>
        </Stack>
      </Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: variant === 'C' ? 'minmax(650px, 1fr) 360px' : { xs: '1fr', xl: 'minmax(560px, 1.4fr) minmax(300px, .6fr)' }, gap: 3, overflowX: 'auto' }}>
        <Card sx={{ p: 2.5, minWidth: 620 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
            {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'].map((day) => <Box key={day} sx={{ p: 1.25, bgcolor: 'grey.100', borderBottom: '1px solid', borderColor: 'divider' }}><Typography variant="subtitle2">{day}</Typography></Box>)}
            {days.map((day, index) => (
              <Box key={`${day}-${index}`} sx={{ minHeight: 92, p: 1, borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'divider', bgcolor: index < 2 || index > 31 ? 'grey.50' : 'background.paper' }}>
                <Typography variant="subtitle2" color={index < 2 ? 'text.disabled' : 'text.primary'}>{day}</Typography>
                {[2, 8, 10, 16, 23, 28].includes(day) && index > 1 && <Box sx={{ mt: 1, px: 0.75, py: 0.4, borderRadius: 0.75, bgcolor: day % 2 ? 'warning.lighter' : 'primary.lighter', color: day % 2 ? 'warning.dark' : 'primary.dark' }}><Typography variant="caption" noWrap>{day === 23 ? 'Wspólne mieszkanie' : 'Termin rodzinny'}</Typography></Box>}
              </Box>
            ))}
          </Box>
        </Card>
        <SectionCard title="Środa, 23 września" action="Pełna agenda">
          <Stack spacing={1.5}>
            <EventCard time="Cały dzień" title="Wspólne mieszkanie" color={palette.green} />
            <EventCard time="16:30" title="Dentysta — Bartek" color={palette.blue} />
            <EventCard time="18:00" title="Legimi — biblioteka" color={palette.orange} />
            <Button fullWidth variant="outlined" startIcon={<Icon icon="mingcute:add-line" />}>Dodaj wydarzenie</Button>
          </Stack>
        </SectionCard>
      </Box>
    </Stack>
  );
}

function FinanceMockup({ variant }: { variant: VariantKey }) {
  const categories = [
    ['Koszty stałe', '3 584,06 zł', '3 825 zł', 94, palette.orange],
    ['Koszty dynamiczne', '500 zł', '501 zł', 100, palette.green],
    ['Pozostałe', '1 662 zł', '1 662 zł', 100, palette.blue],
  ] as const;
  return (
    <Stack spacing={3}>
      <Stack direction={variant === 'B' ? 'column' : { xs: 'column', lg: 'row' }} spacing={2}>
        <Card sx={{ flex: 1, p: 3, background: 'linear-gradient(135deg, #1B2530, #28323D)', color: 'common.white' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box><Typography sx={{ opacity: 0.7 }}>Do dyspozycji</Typography><Typography variant="h3" sx={{ mt: 1 }}>241,94 zł</Typography><Typography variant="body2" sx={{ color: 'primary.light', mt: 1 }}>+549 zł względem planu dochodów</Typography></Box>
            <ProgressRing value={96} color={palette.orange} dark />
            <Box sx={{ textAlign: 'right' }}><Typography sx={{ opacity: 0.7 }}>Wydano</Typography><Typography variant="h4" sx={{ mt: 1 }}>5 746,06 zł</Typography></Box>
          </Stack>
        </Card>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, minWidth: variant === 'B' ? 0 : { lg: 360 } }}>
          <MetricCard icon="solar:bill-list-bold-duotone" color={palette.red} label="Pożyczki" value="2 aktywne" note="1 płatność w tym miesiącu" />
          <MetricCard icon="solar:piggy-bank-bold-duotone" color={palette.purple} label="Oszczędności" value="18 400 zł" note="3 cele" />
        </Box>
      </Stack>
      <Card sx={{ p: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Tabs value="budget"><Tab value="budget" label="Budżet" /><Tab value="debts" label="Pożyczki" /><Tab value="savings" label="Oszczędności" /></Tabs><Stack direction="row" spacing={1} alignItems="center"><IconButton aria-label="Poprzedni miesiąc"><Icon icon="solar:alt-arrow-left-linear" /></IconButton><Typography variant="subtitle1">Wrzesień 2026</Typography><IconButton aria-label="Następny miesiąc"><Icon icon="solar:alt-arrow-right-linear" /></IconButton></Stack></Stack></Card>
      {variant === 'A' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
          {categories.map(([name, spent, budget, progress, color]) => <BudgetCategory key={name} name={name} spent={spent} budget={budget} progress={progress} color={color} />)}
        </Box>
      ) : (
        <SectionCard title="Realizacja budżetu" action="Eksportuj">
          <Box sx={{ overflowX: 'auto' }}><Box sx={{ minWidth: 680 }}>
            <TableHeader columns={['Pozycja', 'Budżet', 'Wydano', 'Pozostało', 'Postęp']} />
            {[
              ['Jedzenie', '950 zł', '812,17 zł', '137,83 zł', '85%'],
              ['Fryzjer', '50 zł', '30 zł', '20 zł', '60%'],
              ['Kieszonkowe D', '500 zł', '409,02 zł', '90,98 zł', '82%'],
              ['Internet', '85 zł', '85,05 zł', '-0,05 zł', '100%'],
              ['Gaz', '300 zł', '300,83 zł', '-0,83 zł', '100%'],
              ['Paliwo', '800 zł', '800 zł', '0 zł', '100%'],
            ].map((row) => <TableRow key={row[0]} columns={row} danger={row[3].startsWith('-')} />)}
          </Box></Box>
        </SectionCard>
      )}
    </Stack>
  );
}

function ShoppingMockup({ variant }: { variant: VariantKey }) {
  const groups = [
    { name: 'Owoce, warzywa i zioła', color: palette.green, items: ['Marakuja', 'Pomidory', 'Bazylia'] },
    { name: 'Inne', color: palette.blue, items: ['Nerkowce', 'Szynka basiuniowa'] },
    { name: 'Nabiał', color: palette.purple, items: ['Mleko', 'Jogurt naturalny'] },
  ];
  return (
    <Stack spacing={3}>
      <Card sx={{ p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between"><Tabs value="today"><Tab value="today" label="Dzisiaj · 7" /><Tab value="tomorrow" label="Jutro · 3" /><Tab value="later" label="Na później · 5" /></Tabs><Stack direction="row" spacing={1}><Button variant="outlined">Przenieś niekupione</Button><Button color="error">Wyczyść listę</Button></Stack></Stack></Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: variant === 'B' ? '1fr' : { xs: '1fr', xl: '1fr 310px' }, gap: 3 }}>
        <Stack spacing={2}>
          {groups.map((group) => (
            <Card key={group.name} sx={{ overflow: 'hidden' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 1.75, bgcolor: `${group.color}0D` }}><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: group.color }} /><Typography variant="subtitle1">{group.name}</Typography></Stack><Chip size="small" label={group.items.length} /></Stack>
              {group.items.map((item, index) => <ListLine key={item} title={item} subtitle={index === 0 ? 'Dodane przez Marzenę' : 'Lista wspólna'} action="1 szt." />)}
            </Card>
          ))}
        </Stack>
        {variant !== 'B' && <SectionCard title="Postęp zakupów"><ProgressRing value={36} color={palette.green} /><Divider sx={{ my: 2 }} /><Legend color={palette.green} label="Kupione" value="4" /><Legend color={palette.blue} label="Pozostało" value="7" /><Button fullWidth variant="outlined" sx={{ mt: 2 }} startIcon={<Icon icon="solar:magic-stick-3-bold-duotone" />}>Dodaj listę z AI</Button></SectionCard>}
      </Box>
    </Stack>
  );
}

function PantryMockup({ variant }: { variant: VariantKey }) {
  const products = [
    ['Makaron', 'Artykuły suche', '2 op.', '08.09.2026', 'Ważne 12 mies.'],
    ['Mleko', 'Nabiał', '3 szt.', '12.09.2026', 'Za 4 dni'],
    ['Pomidory krojone', 'Konserwy', '5 puszek', '22.01.2027', 'Ważne'],
    ['Mrożony szpinak', 'Mrożonki', '1 op.', '03.11.2026', 'Ważne'],
    ['Sok pomarańczowy', 'Napoje', '2 l', '15.09.2026', 'Za 7 dni'],
  ];
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <MetricCard icon="solar:box-bold-duotone" color={palette.blue} label="W spiżarni" value="13 produktów" note="7 kategorii" />
        <MetricCard icon="solar:alarm-bold-duotone" color={palette.orange} label="Krótki termin" value="2 produkty" note="W ciągu 7 dni" />
        <MetricCard icon="solar:sort-by-time-bold-duotone" color={palette.green} label="Ostatnio dodane" value="Makaron" note="Dzisiaj, 08:52" />
      </Box>
      <SectionCard title="Zapasy" action="Pokaż wszystkie">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}><TextField fullWidth size="small" placeholder="Szukaj produktu…" slotProps={{ input: { startAdornment: <InputAdornment position="start"><Icon icon="solar:magnifer-linear" /></InputAdornment> } }} /><TextField size="small" select slotProps={{ select: { native: true } }} sx={{ minWidth: 190 }}><option>Wszystkie kategorie</option><option>Nabiał</option></TextField></Stack>
        {variant === 'A' ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>{products.map((row) => <Card key={row[0]} variant="outlined" sx={{ p: 2, boxShadow: 'none' }}><Stack direction="row" spacing={1.5} alignItems="center"><Avatar variant="rounded" sx={{ bgcolor: 'primary.lighter', color: 'primary.dark' }}><Icon icon="solar:box-bold-duotone" /></Avatar><Box sx={{ flex: 1 }}><Typography variant="subtitle2">{row[0]}</Typography><Typography variant="caption" color="text.secondary">{row[1]} • {row[2]}</Typography></Box><Chip size="small" color={row[4].startsWith('Za') ? 'warning' : 'default'} label={row[4]} /></Stack></Card>)}</Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}><Box sx={{ minWidth: 680 }}><TableHeader columns={['Produkt', 'Kategoria', 'Ilość', 'Ważne do', 'Status']} />{products.map((row) => <TableRow key={row[0]} columns={row} />)}</Box></Box>
        )}
      </SectionCard>
    </Stack>
  );
}

function MealsMockup({ variant }: { variant: VariantKey }) {
  const days = [
    ['Poniedziałek', 'Owsianka kokosowa', 'Pierogi', 'Śledź z pieczywem'],
    ['Wtorek', 'Kanapki z pastą', 'Tik tok gnocchi', '—'],
    ['Środa', 'Smoothie szpinakowe', 'Kurczak po hawajsku', '—'],
    ['Czwartek', 'Bruschetta burrata', 'Racuchy na wynos', 'Carbonara'],
    ['Piątek', 'Tortille', 'Zupa pomidorowa', 'Sałatka'],
  ];
  return (
    <Stack spacing={3}>
      <Card sx={{ p: 2.5 }}><Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}><Stack direction="row" spacing={1.5} alignItems="center"><Avatar variant="rounded" sx={{ bgcolor: 'primary.lighter', color: 'primary.dark' }}><Icon icon="solar:calendar-bold-duotone" /></Avatar><Box><Typography variant="h6">Plan posiłków</Typography><Typography color="text.secondary">Tydzień 15.06–21.06 • 12 z 21 posiłków</Typography></Box></Stack><Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<Icon icon="solar:magic-stick-3-bold-duotone" />}>Zaplanuj z AI</Button><Button variant="contained">Zmień tydzień</Button></Stack></Stack></Card>
      {variant === 'C' ? (
        <SectionCard title="Plan tygodnia" action="Historia planów"><Box sx={{ overflowX: 'auto' }}><Box sx={{ minWidth: 760 }}><TableHeader columns={['Dzień', 'Śniadanie', 'Obiad', 'Kolacja']} />{days.map((row) => <TableRow key={row[0]} columns={row} />)}</Box></Box></SectionCard>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: variant === 'B' ? '1fr' : 'repeat(2, 1fr)' }, gap: 2 }}>
          {days.map((day, dayIndex) => <Card key={day[0]} sx={{ p: 2.5 }}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="h6">{day[0]}</Typography><Typography variant="caption" color="text.secondary">{15 + dayIndex}.06</Typography></Box><Chip color="primary" variant="soft" label={`${day.filter((meal) => meal !== '—').length - 1}/3`} /></Stack><Divider sx={{ my: 2 }} /><Stack spacing={1}>{day.slice(1).map((meal, index) => <Stack key={`${meal}-${index}`} direction="row" spacing={1.25} alignItems="center"><Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: meal === '—' ? 'grey.100' : 'primary.lighter', color: meal === '—' ? 'text.disabled' : 'primary.dark' }}>{index + 1}</Avatar><Typography variant="body2" color={meal === '—' ? 'text.disabled' : 'text.primary'}>{meal === '—' ? 'Nie zaplanowano' : meal}</Typography></Stack>)}</Stack></Card>)}
        </Box>
      )}
    </Stack>
  );
}

function TasksMockup({ variant }: { variant: VariantKey }) {
  const tasks = [['Sprawdź maila', 'Dzisiaj, 10:00', 'Pilne'], ['Kupić kalosze dla Bartka', 'Dzisiaj', 'Dom'], ['City break — rezerwacja', 'Jutro', 'Plan'], ['Finanse rozliczone', '30.09', 'Finanse']];
  const notes = [['To do', 'Piżamy, zdjęcia, kalosze', '30.08, 09:20'], ['Okulary', '450 zł do dzieci, 100 zł', '29.08, 11:59'], ['Tankowanie', '3594 km, 4220 km, 4865 km', '22.07, 18:20']];
  return (
    <Stack spacing={3}>
      <Card sx={{ p: 2 }}><Tabs value={variant === 'B' ? 'notes' : 'tasks'}><Tab value="tasks" label="Do zrobienia" icon={<Icon icon="solar:checklist-bold-duotone" />} iconPosition="start" /><Tab value="notes" label="Notatki prywatne" icon={<Icon icon="solar:notebook-bold-duotone" />} iconPosition="start" /></Tabs></Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: variant === 'C' ? '1.3fr .7fr' : { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        <SectionCard title="Do zrobienia" action="Sortuj"><SimpleRows rows={tasks} checkable /><Button variant="outlined" fullWidth sx={{ mt: 2 }} startIcon={<Icon icon="mingcute:add-line" />}>Dodaj zadanie</Button></SectionCard>
        <SectionCard title="Notatki prywatne" action="Wszystkie"><Stack spacing={1.5}>{notes.map(([title, body, date]) => <Card key={title} variant="outlined" sx={{ p: 2, boxShadow: 'none' }}><Typography variant="subtitle1">{title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{body}</Typography><Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>{date}</Typography></Card>)}</Stack></SectionCard>
      </Box>
    </Stack>
  );
}

function HomeMockup({ variant }: { variant: VariantKey }) {
  return (
    <Stack spacing={3}>
      <Card sx={{ px: 2, pt: 1 }}><Tabs value="cleaning" variant="scrollable"><Tab value="cleaning" label="Sprzątanie" icon={<Icon icon="solar:broom-bold-duotone" />} iconPosition="start" /><Tab value="costs" label="Koszty roczne" icon={<Icon icon="solar:chart-2-bold-duotone" />} iconPosition="start" /><Tab value="data" label="Ważne dane" icon={<Icon icon="solar:database-bold-duotone" />} iconPosition="start" /><Tab value="files" label="Pliki" icon={<Icon icon="solar:folder-bold-duotone" />} iconPosition="start" /></Tabs></Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: variant === 'B' ? '1fr' : { xs: '1fr', xl: '1fr 1fr' }, gap: 3 }}>
        <SectionCard title="Sprzątanie" action="Dodaj zadanie">
          <Stack spacing={1.5}>
            <MaintenanceCard title="Rury w zlewie" location="Dolna łazienka" date="4 września • co 90 dni" overdue />
            <MaintenanceCard title="Łazienka — odpływ i płukanie" location="Łazienka" date="8 października • co 30 dni" />
          </Stack>
        </SectionCard>
        <SectionCard title="Koszty roczne" action="Historia 2026">
          <SimpleRows rows={[["Cookidoo", '24.01.2027', '200 zł'], ['Klima', '30.06.2027', '240 zł'], ['Ubezpieczenie domu', '12.08.2027', '780 zł']]} />
        </SectionCard>
        <SectionCard title="Ważne dane" action="Zarządzaj"><SimpleRows rows={[["Wi-Fi goście", 'Porabki_Guest', 'Dom'], ['Numer polisy', 'POL/2026/44210', 'Ubezpieczenie'], ['Kod alarmu', '••••••', 'Prywatne']]} /></SectionCard>
        <SectionCard title="Ostatnie pliki" action="Wszystkie pliki"><SimpleRows rows={[["1000036121.jpg", 'Barti opaska', 'JPG'], ['1000035602.jpg', 'Barti buty', 'JPG'], ['11065.jpg', 'Maanta żagiel', 'JPG']]} /></SectionCard>
      </Box>
    </Stack>
  );
}

function SettingsMockup({ variant }: { variant: VariantKey }) {
  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gridTemplateColumns: variant === 'B' ? '1fr' : { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        <SectionCard title="Ustawienia domu" action="Zapisano">
          <Stack spacing={2}><TextField label="Nazwa domu" defaultValue="Porabki Home" /><Stack direction="row" spacing={2}><TextField fullWidth label="Waluta" select slotProps={{ select: { native: true } }} defaultValue="PLN"><option value="PLN">PLN zł</option><option value="EUR">EUR €</option></TextField><TextField fullWidth label="Posiłków dziennie" defaultValue="3" /></Stack><Button variant="contained">Zapisz ustawienia</Button></Stack>
        </SectionCard>
        <SectionCard title="Członkowie i zaproszenia" action="Zaproś osobę">
          <Stack spacing={1.5}><MemberRow name="Dariusz Mączałowski" role="Właściciel" image="/assets/images/mock/avatar/avatar-4.webp" /><MemberRow name="Marzena" role="Domownik" image="/assets/images/mock/avatar/avatar-7.webp" /><Button variant="outlined" startIcon={<Icon icon="solar:user-plus-bold-duotone" />}>Wyślij zaproszenie</Button></Stack>
        </SectionCard>
        <SectionCard title="Uprawnienia domowników" action="Edytuj matrycę">
          <Box sx={{ overflowX: 'auto' }}><Box sx={{ minWidth: 560 }}><TableHeader columns={['Moduł', 'Dariusz', 'Marzena', 'Gość']} />{[['Finanse', 'Pełny', 'Odczyt', 'Brak'], ['Kalendarz', 'Pełny', 'Edycja', 'Odczyt'], ['Zakupy', 'Pełny', 'Edycja', 'Edycja'], ['Pliki', 'Pełny', 'Odczyt', 'Brak']].map((row) => <TableRow key={row[0]} columns={row} />)}</Box></Box>
        </SectionCard>
        <Stack spacing={3}>
          <SectionCard title="Szyfrowanie danych" action="Aktywne"><Typography color="text.secondary">Kalendarz, finanse, notatki i ważne dane są chronione szyfrowaniem E2EE.</Typography><Stack direction="row" spacing={1} sx={{ mt: 2 }}><Chip color="success" label="Klucz odblokowany" /><Chip label="4 moduły" /></Stack></SectionCard>
          <SectionCard title="Powiadomienia"><Stack spacing={1.25}>{['Wydarzenia kalendarza', 'Zadania domowe', 'Kończące się produkty', 'Przekroczenia budżetu'].map((label, index) => <Stack key={label} direction="row" justifyContent="space-between" alignItems="center"><Typography variant="body2">{label}</Typography><Chip size="small" color={index === 3 ? 'default' : 'success'} label={index === 3 ? 'Wyłączone' : 'Włączone'} /></Stack>)}</Stack></SectionCard>
        </Stack>
      </Box>
    </Stack>
  );
}

function MetricCard({ icon, color, label, value, note }: { icon: string; color: string; label: string; value: string; note: string }) {
  return <Card sx={{ p: 2.5 }}><Stack direction="row" spacing={2} alignItems="center"><Avatar variant="rounded" sx={{ width: 52, height: 52, bgcolor: `${color}16`, color }}><Icon width={28} icon={icon} /></Avatar><Box><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h6">{value}</Typography><Typography variant="caption" color="text.disabled">{note}</Typography></Box></Stack></Card>;
}

function SectionCard({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return <Card sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}><Typography variant="h6">{title}</Typography>{action && <Button size="small" color="inherit">{action}</Button>}</Stack>{children}</Card>;
}

function SimpleRows({ rows, checkable = false }: { rows: string[][]; checkable?: boolean }) {
  return <Stack divider={<Divider flexItem />}>{rows.map(([title, subtitle, tag]) => <Stack key={title} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.4 }}>
    {checkable ? <Box sx={{ width: 26, height: 26, border: '2px solid', borderColor: 'grey.400', borderRadius: '50%' }} /> : <Box sx={{ width: 8, height: 8, bgcolor: 'primary.main', borderRadius: '50%' }} />}
    <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="subtitle2" noWrap>{title}</Typography><Typography variant="caption" color="text.secondary">{subtitle}</Typography></Box><Chip size="small" variant="soft" label={tag} />
  </Stack>)}</Stack>;
}

function ListLine({ title, subtitle, action }: { title: string; subtitle: string; action: string }) {
  return <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, py: 1.6, borderTop: '1px solid', borderColor: 'divider' }}><Box sx={{ width: 25, height: 25, borderRadius: '50%', border: '2px solid', borderColor: 'grey.400' }} /><Box sx={{ flex: 1 }}><Typography variant="subtitle2">{title}</Typography><Typography variant="caption" color="text.secondary">{subtitle}</Typography></Box><Typography variant="body2" color="text.secondary">{action}</Typography><Icon icon="solar:menu-dots-bold" /></Stack>;
}

function ProgressRing({ value, color, dark = false }: { value: number; color: string; dark?: boolean }) {
  return <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}><CircularProgress variant="determinate" value={100} size={104} thickness={4} sx={{ color: dark ? 'rgba(255,255,255,.12)' : 'grey.200' }} /><CircularProgress variant="determinate" value={value} size={104} thickness={4} sx={{ color, position: 'absolute', left: 0 }} /><Stack sx={{ position: 'absolute', inset: 0 }} alignItems="center" justifyContent="center"><Typography variant="h6">{value}%</Typography><Typography variant="caption" sx={{ opacity: 0.65 }}>wykorzystane</Typography></Stack></Box>;
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return <Stack direction="row" alignItems="center" spacing={1}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} /><Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{label}</Typography><Typography variant="subtitle2">{value}</Typography></Stack>;
}

function ActivityList() {
  return <Stack spacing={2}><AsideItem icon="solar:user-check-bold-duotone" color={palette.green} title="Marzena zakończyła zadanie" caption="12 minut temu" /><AsideItem icon="solar:cart-plus-bold-duotone" color={palette.blue} title="Dodano 3 produkty" caption="43 minuty temu" /><AsideItem icon="solar:wallet-money-bold-duotone" color={palette.orange} title="Wydatek 89,20 zł" caption="2 godziny temu" /></Stack>;
}

function EventCard({ time, title, color }: { time: string; title: string; color: string }) {
  return <Card variant="outlined" sx={{ p: 1.75, boxShadow: 'none', borderLeft: `4px solid ${color}` }}><Typography variant="caption" color="text.secondary">{time}</Typography><Typography variant="subtitle2">{title}</Typography></Card>;
}

function BudgetCategory({ name, spent, budget, progress, color }: { name: string; spent: string; budget: string; progress: number; color: string }) {
  return <Card sx={{ p: 2.5 }}><Stack direction="row" justifyContent="space-between" alignItems="start"><Box><Typography variant="h6">{name}</Typography><Typography variant="body2" color="text.secondary">Wydano {spent} z {budget}</Typography></Box><Chip size="small" label={`${progress}%`} /></Stack><LinearProgress variant="determinate" value={progress} sx={{ mt: 3, mb: 1, height: 8, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: color } }} /><Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Pozostało</Typography><Typography variant="subtitle2">{progress === 94 ? '240,94 zł' : '0 zł'}</Typography></Stack></Card>;
}

function TableHeader({ columns }: { columns: string[] }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(110px, 1fr))`, bgcolor: 'grey.100', borderRadius: '10px 10px 0 0', px: 2, py: 1.5 }}>{columns.map((column) => <Typography key={column} variant="overline" color="text.secondary">{column}</Typography>)}</Box>;
}

function TableRow({ columns, danger = false }: { columns: string[]; danger?: boolean }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(110px, 1fr))`, px: 2, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>{columns.map((column, index) => <Typography key={`${column}-${index}`} variant={index === 0 ? 'subtitle2' : 'body2'} color={danger && index === columns.length - 2 ? 'error.main' : 'text.primary'}>{column}</Typography>)}</Box>;
}

function MaintenanceCard({ title, location, date, overdue = false }: { title: string; location: string; date: string; overdue?: boolean }) {
  return <Card variant="outlined" sx={{ p: 2, boxShadow: 'none', bgcolor: overdue ? 'error.lighter' : 'transparent' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}><Box><Typography variant="subtitle1">{title}</Typography><Stack direction="row" spacing={0.75} alignItems="center" sx={{ my: 0.75 }}><Icon icon="solar:map-point-bold-duotone" /><Typography variant="body2" color="text.secondary">{location}</Typography></Stack><Typography variant="caption" color="text.secondary">Termin: {date}</Typography></Box><Stack alignItems={{ sm: 'flex-end' }} spacing={1}>{overdue && <Chip size="small" color="error" label="Po terminie" />}<Button size="small" variant="outlined">Wykonane</Button></Stack></Stack></Card>;
}

function MemberRow({ name, role, image }: { name: string; role: string; image: string }) {
  return <Stack direction="row" spacing={1.5} alignItems="center"><Avatar src={image} /><Box sx={{ flex: 1 }}><Typography variant="subtitle2">{name}</Typography><Typography variant="caption" color="text.secondary">{role}</Typography></Box><IconButton size="small" aria-label={`Akcje użytkownika ${name}`}><Icon icon="solar:menu-dots-bold" /></IconButton></Stack>;
}

function PrototypeFormDialog({ view, open, onClose }: { view: ViewKey; open: boolean; onClose: () => void }) {
  const fields: Record<ViewKey, string[]> = {
    dashboard: ['Rodzaj szybkiej akcji', 'Tytuł', 'Termin'],
    calendar: ['Nazwa wydarzenia', 'Data i godzina', 'Lokalizacja', 'Przypomnienie'],
    finances: ['Kwota', 'Kategoria budżetu', 'Opis', 'Data'],
    shopping: ['Produkt', 'Ilość', 'Kategoria', 'Lista'],
    pantry: ['Produkt', 'Ilość', 'Data ważności', 'Kategoria'],
    meals: ['Nazwa posiłku', 'Dzień', 'Pora posiłku', 'Link do przepisu'],
    tasks: ['Tytuł', 'Opis', 'Termin', 'Widoczność'],
    home: ['Nazwa', 'Obszar domu', 'Termin', 'Cykliczność'],
    settings: ['Adres e-mail domownika', 'Rola', 'Zakres uprawnień'],
  };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Dodaj — {views.find((item) => item.key === view)?.label}<Typography variant="body2" color="text.secondary">Makieta formularza. Dane nie zostaną zapisane.</Typography></DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{fields[view].map((label) => <TextField key={label} label={label} fullWidth />)}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Anuluj</Button><Button variant="contained" onClick={onClose}>Pokaż działanie</Button></DialogActions></Dialog>;
}
