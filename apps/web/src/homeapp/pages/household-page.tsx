import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Chip,
  Alert,
  Stack,
  Avatar,
  Divider,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';

import { useSession } from '../auth/session-context';
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
  getMyPermissions,
  updateMyHousehold,
  listHouseholdMembers,
  inviteHouseholdMember,
  removeHouseholdMember,
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

export function HouseholdPage() {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [email, setEmail] = useState('');
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
  const [houseName, setHouseName] = useState('');
  const invite = useMutation({
    mutationFn: () => inviteHouseholdMember({ email: email.trim() }, { accessToken }),
    onSuccess: () => {
      setInviteOpen(false);
      setEmail('');
    },
  });
  const update = useMutation({
    mutationFn: () => updateMyHousehold({ name: houseName.trim() }, { accessToken }),
    onSuccess: async () => {
      setSettingsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['household'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeHouseholdMember(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household', 'members'] }),
  });

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
                  <IconButton
                    color="error"
                    onClick={() => confirmDelete(member.displayName) && remove.mutate(member.id)}
                  >
                    <Icon icon="solar:user-minus-bold-duotone" />
                  </IconButton>
                )}
              </Stack>
            ))}
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
    </Page>
  );
}
