import type { ShoppingItem, ShoppingListType } from '../api';

import { Icon } from '@iconify/react';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Tab,
  Tabs,
  Alert,
  Stack,
  Button,
  Divider,
  Checkbox,
  MenuItem,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';

import { useSession } from '../auth/session-context';
import { usePermission } from '../auth/use-permission';
import {
  Page,
  ErrorView,
  EmptyState,
  FormDialog,
  PageHeader,
  LoadingView,
  SectionCard,
  errorMessage,
  PrimaryButton,
  confirmDelete,
} from '../components/ui';
import {
  moveShoppingItem,
  clearShoppingList,
  listShoppingItems,
  listShoppingLists,
  createShoppingItem,
  deleteShoppingItem,
  toggleShoppingItem,
  updateShoppingItem,
  importShoppingItemsWithAi,
  moveUncheckedShoppingToTomorrow,
} from '../api';

const listTypes: Array<{ label: string; value: ShoppingListType }> = [
  { label: 'Dzisiaj', value: 'daily' },
  { label: 'Jutro', value: 'tomorrow' },
  { label: 'Na później', value: 'long_term' },
];

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

type ItemDraft = Pick<ShoppingItem, 'category' | 'expirationDate' | 'name' | 'quantity'>;

const emptyDraft: ItemDraft = {
  category: 'other',
  expirationDate: null,
  name: '',
  quantity: '1 szt.',
};

export function ShoppingPage() {
  const { accessToken } = useSession();
  const permission = usePermission('shopping');
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState<ShoppingListType>('daily');
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const lists = useQuery({
    queryKey: ['shopping', 'lists'],
    queryFn: () => listShoppingLists({ accessToken }),
  });
  const items = useQuery({
    queryKey: ['shopping', activeType],
    queryFn: () => listShoppingItems(activeType, { accessToken }),
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
            activeType,
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
      setNotice(editing ? 'Produkt został zaktualizowany.' : 'Produkt został dodany.');
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
  const move = useMutation({
    mutationFn: ({ id, targetType }: { id: string; targetType: ShoppingListType }) =>
      moveShoppingItem(id, { targetType }, { accessToken }),
    onSuccess: invalidate,
  });
  const clear = useMutation({
    mutationFn: () => clearShoppingList(activeType, { accessToken }),
    onSuccess: async (result) => {
      setNotice(`Usunięto ${result.deleted ?? 0} produktów.`);
      await invalidate();
    },
  });
  const moveTomorrow = useMutation({
    mutationFn: () => moveUncheckedShoppingToTomorrow({ accessToken }),
    onSuccess: async (result) => {
      setNotice(`Przeniesiono ${result.moved ?? 0} produktów na jutro.`);
      await invalidate();
    },
  });
  const aiImport = useMutation({
    mutationFn: () =>
      importShoppingItemsWithAi(activeType, { message: aiMessage.trim() }, { accessToken }),
    onSuccess: async (result) => {
      setAiOpen(false);
      setAiMessage('');
      setNotice(
        result.importedCount
          ? `AI dodało ${result.importedCount} produktów.`
          : `AI przygotowało ${result.plannedItems.length} produktów do listy.`
      );
      await invalidate();
    },
  });

  const grouped = useMemo(
    () =>
      (items.data ?? []).reduce<Record<string, ShoppingItem[]>>((acc, item) => {
        (acc[item.category ?? 'other'] ??= []).push(item);
        return acc;
      }, {}),
    [items.data]
  );
  const currentList = lists.data?.find((item) => item.type === activeType);
  const uncheckedCount = items.data?.filter((item) => !item.isChecked).length ?? 0;

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setFormOpen(true);
  }

  function openEdit(item: ShoppingItem) {
    setEditing(item);
    setDraft({
      category: item.category ?? 'other',
      expirationDate: item.expirationDate,
      name: item.name,
      quantity: item.quantity,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setDraft(emptyDraft);
    save.reset();
  }

  return (
    <Page>
      <PageHeader
        title="Zakupy"
        description="Trzy listy, wspólne odhaczanie, przenoszenie produktów i import z AI."
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Icon icon="solar:magic-stick-3-bold-duotone" />}
              onClick={() => setAiOpen(true)}
              disabled={!permission.canCreate}
            >
              Dodaj z AI
            </Button>
            <PrimaryButton onClick={openCreate} disabled={!permission.canCreate}>
              Dodaj produkt
            </PrimaryButton>
          </Stack>
        }
      />

      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <SectionCard>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Tabs value={activeType} onChange={(_, value) => setActiveType(value)}>
            {listTypes.map((item) => (
              <Tab key={item.value} value={item.value} label={item.label} />
            ))}
          </Tabs>
          <Stack direction="row" spacing={1}>
            {activeType === 'daily' && (
              <Button
                size="small"
                variant="soft"
                onClick={() => moveTomorrow.mutate()}
                disabled={!permission.canUpdate || !uncheckedCount || moveTomorrow.isPending}
              >
                Przenieś niekupione na jutro
              </Button>
            )}
            <Button
              size="small"
              color="error"
              onClick={() =>
                window.confirm('Wyczyścić całą aktualną listę?') && clear.mutate()
              }
              disabled={!permission.canDelete || !(items.data?.length ?? 0) || clear.isPending}
            >
              Wyczyść listę
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

      {items.isLoading ? (
        <LoadingView />
      ) : items.error ? (
        <ErrorView error={items.error} retry={() => void items.refetch()} />
      ) : (items.data?.length ?? 0) === 0 ? (
        <SectionCard>
          <EmptyState
            icon="solar:cart-check-bold-duotone"
            text={`${currentList?.name ?? 'Ta lista'} jest pusta.`}
          />
        </SectionCard>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 2.5,
          }}
        >
          {Object.entries(grouped).map(([key, groupItems]) => {
            const meta = categories[key] ?? categories.other!;
            return (
              <SectionCard key={key} title={`${meta.emoji} ${meta.label}`}>
                <Stack divider={<Divider flexItem />}>
                  {groupItems.map((item) => (
                    <Stack
                      key={item.id}
                      direction="row"
                      spacing={1}
                      sx={{ py: 1, alignItems: 'center' }}
                    >
                      <Checkbox
                        checked={item.isChecked}
                        onChange={() => toggle.mutate(item.id)}
                        disabled={!permission.canUpdate}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          noWrap
                          sx={{
                            fontWeight: 600,
                            textDecoration: item.isChecked ? 'line-through' : 'none',
                            color: item.isChecked ? 'text.disabled' : 'text.primary',
                          }}
                        >
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.quantity || '1 szt.'}
                        </Typography>
                      </Box>
                      {activeType !== 'daily' && permission.canUpdate && (
                        <IconButton
                          size="small"
                          aria-label="Przenieś na dzisiaj"
                          onClick={() => move.mutate({ id: item.id, targetType: 'daily' })}
                        >
                          <Icon icon="solar:calendar-mark-bold-duotone" />
                        </IconButton>
                      )}
                      {activeType === 'long_term' && permission.canUpdate && (
                        <IconButton
                          size="small"
                          aria-label="Przenieś na jutro"
                          onClick={() => move.mutate({ id: item.id, targetType: 'tomorrow' })}
                        >
                          <Icon icon="solar:forward-2-bold-duotone" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        aria-label="Edytuj produkt"
                        onClick={() => openEdit(item)}
                        disabled={!permission.canUpdate}
                      >
                        <Icon icon="solar:pen-bold-duotone" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Usuń produkt"
                        onClick={() => confirmDelete(item.name) && remove.mutate(item.id)}
                        disabled={!permission.canDelete}
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
        title={editing ? 'Edytuj produkt' : 'Dodaj produkt'}
        open={formOpen}
        onClose={closeForm}
        onSubmit={() => save.mutate()}
        loading={save.isPending}
        submitDisabled={!draft.name.trim()}
      >
        {save.error && <Alert severity="error">{errorMessage(save.error)}</Alert>}
        <TextField
          label="Produkt"
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
          select
          label="Kategoria"
          value={draft.category ?? 'other'}
          onChange={(event) => setDraft({ ...draft, category: event.target.value })}
        >
          {Object.entries(categories).map(([value, meta]) => (
            <MenuItem key={value} value={value}>
              {meta.emoji} {meta.label}
            </MenuItem>
          ))}
        </TextField>
      </FormDialog>

      <FormDialog
        title="AI lista zakupów"
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onSubmit={() => aiImport.mutate()}
        submitLabel="Dodaj produkty"
        loading={aiImport.isPending}
        submitDisabled={!aiMessage.trim()}
      >
        <Alert severity="info">
          Wklej wiadomość, przepis albo luźną listę. AI rozbije tekst na produkty i przypisze
          kategorie.
        </Alert>
        {aiImport.error && <Alert severity="error">{errorMessage(aiImport.error)}</Alert>}
        <TextField
          label="Treść dla AI"
          placeholder="Papryka, boczniaki, kurczak i chleb tostowy…"
          multiline
          minRows={6}
          value={aiMessage}
          onChange={(event) => setAiMessage(event.target.value)}
          autoFocus
        />
      </FormDialog>
    </Page>
  );
}
