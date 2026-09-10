import type { ShoppingItem, ShoppingListType } from '../api';

import { Icon } from '@iconify/react';
import { useSearchParams } from 'react-router';
import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Box,
  Tab,
  Menu,
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
import { useEncryption } from '../auth/encryption-context';
import { FoodNavigation } from '../components/food-navigation';
import meatImage from '../../../../mobile/assets/shopping-category-meat.png';
import careImage from '../../../../mobile/assets/shopping-category-care.png';
import dairyImage from '../../../../mobile/assets/shopping-category-dairy.png';
import bakeryImage from '../../../../mobile/assets/shopping-category-bakery.png';
import drinksImage from '../../../../mobile/assets/shopping-category-drinks.png';
import snacksImage from '../../../../mobile/assets/shopping-category-snacks.png';
import pantryImage from '../../../../mobile/assets/shopping-category-pantry.png';
import familyImage from '../../../../mobile/assets/shopping-category-family.png';
import produceImage from '../../../../mobile/assets/shopping-category-produce.png';
import defaultImage from '../../../../mobile/assets/shopping-category-default.png';
import cleaningImage from '../../../../mobile/assets/shopping-category-cleaning.png';
import {
  SHOPPING_CATEGORIES,
  getShoppingCategoryMeta,
  categorizeShoppingProduct,
  getShoppingProductSuggestions,
} from '../utils/shopping-catalog';
import {
  Page,
  ErrorView,
  EmptyState,
  FormDialog,
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

function categoryImage(category: string) {
  if (/owoce|warzywa|zioła/i.test(category)) return produceImage;
  if (/mięso|wędliny|ryby|owoce morza/i.test(category)) return meatImage;
  if (/nabiał|jaja/i.test(category)) return dairyImage;
  if (/pieczywo|pieczenie/i.test(category)) return bakeryImage;
  if (/woda|napoje|kawa|herbata|alkohole/i.test(category)) return drinksImage;
  if (/słodycze|przekąski/i.test(category)) return snacksImage;
  if (/środki czystości|dom i ogród/i.test(category)) return cleaningImage;
  if (/higiena|apteczka/i.test(category)) return careImage;
  if (/dziecko|zwierząt|ubrania|papiernicze|elektronika/i.test(category)) return familyImage;
  if (/sypkie|konserwy|przetwory|mrożonki|przyprawy|dania gotowe|wege/i.test(category)) {
    return pantryImage;
  }
  return defaultImage;
}

function categoryPresentation(category: string) {
  const meta = getShoppingCategoryMeta(category);
  return {
    color: meta.color,
    emoji: meta.emoji,
    image: categoryImage(meta.title),
    label: meta.title,
  };
}

type ItemDraft = Pick<ShoppingItem, 'category' | 'expirationDate' | 'name' | 'quantity'>;

const emptyDraft: ItemDraft = {
  category: 'Inne',
  expirationDate: null,
  name: '',
  quantity: '1 szt.',
};

export function ShoppingPage() {
  const { accessToken } = useSession();
  const permission = usePermission('shopping');
  const encryption = useEncryption();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeType, setActiveType] = useState<ShoppingListType>('daily');
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuItem, setMenuItem] = useState<ShoppingItem | null>(null);
  const [aiDisclosureOpen, setAiDisclosureOpen] = useState(false);

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
        (acc[getShoppingCategoryMeta(item.category).title] ??= []).push(item);
        return acc;
      }, {}),
    [items.data]
  );
  const productSuggestions = useMemo(
    () => getShoppingProductSuggestions(draft.name, 8),
    [draft.name]
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
      category: item.category ?? 'Inne',
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

  function closeItemMenu() {
    setMenuAnchor(null);
    setMenuItem(null);
  }

  function requestAiImport() {
    if (encryption.settings?.enabledModules.includes('shopping')) {
      setAiDisclosureOpen(true);
      return;
    }
    aiImport.mutate();
  }

  const routeAction = searchParams.get('action');

  useEffect(() => {
    if (!permission.canCreate || (routeAction !== 'create' && routeAction !== 'ai')) return;
    if (routeAction === 'ai') {
      setAiOpen(true);
    } else {
      setEditing(null);
      setDraft(emptyDraft);
      setFormOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [permission.canCreate, routeAction, searchParams, setSearchParams]);

  return (
    <Page>
      <FoodNavigation
        description="Wspólne zakupy, trzy terminy i szybkie dodawanie produktów."
        actions={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
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

      <SectionCard sx={{ p: 0 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Tabs
            value={activeType}
            onChange={(_, value) => setActiveType(value)}
            variant="scrollable"
            scrollButtons={false}
            sx={{ minHeight: 42, '& .MuiTab-root': { minHeight: 42, borderRadius: 1.25 } }}
          >
            {listTypes.map((item) => (
              <Tab key={item.value} value={item.value} label={item.label} />
            ))}
          </Tabs>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
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
              onClick={() => window.confirm('Wyczyścić całą aktualną listę?') && clear.mutate()}
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
            const meta = categoryPresentation(key);
            return (
              <SectionCard key={key} sx={{ position: 'relative', overflow: 'hidden' }}>
                <Stack direction="row" spacing={1.25} sx={{ mb: 1.5, alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      display: 'grid',
                      flexShrink: 0,
                      placeItems: 'center',
                      borderRadius: 1.4,
                      bgcolor: `${meta.color}18`,
                      fontSize: 21,
                    }}
                  >
                    {meta.emoji}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="h5">{meta.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {groupItems.filter((item) => !item.isChecked).length} do kupienia
                    </Typography>
                  </Box>
                  <Box
                    component="img"
                    src={meta.image}
                    alt=""
                    sx={{
                      width: 72,
                      height: 58,
                      flexShrink: 0,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 8px 9px rgba(0,0,0,.16))',
                    }}
                  />
                </Stack>
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
                          onClick={() => permission.canUpdate && openEdit(item)}
                          sx={{
                            fontWeight: 600,
                            cursor: permission.canUpdate ? 'pointer' : 'default',
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
                          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                        >
                          <Icon icon="solar:calendar-mark-bold-duotone" />
                        </IconButton>
                      )}
                      {activeType === 'long_term' && permission.canUpdate && (
                        <IconButton
                          size="small"
                          aria-label="Przenieś na jutro"
                          onClick={() => move.mutate({ id: item.id, targetType: 'tomorrow' })}
                          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                        >
                          <Icon icon="solar:forward-2-bold-duotone" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        aria-label="Edytuj produkt"
                        onClick={() => openEdit(item)}
                        disabled={!permission.canUpdate}
                        sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                      >
                        <Icon icon="solar:pen-bold-duotone" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Usuń produkt"
                        onClick={() => confirmDelete(item.name) && remove.mutate(item.id)}
                        disabled={!permission.canDelete}
                        sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                      >
                        <Icon icon="solar:trash-bin-trash-bold-duotone" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Akcje produktu ${item.name}`}
                        onClick={(event) => {
                          setMenuAnchor(event.currentTarget);
                          setMenuItem(item);
                        }}
                        sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                      >
                        <Icon icon="solar:menu-dots-bold" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              </SectionCard>
            );
          })}
        </Box>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeItemMenu}>
        <MenuItem
          disabled={!permission.canUpdate}
          sx={{ gap: 1 }}
          onClick={() => {
            const item = menuItem;
            closeItemMenu();
            if (item) openEdit(item);
          }}
        >
          <Icon icon="solar:pen-bold-duotone" width={20} />
          Edytuj
        </MenuItem>
        {activeType !== 'daily' && (
          <MenuItem
            disabled={!permission.canUpdate}
            sx={{ gap: 1 }}
            onClick={() => {
              const item = menuItem;
              closeItemMenu();
              if (item) move.mutate({ id: item.id, targetType: 'daily' });
            }}
          >
            <Icon icon="solar:calendar-mark-bold-duotone" width={20} />
            Przenieś na dzisiaj
          </MenuItem>
        )}
        {activeType === 'long_term' && (
          <MenuItem
            disabled={!permission.canUpdate}
            sx={{ gap: 1 }}
            onClick={() => {
              const item = menuItem;
              closeItemMenu();
              if (item) move.mutate({ id: item.id, targetType: 'tomorrow' });
            }}
          >
            <Icon icon="solar:forward-2-bold-duotone" width={20} />
            Przenieś na jutro
          </MenuItem>
        )}
        <MenuItem
          disabled={!permission.canDelete}
          onClick={() => {
            const item = menuItem;
            closeItemMenu();
            if (item && confirmDelete(item.name)) remove.mutate(item.id);
          }}
          sx={{ gap: 1, color: 'error.main' }}
        >
          <Icon icon="solar:trash-bin-trash-bold-duotone" width={20} />
          Usuń
        </MenuItem>
      </Menu>

      <FormDialog
        title={editing ? 'Edytuj produkt' : 'Dodaj produkt'}
        subtitle={
          editing ? 'Zmień nazwę, ilość lub kategorię.' : 'Dodaj produkt do wybranej listy.'
        }
        icon="solar:cart-plus-bold-duotone"
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
          onChange={(event) => {
            const nextName = event.target.value;
            setDraft({
              ...draft,
              name: nextName,
              category: categorizeShoppingProduct(nextName),
            });
          }}
          required
          autoFocus
        />
        {productSuggestions.length > 0 && (
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
            {productSuggestions.map((suggestion) => (
              <Button
                key={suggestion.name}
                size="small"
                variant="soft"
                onClick={() =>
                  setDraft({
                    ...draft,
                    name: suggestion.name,
                    category: suggestion.category,
                  })
                }
              >
                {suggestion.name}
              </Button>
            ))}
          </Stack>
        )}
        <TextField
          label="Ilość"
          value={draft.quantity}
          onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
        />
        <TextField
          select
          label="Kategoria"
          value={draft.category ?? 'Inne'}
          onChange={(event) => setDraft({ ...draft, category: event.target.value })}
        >
          {SHOPPING_CATEGORIES.map((value) => {
            const meta = getShoppingCategoryMeta(value);
            return (
              <MenuItem key={value} value={value}>
                {meta.emoji} {meta.title}
              </MenuItem>
            );
          })}
        </TextField>
      </FormDialog>

      <FormDialog
        title="AI lista zakupów"
        subtitle="Opisz zakupy własnymi słowami, a asystent uporządkuje listę."
        icon="solar:magic-stick-3-bold-duotone"
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onSubmit={requestAiImport}
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
      <FormDialog
        title="Wysłać dane do AI?"
        subtitle="Ta operacja wymaga jawnej zgody przy włączonym szyfrowaniu."
        icon="solar:shield-warning-bold-duotone"
        open={aiDisclosureOpen}
        onClose={() => setAiDisclosureOpen(false)}
        onSubmit={() => {
          setAiDisclosureOpen(false);
          aiImport.mutate();
        }}
        submitLabel="Zgadzam się i wyślij"
      >
        <Alert severity="warning">
          Udostępniasz treść chronioną szyfrowaniem. Na potrzeby tej funkcji zostanie ona
          odszyfrowana i wysłana do zewnętrznej usługi AI.
        </Alert>
      </FormDialog>
    </Page>
  );
}
