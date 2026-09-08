import type { EncryptableModuleKey } from '@homeapp/shared-types';
import type { HouseholdMember, EffectivePermission } from '../api';

import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Chip,
  Alert,
  Stack,
  Avatar,
  Button,
  Divider,
  Checkbox,
  TextField,
  IconButton,
  Typography,
  FormControlLabel,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { useEncryption } from '../auth/encryption-context';
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
  calendar: 'Kalendarz',
  finances: 'Finanse',
  meal_planner: 'Posiłki',
  shopping: 'Zakupy',
  todo: 'Zadania',
  notes: 'Notatki',
  cleaning: 'Sprzątanie',
  annual_costs: 'Koszty roczne',
  data_entries: 'Ważne dane',
  attachments: 'Załączniki',
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
    mutationFn: () => updateMyHousehold(
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
    mutationFn: () => updateMemberPermissions(selectedMember!.id, { permissions: permissionDraft }, { accessToken }),
    onSuccess: async () => {
      setPermissionsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
  const saveNotifications = useMutation({
    mutationFn: () => updateNotificationPreferences({ preferences: notifications.data ?? [] }, { accessToken }),
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

  function changePermission(moduleKey: string, key: keyof Pick<EffectivePermission, 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'>, checked: boolean) {
    setPermissionDraft((current) => current.map((item) => {
      if (item.moduleKey !== moduleKey) return item;
      if (key === 'canRead' && !checked) return { ...item, canRead: false, canCreate: false, canUpdate: false, canDelete: false };
      return { ...item, [key]: checked, canRead: key === 'canRead' ? checked : checked || item.canRead };
    }));
  }

  if (household.isLoading || members.isLoading) return <LoadingView />;
  if (household.error || members.error || !household.data)
    return <ErrorView error={household.error ?? members.error} />;

  return (
    <Page>
      <PageHeader
        title={household.data.name}
        description={`${members.data?.length ?? 0} domowników · ${household.data.currencyCode}`}
        action={
          <Stack direction="row" spacing={1}>
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
              Ustawienia
            </PrimaryButton>
            <PrimaryButton onClick={() => setInviteOpen(true)}>Zaproś</PrimaryButton>
          </Stack>
        }
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' },
          gap: 3,
        }}
      >
        <SectionCard title="Domownicy">
          <Stack divider={<Divider flexItem />}>
            {members.data?.map((member) => (
              <Stack
                key={member.id}
                direction="row"
                spacing={2}
                sx={{ py: 1.5, alignItems: 'center' }}
              >
                <Avatar
                  sx={{
                    bgcolor: member.role === 'owner' ? 'primary.main' : 'secondary.main',
                  }}
                >
                  {member.displayName.slice(0, 1).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {member.email}
                  </Typography>
                </Box>
                <Chip
                  label={member.role === 'owner' ? 'Właściciel' : 'Domownik'}
                  color={member.role === 'owner' ? 'primary' : 'default'}
                  variant="outlined"
                />
                {member.role !== 'owner' && (
                  <Stack direction="row">
                    <IconButton onClick={() => {
                      setSelectedMember(member);
                      setPermissionDraft([]);
                      setPermissionsOpen(true);
                    }}>
                      <Icon icon="solar:shield-user-bold-duotone" />
                    </IconButton>
                    <IconButton color="error" onClick={() => confirmDelete(member.displayName) && remove.mutate(member.id)}>
                      <Icon icon="solar:user-minus-bold-duotone" />
                    </IconButton>
                  </Stack>
                )}
              </Stack>
            ))}
          </Stack>
        </SectionCard>
        <SectionCard title="Konto i powiadomienia">
          <Stack spacing={1.5}>
            <Typography color="text.secondary">Wybierz, o jakich zmianach w domu chcesz otrzymywać powiadomienia.</Typography>
            <PrimaryButton variant="outlined" icon="solar:bell-bold-duotone" onClick={() => setNotificationsOpen(true)}>
              Ustaw powiadomienia
            </PrimaryButton>
            <Button
              color="error"
              variant="outlined"
              startIcon={<Icon icon="solar:trash-bin-trash-bold-duotone" />}
              disabled={deleteAccount.isPending}
              onClick={() => {
                const confirmation = window.prompt('Aby usunąć konto, wpisz USUŃ KONTO');
                if (confirmation === 'USUŃ KONTO') deleteAccount.mutate();
              }}
            >
              Usuń moje konto
            </Button>
            {deleteAccount.error && <Alert severity="error">{deleteAccount.error.message}</Alert>}
          </Stack>
        </SectionCard>
        <SectionCard title="Szyfrowanie end-to-end">
          <Stack spacing={1.5}>
            <Typography color="text.secondary">
              {encryption.lockState === 'not-configured'
                ? 'Włącz E2EE dla wybranych modułów. Serwer nie otrzyma ich czytelnej treści.'
                : `Aktywne moduły: ${encryption.settings?.enabledModules.length ?? 0}. Klucz jest odblokowany tylko w tej karcie.`}
            </Typography>
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
              {encryption.lockState === 'not-configured' ? 'Włącz szyfrowanie' : 'Zarządzaj szyfrowaniem'}
            </PrimaryButton>
            {encryption.lockState === 'unlocked' && <Button variant="text" onClick={encryption.lock}>Zablokuj teraz</Button>}
          </Stack>
        </SectionCard>
        <SectionCard title="Twoje uprawnienia">
          {permissions.error ? (
            <ErrorView error={permissions.error} />
          ) : (
            <Stack spacing={1.25}>
              {permissions.data?.map((permission) => (
                <Stack
                  key={permission.moduleKey}
                  direction="row"
                  sx={{ justifyContent: 'space-between', alignItems: 'center' }}
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
            </Stack>
          )}
        </SectionCard>
      </Box>
      <FormDialog
        title="Zaproś domownika"
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
        title={`Uprawnienia: ${selectedMember?.displayName ?? ''}`}
        open={permissionsOpen}
        onClose={() => { setPermissionsOpen(false); setSelectedMember(null); }}
        onSubmit={() => savePermissions.mutate()}
        loading={savePermissions.isPending || memberPermissions.isLoading}
        submitLabel="Zapisz uprawnienia"
        maxWidth="md"
      >
        {savePermissions.error && <Alert severity="error">{savePermissions.error.message}</Alert>}
        <Stack divider={<Divider flexItem />}>
          {permissionDraft.map((item) => (
            <Stack key={item.moduleKey} direction={{ xs: 'column', sm: 'row' }} sx={{ py: 1, alignItems: { sm: 'center' } }}>
              <Typography sx={{ flex: 1, fontWeight: 700 }}>{moduleNames[item.moduleKey] ?? item.moduleKey}</Typography>
              {(['canRead', 'canCreate', 'canUpdate', 'canDelete'] as const).map((key) => (
                <FormControlLabel
                  key={key}
                  label={{ canRead: 'Odczyt', canCreate: 'Dodawanie', canUpdate: 'Edycja', canDelete: 'Usuwanie' }[key]}
                  control={<Checkbox checked={item[key]} onChange={(event) => changePermission(item.moduleKey, key, event.target.checked)} />}
                />
              ))}
            </Stack>
          ))}
        </Stack>
      </FormDialog>
      <FormDialog
        title="Powiadomienia"
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onSubmit={() => saveNotifications.mutate()}
        loading={saveNotifications.isPending}
        submitLabel="Zapisz"
      >
        {notifications.error && <Alert severity="error">{notifications.error.message}</Alert>}
        <Stack spacing={0.5}>
          {notifications.data?.map((preference) => (
            <FormControlLabel
              key={preference.eventType}
              label={preference.eventType.replaceAll('_', ' ')}
              control={<Checkbox checked={preference.enabled} onChange={(event) => queryClient.setQueryData(
                ['notifications', 'preferences'],
                (current: typeof notifications.data) => current?.map((item) => item.eventType === preference.eventType ? { ...item, enabled: event.target.checked } : item)
              )} />}
            />
          ))}
        </Stack>
      </FormDialog>
      <FormDialog
        title="Ustawienia domu"
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
      </FormDialog>
      <FormDialog
        title="Szyfrowanie end-to-end"
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
          <Alert severity="error">{(saveEncryption.error ?? disableEncryption.error)?.message}</Alert>
        )}
        {recoveryCode ? (
          <Alert severity="warning">
            <Typography sx={{ fontWeight: 700 }}>Zapisz kod odzyskiwania. Nie będzie pokazany ponownie.</Typography>
            <Typography component="code" sx={{ display: 'block', mt: 1, wordBreak: 'break-all', userSelect: 'all' }}>{recoveryCode}</Typography>
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
    </Page>
  );
}
