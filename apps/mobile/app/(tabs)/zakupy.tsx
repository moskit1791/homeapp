import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ApiError,
  checkShoppingItem,
  createShoppingItem,
  deleteShoppingItem,
  importShoppingItemsWithAi,
  listShoppingItems,
  listShoppingLists,
  queryKeys,
  type ShoppingItem,
  type ShoppingListType,
} from "../../src/api";
import { useModulePermission } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import { radii, spacing } from "../../src/theme/tokens";
import {
  ActionButton,
  AppScreen,
  EmptyState,
  FormModal,
  IconButton,
  InlineAlert,
  QueryState,
} from "../../src/ui";
import {
  Check,
  RefreshCcw,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "../../src/ui/icon";

const listTypes: Array<{ label: string; value: ShoppingListType }> = [
  { label: "Dzisiaj", value: "daily" },
  { label: "Na później", value: "long_term" },
];

export default function ZakupyScreen() {
  const { session } = useSession();
  const params = useLocalSearchParams<{ action?: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const { canCreate, canDelete, canRead, canUpdate, permissionsQuery } =
    useModulePermission("shopping");
  const [activeType, setActiveType] = useState<ShoppingListType>("daily");
  const [aiMessage, setAiMessage] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isAiVisible, setAiVisible] = useState(false);
  const [isCreateVisible, setCreateVisible] = useState(false);
  const [handledRouteAction, setHandledRouteAction] = useState<string | null>(null);
  const accessToken = session?.accessToken;

  const listsQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listShoppingLists({ accessToken }),
    queryKey: [...queryKeys.shopping, "lists"],
  });

  const itemsQuery = useQuery({
    enabled: canRead && Boolean(accessToken),
    queryFn: () => listShoppingItems(activeType, { accessToken }),
    queryKey: [...queryKeys.shopping, activeType, "items"],
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createShoppingItem(
        activeType,
        {
          name: name.trim(),
          quantity: quantity.trim() || undefined,
        },
        { accessToken },
      ),
    onSuccess: async () => {
      setName("");
      setQuantity("");
      setCreateVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
    },
  });

  const aiImportMutation = useMutation({
    mutationFn: () =>
      importShoppingItemsWithAi(
        activeType,
        {
          message: aiMessage.trim(),
        },
        { accessToken },
      ),
    onSuccess: async () => {
      setAiMessage("");
      setAiVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
    },
  });

  const checkMutation = useMutation({
    mutationFn: (id: string) => checkShoppingItem(id, { accessToken }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id, { accessToken }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });

  const items = itemsQuery.data ?? [];
  const uncheckedItems = useMemo(
    () => items.filter((item) => !item.isChecked),
    [items],
  );
  const checkedItems = useMemo(
    () => items.filter((item) => item.isChecked),
    [items],
  );
  const currentList = listsQuery.data?.find((list) => list.type === activeType);
  const currentListName =
    currentList?.name ??
    (activeType === "daily" ? "Zakupy na dziś" : "Rzeczy na później");
  const canAdd = canCreate && Boolean(name.trim()) && !createMutation.isPending;
  const canImportAi =
    canCreate && Boolean(aiMessage.trim()) && !aiImportMutation.isPending;

  function handleAdd() {
    if (canAdd) {
      createMutation.mutate();
    }
  }

  function handleAiImport() {
    if (canImportAi) {
      aiImportMutation.mutate();
    }
  }

  useEffect(() => {
    if (!params.action) {
      setHandledRouteAction(null);
      return;
    }

    if (params.action !== "item" || handledRouteAction === params.action || !canCreate) {
      return;
    }

    setCreateVisible(true);
    setHandledRouteAction(params.action);
    router.setParams({ action: undefined });
  }, [canCreate, handledRouteAction, params.action, router]);

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
        <InlineAlert
          tone="info"
          text="Nie masz uprawnienia do czytania list zakupów."
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      actions={
        <View style={styles.topActions}>
          {canCreate ? (
            <>
              <IconButton
                accessibilityLabel="AI do listy zakupów"
                onPress={() => {
                  aiImportMutation.reset();
                  setAiVisible(true);
                }}
                style={styles.aiIconButton}
              >
                <Sparkles color={theme.colors.inverseText} size={19} />
              </IconButton>
              <ActionButton
                onPress={() => {
                  aiImportMutation.reset();
                  setAiVisible(true);
                }}
                size="small"
                style={styles.aiTextButton}
                title="AI"
                variant="secondary"
              />
              <ActionButton
                onPress={() => setCreateVisible(true)}
                size="small"
                title="+ Dodaj"
              />
            </>
          ) : null}
          <IconButton
            disabled={itemsQuery.isFetching}
            onPress={() => itemsQuery.refetch()}
          >
            <RefreshCcw color={theme.colors.textMuted} size={18} />
          </IconButton>
        </View>
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
            {uncheckedItems.length} do kupienia / {checkedItems.length}{" "}
            odhaczone
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
              <Text
                style={[styles.switchLabel, active && styles.switchLabelActive]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <QueryState error={itemsQuery.error} isLoading={itemsQuery.isLoading} />

      {!itemsQuery.isLoading && !itemsQuery.error && items.length === 0 ? (
        <EmptyState
          action={
            canCreate ? (
              <ActionButton
                onPress={() => setCreateVisible(true)}
                size="small"
                title="Dodaj pierwszy produkt"
              />
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

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              disabled={aiImportMutation.isPending}
              onPress={() => {
                aiImportMutation.reset();
                setAiVisible(false);
              }}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canImportAi}
              loading={aiImportMutation.isPending}
              onPress={handleAiImport}
              style={styles.modalFooterButton}
              title="Uporządkuj"
            />
          </View>
        }
        onClose={() => {
          if (!aiImportMutation.isPending) {
            aiImportMutation.reset();
            setAiVisible(false);
          }
        }}
        subtitle={
          activeType === "daily"
            ? "AI zapisze produkty na liście dzisiejszej."
            : "AI zapisze produkty na liście długoterminowej."
        }
        title="AI zakupy"
        visible={isAiVisible}
      >
        <View style={styles.aiStatus}>
          {aiImportMutation.isPending ? (
            <ActivityIndicator color={theme.colors.shopping} />
          ) : (
            <Sparkles color={theme.colors.shopping} size={19} />
          )}
          <Text style={styles.aiStatusText}>
            {aiImportMutation.isPending
              ? "Gemini porządkuje listę i sprawdza, czy nic nie zginęło."
              : "Wklej listę tak, jak ją masz w głowie."}
          </Text>
        </View>
        <TextInput
          autoFocus
          editable={!aiImportMutation.isPending}
          multiline
          onChangeText={(value) => {
            if (aiImportMutation.error) {
              aiImportMutation.reset();
            }

            setAiMessage(value);
          }}
          placeholder="Papryka, boczniaki, (kurczak), chleb tostowy..."
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.aiInput}
          textAlignVertical="top"
          value={aiMessage}
        />
        {aiImportMutation.error ? (
          <InlineAlert tone="error" text={getAiErrorMessage(aiImportMutation.error)} />
        ) : null}
      </FormModal>

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setCreateVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canAdd}
              loading={createMutation.isPending}
              onPress={handleAdd}
              style={styles.modalFooterButton}
              title="Dodaj"
            />
          </View>
        }
        onClose={() => setCreateVisible(false)}
        subtitle={
          activeType === "daily"
            ? "Dodajesz produkt do listy na dzisiaj."
            : "Dodajesz produkt do listy długoterminowej."
        }
        title="Dodaj produkt"
        visible={isCreateVisible}
      >
        <TextInput
          autoFocus
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
          placeholder="Ilość, opakowanie lub notatka"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.quantityInput}
          value={quantity}
        />
        {createMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się dodać produktu." />
        ) : null}
      </FormModal>
    </AppScreen>
  );
}

function getAiErrorMessage(error: unknown): string {
  const clarification = getAiClarificationMessage(error);

  if (clarification) {
    return clarification;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Nie udało się uporządkować listy przez AI.";
}

function getAiClarificationMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || !isRecord(error.details)) {
    return undefined;
  }

  const details = error.details.details;

  if (!isRecord(details) || typeof details.clarificationMessage !== "string") {
    return undefined;
  }

  return details.clarificationMessage.trim() || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ShoppingRow({
  canDelete,
  canUpdate,
  colors,
  deleting,
  item,
  onCheck,
  onDelete,
  updating,
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
        <Text
          style={[styles.itemName, item.isChecked && styles.itemNameChecked]}
        >
          {item.name}
        </Text>
        {item.quantity ? (
          <Text style={styles.itemQuantity}>{item.quantity}</Text>
        ) : null}
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
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radii.control,
      height: 50,
      justifyContent: "center",
      width: 50,
    },
    addFabDisabled: {
      opacity: 0.42,
    },
    aiIconButton: {
      backgroundColor: colors.shopping,
      borderColor: colors.shopping,
    },
    aiTextButton: {
      borderColor: colors.shopping,
      minWidth: 48,
    },
    aiInput: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      letterSpacing: 0,
      lineHeight: 21,
      minHeight: 170,
      padding: spacing.md,
    },
    aiStatus: {
      alignItems: "center",
      backgroundColor: colors.shoppingSoft,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    aiStatusText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 18,
    },
    checkBox: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 26,
      justifyContent: "center",
      width: 26,
    },
    checkBoxDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    composer: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    composerFields: {
      flex: 1,
      gap: spacing.xs,
    },
    group: {
      gap: spacing.sm,
    },
    groupTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    hero: {
      alignItems: "center",
      backgroundColor: colors.shoppingSoft,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.lg,
    },
    heroIcon: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.control,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    heroMeta: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 19,
    },
    heroText: {
      flex: 1,
      gap: spacing.xs,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0,
    },
    itemContent: {
      flex: 1,
      gap: spacing.xs,
      paddingRight: spacing.sm,
    },
    itemName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 20,
    },
    itemNameChecked: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    itemQuantity: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
    },
    itemRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    itemRowChecked: {
      backgroundColor: colors.surfaceMuted,
      opacity: 0.72,
    },
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    nameInput: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0,
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    pressed: {
      opacity: 0.82,
    },
    quantityInput: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      minHeight: 46,
      paddingHorizontal: spacing.md,
    },
    switchButton: {
      alignItems: "center",
      borderRadius: radii.control,
      flex: 1,
      minHeight: 40,
      justifyContent: "center",
    },
    switchButtonActive: {
      backgroundColor: colors.card,
    },
    switchLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    switchLabelActive: {
      color: colors.text,
    },
    switcher: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.control,
      flexDirection: "row",
      gap: spacing.xs,
      padding: spacing.xs,
    },
    topActions: {
      flexDirection: "row",
      gap: spacing.xs,
    },
  });
}
