import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Box, Chip, Alert, Stack, Divider, TextField, IconButton, Typography } from '@mui/material';

import { useSession } from '../auth/session-context';
import { todayIso, shortDate } from '../utils/format';
import { createShoppingItem, deleteShoppingItem, getPantryDashboard } from '../api';
import {
  Page,
  ErrorView,
  EmptyState,
  FormDialog,
  MetricCard,
  PageHeader,
  LoadingView,
  SectionCard,
  confirmDelete,
  PrimaryButton,
} from '../components/ui';

export function PantryPage() {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1 szt.');
  const [expirationDate, setExpirationDate] = useState('');
  const query = useQuery({
    queryKey: ['shopping', 'pantry'],
    queryFn: () => getPantryDashboard({ accessToken }),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shopping'] });
  const create = useMutation({
    mutationFn: () =>
      createShoppingItem(
        'pantry',
        { name: name.trim(), quantity, expirationDate: expirationDate || null },
        { accessToken }
      ),
    onSuccess: async () => {
      setOpen(false);
      setName('');
      setExpirationDate('');
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id, { accessToken }),
    onSuccess: invalidate,
  });

  return (
    <Page>
      <PageHeader
        title="Spiżarnia"
        description="Zapasy i daty przydatności produktów."
        action={<PrimaryButton onClick={() => setOpen(true)}>Dodaj zapas</PrimaryButton>}
      />
      {query.isLoading ? (
        <LoadingView />
      ) : query.error || !query.data ? (
        <ErrorView error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2.5,
            }}
          >
            <MetricCard
              icon="solar:box-bold-duotone"
              label="Wszystkich produktów"
              value={query.data.stats.total}
            />
            <MetricCard
              icon="solar:danger-triangle-bold-duotone"
              label="Kończy się termin"
              value={query.data.stats.expiringSoon}
              color="warning.main"
            />
            <MetricCard
              icon="solar:close-circle-bold-duotone"
              label="Po terminie"
              value={query.data.stats.expired}
              color="error.main"
            />
          </Box>
          <SectionCard>
            {query.data.items.length === 0 ? (
              <EmptyState text="Spiżarnia jest pusta." />
            ) : (
              <Stack divider={<Divider flexItem />}>
                {query.data.items.map((item) => {
                  const expired = Boolean(item.expirationDate && item.expirationDate < todayIso());
                  return (
                    <Stack
                      key={item.id}
                      direction="row"
                      spacing={2}
                      sx={{ py: 1.5, alignItems: 'center' }}
                    >
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 1.5,
                          bgcolor: 'action.hover',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Icon icon="solar:box-minimalistic-bold-duotone" width={24} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.quantity || '1 szt.'}
                        </Typography>
                      </Box>
                      {item.expirationDate && (
                        <Chip
                          size="small"
                          color={expired ? 'error' : 'default'}
                          label={`do ${shortDate(item.expirationDate)}`}
                        />
                      )}
                      <IconButton
                        color="error"
                        onClick={() => confirmDelete(item.name) && remove.mutate(item.id)}
                      >
                        <Icon icon="solar:trash-bin-trash-bold-duotone" />
                      </IconButton>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </SectionCard>
        </>
      )}
      <FormDialog
        title="Dodaj do spiżarni"
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={() => create.mutate()}
        loading={create.isPending}
        submitDisabled={!name.trim()}
      >
        {create.error && <Alert severity="error">{create.error.message}</Alert>}
        <TextField
          label="Produkt"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <TextField label="Ilość" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <TextField
          label="Data przydatności"
          type="date"
          value={expirationDate}
          onChange={(e) => setExpirationDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </FormDialog>
    </Page>
  );
}
