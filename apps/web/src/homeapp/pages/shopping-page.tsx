import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Chip,
  Alert,
  Stack,
  Divider,
  Checkbox,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import {
  listShoppingItems,
  type ShoppingItem,
  createShoppingItem,
  deleteShoppingItem,
  toggleShoppingItem,
} from '../api';
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

const categories: Record<string, { emoji: string; label: string }> = {
  bakery: { emoji: '🥖', label: 'Pieczywo' },
  dairy: { emoji: '🥛', label: 'Nabiał' },
  drinks: { emoji: '🥤', label: 'Napoje' },
  meat: { emoji: '🥩', label: 'Mięso' },
  produce: { emoji: '🥬', label: 'Warzywa i owoce' },
  pantry: { emoji: '🥫', label: 'Spiżarnia' },
  cleaning: { emoji: '🧽', label: 'Chemia' },
  care: { emoji: '🧴', label: 'Higiena' },
  other: { emoji: '🛒', label: 'Inne' },
};

export function ShoppingPage() {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1 szt.');
  const [itemCategory, setItemCategory] = useState('other');
  const query = useQuery({
    queryKey: ['shopping', 'daily'],
    queryFn: () => listShoppingItems('daily', { accessToken }),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shopping'] });
  const create = useMutation({
    mutationFn: () =>
      createShoppingItem(
        'daily',
        { name: name.trim(), quantity, category: itemCategory },
        { accessToken }
      ),
    onSuccess: async () => {
      setOpen(false);
      setName('');
      await invalidate();
    },
  });
  const toggle = useMutation({
    mutationFn: (id: string) => toggleShoppingItem(id, { accessToken }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id, { accessToken }),
    onSuccess: invalidate,
  });
  const groups = (query.data ?? []).reduce<Record<string, ShoppingItem[]>>((acc, item) => {
    (acc[item.category ?? 'other'] ??= []).push(item);
    return acc;
  }, {});

  return (
    <Page>
      <PageHeader
        title="Lista zakupów"
        description={`${query.data?.filter((i) => !i.isChecked).length ?? 0} produktów do kupienia`}
        action={<PrimaryButton onClick={() => setOpen(true)}>Dodaj produkt</PrimaryButton>}
      />
      {query.isLoading ? (
        <LoadingView />
      ) : query.error ? (
        <ErrorView error={query.error} retry={() => void query.refetch()} />
      ) : (query.data?.length ?? 0) === 0 ? (
        <SectionCard>
          <EmptyState
            icon="solar:cart-check-bold-duotone"
            text="Lista jest pusta. Dodaj pierwszy produkt."
          />
        </SectionCard>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2.5,
          }}
        >
          {Object.entries(groups).map(([key, items]) => {
            const meta = categories[key] ?? categories.other!;
            return (
              <SectionCard key={key} title={`${meta.emoji} ${meta.label}`}>
                <Stack divider={<Divider flexItem />}>
                  {items.map((item) => (
                    <Stack key={item.id} direction="row" sx={{ py: 1, alignItems: 'center' }}>
                      <Checkbox checked={item.isChecked} onChange={() => toggle.mutate(item.id)} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            textDecoration: item.isChecked ? 'line-through' : 'none',
                            color: item.isChecked ? 'text.disabled' : 'text.primary',
                          }}
                        >
                          {item.name}
                        </Typography>
                      </Box>
                      <Chip label={item.quantity || '1 szt.'} size="small" variant="filled" />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => confirmDelete(item.name) && remove.mutate(item.id)}
                        aria-label="Usuń produkt"
                      >
                        <Icon icon="solar:trash-bin-trash-bold-duotone" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              </SectionCard>
            );
          })}
        </Box>
      )}
      <FormDialog
        title="Dodaj produkt"
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
          select
          label="Kategoria"
          value={itemCategory}
          onChange={(e) => setItemCategory(e.target.value)}
          slotProps={{ select: { native: true } }}
        >
          {Object.entries(categories).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.emoji} {meta.label}
            </option>
          ))}
        </TextField>
      </FormDialog>
    </Page>
  );
}
