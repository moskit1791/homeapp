import type { ShoppingItem } from '../api';

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
  TextField,
  IconButton,
  Typography,
  InputAdornment,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { todayIso, shortDate } from '../utils/format';
import { usePermission } from '../auth/use-permission';
import { FoodNavigation } from '../components/food-navigation';
import dryImage from '../../../../mobile/assets/shopping-category-pantry.png';
import dairyImage from '../../../../mobile/assets/shopping-category-dairy.png';
import drinksImage from '../../../../mobile/assets/shopping-category-drinks.png';
import snacksImage from '../../../../mobile/assets/shopping-category-snacks.png';
import frozenImage from '../../../../mobile/assets/shopping-category-default.png';
import defaultImage from '../../../../mobile/assets/shopping-category-family.png';
import preservesImage from '../../../../mobile/assets/shopping-category-care.png';
import spicesImage from '../../../../mobile/assets/shopping-category-produce.png';
import {
  createShoppingItem,
  deleteShoppingItem,
  getPantryDashboard,
  updateShoppingItem,
} from '../api';
import {
  Page,
  ErrorView,
  EmptyState,
  FormDialog,
  MetricCard,
  LoadingView,
  SectionCard,
  errorMessage,
  confirmDelete,
  PrimaryButton,
} from '../components/ui';

type PantryDraft = Pick<ShoppingItem, 'category' | 'expirationDate' | 'name' | 'quantity'>;

const emptyDraft: PantryDraft = {
  category: 'Inne',
  expirationDate: null,
  name: '',
  quantity: '1 szt.',
};

const pantryGroups = [
  {
    categories: ['Sypkie', 'Pieczywo', 'Pieczenie i dodatki', 'Kawa i herbata'],
    emoji: '🌾',
    image: dryImage,
    label: 'Artykuły suche',
  },
  { categories: ['Nabiał i jaja'], emoji: '🥛', image: dairyImage, label: 'Nabiał' },
  {
    categories: ['Konserwy i przetwory'],
    emoji: '🥫',
    image: preservesImage,
    label: 'Konserwy i puszki',
  },
  { categories: ['Mrożonki'], emoji: '❄️', image: frozenImage, label: 'Mrożonki' },
  {
    categories: ['Przyprawy, sosy i oleje'],
    emoji: '🌿',
    image: spicesImage,
    label: 'Przyprawy i dodatki',
  },
  {
    categories: ['Woda i napoje', 'Alkohole'],
    emoji: '🧃',
    image: drinksImage,
    label: 'Napoje',
  },
  {
    categories: ['Słodycze i przekąski'],
    emoji: '🍪',
    image: snacksImage,
    label: 'Słodycze i przekąski',
  },
  { categories: ['Inne'], emoji: '📦', image: defaultImage, label: 'Inne' },
] as const;

function pantryGroupFor(category: string | null) {
  return (
    pantryGroups.find((group) => group.categories.some((item) => item === category)) ??
    pantryGroups.at(-1)!
  );
}

export function PantryPage() {
  const { accessToken } = useSession();
  const permission = usePermission('shopping');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<PantryDraft>(emptyDraft);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const query = useQuery({
    queryKey: ['shopping', 'pantry'],
    queryFn: () => getPantryDashboard({ accessToken }),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shopping'] });
  const save = useMutation({
    mutationFn: () =>
      editing
        ? updateShoppingItem(
            editing.id,
            {
              category: draft.category,
              expirationDate: draft.expirationDate,
              name: draft.name.trim(),
              quantity: draft.quantity.trim(),
            },
            { accessToken }
          )
        : createShoppingItem(
            'pantry',
            {
              category: draft.category,
              expirationDate: draft.expirationDate,
              name: draft.name.trim(),
              quantity: draft.quantity.trim(),
            },
            { accessToken }
          ),
    onSuccess: async () => {
      closeForm();
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id, { accessToken }),
    onSuccess: invalidate,
  });

  const visibleItems = useMemo(() => {
    const matching = (query.data?.items ?? []).filter((item) =>
      `${item.name} ${item.category ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
    );
    return showAll ? matching : matching.slice(0, 12);
  }, [query.data?.items, search, showAll]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  }

  function openEdit(item: ShoppingItem) {
    setEditing(item);
    setDraft({
      category: item.category ?? 'Inne',
      expirationDate: item.expirationDate,
      name: item.name,
      quantity: item.quantity,
    });
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setDraft(emptyDraft);
    save.reset();
  }

  return (
    <Page>
      <FoodNavigation
        description="Zapasy, szybkie wyszukiwanie oraz kontrola terminów przydatności."
        actions={
          <PrimaryButton onClick={openCreate} disabled={!permission.canCreate}>
            Dodaj produkt
          </PrimaryButton>
        }
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
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
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
            <MetricCard
              icon="solar:cart-3-bold-duotone"
              label="Na liście zakupów"
              value={query.data.stats.shoppingList}
              color="info.main"
            />
          </Box>
          <SectionCard>
            <TextField
              fullWidth
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Szukaj produktu lub kategorii"
              sx={{ mb: 2 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon icon="solar:magnifer-bold-duotone" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {visibleItems.length === 0 ? (
              <EmptyState
                text={
                  search ? 'Brak produktów pasujących do wyszukiwania.' : 'Spiżarnia jest pusta.'
                }
              />
            ) : (
              <Stack divider={<Divider flexItem />}>
                {visibleItems.map((item) => {
                  const expired = Boolean(item.expirationDate && item.expirationDate < todayIso());
                  const group = pantryGroupFor(item.category);
                  return (
                    <Stack
                      key={item.id}
                      direction="row"
                      spacing={2}
                      sx={{ py: 1.5, alignItems: 'center' }}
                    >
                      <Box
                        sx={{
                          width: 58,
                          height: 52,
                          flexShrink: 0,
                          borderRadius: 1.5,
                          bgcolor: expired ? 'error.lighter' : 'success.lighter',
                          display: 'grid',
                          placeItems: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          component="img"
                          src={group.image}
                          alt=""
                          sx={{ width: 52, height: 46, objectFit: 'contain' }}
                        />
                      </Box>
                      <Box
                        onClick={() => permission.canUpdate && openEdit(item)}
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          cursor: permission.canUpdate ? 'pointer' : 'default',
                        }}
                      >
                        <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.quantity || '1 szt.'}
                          {item.category ? ` · ${group.emoji} ${group.label}` : ''}
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
                        aria-label="Edytuj produkt"
                        onClick={() => openEdit(item)}
                        disabled={!permission.canUpdate}
                      >
                        <Icon icon="solar:pen-bold-duotone" />
                      </IconButton>
                      <IconButton
                        color="error"
                        aria-label="Usuń produkt"
                        onClick={() => confirmDelete(item.name) && remove.mutate(item.id)}
                        disabled={!permission.canDelete}
                      >
                        <Icon icon="solar:trash-bin-trash-bold-duotone" />
                      </IconButton>
                    </Stack>
                  );
                })}
              </Stack>
            )}
            {(query.data.items.length ?? 0) > 12 && (
              <Button onClick={() => setShowAll((value) => !value)} sx={{ mt: 2 }}>
                {showAll ? 'Pokaż mniej' : `Pokaż wszystkie (${query.data.items.length})`}
              </Button>
            )}
          </SectionCard>
        </>
      )}
      <FormDialog
        title={editing ? 'Edytuj produkt' : 'Dodaj do spiżarni'}
        subtitle="Ilość, termin ważności i kategoria produktu."
        icon="solar:box-bold-duotone"
        open={open}
        onClose={closeForm}
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        submitDisabled={!draft.name.trim()}
      >
        {save.error && <Alert severity="error">{errorMessage(save.error)}</Alert>}
        <TextField
          label="Nazwa"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          required
          autoFocus
        />
        <TextField
          label="Ilość"
          value={draft.quantity}
          onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
        />
        <TextField
          label="Data przydatności"
          type="date"
          value={draft.expirationDate ?? ''}
          onChange={(event) => setDraft({ ...draft, expirationDate: event.target.value || null })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Kategoria
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            {pantryGroups.map((group) => {
              const selected = group.categories.some((category) => category === draft.category);
              return (
                <Button
                  key={group.label}
                  variant={selected ? 'soft' : 'outlined'}
                  color={selected ? 'primary' : 'inherit'}
                  onClick={() => setDraft({ ...draft, category: group.categories[0] })}
                  sx={{ py: 1.15, justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  <Box component="span" sx={{ mr: 1, fontSize: 20 }}>
                    {group.emoji}
                  </Box>
                  {group.label}
                </Button>
              );
            })}
          </Box>
        </Box>
        {editing && (
          <Button onClick={() => setDraft({ ...draft, quantity: '0' })}>Ustaw ilość na 0</Button>
        )}
      </FormDialog>
    </Page>
  );
}
