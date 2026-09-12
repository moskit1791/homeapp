import type { EncryptableModuleKey } from '@homeapp/shared-types';
import type { HouseholdMember, EffectivePermission } from '../api';

import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useColorScheme } from '@mui/material/styles';
import {
  Box,
  Chip,
  Alert,
  Stack,
  Avatar,
  Button,
  Slider,
  Divider,
  Checkbox,
  TextField,
  IconButton,
  Typography,
  FormControlLabel,
} from '@mui/material';

import { useSettingsContext } from 'src/components/settings';

import { useSession } from '../auth/session-context';
import { useEncryption } from '../auth/encryption-context';
import { WebPushButton } from '../components/web-push-button';
import {
  Page,
  ErrorView,
  FormDialog,
  PageHeader,
  LoadingView,
  SectionCard,
  confirmDelete,
  PrimaryButton,
} from '../components/ui';
import {
  getMyHousehold,
  deleteMyAccount,
  getMyPermissions,
  updateMyHousehold,
  listHouseholdMembers,
  listMemberPermissions,
  inviteHouseholdMember,
  removeHouseholdMember,
  updateMemberPermissions,
  listNotificationPreferences,
  updateNotificationPreferences,
} from '../api';

const moduleNames: Record<string, string> = {
  start: 'Dzisiaj',
  calendar: 'Kalendarz',
  finances: 'Finanse',
  meal_planner: 'Posiłki',
  shopping: 'Zakupy',
  todo: 'Zadania',
  notes: 'Notatki',
  cleaning: 'Cykliczne',
  annual_costs: 'Koszty roczne',
  data_entries: 'Ważne dane',
  attachments: 'Załączniki',
  household_members: 'Domownicy',
  permissions: 'Uprawnienia',
};

const notificationLabels: Record<string, { label: string; meta: string }> = {
  'annual_cost.changed': { label: 'Koszty roczne', meta: 'Nowe i opłacone koszty roczne.' },
  'attachment.changed': { label: 'Pliki', meta: 'Dodanie, opis i usunięcie plików.' },
  'calendar.changed': {
    label: 'Kalendarz',
    meta: 'Wydarzenia dodane lub zmienione przez domowników.',
  },
  'cleaning.changed': {
    label: 'Cykliczne',
    meta: 'Cykliczne obowiązki, opłaty i przypomnienia o terminach.',
  },
  'data.changed': { label: 'Dane', meta: 'Wpisy w domowym sejfie danych.' },
  'finance.changed': { label: 'Finanse', meta: 'Kategorie, budżety, wydatki i dochody.' },
  'finance.month.deleted': {
    label: 'Usunięcie miesiąca finansów',
    meta: 'Gdy domownik usunie miesiąc budżetu.',
  },
  'finance.month.generated': {
    label: 'Nowy miesiąc finansów',
    meta: 'Gdy domownik wygeneruje kolejny miesiąc.',
  },
  'household.changed': { label: 'Dom', meta: 'Zmiany ustawień domu i składu domowników.' },
  'meal.changed': { label: 'Plan posiłków', meta: 'Tygodnie, posiłki i inspiracje kulinarne.' },
  'permissions.changed': { label: 'Uprawnienia', meta: 'Zmiany dostępu do modułów.' },
  'shopping.changed': { label: 'Zakupy', meta: 'Produkty dodane, odhaczone lub usunięte z list.' },
  'todo.changed': {
    label: 'Do zrobienia',
    meta: 'Wspólne rzeczy dodane, zamknięte lub przywrócone.',
  },
};

const encryptableModuleKeys: EncryptableModuleKey[] = [
  'finances',
  'calendar',
  'meal_planner',
  'shopping',
  'todo',
  'notes',
  'cleaning',
  'annual_costs',
  'data_entries',
  'attachments',
];

export function HouseholdPage() {
  const { accessToken, logout } = useSession();
  const settings = useSettingsContext();
  const { mode, setMode } = useColorScheme();
  const encryption = useEncryption();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<HouseholdMember | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<EffectivePermission[]>([]);
  const [encryptionOpen, setEncryptionOpen] = useState(false);
  const [encryptionPassphrase, setEncryptionPassphrase] = useState('');
  const [encryptionModules, setEncryptionModules] = useState<EncryptableModuleKey[]>([]);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const household = useQuery({
    queryKey: ['household'],
    queryFn: () => getMyHousehold({ accessToken }),
  });
  const members = useQuery({
    queryKey: ['household', 'members'],
    queryFn: () => listHouseholdMembers({ accessToken }),
  });
  const permissions = useQuery({
    queryKey: ['permissions'],
    queryFn: () => getMyPermissions({ accessToken }),
  });
  const memberPermissions = useQuery({
    queryKey: ['permissions', selectedMember?.id],
    queryFn: () => listMemberPermissions(selectedMember!.id, { accessToken }),
    enabled: Boolean(selectedMember),
  });
  const notifications = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => listNotificationPreferences({ accessToken }),
  });
  const [houseName, setHouseName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('PLN');
  const [mealSlotsPerDay, setMealSlotsPerDay] = useState('3');
  useEffect(() => {
    if (memberPermissions.data) setPermissionDraft(memberPermissions.data);
  }, [memberPermissions.data]);
  const invite = useMutation({
    mutationFn: () => inviteHouseholdMember({ email: email.trim() }, { accessToken }),
    onSuccess: () => {
      setInviteOpen(false);
      setEmail('');
    },
  });
  const update = useMutation({
    mutationFn: () =>
      updateMyHousehold(
        { name: houseName.trim(), currencyCode, mealSlotsPerDay: Number(mealSlotsPerDay) },
        { accessToken }
      ),
    onSuccess: async () => {
      setSettingsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['household'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeHouseholdMember(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household', 'members'] }),
  });
  const savePermissions = useMutation({
    mutationFn: () =>
      updateMemberPermissions(
        selectedMember!.id,
        { permissions: permissionDraft },
        { accessToken }
      ),
    onSuccess: async () => {
      setPermissionsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
  const saveNotifications = useMutation({
    mutationFn: () =>
      updateNotificationPreferences({ preferences: notifications.data ?? [] }, { accessToken }),
    onSuccess: () => setNotificationsOpen(false),
  });
  const deleteAccount = useMutation({
    mutationFn: () => deleteMyAccount({ accessToken }),
    onSuccess: () => logout(),
  });
  const saveEncryption = useMutation({
    mutationFn: async () => {
      if (encryption.lockState === 'not-configured') {
        return encryption.setup(encryptionPassphrase, encryptionModules);
      }
      await encryption.saveEnabledModules(encryptionModules);
      return null;
    },
    onSuccess: (code) => {
      if (code) setRecoveryCode(code);
      else setEncryptionOpen(false);
      setEncryptionPassphrase('');
    },
  });
  const disableEncryption = useMutation({
    mutationFn: () => encryption.removeEncryption(),
    onSuccess: () => setEncryptionOpen(false),
  });

  function changePermission(
    moduleKey: string,
    key: keyof Pick<EffectivePermission, 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'>,
    checked: boolean
  ) {
    setPermissionDraft((current) =>
      current.map((item) => {
        if (item.moduleKey !== moduleKey) return item;
        if (key === 'canRead' && !checked)
          return { ...item, canRead: false, canCreate: false, canUpdate: false, canDelete: false };
        return {
          ...item,
          [key]: checked,
          canRead: key === 'canRead' ? checked : checked || item.canRead,
        };
      })
    );
  }

  if (household.isLoading || members.isLoading) return <LoadingView />;
  if (household.error || members.error || !household.data)
    return <ErrorView error={household.error ?? members.error} />;

  return (
    <Page>
      <PageHeader
        title="Ustawienia i konto"
        description="Profil, powiadomienia i konfiguracja domu."
        action={
          <Button
            variant="outlined"
            startIcon={<Icon icon="solar:logout-2-bold-duotone" />}
            onClick={logout}
          >
            Wyloguj się
          </Button>
        }
      />
      <Box
        sx={(theme) => ({
          p: { xs: 2.25, md: 3 },
          display: 'grid',
          gap: 2.5,
          alignItems: 'center',
          gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
          border: '1px solid',
          borderColor: 'rgba(77,123,235,.2)',
          borderRadius: 2.5,
          background:
            'linear-gradient(120deg, rgba(91,141,239,.12), rgba(168,121,232,.06) 58%, rgba(82,218,153,.08))',
          ...theme.applyStyles('dark', {
            borderColor: 'rgba(126,163,255,.25)',
            background:
              'linear-gradient(120deg, rgba(38,73,130,.34), rgba(87,58,126,.17) 58%, rgba(36,116,87,.15))',
          }),
        })}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: { xs: 58, md: 68 },
              height: { xs: 58, md: 68 },
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: 'primary.lighter',
              boxShadow: '0 12px 28px rgba(56,98,190,.18)',
            }}
          >
            <Icon icon="solar:home-smile-bold-duotone" width={36} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main">
              Twój dom
            </Typography>
            <Typography variant="h3" noWrap>
              {household.data.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Wspólna przestrzeń dla {members.data?.length ?? 0}{' '}
              {(members.data?.length ?? 0) === 1 ? 'domownika' : 'domowników'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip
            icon={<Icon icon="solar:wallet-bold-duotone" />}
            label={household.data.currencyCode}
          />
          <Chip
            icon={<Icon icon="solar:chef-hat-heart-bold-duotone" />}
            label={`${household.data.mealSlotsPerDay} posiłki dziennie`}
          />
          <Chip
            color={encryption.lockState === 'unlocked' ? 'success' : 'default'}
            icon={<Icon icon="solar:shield-check-bold-duotone" />}
            label={encryption.lockState === 'unlocked' ? 'E2EE aktywne' : 'Ochrona standardowa'}
          />
        </Stack>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Stack spacing={3} sx={{ display: { xs: 'contents', lg: 'flex' } }}>
          <SectionCard title="Dom" sx={{ order: 1, borderTop: '3px solid #5B8DEF' }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1.5,
                    color: 'primary.main',
                    bgcolor: 'primary.lighter',
                  }}
                >
                  <Icon icon="solar:home-smile-bold-duotone" width={27} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5">{household.data.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {household.data.currencyCode} · {household.data.mealSlotsPerDay} posiłki
                    dziennie
                  </Typography>
                </Box>
              </Stack>
              <PrimaryButton
                icon="solar:settings-bold-duotone"
                variant="outlined"
                onClick={() => {
                  setHouseName(household.data.name);
                  setCurrencyCode(household.data.currencyCode);
                  setMealSlotsPerDay(String(household.data.mealSlotsPerDay));
                  setSettingsOpen(true);
                }}
              >
                Zmień ustawienia domu
              </PrimaryButton>
            </Stack>
          </SectionCard>
          <SectionCard title="Wygląd aplikacji" sx={{ order: 3, borderTop: '3px solid #F6B94D' }}>
            <Stack spacing={1.5}>
              <Typography color="text.secondary">
                Wybierz wygląd zgodny z systemem, jasny albo ciemny.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {(['system', 'light', 'dark'] as const).map((themeMode) => (
                  <Button
                    key={themeMode}
                    variant={mode === themeMode ? 'contained' : 'outlined'}
                    startIcon={
                      <Icon
                        icon={
                          themeMode === 'system'
                            ? 'solar:monitor-smartphone-bold-duotone'
                            : themeMode === 'light'
                              ? 'solar:sun-2-bold-duotone'
                              : 'solar:moon-bold-duotone'
                        }
                      />
                    }
                    onClick={() => {
                      setMode(themeMode);
                      settings.setState({ mode: themeMode });
                    }}
                  >
                    {themeMode === 'system' ? 'System' : themeMode === 'light' ? 'Jasny' : 'Ciemny'}
                  </Button>
                ))}
              </Stack>
              <Box sx={{ pt: 1 }}>
                <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Rozmiar tekstu</Typography>
                  <Typography variant="subtitle2" color="primary.main">
                    {Math.round((settings.state.fontSize / 16) * 100)}%
                  </Typography>
                </Stack>
                <Slider
                  marks
                  min={12}
                  max={20}
                  step={1}
                  value={settings.state.fontSize}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${Math.round((value / 16) * 100)}%`}
                  onChange={(_, value) => settings.setState({ fontSize: value as number })}
                  aria-label="Rozmiar tekstu"
                />
              </Box>
            </Stack>
          </SectionCard>
          <SectionCard
            title="Szyfrowanie end-to-end"
            sx={{ order: 5, borderTop: '3px solid #4C9AFF' }}
          >
            <Stack spacing={1.5}>
              <Typography color="text.secondary">
                {encryption.lockState === 'not-configured'
                  ? 'Włącz E2EE dla wybranych modułów. Serwer nie otrzyma ich czytelnej treści.'
                  : `Aktywne moduły: ${encryption.settings?.enabledModules.length ?? 0}. Klucz jest odblokowany tylko w tej karcie.`}
              </Typography>
              <Alert severity="info">
                Zaszyfrowane treści nie są wysyłane do AI automatycznie. Aplikacja poprosi o osobną
                zgodę przed ich odszyfrowaniem i przekazaniem do zewnętrznej usługi.
              </Alert>
              <PrimaryButton
                variant="outlined"
                icon="solar:lock-keyhole-bold-duotone"
                disabled={!encryption.settings?.canManage}
                onClick={() => {
                  setEncryptionModules(encryption.settings?.enabledModules ?? []);
                  setRecoveryCode(null);
                  setEncryptionOpen(true);
                }}
              >
                {encryption.lockState === 'not-configured'
                  ? 'Włącz szyfrowanie'
                  : 'Zarządzaj szyfrowaniem'}
              </PrimaryButton>
              {encryption.lockState === 'unlocked' && (
                <Button variant="text" onClick={encryption.lock}>
                  Zablokuj teraz
                </Button>
              )}
            </Stack>
          </SectionCard>
          <SectionCard title="Usuwanie konta" sx={{ order: 7, borderColor: 'error.main' }}>
            <Stack spacing={1.5}>
              <Typography color="text.secondary">
                Konto zostanie wylogowane, a adres e-mail odłączony od profilu.
              </Typography>
              <Button
                color="error"
                variant="contained"
                startIcon={<Icon icon="solar:trash-bin-trash-bold-duotone" />}
                disabled={deleteAccount.isPending}
                onClick={() => {
                  setDeleteConfirmation('');
                  setDeleteOpen(true);
                }}
              >
                Usuń moje konto
              </Button>
              {deleteAccount.error && <Alert severity="error">{deleteAccount.error.message}</Alert>}
            </Stack>
          </SectionCard>
        </Stack>
        <Stack spacing={3} sx={{ display: { xs: 'contents', lg: 'flex' } }}>
          <SectionCard title="Domownicy" sx={{ order: 2, borderTop: '3px solid #A879E8' }}>
            <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'flex-end' }}>
              <PrimaryButton size="small" onClick={() => setInviteOpen(true)}>
                Zaproś domownika
              </PrimaryButton>
            </Stack>
            <Stack divider={<Divider flexItem />}>
              {members.data?.map((member) => (
                <Stack
                  key={member.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  sx={{ py: 1.5, gap: 1.25, alignItems: { sm: 'center' } }}
                >
                  <Stack
                    direction="row"
                    sx={{ flex: 1, minWidth: 0, gap: 1.5, alignItems: 'center' }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: member.role === 'owner' ? 'primary.main' : 'secondary.main',
                      }}
                    >
                      {member.displayName.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ wordBreak: 'break-word' }}
                      >
                        {member.email}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack
                    direction="row"
                    sx={{
                      gap: 0.5,
                      alignItems: 'center',
                      justifyContent: { xs: 'space-between', sm: 'flex-end' },
                    }}
                  >
                    <Chip
                      label={member.role === 'owner' ? 'Właściciel' : 'Domownik'}
                      color={member.role === 'owner' ? 'primary' : 'default'}
                      variant="outlined"
                    />
                    {member.role !== 'owner' && (
                      <Stack direction="row">
                        <IconButton
                          aria-label={`Uprawnienia: ${member.displayName}`}
                          onClick={() => {
                            setSelectedMember(member);
                            setPermissionDraft([]);
                            setPermissionsOpen(true);
                          }}
                        >
                          <Icon icon="solar:shield-user-bold-duotone" />
                        </IconButton>
                        <IconButton
                          color="error"
                          aria-label={`Usuń domownika: ${member.displayName}`}
                          onClick={() =>
                            confirmDelete(member.displayName) && remove.mutate(member.id)
                          }
                        >
                          <Icon icon="solar:user-minus-bold-duotone" />
                        </IconButton>
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
          <SectionCard title="Powiadomienia" sx={{ order: 4, borderTop: '3px solid #55D99B' }}>
            <Stack spacing={1.5}>
              <Typography color="text.secondary">
                Wybierz, o jakich zmianach w domu chcesz otrzymywać powiadomienia.
              </Typography>
              <PrimaryButton
                variant="outlined"
                icon="solar:bell-bold-duotone"
                onClick={() => setNotificationsOpen(true)}
              >
                Ustaw powiadomienia
              </PrimaryButton>
              <WebPushButton accessToken={accessToken} variant="button" />
            </Stack>
          </SectionCard>
          <SectionCard title="Twoje uprawnienia" sx={{ order: 6, borderTop: '3px solid #7C6CE7' }}>
            {permissions.error ? (
              <ErrorView error={permissions.error} />
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: '1fr' },
                }}
              >
                {permissions.data?.map((permission) => (
                  <Stack
                    key={permission.moduleKey}
                    direction="row"
                    sx={{
                      px: 1.25,
                      py: 0.8,
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderRadius: 1.25,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Typography>
                      {moduleNames[permission.moduleKey] ?? permission.moduleKey}
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        permission.canCreate && permission.canUpdate && permission.canDelete
                          ? 'Pełne'
                          : permission.canRead
                            ? 'Odczyt'
                            : 'Brak'
                      }
                      color={permission.canRead ? 'success' : 'default'}
                    />
                  </Stack>
                ))}
              </Box>
            )}
          </SectionCard>
        </Stack>
      </Box>
      <FormDialog
        title="Zaproś domownika"
        subtitle="Wyślij zaproszenie na adres e-mail."
        icon="solar:user-plus-bold-duotone"
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSubmit={() => invite.mutate()}
        loading={invite.isPending}
        submitLabel="Wyślij zaproszenie"
        submitDisabled={!email.trim()}
      >
        {invite.error && <Alert severity="error">{invite.error.message}</Alert>}
        {invite.data && <Alert severity="success">Zaproszenie zostało utworzone.</Alert>}
        <TextField
          label="Adres e-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </FormDialog>
      <FormDialog
        title={`Uprawnienia: ${selectedMember?.displayName ?? ''}`}
        subtitle="Określ osobno odczyt, dodawanie, edycję i usuwanie."
        icon="solar:shield-user-bold-duotone"
        open={permissionsOpen}
        onClose={() => {
          setPermissionsOpen(false);
          setSelectedMember(null);
        }}
        onSubmit={() => savePermissions.mutate()}
        loading={savePermissions.isPending || memberPermissions.isLoading}
        submitLabel="Zapisz uprawnienia"
        maxWidth="md"
      >
        {savePermissions.error && <Alert severity="error">{savePermissions.error.message}</Alert>}
        <Stack divider={<Divider flexItem />}>
          {permissionDraft.map((item) => (
            <Stack
              key={item.moduleKey}
              direction={{ xs: 'column', sm: 'row' }}
              sx={{ py: 1, alignItems: { sm: 'center' } }}
            >
              <Typography sx={{ flex: 1, fontWeight: 700 }}>
                {moduleNames[item.moduleKey] ?? item.moduleKey}
              </Typography>
              {(['canRead', 'canCreate', 'canUpdate', 'canDelete'] as const).map((key) => (
                <FormControlLabel
                  key={key}
                  label={
                    {
                      canRead: 'Odczyt',
                      canCreate: 'Dodawanie',
                      canUpdate: 'Edycja',
                      canDelete: 'Usuwanie',
                    }[key]
                  }
                  control={
                    <Checkbox
                      checked={item[key]}
                      onChange={(event) =>
                        changePermission(item.moduleKey, key, event.target.checked)
                      }
                    />
                  }
                />
              ))}
            </Stack>
          ))}
        </Stack>
      </FormDialog>
      <FormDialog
        title="Powiadomienia"
        subtitle="Wybierz zdarzenia, o których chcesz wiedzieć."
        icon="solar:bell-bold-duotone"
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onSubmit={() => saveNotifications.mutate()}
        loading={saveNotifications.isPending}
        submitLabel="Zapisz"
      >
        {notifications.error && <Alert severity="error">{notifications.error.message}</Alert>}
        <Stack spacing={0.5}>
          {notifications.data
            ?.filter((preference) => preference.eventType !== 'note.changed')
            .map((preference) => {
              const content = notificationLabels[preference.eventType] ?? {
                label: preference.eventType,
                meta: 'Powiadomienia o zmianach tego typu.',
              };
              return (
                <FormControlLabel
                  key={preference.eventType}
                  sx={{ m: 0, py: 0.75, alignItems: 'flex-start' }}
                  label={
                    <Box sx={{ pt: 0.35 }}>
                      <Typography variant="subtitle2">{content.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {content.meta}
                      </Typography>
                    </Box>
                  }
                  control={
                    <Checkbox
                      checked={preference.enabled}
                      onChange={(event) =>
                        queryClient.setQueryData(
                          ['notifications', 'preferences'],
                          (current: typeof notifications.data) =>
                            current?.map((item) =>
                              item.eventType === preference.eventType
                                ? { ...item, enabled: event.target.checked }
                                : item
                            )
                        )
                      }
                    />
                  }
                />
              );
            })}
        </Stack>
      </FormDialog>
      <FormDialog
        title="Ustawienia domu"
        subtitle="Nazwa, waluta i liczba posiłków dziennie."
        icon="solar:home-smile-bold-duotone"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSubmit={() => update.mutate()}
        loading={update.isPending}
        submitDisabled={!houseName.trim()}
      >
        {update.error && <Alert severity="error">{update.error.message}</Alert>}
        <TextField
          label="Nazwa domu"
          value={houseName}
          onChange={(e) => setHouseName(e.target.value)}
          required
          autoFocus
        />
        <TextField
          label="Waluta"
          value={currencyCode}
          onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
          slotProps={{ htmlInput: { maxLength: 3 } }}
        />
        <TextField
          label="Liczba posiłków dziennie"
          type="number"
          value={mealSlotsPerDay}
          onChange={(event) => setMealSlotsPerDay(event.target.value)}
          slotProps={{ htmlInput: { min: 1, max: 8 } }}
        />
      </FormDialog>
      <FormDialog
        title="Szyfrowanie end-to-end"
        subtitle="Wybierz moduły chronione kluczem dostępnym tylko na Twoich urządzeniach."
        icon="solar:lock-keyhole-bold-duotone"
        open={encryptionOpen}
        onClose={() => setEncryptionOpen(false)}
        onSubmit={() => saveEncryption.mutate()}
        loading={saveEncryption.isPending}
        submitLabel={encryption.lockState === 'not-configured' ? 'Włącz E2EE' : 'Zapisz moduły'}
        submitDisabled={
          Boolean(recoveryCode) ||
          encryptionModules.length === 0 ||
          (encryption.lockState === 'not-configured' && encryptionPassphrase.length < 12)
        }
      >
        {(saveEncryption.error || disableEncryption.error) && (
          <Alert severity="error">
            {(saveEncryption.error ?? disableEncryption.error)?.message}
          </Alert>
        )}
        {recoveryCode ? (
          <Alert severity="warning">
            <Typography sx={{ fontWeight: 700 }}>
              Zapisz kod odzyskiwania. Nie będzie pokazany ponownie.
            </Typography>
            <Typography
              component="code"
              sx={{ display: 'block', mt: 1, wordBreak: 'break-all', userSelect: 'all' }}
            >
              {recoveryCode}
            </Typography>
          </Alert>
        ) : (
          <>
            {encryptableModuleKeys.map((moduleKey) => (
              <FormControlLabel
                key={moduleKey}
                label={moduleNames[moduleKey] ?? moduleKey}
                control={
                  <Checkbox
                    checked={encryptionModules.includes(moduleKey)}
                    onChange={(event) =>
                      setEncryptionModules((current) =>
                        event.target.checked
                          ? [...current, moduleKey]
                          : current.filter((item) => item !== moduleKey)
                      )
                    }
                  />
                }
              />
            ))}
            {encryption.lockState === 'not-configured' && (
              <TextField
                label="Hasło szyfrowania (min. 12 znaków)"
                type="password"
                value={encryptionPassphrase}
                onChange={(event) => setEncryptionPassphrase(event.target.value)}
              />
            )}
            {encryption.lockState === 'unlocked' && (
              <Button
                color="error"
                variant="outlined"
                disabled={disableEncryption.isPending}
                onClick={() =>
                  confirmDelete('szyfrowanie E2EE i odszyfrować wszystkie dane') &&
                  disableEncryption.mutate()
                }
              >
                Wyłącz E2EE
              </Button>
            )}
          </>
        )}
      </FormDialog>
      <FormDialog
        title="Usuń konto"
        subtitle="Ta operacja jest nieodwracalna. Potwierdź ją świadomie."
        icon="solar:danger-triangle-bold-duotone"
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onSubmit={() => deleteAccount.mutate()}
        loading={deleteAccount.isPending}
        submitLabel="Usuń konto"
        submitColor="error"
        submitDisabled={deleteConfirmation !== 'USUŃ KONTO'}
      >
        {deleteAccount.error && <Alert severity="error">{deleteAccount.error.message}</Alert>}
        <Alert severity="error">
          Konto zostanie wylogowane, tokeny powiadomień wyłączone, a adres e-mail odłączony od
          profilu.
        </Alert>
        <TextField
          label="Wpisz: USUŃ KONTO"
          value={deleteConfirmation}
          onChange={(event) => setDeleteConfirmation(event.target.value)}
          autoFocus
        />
      </FormDialog>
    </Page>
  );
}
