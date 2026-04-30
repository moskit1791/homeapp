import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  checkShoppingItem,
  createShoppingItem,
  deleteShoppingItem,
  listShoppingItems,
  listShoppingLists,
  queryKeys,
  type ShoppingItem,
  type ShoppingListType
} from '../../src/api';
import { useModulePermission } from '../../src/permissions/use-permissions';
import { useSession } from '../../src/session/session-context';
import { useAppTheme, type AppPalette } from '../../src/theme/use-app-theme';
import { radii, spacing } from '../../src/theme/tokens';
import { ActionButton, AppScreen, EmptyState, IconButton, InlineAlert, QueryState } from '../../src/ui';
import { Check, Plus, RefreshCcw, ShoppingCart, Trash2 } from '../../src/ui/icon';

const listTypes: Array<{ label: string; value: ShoppingListType }> = [
  { label: 'Dzisiaj', value: 'daily' },
  { label: 'Na później', value: 'long_term' }
];

export default function ZakupyScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const { canCreate, canDelete, canRead, canUpdate, permissionsQuery } =
    useModulePermission('shopping');
  const [activeType, setActiveType] = useState<ShoppingListType>('daily');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const accessToken = session?.accessToken;

  const listsQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listShoppingLists({ accessToken }),
    queryKey: [...queryKeys.shopping, 'lists']
  });

  const itemsQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listShoppingItems(activeType, { accessToken }),
    queryKey: [...queryKeys.shopping, activeType, 'items']
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createShoppingItem(
        activeType,
        {
          name: name.trim(),
          quantity: quantity.trim() || undefined
        },
        { accessToken }
      ),
    onSuccess: async () => {
      setName('');
      setQuantity('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
    }
  });

  const checkMutation = useMutation({
    mutationFn: (id: string) => checkShoppingItem(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping })
  });

  const items = itemsQuery.data ?? [];
  const uncheckedItems = useMemo(() => items.filter((item) => !item.isChecked), [items]);
  const checkedItems = useMemo(() => items.filter((item) => item.isChecked), [items]);
  const currentList = listsQuery.data?.find((list) => list.type === activeType);
  const currentListName =
    currentList?.name ?? (activeType === 'daily' ? 'Zakupy na dziś' : 'Rzeczy na później');
  const canAdd = canCreate && Boolean(name.trim()) && !createMutation.isPending;

  function handleAdd() {
    if (canAdd) {
      createMutation.mutate();
    }
  }

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Zakupy">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (!canRead) {
    return (
      <AppScreen title="Zakupy">
        <InlineAlert tone="info" text="Nie masz uprawnienia do czytania list zakupów." />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      actions={
        <IconButton disabled={itemsQuery.isFetching} onPress={() => itemsQuery.refetch()}>
          <RefreshCcw color={theme.colors.textMuted} size={18} />
        </IconButton>
      }
      subtitle="Szybka lista domowa, bez przeklikiwania formularzy."
      title="Zakupy"
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <ShoppingCart color={theme.colors.shopping} size={24} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>{currentListName}</Text>
          <Text style={styles.heroMeta}>
            {uncheckedItems.length} do kupienia / {checkedItems.length} odhaczone
          </Text>
        </View>
      </View>

      <View style={styles.switcher}>
        {listTypes.map((item) => {
          const active = item.value === activeType;

          return (
            <Pressable
              key={item.value}
              onPress={() => setActiveType(item.value)}
              style={[styles.switchButton, active && styles.switchButtonActive]}
            >
              <Text style={[styles.switchLabel, active && styles.switchLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {canCreate ? (
        <View style={styles.composer}>
          <View style={styles.composerFields}>
            <TextInput
              onChangeText={setName}
              onSubmitEditing={handleAdd}
              placeholder="Co kupić?"
              placeholderTextColor={theme.colors.textSubtle}
              returnKeyType="done"
              style={styles.nameInput}
              value={name}
            />
            <TextInput
              onChangeText={setQuantity}
              placeholder="Ilość"
              placeholderTextColor={theme.colors.textSubtle}
              style={styles.quantityInput}
              value={quantity}
            />
          </View>
          <Pressable
            disabled={!canAdd}
            onPress={handleAdd}
            style={({ pressed }) => [
              styles.addFab,
              !canAdd && styles.addFabDisabled,
              pressed && canAdd && styles.pressed
            ]}
          >
            <Plus color={theme.colors.inverseText} size={20} />
          </Pressable>
        </View>
      ) : null}

      {createMutation.error ? <InlineAlert tone="error" text="Nie udało się dodać produktu." /> : null}

      <QueryState
        error={itemsQuery.error}
        isLoading={itemsQuery.isLoading}
      />

      {!itemsQuery.isLoading && !itemsQuery.error && items.length === 0 ? (
        <EmptyState
          action={
            canCreate ? (
              <ActionButton disabled={!name.trim()} onPress={handleAdd} size="small" title="Dodaj pierwszy produkt" />
            ) : undefined
          }
          icon={<ShoppingCart color={theme.colors.shopping} size={22} />}
          text="Wpisz produkt w polu u góry. Lista automatycznie oddzieli rzeczy kupione od tych, które jeszcze czekają."
          title="Lista jest pusta"
        />
      ) : null}

      {uncheckedItems.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Do kupienia</Text>
          {uncheckedItems.map((item) => (
            <ShoppingRow
              canDelete={canDelete}
              canUpdate={canUpdate}
              colors={theme.colors}
              deleting={deleteMutation.isPending}
              item={item}
              key={item.id}
              onCheck={() => checkMutation.mutate(item.id)}
              onDelete={() => deleteMutation.mutate(item.id)}
              updating={checkMutation.isPending}
            />
          ))}
        </View>
      ) : null}

      {checkedItems.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Kupione</Text>
          {checkedItems.map((item) => (
            <ShoppingRow
              canDelete={canDelete}
              canUpdate={canUpdate}
              colors={theme.colors}
              deleting={deleteMutation.isPending}
              item={item}
              key={item.id}
              onCheck={() => checkMutation.mutate(item.id)}
              onDelete={() => deleteMutation.mutate(item.id)}
              updating={checkMutation.isPending}
            />
          ))}
        </View>
      ) : null}
    </AppScreen>
  );
}

function ShoppingRow({
  canDelete,
  canUpdate,
  colors,
  deleting,
  item,
  onCheck,
  onDelete,
  updating
}: {
  canDelete: boolean;
  canUpdate: boolean;
  colors: AppPalette;
  deleting: boolean;
  item: ShoppingItem;
  onCheck: () => void;
  onDelete: () => void;
  updating: boolean;
}) {
  const styles = createStyles(colors);

  return (
    <View style={[styles.itemRow, item.isChecked && styles.itemRowChecked]}>
      <Pressable
        disabled={!canUpdate || updating || item.isChecked}
        onPress={onCheck}
        style={[styles.checkBox, item.isChecked && styles.checkBoxDone]}
      >
        {item.isChecked ? <Check color={colors.inverseText} size={15} /> : null}
      </Pressable>
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, item.isChecked && styles.itemNameChecked]}>{item.name}</Text>
        {item.quantity ? <Text style={styles.itemQuantity}>{item.quantity}</Text> : null}
      </View>
      {canDelete ? (
        <IconButton disabled={deleting} onPress={onDelete}>
          <Trash2 color={colors.danger} size={17} />
        </IconButton>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    addFab: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.control,
      height: 50,
      justifyContent: 'center',
      width: 50
    },
    addFabDisabled: {
      opacity: 0.42
    },
    checkBox: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 26,
      justifyContent: 'center',
      width: 26
    },
    checkBoxDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    composer: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.sm
    },
    composerFields: {
      flex: 1,
      gap: spacing.xs
    },
    group: {
      gap: spacing.sm
    },
    groupTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0,
      textTransform: 'uppercase'
    },
    hero: {
      alignItems: 'center',
      backgroundColor: colors.shoppingSoft,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radii.control,
      height: 48,
      justifyContent: 'center',
      width: 48
    },
    heroMeta: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 19
    },
    heroText: {
      flex: 1,
      gap: spacing.xs
    },
    heroTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 0
    },
    itemContent: {
      flex: 1,
      gap: spacing.xs,
      paddingRight: spacing.sm
    },
    itemName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 20
    },
    itemNameChecked: {
      color: colors.textMuted,
      textDecorationLine: 'line-through'
    },
    itemQuantity: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0
    },
    itemRow: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    itemRowChecked: {
      backgroundColor: colors.surfaceMuted,
      opacity: 0.72
    },
    nameInput: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0,
      minHeight: 30,
      paddingHorizontal: spacing.sm
    },
    pressed: {
      opacity: 0.82
    },
    quantityInput: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      minHeight: 28,
      paddingHorizontal: spacing.sm
    },
    switchButton: {
      alignItems: 'center',
      borderRadius: radii.control,
      flex: 1,
      minHeight: 40,
      justifyContent: 'center'
    },
    switchButtonActive: {
      backgroundColor: colors.card
    },
    switchLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0
    },
    switchLabelActive: {
      color: colors.text
    },
    switcher: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.control,
      flexDirection: 'row',
      gap: spacing.xs,
      padding: spacing.xs
    }
  });
}
