import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SHOPPING_CATEGORIES,
  categorizeShoppingProduct,
  getShoppingCategoryMeta,
  getShoppingProductSuggestions,
  isShoppingCategory,
  type ShoppingCategory,
} from "@homeapp/shared-types";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { setStringAsync } from "expo-clipboard";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { Calendar, LocaleConfig, type DateData } from "react-native-calendars";
import {
  chatMealPlanWithAi,
  clearShoppingList,
  createMealPlan,
  deleteMealSlot,
  createShoppingItem,
  deleteShoppingItem,
  finalizeMealPlanWithAi,
  getCurrentMealPlanWeek,
  getMealPlanWeek,
  getMyHousehold,
  importShoppingItemsWithAi,
  listMealPlanHistory,
  listShoppingItems,
  listShoppingLists,
  moveShoppingItem,
  moveUncheckedShoppingToTomorrow,
  queryKeys,
  generateMealPlanAiPrompt,
  type MealPlanAiDraftEntry,
  type MealPlanAiMessage,
  type MealPlanEntry,
  type MealPlanDetail,
  type MealPlanSummary,
  type ShoppingItem,
  type ShoppingListType,
  toggleShoppingItem,
  updateShoppingItem,
  upsertMealSlot,
} from "../../src/api";
import {
  hasModuleRead,
  useModulePermission,
  usePermissions,
} from "../../src/permissions/use-permissions";
import {
  loadStoredJson,
  saveStoredJson,
} from "../../src/session/secure-session-store";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import { useDebouncedOptimisticToggle } from "../../src/utils/use-debounced-optimistic-toggle";
import {
  ActionButton,
  AppScreen,
  FormModal,
  IconButton,
  InlineAlert,
  QueryState,
  SegmentedControl,
} from "../../src/ui";
import {
  CalendarDays,
  Check,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Sparkles,
  TableLarge,
  Trash2,
  Utensils,
  ViewGrid,
} from "../../src/ui/icon";
import shoppingCategoryDairyImage from "../../assets/shopping-category-dairy.png";
import shoppingCategoryBakeryImage from "../../assets/shopping-category-bakery.png";
import shoppingCategoryCareImage from "../../assets/shopping-category-care.png";
import shoppingCategoryCleaningImage from "../../assets/shopping-category-cleaning.png";
import shoppingCategoryDefaultImage from "../../assets/shopping-category-default.png";
import shoppingCategoryDoneImage from "../../assets/shopping-category-done.png";
import shoppingCategoryDrinksImage from "../../assets/shopping-category-drinks.png";
import shoppingCategoryFamilyImage from "../../assets/shopping-category-family.png";
import shoppingCategoryMeatImage from "../../assets/shopping-category-meat.png";
import shoppingCategoryPantryImage from "../../assets/shopping-category-pantry.png";
import shoppingCategoryProduceImage from "../../assets/shopping-category-produce.png";
import shoppingCategorySnacksImage from "../../assets/shopping-category-snacks.png";

type MainSegment = "shopping" | "meals" | "pantry";
type MealLayout = "list" | "cards";

const mealLayoutStorageKey = "homeapp.meals.layout.v1";

const listTypes: Array<{ label: string; value: ShoppingListType }> = [
  { label: "Dzisiaj", value: "daily" },
  { label: "Jutro", value: "tomorrow" },
  { label: "Na później", value: "long_term" },
];

LocaleConfig.locales.pl = {
  dayNames: [
    "Niedziela",
    "Poniedziałek",
    "Wtorek",
    "Środa",
    "Czwartek",
    "Piątek",
    "Sobota",
  ],
  dayNamesShort: ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"],
  monthNames: [
    "Styczeń",
    "Luty",
    "Marzec",
    "Kwiecień",
    "Maj",
    "Czerwiec",
    "Lipiec",
    "Sierpień",
    "Wrzesień",
    "Październik",
    "Listopad",
    "Grudzień",
  ],
  monthNamesShort: [
    "Sty",
    "Lut",
    "Mar",
    "Kwi",
    "Maj",
    "Cze",
    "Lip",
    "Sie",
    "Wrz",
    "Paź",
    "Lis",
    "Gru",
  ],
  today: "Dzisiaj",
};
LocaleConfig.defaultLocale = "pl";

export default function ListaScreen() {
  const params = useLocalSearchParams<{
    action?: string;
    segment?: MainSegment;
  }>();
  const router = useRouter();
  const permissionsQuery = usePermissions();
  const shoppingPermission = useModulePermission("shopping");
  const mealPermission = useModulePermission("meal_planner");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const [activeSegment, setActiveSegment] = useState<MainSegment>("shopping");
  const [shoppingAiOpenRequest, setShoppingAiOpenRequest] = useState(0);
  const [mealAiOpenRequest, setMealAiOpenRequest] = useState(0);
  const [mealViewResetRequest, setMealViewResetRequest] = useState(0);
  const [mealLayout, setMealLayout] = useState<MealLayout>("list");
  const [mealLayoutLoaded, setMealLayoutLoaded] = useState(false);
  const clearRouteAction = useCallback(() => {
    router.setParams({ action: undefined });
  }, [router]);
  const availableSegments = useMemo(
    () =>
      [
        shoppingPermission.canRead
          ? { label: "Zakupy", value: "shopping" as const }
          : null,
        mealPermission.canRead
          ? { label: "Posiłki", value: "meals" as const }
          : null,
        shoppingPermission.canRead
          ? { label: "Spiżarnia", value: "pantry" as const }
          : null,
      ].filter(Boolean) as Array<{ label: string; value: MainSegment }>,
    [mealPermission.canRead, shoppingPermission.canRead],
  );

  useEffect(() => {
    if (
      availableSegments.length > 0 &&
      !availableSegments.some((segment) => segment.value === activeSegment)
    ) {
      selectMainSegment(availableSegments[0]!.value);
    }
  }, [activeSegment, availableSegments]);

  useEffect(() => {
    if (
      params.segment &&
      availableSegments.some((segment) => segment.value === params.segment)
    ) {
      selectMainSegment(params.segment);
    }
  }, [availableSegments, params.segment]);

  useFocusEffect(
    useCallback(() => {
      if (activeSegment === "meals") {
        setMealViewResetRequest((value) => value + 1);
      }
    }, [activeSegment]),
  );

  useEffect(() => {
    let isMounted = true;

    loadStoredJson<{ layout?: MealLayout }>(mealLayoutStorageKey)
      .then((storedLayout) => {
        if (!isMounted) {
          return;
        }

        if (
          storedLayout?.layout === "list" ||
          storedLayout?.layout === "cards"
        ) {
          setMealLayout(storedLayout.layout);
        }

        setMealLayoutLoaded(true);
      })
      .catch(() => {
        if (isMounted) {
          setMealLayoutLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mealLayoutLoaded) {
      return;
    }

    saveStoredJson(mealLayoutStorageKey, { layout: mealLayout });
  }, [mealLayout, mealLayoutLoaded]);

  function selectMainSegment(segment: MainSegment) {
    setActiveSegment(segment);

    if (segment === "meals") {
      setMealViewResetRequest((value) => value + 1);
    }
  }

  function toggleMealLayout() {
    setMealLayout((layout) => (layout === "list" ? "cards" : "list"));
  }

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Jedzenie">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (!hasModuleRead(permissionsQuery.data, ["shopping", "meal_planner"])) {
    return (
      <AppScreen title="Jedzenie">
        <InlineAlert text="Nie masz dostępu do listy zakupów ani planu posiłków." />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      actions={
        activeSegment === "shopping" && shoppingPermission.canCreate ? (
          <IconButton
            accessibilityLabel="AI do listy zakupów"
            onPress={() => setShoppingAiOpenRequest((value) => value + 1)}
            style={styles.aiHeaderButton}
          >
            <Sparkles color={theme.colors.primary} size={22} />
          </IconButton>
        ) : activeSegment === "meals" ? (
          <View style={styles.headerActions}>
            {mealPermission.canCreate && mealPermission.canUpdate ? (
              <IconButton
                accessibilityLabel="AI do planu posilkow"
                onPress={() => setMealAiOpenRequest((value) => value + 1)}
                style={styles.aiHeaderButton}
              >
                <Sparkles color={theme.colors.food} size={22} />
              </IconButton>
            ) : null}
            <IconButton
              accessibilityLabel={
                mealLayout === "list"
                  ? "Zmien uklad posilkow na kafelki"
                  : "Zmien uklad posilkow na liste"
              }
              onPress={toggleMealLayout}
              style={styles.mealLayoutButton}
            >
              {mealLayout === "list" ? (
                <ViewGrid color={theme.colors.food} size={21} />
              ) : (
                <TableLarge color={theme.colors.food} size={21} />
              )}
            </IconButton>
          </View>
        ) : undefined
      }
      title="Jedzenie"
    >
      <SegmentedControl
        onChange={selectMainSegment}
        options={availableSegments}
        value={activeSegment}
      />

      {activeSegment === "shopping" ? (
        <ShoppingBoard
          action={params.action}
          aiOpenRequest={shoppingAiOpenRequest}
          onRouteActionHandled={clearRouteAction}
        />
      ) : null}
      {activeSegment === "meals" ? (
        <MealsBoard
          action={params.action}
          aiOpenRequest={mealAiOpenRequest}
          layout={mealLayout}
          onRouteActionHandled={clearRouteAction}
          resetRequest={mealViewResetRequest}
        />
      ) : null}
      {activeSegment === "pantry" ? (
        <PantryBoard />
      ) : null}
    </AppScreen>
  );
}

function ShoppingBoard({
  action,
  aiOpenRequest,
  onRouteActionHandled,
}: {
  action?: string;
  aiOpenRequest: number;
  onRouteActionHandled: () => void;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("shopping");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [activeType, setActiveType] = useState<ShoppingListType>("daily");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiNotice, setAiNotice] = useState("");
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [handledAiOpenRequest, setHandledAiOpenRequest] =
    useState(aiOpenRequest);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [clearFinalConfirmVisible, setClearFinalConfirmVisible] =
    useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [toggleError, setToggleError] = useState("");
  const shoppingItemsQueryKey = useMemo(
    () => [...queryKeys.shopping, activeType, "items"] as const,
    [activeType],
  );
  const productSuggestions = useMemo(
    () => getShoppingProductSuggestions(name, 8),
    [name],
  );
  const suggestedCategory = useMemo(
    () => (name.trim() ? categorizeShoppingProduct(name) : null),
    [name],
  );

  useEffect(() => {
    if (action === "addShopping") {
      setModalVisible(true);
      onRouteActionHandled();
    }
  }, [action, onRouteActionHandled]);

  useEffect(() => {
    if (aiOpenRequest > handledAiOpenRequest) {
      setHandledAiOpenRequest(aiOpenRequest);
      setAiModalVisible(true);
    }
  }, [aiOpenRequest, handledAiOpenRequest]);

  const listsQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listShoppingLists({ accessToken }),
    queryKey: [...queryKeys.shopping, "lists"],
  });
  const itemsQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listShoppingItems(activeType, { accessToken }),
    queryKey: shoppingItemsQueryKey,
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createShoppingItem(
        activeType,
        {
          category: categorizeShoppingProduct(name),
          name: name.trim(),
          quantity: quantity.trim() || undefined,
        },
        { accessToken },
      ),
    onSuccess: async () => {
      setName("");
      setQuantity("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const shoppingToggle = useDebouncedOptimisticToggle<ShoppingItem>({
    getId: (item) => item.id,
    getValue: (item) => item.isChecked,
    onError: () => {
      setToggleError("Nie udało się zapisać zmiany. Cofnąłem stan produktu.");
      setTimeout(() => setToggleError(""), 2600);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
    queryClient,
    queryKey: shoppingItemsQueryKey,
    setValue: (item, isChecked) => {
      const now = new Date().toISOString();

      return {
        ...item,
        checkedAt: isChecked ? now : null,
        isChecked,
        updatedAt: now,
      };
    },
    sync: (id) => toggleShoppingItem(id, { accessToken }),
  });
  const clearMutation = useMutation({
    mutationFn: () => {
      shoppingToggle.cancelAll();
      return clearShoppingList(activeType, { accessToken });
    },
    onSuccess: async () => {
      setClearConfirmVisible(false);
      setClearFinalConfirmVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id, { accessToken }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });
  const moveMutation = useMutation({
    mutationFn: ({
      id,
      targetType,
    }: {
      id: string;
      targetType: ShoppingListType;
    }) => moveShoppingItem(id, { targetType }, { accessToken }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });
  const moveUncheckedMutation = useMutation({
    mutationFn: async () => {
      await shoppingToggle.flushAll();
      return moveUncheckedShoppingToTomorrow({ accessToken });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });
  const aiImportMutation = useMutation({
    mutationFn: () =>
      importShoppingItemsWithAi(
        activeType,
        { message: aiMessage.trim() },
        { accessToken },
      ),
    onSuccess: async (result) => {
      setAiMessage("");
      setAiModalVisible(false);
      setAiNotice(`AI dodało ${result.importedCount} pozycji do listy.`);
      setTimeout(() => setAiNotice(""), 2600);
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });

  const items = itemsQuery.data ?? [];
  const uncheckedItems = items.filter((item) => !item.isChecked);
  const checkedItems = items.filter((item) => item.isChecked);
  const groups = groupShoppingItems(uncheckedItems);
  const currentList =
    listsQuery.data?.find((list) => list.type === activeType)?.name ??
    (activeType === "daily"
      ? "Zakupy na dziś"
      : activeType === "tomorrow"
        ? "Zakupy na jutro"
        : "Lista na później");
  const canAdd =
    permission.canCreate && Boolean(name.trim()) && !createMutation.isPending;
  const canImportWithAi =
    permission.canCreate &&
    aiMessage.trim().length >= 3 &&
    !aiImportMutation.isPending;

  return (
    <>
      <SegmentedControl
        onChange={setActiveType}
        options={listTypes}
        value={activeType}
      />

      <QueryState error={itemsQuery.error} isLoading={itemsQuery.isLoading} />

      <View style={styles.listHeader}>
        <View>
          <Text style={styles.sectionTitle}>{currentList}</Text>
          <Text style={styles.sectionMeta}>
            {uncheckedItems.length} do kupienia / {checkedItems.length} kupione
          </Text>
        </View>
        {permission.canCreate ? (
          <Pressable
            onPress={() => setModalVisible(true)}
            style={styles.fabInline}
          >
            <Plus color={theme.colors.card} size={22} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.quickActions}>
        {activeType === "daily" &&
        uncheckedItems.length > 0 &&
        permission.canUpdate ? (
          <ActionButton
            disabled={moveUncheckedMutation.isPending}
            loading={moveUncheckedMutation.isPending}
            onPress={() => moveUncheckedMutation.mutate()}
            size="small"
            title="Przenieś niekupione na jutro"
            variant="secondary"
          />
        ) : null}
        {items.length > 0 && permission.canDelete ? (
          <ActionButton
            disabled={clearMutation.isPending}
            loading={clearMutation.isPending}
            onPress={() => setClearConfirmVisible(true)}
            size="small"
            title="Wyczyść całą listę"
            variant="ghost"
          />
        ) : null}
      </View>
      {aiNotice ? <InlineAlert text={aiNotice} /> : null}
      {toggleError ? <InlineAlert text={toggleError} tone="error" /> : null}

      {!itemsQuery.isLoading &&
      uncheckedItems.length === 0 &&
      checkedItems.length === 0 ? (
        <InlineAlert text="Lista jest pusta. Dodaj produkt, żeby zacząć planowanie." />
      ) : null}

      <View style={styles.groupList}>
        {groups.map((group) => (
          <ShoppingGroupCard
            canDelete={permission.canDelete}
            canUpdate={permission.canUpdate}
            deleting={deleteMutation.isPending}
            group={group}
            key={group.title}
            listType={activeType}
            moving={moveMutation.isPending}
            onCheck={(item) => shoppingToggle.toggle(item.id)}
            onDelete={(item) => {
              shoppingToggle.cancel(item.id);
              deleteMutation.mutate(item.id);
            }}
            onMove={(item, targetType) => {
              shoppingToggle.cancel(item.id);
              moveMutation.mutate({ id: item.id, targetType });
            }}
            isUpdating={shoppingToggle.isSyncing}
          />
        ))}
        {checkedItems.length > 0 ? (
          <ShoppingGroupCard
            canDelete={permission.canDelete}
            canUpdate={permission.canUpdate}
            deleting={deleteMutation.isPending}
            group={{
              category: "Inne",
              emoji: "✓",
              items: checkedItems,
              title: "Kupione",
            }}
            listType={activeType}
            moving={moveMutation.isPending}
            onCheck={(item) => shoppingToggle.toggle(item.id)}
            onDelete={(item) => {
              shoppingToggle.cancel(item.id);
              deleteMutation.mutate(item.id);
            }}
            onMove={(item, targetType) => {
              shoppingToggle.cancel(item.id);
              moveMutation.mutate({ id: item.id, targetType });
            }}
            isUpdating={shoppingToggle.isSyncing}
          />
        ) : null}
      </View>

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setModalVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canAdd}
              loading={createMutation.isPending}
              onPress={() => createMutation.mutate()}
              style={styles.modalFooterButton}
              title="Dodaj"
            />
          </View>
        }
        onClose={() => setModalVisible(false)}
        subtitle={
          activeType === "daily"
            ? "Dodajesz produkt na dziś."
            : activeType === "tomorrow"
              ? "Dodajesz produkt na jutro."
              : "Dodajesz produkt na później."
        }
        title="Dodaj produkt"
        visible={modalVisible}
      >
        <TextInput
          autoFocus
          onChangeText={setName}
          onSubmitEditing={() => {
            if (canAdd) {
              createMutation.mutate();
            }
          }}
          placeholder="Co kupić?"
          placeholderTextColor={theme.colors.textSubtle}
          returnKeyType="done"
          style={styles.input}
          value={name}
        />
        {productSuggestions.length > 0 ? (
          <View style={styles.productSuggestions}>
            {productSuggestions.map((suggestion) => {
              const categoryMeta = getShoppingCategoryMeta(suggestion.category);

              return (
                <Pressable
                  key={suggestion.name}
                  onPress={() => setName(suggestion.name)}
                  style={styles.productSuggestionChip}
                >
                  <Text style={styles.productSuggestionEmoji}>
                    {categoryMeta.emoji}
                  </Text>
                  <View style={styles.productSuggestionText}>
                    <Text
                      numberOfLines={1}
                      style={styles.productSuggestionName}
                    >
                      {suggestion.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={styles.productSuggestionCategory}
                    >
                      {suggestion.category}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : suggestedCategory ? (
          <Text style={styles.productCategoryHint}>
            Kategoria: {getShoppingCategoryMeta(suggestedCategory).emoji}{" "}
            {suggestedCategory}
          </Text>
        ) : null}
        <TextInput
          onChangeText={setQuantity}
          placeholder="Ilość, opakowanie lub notatka"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={quantity}
        />
        {createMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się dodać produktu." />
        ) : null}
      </FormModal>
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              disabled={clearMutation.isPending}
              onPress={() => setClearConfirmVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              labelStyle={styles.dangerActionLabel}
              onPress={() => {
                setClearConfirmVisible(false);
                setClearFinalConfirmVisible(true);
              }}
              style={styles.modalFooterButton}
              title="Dalej"
              variant="secondary"
            />
          </View>
        }
        onClose={() => {
          if (!clearMutation.isPending) {
            setClearConfirmVisible(false);
          }
        }}
        subtitle={`${currentList} zostanie opróżniona.`}
        title="Wyczyścić całą listę?"
        visible={clearConfirmVisible}
      >
        <Text style={styles.confirmText}>
          Ta akcja usunie wszystkie produkty z tej listy zakupów. Nie da się jej
          cofnąć.
        </Text>
      </FormModal>
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              disabled={clearMutation.isPending}
              onPress={() => setClearFinalConfirmVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              labelStyle={styles.dangerActionLabel}
              loading={clearMutation.isPending}
              onPress={() => clearMutation.mutate()}
              style={styles.modalFooterButton}
              title="Tak, usuń"
              variant="secondary"
            />
          </View>
        }
        onClose={() => {
          if (!clearMutation.isPending) {
            setClearFinalConfirmVisible(false);
          }
        }}
        subtitle="To jest ostatnie potwierdzenie."
        title="Na pewno usunąć produkty?"
        visible={clearFinalConfirmVisible}
      >
        <Text style={styles.confirmText}>
          Usuniesz wszystkie produkty z listy „{currentList}”. Tej operacji nie
          można cofnąć.
        </Text>
        {clearMutation.error ? (
          <InlineAlert tone="error" text="Nie udało się wyczyścić listy." />
        ) : null}
      </FormModal>
      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setAiModalVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canImportWithAi}
              loading={aiImportMutation.isPending}
              onPress={() => aiImportMutation.mutate()}
              style={styles.modalFooterButton}
              title="Dodaj z AI"
            />
          </View>
        }
        onClose={() => setAiModalVisible(false)}
        subtitle="Wklej wiadomość, przepis albo luźną listę, a AI rozbije ją na produkty."
        title="AI lista zakupów"
        visible={aiModalVisible}
      >
        <View style={styles.aiHeader}>
          <View style={styles.aiIcon}>
            <Sparkles color={theme.colors.primary} size={20} />
          </View>
          <Text style={styles.sectionMeta}>
            Produkty trafią do aktualnie wybranej listy.
          </Text>
        </View>
        <TextInput
          multiline
          onChangeText={setAiMessage}
          placeholder="Np. zrób grilla: kiełbasa, pieczywo czosnkowe, papryka, coś do sałatki"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={aiMessage}
        />
        {aiImportMutation.error ? (
          <InlineAlert
            tone="error"
            text="AI nie dodało produktów. Sprawdź konfigurację albo treść listy."
          />
        ) : null}
      </FormModal>
    </>
  );
}

function MealsBoard({
  action,
  aiOpenRequest,
  layout,
  onRouteActionHandled,
  resetRequest,
}: {
  action?: string;
  aiOpenRequest: number;
  layout: MealLayout;
  onRouteActionHandled: () => void;
  resetRequest: number;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("meal_planner");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [selectedWeekStartDate, setSelectedWeekStartDate] =
    useState(currentWeekStart());
  const [didInitCurrentWeek, setDidInitCurrentWeek] = useState(false);
  const [weekday, setWeekday] = useState(weekdayFromIsoDate(todayIso()));
  const [slotIndex, setSlotIndex] = useState(0);
  const [mealDate, setMealDate] = useState(todayIso());
  const [mealName, setMealName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [note, setNote] = useState("");
  const [mealDrafts, setMealDrafts] = useState<Record<string, MealDraft>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<MealPlanAiMessage[]>([]);
  const [aiDraft, setAiDraft] = useState<MealPlanAiDraftEntry[]>([]);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [aiTargetWeekConfirmed, setAiTargetWeekConfirmed] = useState(false);
  const [aiTargetWeekStartDate, setAiTargetWeekStartDate] = useState(
    selectedWeekStartDate,
  );
  const [aiNotice, setAiNotice] = useState("");
  const [handledAiOpenRequest, setHandledAiOpenRequest] =
    useState(aiOpenRequest);
  const [isCalendarExpanded, setCalendarExpanded] = useState(false);
  const householdQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyHousehold({ accessToken }),
    queryKey: [...queryKeys.household, "me"],
  });
  const currentQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => getCurrentMealPlanWeek({ accessToken }),
    queryKey: [...queryKeys.meal, "current"],
  });
  const historyQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listMealPlanHistory({ accessToken }),
    queryKey: [...queryKeys.meal, "history"],
  });
  const historyWeeks = mergeMealHistory(
    currentQuery.data?.week,
    historyQuery.data ?? [],
  );
  const selectedWeek = historyWeeks.find(
    (week) => week.weekStartDate === selectedWeekStartDate,
  );
  const selectedWeekId = selectedWeek?.id ?? null;
  const selectedPlanQuery = useQuery({
    enabled:
      permission.canRead &&
      Boolean(accessToken) &&
      Boolean(selectedWeekId) &&
      selectedWeekId !== currentQuery.data?.week.id,
    queryFn: () => getMealPlanWeek(selectedWeekId!, { accessToken }),
    queryKey: [...queryKeys.meal, "detail", selectedWeekId],
  });

  useEffect(() => {
    if (currentQuery.data?.week.weekStartDate && !didInitCurrentWeek) {
      setSelectedWeekStartDate(currentQuery.data.week.weekStartDate);
      setDidInitCurrentWeek(true);
    }
  }, [currentQuery.data?.week.weekStartDate, didInitCurrentWeek]);

  useEffect(() => {
    const nextDate = todayIso();
    const nextWeekStart = weekStartFromIsoDate(nextDate) ?? currentWeekStart();

    setSelectedWeekStartDate(nextWeekStart);
    setMealDate(nextDate);
    setWeekday(weekdayFromIsoDate(nextDate));
    setSlotIndex(0);
    setCalendarExpanded(false);
  }, [resetRequest]);

  useEffect(() => {
    if (action === "addMeal") {
      const nextDate = todayIso();
      const nextWeekStart =
        weekStartFromIsoDate(nextDate) ?? currentWeekStart();

      setSelectedWeekStartDate(nextWeekStart);
      setMealDate(nextDate);
      setWeekday(weekdayFromIsoDate(nextDate));
      setSlotIndex(0);
      setCalendarExpanded(false);
      setModalVisible(true);
      onRouteActionHandled();
    }
  }, [action, onRouteActionHandled]);

  useEffect(() => {
    if (aiOpenRequest > handledAiOpenRequest) {
      setHandledAiOpenRequest(aiOpenRequest);
      setAiDraft([]);
      setAiInput("");
      setAiInsights([]);
      setAiMessages([]);
      setAiTargetWeekConfirmed(false);
      setAiTargetWeekStartDate(selectedWeekStartDate);
      setAiModalVisible(true);
    }
  }, [aiOpenRequest, handledAiOpenRequest, selectedWeekStartDate]);

  const activePlan =
    selectedWeekId === currentQuery.data?.week.id
      ? currentQuery.data
      : selectedWeekId
        ? selectedPlanQuery.data
        : null;
  const selectedDraftKey = mealDraftKey(
    selectedWeekStartDate,
    weekday,
    slotIndex,
  );

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const targetWeekStartDate = selectedWeekStartDate;
      const targetPlan = await getOrCreateMealPlanForDate({
        accessToken,
        activePlan,
        currentPlan: currentQuery.data,
        history: historyQuery.data ?? [],
        targetWeekStartDate,
      });
      const weekId = targetPlan?.week?.id;

      if (!weekId) {
        throw new Error("Missing meal plan week");
      }

      return upsertMealSlot(
        weekId,
        [
          {
            linkUrl: normalizeOptionalMealUrl(linkUrl),
            mealName: mealName.trim(),
            note: note.trim() || null,
            slotIndex,
            weekday,
          },
        ],
        { accessToken },
      );
    },
    onSuccess: async (updatedPlan) => {
      setSelectedWeekStartDate(updatedPlan.week.weekStartDate);
      setMealName("");
      setLinkUrl("");
      setNote("");
      setMealDrafts({});
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.meal });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const deleteMealMutation = useMutation({
    mutationFn: (entry: MealPlanEntry) =>
      deleteMealSlot(
        entry.mealPlanWeekId,
        {
          slotIndex: entry.slotIndex,
          weekday: entry.weekday,
        },
        { accessToken },
      ),
    onSuccess: async (updatedPlan) => {
      setSelectedWeekStartDate(updatedPlan.week.weekStartDate);
      await queryClient.invalidateQueries({ queryKey: queryKeys.meal });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const aiPromptMutation = useMutation({
    mutationFn: async () => {
      return generateMealPlanAiPrompt({ accessToken });
    },
    onSuccess: async (response) => {
      await setStringAsync(response.prompt);
      setAiNotice("Prompt skopiowany do schowka.");
      setTimeout(() => setAiNotice(""), 3500);
    },
  });
  const aiChatMutation = useMutation({
    mutationFn: async () => {
      const content = aiInput.trim();

      if (!content) {
        throw new Error("Missing AI message");
      }

      const nextMessages: MealPlanAiMessage[] = [
        ...aiMessages,
        { content, role: "user" },
      ];

      if (
        !aiTargetWeekConfirmed ||
        !isValidWeekStartDate(aiTargetWeekStartDate)
      ) {
        throw new Error("Missing AI target week");
      }

      const response = await chatMealPlanWithAi(
        {
          currentDraft: aiDraft,
          messages: nextMessages,
          targetWeekStartDate: aiTargetWeekStartDate,
        },
        { accessToken },
      );

      return { messages: nextMessages, response };
    },
    onSuccess: ({ messages, response }) => {
      setAiMessages([
        ...messages,
        { content: response.assistantMessage, role: "assistant" },
      ]);
      if (response.entries.length > 0) {
        setAiDraft(response.entries);
      }
      setAiInput("");
      if (response.limitExhausted) {
        setAiNotice(
          "Limit AI jest wyczerpany. Aplikacja uzyla lokalnego algorytmu.",
        );
        setTimeout(() => setAiNotice(""), 3500);
      }
    },
  });
  const aiSaveMutation = useMutation({
    mutationFn: async () => {
      if (
        !aiTargetWeekConfirmed ||
        !isValidWeekStartDate(aiTargetWeekStartDate)
      ) {
        throw new Error("Missing AI target week");
      }

      if (!aiMessages.some((message) => message.role === "user")) {
        if (aiDraft.length === 0) {
          throw new Error("Najpierw wygeneruj albo wpisz plan do AI.");
        }
      }

      const hasUserMessage = aiMessages.some((message) => message.role === "user");
      const finalizeResponse = hasUserMessage
        ? await finalizeMealPlanWithAi(
            {
              currentDraft: aiDraft,
              messages: aiMessages,
              targetWeekStartDate: aiTargetWeekStartDate,
            },
            { accessToken },
          )
        : {
            entries: aiDraft,
            limitExhausted: false,
          };

      if (finalizeResponse.entries.length === 0) {
        throw new Error(
          "AI nie przygotowalo planu do zapisu.",
        );
      }

      const targetPlan = await getOrCreateMealPlanForDate({
        accessToken,
        activePlan,
        currentPlan: currentQuery.data,
        history: historyQuery.data ?? [],
        targetWeekStartDate: aiTargetWeekStartDate,
      });
      const weekId = targetPlan?.week?.id;

      if (!weekId) {
        throw new Error("Missing AI meal plan draft");
      }

      const updatedPlan = await upsertMealSlot(
        weekId,
        finalizeResponse.entries.map((entry) => ({
          linkUrl: entry.linkUrl,
          mealName: entry.mealName,
          note: buildAiMealNote(entry),
          slotIndex: entry.slotIndex,
          weekday: entry.weekday,
        })),
        { accessToken },
      );

      return {
        limitExhausted: finalizeResponse.limitExhausted,
        updatedPlan,
      };
    },
    onSuccess: async ({ limitExhausted, updatedPlan }) => {
      setSelectedWeekStartDate(updatedPlan.week.weekStartDate);
      setAiModalVisible(false);
      setAiInput("");
      setAiMessages([]);
      setAiDraft([]);
      setAiInsights([]);
      setAiTargetWeekConfirmed(false);
      setAiNotice(
        limitExhausted
          ? `Limit AI wyczerpany, zapisano ${updatedPlan.entries.length} pozycji z lokalnego algorytmu.`
          : `AI zapisalo ${updatedPlan.entries.length} pozycji w planie.`,
      );
      setTimeout(() => setAiNotice(""), 3000);
      await queryClient.invalidateQueries({ queryKey: queryKeys.meal });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const entries = [...(activePlan?.entries ?? [])].sort(
    (left, right) =>
      left.weekday - right.weekday || left.slotIndex - right.slotIndex,
  );
  const groupedEntries = groupMeals(entries);
  const mealSlots = buildMealSlotIndexes(householdQuery.data?.mealSlotsPerDay);
  const mealWeekCards = buildMealWeekCards(
    entries,
    selectedWeekStartDate,
    mealSlots,
  );
  const canSave =
    permission.canUpdate &&
    Boolean(mealName.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(selectedWeekStartDate) &&
    !upsertMutation.isPending;
  const canSendAi =
    aiTargetWeekConfirmed &&
    isValidWeekStartDate(aiTargetWeekStartDate) &&
    aiInput.trim().length >= 3 &&
    !aiChatMutation.isPending;
  const hasAiConversation =
    aiDraft.length > 0 ||
    aiMessages.some((message) => message.role === "assistant");
  const canSaveAi =
    permission.canCreate &&
    permission.canUpdate &&
    aiTargetWeekConfirmed &&
    isValidWeekStartDate(aiTargetWeekStartDate) &&
    hasAiConversation &&
    !aiChatMutation.isPending &&
    !aiPromptMutation.isPending &&
    !aiSaveMutation.isPending;
  const aiDraftGroups = groupMealDraftEntries(aiDraft);

  useEffect(() => {
    if (!modalVisible) {
      return;
    }

    const draft =
      mealDrafts[selectedDraftKey] ??
      findMealDraftForSelection(
        activePlan,
        selectedWeekStartDate,
        weekday,
        slotIndex,
      );

    setMealDate(dateForWeekday(selectedWeekStartDate, weekday));
    setMealName(draft.mealName);
    setLinkUrl(draft.linkUrl);
    setNote(draft.note);
  }, [
    activePlan?.week.id,
    mealDrafts,
    modalVisible,
    selectedDraftKey,
    selectedWeekStartDate,
    slotIndex,
    weekday,
  ]);

  function openCreateMealModal() {
    const nextDate = todayIso();
    const nextWeekStart = weekStartFromIsoDate(nextDate) ?? currentWeekStart();

    setSelectedWeekStartDate(nextWeekStart);
    setWeekday(weekdayFromIsoDate(nextDate));
    setSlotIndex(0);
    setMealDate(nextDate);
    setCalendarExpanded(false);
    setModalVisible(true);
  }

  function openCreateMealModalForDay(day: number, nextSlotIndex: number) {
    setWeekday(day);
    setSlotIndex(nextSlotIndex);
    setMealDate(dateForWeekday(selectedWeekStartDate, day));
    setCalendarExpanded(false);
    setModalVisible(true);
  }

  function openEditMealModal(entry: MealPlanEntry) {
    const weekStart = activePlan?.week.weekStartDate ?? selectedWeekStartDate;
    const key = mealDraftKey(weekStart, entry.weekday, entry.slotIndex);

    setMealDrafts((current) => ({
      ...current,
      [key]: mealDraftFromEntry(entry),
    }));
    setSelectedWeekStartDate(weekStart);
    setWeekday(entry.weekday);
    setSlotIndex(entry.slotIndex);
    setMealDate(dateForWeekday(weekStart, entry.weekday));
    setModalVisible(true);
  }

  function selectWeekStart(weekStart: string) {
    setSelectedWeekStartDate(weekStart);
    setMealDate(dateForWeekday(weekStart, weekday));
  }

  function selectMainWeekStart(weekStart: string) {
    selectWeekStart(weekStart);
    setCalendarExpanded(false);
  }

  function selectAiTargetWeekStart(weekStart: string) {
    setAiTargetWeekStartDate(weekStart);
    setAiTargetWeekConfirmed(true);
  }

  function selectWeekday(day: number) {
    setWeekday(day);
    setMealDate(dateForWeekday(selectedWeekStartDate, day));
  }

  function updateMealDraft(field: keyof MealDraft, value: string) {
    const base =
      mealDrafts[selectedDraftKey] ??
      findMealDraftForSelection(
        activePlan,
        selectedWeekStartDate,
        weekday,
        slotIndex,
      );

    setMealDrafts((current) => ({
      ...current,
      [selectedDraftKey]: {
        ...base,
        [field]: value,
      },
    }));
  }

  return (
    <>
      <View style={styles.mealHero}>
        <View style={styles.mealHeroIcon}>
          <Utensils color={theme.colors.food} size={22} />
        </View>
        <View style={styles.mealHeroText}>
          <Text style={styles.sectionTitle}>Plan posiłków</Text>
          <Text style={styles.sectionMeta}>
            {formatWeekRange(selectedWeekStartDate)}
          </Text>
        </View>
        {permission.canUpdate ? (
          <Pressable onPress={openCreateMealModal} style={styles.fabInline}>
            <Plus color={theme.colors.card} size={22} />
          </Pressable>
        ) : null}
      </View>
      {aiNotice ? <InlineAlert text={aiNotice} /> : null}

      <Pressable
        accessibilityLabel={
          isCalendarExpanded ? "Zwin wybor tygodnia" : "Zmien tydzien posilkow"
        }
        accessibilityRole="button"
        onPress={() => setCalendarExpanded((value) => !value)}
        style={({ pressed }) => [
          styles.calendarToggle,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.calendarToggleIcon}>
          <CalendarDays color={theme.colors.food} size={19} />
        </View>
        <View style={styles.calendarToggleText}>
          <Text style={styles.calendarToggleTitle}>
            {isCalendarExpanded ? "Zwin kalendarz" : "Zmien tydzien"}
          </Text>
          <Text style={styles.calendarToggleMeta}>
            {formatWeekRange(selectedWeekStartDate)}
          </Text>
        </View>
        <View
          style={
            isCalendarExpanded ? styles.calendarToggleChevronOpen : undefined
          }
        >
          <ChevronRight color={theme.colors.textMuted} size={18} />
        </View>
      </Pressable>

      {isCalendarExpanded ? (
        <CalendarWeekPicker
          mealWeeks={historyWeeks}
          onSelect={selectMainWeekStart}
          selectedWeekStartDate={selectedWeekStartDate}
        />
      ) : null}

      <QueryState
        emptyText="Brak posiłków w planie."
        error={currentQuery.error ?? selectedPlanQuery.error}
        isEmpty={
          !currentQuery.isLoading &&
          !selectedPlanQuery.isLoading &&
          entries.length === 0
        }
        isLoading={currentQuery.isLoading || selectedPlanQuery.isLoading}
      />

      {layout === "cards" ? (
        <View style={styles.mealGrid}>
          {mealWeekCards.map((day) => (
            <View
              key={day.day}
              style={[
                styles.mealTile,
                day.day === weekday ? styles.mealTileActive : null,
              ]}
            >
              <View style={styles.mealTileHeader}>
                <View style={styles.itemText}>
                  <Text style={styles.mealTileDay}>
                    {weekdayShort(day.day)}
                  </Text>
                  <Text style={styles.mealTileDate}>
                    {formatIsoDateShort(day.date)}
                  </Text>
                </View>
                <View style={styles.mealTileCountPill}>
                  <Text style={styles.mealTileCount}>
                    {day.entries.length}/{mealSlots.length}
                  </Text>
                </View>
              </View>
              <View style={styles.mealTileList}>
                {day.entries.slice(0, 4).map((entry) => (
                  <Pressable
                    disabled={!permission.canUpdate}
                    key={entry.id}
                    onPress={() => openEditMealModal(entry)}
                    style={({ pressed }) => [
                      styles.mealTileRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.mealTileSlot}>
                      {entry.slotIndex + 1}
                    </Text>
                    <Text numberOfLines={1} style={styles.mealTileName}>
                      {entry.mealName}
                    </Text>
                    {entry.linkUrl ? (
                      <IconButton
                        accessibilityLabel="Otworz link"
                        onPress={() => Linking.openURL(entry.linkUrl!)}
                      >
                        <ExternalLink color={theme.colors.food} size={15} />
                      </IconButton>
                    ) : null}
                  </Pressable>
                ))}
                {day.entries.length === 0 ? (
                  <Text style={styles.mealTileEmpty}>Brak posilkow</Text>
                ) : null}
                {day.entries.length > 4 ? (
                  <Text style={styles.mealTileOverflow}>
                    +{day.entries.length - 4} dalej
                  </Text>
                ) : null}
              </View>
              {permission.canUpdate ? (
                <Pressable
                  onPress={() =>
                    openCreateMealModalForDay(day.day, day.nextSlotIndex)
                  }
                  style={({ pressed }) => [
                    styles.mealTileAdd,
                    pressed && styles.pressed,
                  ]}
                >
                  <Plus color={theme.colors.food} size={16} />
                  <Text style={styles.mealTileAddText}>Dodaj</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {layout === "list" ? (
        <View style={styles.groupList}>
          {groupedEntries.map((group) => (
            <View key={group.day} style={styles.mealDayCard}>
              <Text style={styles.groupTitle}>{weekdayLabel(group.day)}</Text>
              {group.entries.map((entry) => (
                <View key={entry.id} style={styles.mealRow}>
                  <View style={styles.mealSlot}>
                    <Text style={styles.mealSlotText}>
                      {entry.slotIndex + 1}
                    </Text>
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemName}>{entry.mealName}</Text>
                    {entry.note ? (
                      <Text numberOfLines={2} style={styles.itemMeta}>
                        {entry.note}
                      </Text>
                    ) : null}
                  </View>
                  {entry.linkUrl ? (
                    <IconButton
                      accessibilityLabel="Otworz link"
                      onPress={() => Linking.openURL(entry.linkUrl!)}
                    >
                      <ExternalLink color={theme.colors.food} size={17} />
                    </IconButton>
                  ) : null}
                  <View style={styles.mealRowActions}>
                    {permission.canUpdate ? (
                      <IconButton
                        accessibilityLabel="Edytuj posiłek"
                        onPress={() => openEditMealModal(entry)}
                      >
                        <Pencil color={theme.colors.primary} size={16} />
                      </IconButton>
                    ) : null}
                    {permission.canDelete ? (
                      <IconButton
                        accessibilityLabel="Usuń posiłek"
                        disabled={deleteMealMutation.isPending}
                        onPress={() => deleteMealMutation.mutate(entry)}
                      >
                        <Trash2 color={theme.colors.danger} size={16} />
                      </IconButton>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      <FormModal
        footer={
          <View style={styles.modalFooter}>
            <ActionButton
              onPress={() => setModalVisible(false)}
              style={styles.modalFooterButton}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!canSave}
              loading={upsertMutation.isPending}
              onPress={() => upsertMutation.mutate()}
              style={styles.modalFooterButton}
              title="Zapisz"
            />
          </View>
        }
        onClose={() => setModalVisible(false)}
        subtitle="Wybierz tydzień z kalendarza, dzień i numer posiłku."
        title="Dodaj posiłek"
        visible={modalVisible}
      >
        <Text style={styles.inputLabel}>Tydzień</Text>
        <CalendarWeekPicker
          mealWeeks={historyWeeks}
          onSelect={selectWeekStart}
          selectedWeekStartDate={selectedWeekStartDate}
        />
        <Text style={styles.inputLabel}>Dzień</Text>
        <View style={styles.chips}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <Chip
              active={weekday === day}
              key={day}
              onPress={() => selectWeekday(day)}
              title={weekdayShort(day)}
            />
          ))}
        </View>
        <Text style={styles.inputLabel}>Numer posiłku</Text>
        <View style={styles.chips}>
          {mealSlots.map((slot) => (
            <Chip
              active={slotIndex === slot}
              key={slot}
              onPress={() => setSlotIndex(slot)}
              title={`Posiłek ${slot + 1}`}
            />
          ))}
        </View>
        <TextInput
          onChangeText={(value) => {
            setMealName(value);
            updateMealDraft("mealName", value);
          }}
          placeholder="Nazwa posiłku"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={mealName}
        />
        <TextInput
          multiline
          onChangeText={(value) => {
            setNote(value);
            updateMealDraft("note", value);
          }}
          placeholder="Notatka"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={note}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={(value) => {
            setLinkUrl(value);
            updateMealDraft("linkUrl", value);
          }}
          placeholder="Link URL, np. przepisy.pl/obiad"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={linkUrl}
        />
        <Text style={styles.itemMeta}>Wybrana data: {mealDate}</Text>
        {upsertMutation.error ? (
          <InlineAlert text="Nie udało się zapisać posiłku." tone="error" />
        ) : null}
      </FormModal>
      <FormModal
        footer={
          <View style={styles.aiFooter}>
            <ActionButton
              loading={aiPromptMutation.isPending}
              onPress={() => aiPromptMutation.mutate()}
              title="Kopiuj prompt dla AI"
              variant="secondary"
            />
            <View style={styles.modalFooter}>
              <ActionButton
                onPress={() => setAiModalVisible(false)}
                style={styles.modalFooterButton}
                title="Zamknij"
                variant="secondary"
              />
              <ActionButton
                disabled={!canSendAi}
                loading={aiChatMutation.isPending}
                onPress={() => aiChatMutation.mutate()}
                style={styles.modalFooterButton}
                title="Wyślij"
              />
            </View>
            {hasAiConversation ? (
              <ActionButton
                disabled={!canSaveAi}
                loading={aiSaveMutation.isPending}
                onPress={() => aiSaveMutation.mutate()}
                title="Zapisz plan"
              />
            ) : null}
          </View>
        }
        onClose={() => setAiModalVisible(false)}
        subtitle="Rozmawiaj z AI, dopracuj plan i zapisz dopiero gotowy efekt."
        title="AI plan posilkow"
        visible={aiModalVisible}
      >
        <View style={styles.aiHeader}>
          <View style={styles.aiIcon}>
            <Sparkles color={theme.colors.food} size={20} />
          </View>
          <View style={styles.itemText}>
            <Text style={styles.sectionTitle}>Tydzien docelowy</Text>
            <Text style={styles.sectionMeta}>
              {aiTargetWeekConfirmed
                ? formatWeekRange(aiTargetWeekStartDate)
                : "Wybierz tydzien przed wyslaniem planu"}
            </Text>
          </View>
        </View>

        <Text style={styles.inputLabel}>Tydzien zapisu *</Text>
        <CalendarWeekPicker
          mealWeeks={historyWeeks}
          onSelect={selectAiTargetWeekStart}
          selectedWeekStartDate={aiTargetWeekStartDate}
        />
        {!aiTargetWeekConfirmed ? (
          <InlineAlert text="Wybierz tydzien, do ktorego AI ma przygotowac i zapisac plan posilkow." />
        ) : null}

        {aiInsights.length > 0 ? (
          <View style={styles.aiInsightCard}>
            <Text style={styles.groupTitle}>Co AI znalazlo w historii</Text>
            {aiInsights.map((insight, index) => (
              <Text key={`${insight}-${index}`} style={styles.itemMeta}>
                {insight}
              </Text>
            ))}
          </View>
        ) : null}

        {aiMessages.length > 0 ? (
          <View style={styles.aiChatList}>
            {aiMessages.slice(-6).map((message, index) => (
              <View
                key={`${message.role}-${index}`}
                style={[
                  styles.aiChatBubble,
                  message.role === "user" ? styles.aiChatBubbleUser : null,
                ]}
              >
                <Text
                  style={[
                    styles.aiChatText,
                    message.role === "user" ? styles.aiChatTextUser : null,
                  ]}
                >
                  {message.content}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {aiDraftGroups.length > 0 ? (
          <View style={styles.aiDraftCard}>
            <View style={styles.aiDraftHeader}>
              <Text style={styles.groupTitle}>Szkic do zapisania</Text>
              <Text style={styles.itemMeta}>{aiDraft.length} pozycji</Text>
            </View>
            {aiDraftGroups.map((group) => (
              <View key={group.day} style={styles.aiDraftDay}>
                <Text style={styles.groupTitle}>{weekdayLabel(group.day)}</Text>
                {group.entries.map((entry) => (
                  <View
                    key={`${entry.weekday}-${entry.slotIndex}`}
                    style={styles.aiDraftMeal}
                  >
                    <View style={styles.mealSlot}>
                      <Text style={styles.mealSlotText}>
                        {entry.slotIndex + 1}
                      </Text>
                    </View>
                    <View style={styles.itemText}>
                      <Text style={styles.itemName}>{entry.mealName}</Text>
                      {entry.sourceHint || entry.note || entry.linkUrl ? (
                        <Text numberOfLines={2} style={styles.itemMeta}>
                          {[
                            entry.sourceHint,
                            entry.linkUrl ? "link" : null,
                            entry.note,
                          ]
                            .filter(Boolean)
                            .join(" / ")}
                        </Text>
                      ) : null}
                    </View>
                    {entry.linkUrl ? (
                      <IconButton
                        accessibilityLabel="Otworz link z AI"
                        onPress={() => Linking.openURL(entry.linkUrl!)}
                      >
                        <ExternalLink color={theme.colors.food} size={16} />
                      </IconButton>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.inputLabel}>Wiadomosc</Text>
        <TextInput
          multiline
          onChangeText={setAiInput}
          placeholder="Np. Pon: C kasza manna, KS pieczona kielbasa z warzywami..."
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={aiInput}
        />
        {aiChatMutation.error ? (
          <InlineAlert
            tone="error"
            text={getMealAiErrorText(
              aiChatMutation.error,
              "AI nie odpowiedzialo. Sprobuj wyslac wiadomosc jeszcze raz.",
            )}
          />
        ) : null}
        {aiPromptMutation.error ? (
          <InlineAlert
            tone="error"
            text={getMealAiErrorText(
              aiPromptMutation.error,
              "Nie udalo sie wygenerowac promptu.",
            )}
          />
        ) : null}
        {aiSaveMutation.error ? (
          <InlineAlert
            tone="error"
            text={getMealAiErrorText(
              aiSaveMutation.error,
              "Nie udalo sie zapisac planu z AI.",
            )}
          />
        ) : null}
      </FormModal>
    </>
  );
}

function ShoppingGroupCard({
  canDelete,
  canUpdate,
  deleting,
  group,
  isUpdating,
  listType,
  moving,
  onCheck,
  onDelete,
  onMove,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  deleting: boolean;
  group: ShoppingGroup;
  isUpdating: (id: string) => boolean;
  listType: ShoppingListType;
  moving: boolean;
  onCheck: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  onMove: (item: ShoppingItem, targetType: ShoppingListType) => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const illustration = getShoppingGroupIllustration(group.category, group.title);

  return (
    <View style={styles.shoppingGroup}>
      <View style={styles.groupHeader}>
        <Text style={styles.shoppingGroupTitle}>{group.title}</Text>
        <View style={styles.groupCountPill}>
          <Text style={styles.groupCountText}>{group.items.length}</Text>
        </View>
      </View>
      <View style={styles.groupBody}>
        <View style={styles.groupItems}>
          {group.items.map((item) => (
            <View key={item.id} style={[styles.itemRow, styles.shoppingItemRow]}>
              <Pressable
                disabled={!canUpdate || isUpdating(item.id)}
                onPress={() => onCheck(item)}
                style={[styles.checkBox, item.isChecked && styles.checkBoxDone]}
              >
                {item.isChecked ? (
                  <Check color={theme.colors.card} size={14} />
                ) : null}
              </Pressable>
              <Pressable
                disabled={!canUpdate || isUpdating(item.id)}
                onPress={() => onCheck(item)}
                style={styles.itemText}
              >
                <Text
                  style={[styles.itemName, styles.shoppingItemName, item.isChecked && styles.shoppingItemDone]}
                >
                  {item.name}
                </Text>
                {item.quantity ? (
                  <Text numberOfLines={1} style={[styles.itemMeta, styles.shoppingItemMeta]}>
                    {item.quantity}
                  </Text>
                ) : null}
              </Pressable>
              {listType === "long_term" && canUpdate ? (
                <View style={styles.itemMoveActions}>
                  <ActionButton
                    disabled={moving}
                    onPress={() => onMove(item, "daily")}
                    size="small"
                    title="Dziś"
                    variant="secondary"
                  />
                  <ActionButton
                    disabled={moving}
                    onPress={() => onMove(item, "tomorrow")}
                    size="small"
                    title="Jutro"
                    variant="secondary"
                  />
                </View>
              ) : null}
              {canDelete ? (
                <IconButton disabled={deleting} onPress={() => onDelete(item)}>
                  <Trash2 color={theme.colors.danger} size={16} />
                </IconButton>
              ) : null}
            </View>
          ))}
        </View>
        <View style={styles.groupIllustrationFrame}>
          <Image
            resizeMode="contain"
            source={illustration}
            style={styles.groupIllustration}
          />
        </View>
      </View>
    </View>
  );
}

function Chip({
  active,
  onPress,
  title,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {title}
      </Text>
    </Pressable>
  );
}

function CalendarWeekPicker({
  mealWeeks,
  onSelect,
  selectedWeekStartDate,
}: {
  mealWeeks: Array<{
    entriesByWeekday?: Record<number, number>;
    entriesCount?: number;
    id: string;
    weekStartDate: string;
  }>;
  onSelect: (weekStartDate: string) => void;
  selectedWeekStartDate: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const markedDates = useMemo(
    () =>
      buildMarkedMealWeekDates(selectedWeekStartDate, mealWeeks, theme.colors),
    [mealWeeks, selectedWeekStartDate, theme.colors],
  );

  return (
    <View style={styles.calendarPicker}>
      <Calendar
        current={selectedWeekStartDate}
        enableSwipeMonths
        firstDay={1}
        markedDates={markedDates}
        markingType="period"
        onDayPress={(day: DateData) => {
          const weekStart = weekStartFromIsoDate(day.dateString);

          if (weekStart) {
            onSelect(weekStart);
          }
        }}
        theme={{
          arrowColor: theme.colors.primary,
          calendarBackground: theme.colors.card,
          dayTextColor: theme.colors.text,
          monthTextColor: theme.colors.text,
          selectedDayBackgroundColor: theme.colors.cardMuted,
          selectedDayTextColor: theme.colors.text,
          textDisabledColor: theme.colors.textSubtle,
          textSectionTitleColor: theme.colors.textMuted,
          todayTextColor: theme.colors.primary,
        }}
      />
      <Text style={styles.calendarPickerMeta}>
        Wybrany tydzien: {formatWeekRange(selectedWeekStartDate)}
      </Text>
    </View>
  );
}

type MealDraft = {
  linkUrl: string;
  mealName: string;
  note: string;
};

type ShoppingGroup = {
  category: ShoppingCategory;
  emoji: string;
  items: ShoppingItem[];
  title: string;
};

const legacyShoppingCategoryMap: Record<string, ShoppingCategory> = {
  "Chemia i dom": "Środki czystości",
  "Chemia i sprzątanie": "Środki czystości",
  "Dziecko i prezenty": "Dziecko",
  "Grill i ogrod": "Dom i ogród",
  "Mięso i ryby": "Mięso i wędliny",
  "Mieso i wedliny": "Mięso i wędliny",
  "Nabial": "Nabiał i jaja",
  "Nabiał i jajka": "Nabiał i jaja",
  "Napoje": "Woda i napoje",
  "Owoce": "Owoce, warzywa i zioła",
  "Owoce i warzywa": "Owoce, warzywa i zioła",
  "Pozostałe": "Inne",
  "Produkty suche i spizarnia": "Sypkie",
  "Przekaski i slodycze": "Słodycze i przekąski",
  "Sosy i dodatki": "Przyprawy, sosy i oleje",
  "Spiżarnia": "Sypkie",
  "Warzywa": "Owoce, warzywa i zioła",
};

function groupShoppingItems(items: ShoppingItem[]): ShoppingGroup[] {
  const groups = new Map<ShoppingCategory, ShoppingGroup>();
  const orderedCategories: ShoppingCategory[] = [
    ...SHOPPING_CATEGORIES.filter((category) => category !== "Inne"),
    "Inne",
  ];

  orderedCategories.forEach((category) => {
    const meta = getShoppingCategoryMeta(category);
    groups.set(category, {
      category,
      emoji: meta.emoji,
      items: [],
      title: meta.title,
    });
  });

  items.forEach((item) => {
    const target = groups.get(resolveShoppingCategory(item));

    (target ?? groups.get("Inne"))?.items.push(item);
  });

  return [...groups.values()].filter((group) => group.items.length > 0);
}

function getShoppingGroupIllustration(
  category: ShoppingCategory,
  title?: string,
): ImageSourcePropType {
  if (title === "Kupione") {
    return shoppingCategoryDoneImage;
  }

  switch (category) {
    case "Alkohole":
    case "Kawa i herbata":
    case "Woda i napoje":
      return shoppingCategoryDrinksImage;
    case "Apteczka":
    case "Higiena":
      return shoppingCategoryCareImage;
    case "Dania gotowe":
    case "Konserwy i przetwory":
    case "Pieczenie i dodatki":
    case "Przyprawy, sosy i oleje":
    case "Sypkie":
    case "Wege":
      return shoppingCategoryPantryImage;
    case "Dla zwierząt":
    case "Dziecko":
    case "Elektronika":
    case "Papiernicze":
    case "Ubrania":
      return shoppingCategoryFamilyImage;
    case "Dom i ogród":
    case "Środki czystości":
      return shoppingCategoryCleaningImage;
    case "Mięso i wędliny":
      return shoppingCategoryMeatImage;
    case "Mrożonki":
    case "Ryby i owoce morza":
      return shoppingCategoryMeatImage;
    case "Nabiał i jaja":
      return shoppingCategoryDairyImage;
    case "Owoce, warzywa i zioła":
      return shoppingCategoryProduceImage;
    case "Pieczywo":
      return shoppingCategoryBakeryImage;
    case "Słodycze i przekąski":
      return shoppingCategorySnacksImage;
    case "Inne":
    default:
      return shoppingCategoryDefaultImage;
  }
}

function resolveShoppingCategory(item: ShoppingItem): ShoppingCategory {
  const categoryByName = categorizeShoppingProduct(item.name);

  if (categoryByName !== "Inne") {
    return categoryByName;
  }

  if (isShoppingCategory(item.category)) {
    return item.category;
  }

  return item.category ? (legacyShoppingCategoryMap[item.category] ?? "Inne") : "Inne";
}

function mealDraftKey(
  weekStartDate: string,
  weekday: number,
  slotIndex: number,
): string {
  return `${weekStartDate}:${weekday}:${slotIndex}`;
}

function mealDraftFromEntry(entry: MealPlanEntry | undefined): MealDraft {
  return {
    linkUrl: entry?.linkUrl ?? "",
    mealName: entry?.mealName ?? "",
    note: entry?.note ?? "",
  };
}

function findMealDraftForSelection(
  plan: MealPlanDetail | null | undefined,
  weekStartDate: string,
  weekday: number,
  slotIndex: number,
): MealDraft {
  if (plan?.week.weekStartDate !== weekStartDate) {
    return mealDraftFromEntry(undefined);
  }

  return mealDraftFromEntry(
    plan.entries.find(
      (entry) => entry.weekday === weekday && entry.slotIndex === slotIndex,
    ),
  );
}

function buildAiMealNote(entry: MealPlanAiDraftEntry): string | null {
  const note = entry.note?.trim();
  const sourceHint = entry.sourceHint?.trim();

  if (
    note &&
    sourceHint &&
    !note.toLowerCase().includes(sourceHint.toLowerCase())
  ) {
    return `${note}\nZrodlo: ${sourceHint}`;
  }

  return note || (sourceHint ? `Zrodlo: ${sourceHint}` : null);
}

function getMealAiErrorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function groupMealDraftEntries(entries: MealPlanAiDraftEntry[]) {
  const groups = new Map<number, MealPlanAiDraftEntry[]>();

  entries.forEach((entry) => {
    groups.set(entry.weekday, [...(groups.get(entry.weekday) ?? []), entry]);
  });

  return [...groups.entries()].map(([day, dayEntries]) => ({
    day,
    entries: dayEntries,
  }));
}

function normalizeOptionalMealUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
}

function buildMarkedMealWeekDates(
  selectedWeekStartDate: string,
  mealWeeks: Array<{
    entriesByWeekday?: Record<number, number>;
    entriesCount?: number;
    id: string;
    weekStartDate: string;
  }>,
  colors: AppPalette,
) {
  const marked: Record<
    string,
    {
      color?: string;
      dotColor?: string;
      endingDay?: boolean;
      marked?: boolean;
      startingDay?: boolean;
      textColor?: string;
    }
  > = {};

  mealWeeks.forEach((week) => {
    const plannedWeekdays = Object.entries(week.entriesByWeekday ?? {})
      .map(([weekday, count]) => ({
        count: Number(count),
        weekday: Number(weekday),
      }))
      .filter(({ count, weekday }) => count > 0 && weekday >= 1 && weekday <= 7);

    if (plannedWeekdays.length === 0 && week.entriesCount) {
      marked[week.weekStartDate] = {
        dotColor: colors.food,
        marked: true,
      };
      return;
    }

    plannedWeekdays.forEach(({ weekday }) => {
      const date = dateForWeekday(week.weekStartDate, weekday);

      marked[date] = {
        dotColor: colors.food,
        marked: true,
      };
    });
  });

  for (let day = 1; day <= 7; day += 1) {
    const date = dateForWeekday(selectedWeekStartDate, day);

    marked[date] = {
      ...marked[date],
      color: colors.cardMuted,
      endingDay: day === 7,
      startingDay: day === 1,
      textColor: colors.text,
    };
  }

  return marked;
}

function mergeMealHistory(
  currentWeek: MealPlanDetail["week"] | undefined,
  history: MealPlanSummary[],
): Array<{
  entriesByWeekday?: Record<number, number>;
  entriesCount?: number;
  id: string;
  weekStartDate: string;
}> {
  const weeks = new Map<
    string,
    {
      entriesByWeekday?: Record<number, number>;
      entriesCount?: number;
      id: string;
      weekStartDate: string;
    }
  >();

  if (currentWeek) {
    weeks.set(currentWeek.id, currentWeek);
  }

  history.forEach((week) => weeks.set(week.id, week));

  return [...weeks.values()].sort((left, right) =>
    right.weekStartDate.localeCompare(left.weekStartDate),
  );
}

async function getOrCreateMealPlanForDate({
  accessToken,
  activePlan,
  currentPlan,
  history,
  targetWeekStartDate,
}: {
  accessToken?: string;
  activePlan?: MealPlanDetail | null;
  currentPlan?: MealPlanDetail | null;
  history: MealPlanSummary[];
  targetWeekStartDate: string;
}): Promise<MealPlanDetail> {
  if (activePlan?.week.weekStartDate === targetWeekStartDate) {
    return activePlan;
  }

  if (currentPlan?.week.weekStartDate === targetWeekStartDate) {
    return currentPlan;
  }

  const historicalWeek = history.find(
    (week) => week.weekStartDate === targetWeekStartDate,
  );

  if (historicalWeek) {
    return getMealPlanWeek(historicalWeek.id, { accessToken });
  }

  return createMealPlan(
    { weekStartDate: targetWeekStartDate },
    { accessToken },
  );
}

function groupMeals(entries: MealPlanEntry[]) {
  const groups = new Map<number, MealPlanEntry[]>();

  entries.forEach((entry) => {
    groups.set(entry.weekday, [...(groups.get(entry.weekday) ?? []), entry]);
  });

  return [...groups.entries()].map(([day, dayEntries]) => ({
    day,
    entries: dayEntries,
  }));
}

function buildMealWeekCards(
  entries: MealPlanEntry[],
  weekStartDate: string,
  mealSlots: number[],
) {
  const groups = new Map<number, MealPlanEntry[]>();

  entries.forEach((entry) => {
    groups.set(entry.weekday, [...(groups.get(entry.weekday) ?? []), entry]);
  });

  return [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const dayEntries = groups.get(day) ?? [];
    const usedSlots = new Set(dayEntries.map((entry) => entry.slotIndex));
    const nextSlotIndex =
      mealSlots.find((slot) => !usedSlots.has(slot)) ?? mealSlots[0] ?? 0;

    return {
      date: dateForWeekday(weekStartDate, day),
      day,
      entries: dayEntries,
      nextSlotIndex,
    };
  });
}

function buildMealSlotIndexes(value: number | null | undefined): number[] {
  const count = Number.isFinite(value)
    ? Math.max(1, Math.min(8, Number(value)))
    : 4;

  return Array.from({ length: count }, (_, index) => index);
}

function currentWeekStart(): string {
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const from = new Date(today);
  from.setDate(today.getDate() - day + 1);

  return isoFromDate(from);
}

function todayIso(): string {
  return isoFromDate(new Date());
}

function weekStartFromIsoDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }

  const date = new Date(`${value.trim()}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - day + 1);

  return isoFromDate(date);
}

function isValidWeekStartDate(value: string): boolean {
  return weekStartFromIsoDate(value) === value;
}

function weekdayFromIsoDate(value: string): number {
  const date = new Date(`${value.trim()}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return 1;
  }

  return date.getDay() === 0 ? 7 : date.getDay();
}

function dateForWeekday(weekStartDate: string, weekday: number): string {
  const date = new Date(`${weekStartDate}T12:00:00`);
  date.setDate(date.getDate() + weekday - 1);

  return isoFromDate(date);
}

function isoFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatWeekRange(weekStartDate: string): string {
  const from = new Date(`${weekStartDate}T12:00:00`);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);

  return `Tydzień ${formatDateShort(from)} - ${formatDateShort(to)}`;
}

function formatDateShort(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatIsoDateShort(value: string): string {
  const date = new Date(`${value}T12:00:00`);

  return Number.isNaN(date.getTime()) ? value.slice(5) : formatDateShort(date);
}

function weekdayLabel(day: number): string {
  return (
    [
      "Poniedziałek",
      "Wtorek",
      "Środa",
      "Czwartek",
      "Piątek",
      "Sobota",
      "Niedziela",
    ][day - 1] ?? `Dzień ${day}`
  );
}

function weekdayShort(day: number): string {
  return ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"][day - 1] ?? String(day);
}

function PantryBoard() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("shopping");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [modalVisible, setModalVisible] = useState(false);

  const [editItem, setEditItem] = useState<ShoppingItem | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const pantryQueryKey = useMemo(
    () => [...queryKeys.shopping, "pantry", "items"] as const,
    [],
  );

  const pantryQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => listShoppingItems("pantry", { accessToken }),
    queryKey: pantryQueryKey,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; quantity: string }) =>
      createShoppingItem("pantry", data, { accessToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pantryQueryKey });
      setName("");
      setQuantity("");
      setModalVisible(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; quantity: string }) =>
      updateShoppingItem(data.id, { quantity: data.quantity }, { accessToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pantryQueryKey });
      setEditItem(null);
    },
  });

  const isZeroQuantity = useCallback((qty: string | null | undefined) => {
    if (!qty) return false;
    const str = qty.trim().toLowerCase();
    return str === "0" || str.startsWith("0 ") || str === "brak" || str === "0szt";
  }, []);

  const groupedItems = useMemo(() => {
    const items = pantryQuery.data ?? [];
    const groups: Record<string, ShoppingItem[]> = {};

    for (const item of items) {
      const category = isShoppingCategory(item.category)
        ? item.category
        : "other";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(item);
    }

    return Object.entries(groups)
      .map(([key, groupItems]) => {
        const sortedItems = [...groupItems].sort((a, b) => {
          const aZero = isZeroQuantity(a.quantity);
          const bZero = isZeroQuantity(b.quantity);
          if (aZero && !bZero) return 1;
          if (!aZero && bZero) return -1;
          return a.name.localeCompare(b.name);
        });
        return {
          category: key as ShoppingCategory,
          items: sortedItems,
          meta: getShoppingCategoryMeta(key as ShoppingCategory),
        };
      })
      .sort((a, b) => a.meta.title.localeCompare(b.meta.title));
  }, [pantryQuery.data, isZeroQuantity]);

  const productSuggestions = useMemo(
    () => getShoppingProductSuggestions(name, 8),
    [name],
  );
  const suggestedCategory = useMemo(
    () => (name.trim() ? categorizeShoppingProduct(name) : null),
    [name],
  );

  if (!permission.canRead) {
    return <InlineAlert text="Nie masz dostępu do spiżarni." />;
  }

  return (
    <View style={{ flex: 1 }}>
      <QueryState
        error={pantryQuery.error}
        isEmpty={!pantryQuery.isLoading && (pantryQuery.data ?? []).length === 0}
        isLoading={pantryQuery.isLoading}
      />

      <View style={{ gap: 16, padding: 16, paddingBottom: 100 }}>
        {groupedItems.map((group) => (
          <PantryGroupCard
            category={group.category}
            items={group.items}
            key={group.category}
            meta={group.meta}
            onItemPress={(item) => {
              setEditItem(item);
              setEditQuantity(item.quantity ?? "");
            }}
          />
        ))}
      </View>

      {permission.canCreate ? (
        <View style={{ bottom: 24, position: "absolute", right: 24 }}>
          <IconButton
            accessibilityLabel="Dodaj produkt do spiżarni"
            onPress={() => setModalVisible(true)}
            style={{ backgroundColor: theme.colors.primary, borderRadius: 32, elevation: 6, height: 64, width: 64, alignItems: "center", justifyContent: "center" }}
          >
            <Plus color="#FFFFFF" size={32} />
          </IconButton>
        </View>
      ) : null}

      <FormModal
        onClose={() => setModalVisible(false)}
        footer={
          <View style={{ flexDirection: "row", gap: 12 }}>
            <ActionButton
              onPress={() => setModalVisible(false)}
              style={{ flex: 1 }}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={!name.trim() || createMutation.isPending}
              onPress={() => {
                if (name.trim()) {
                  createMutation.mutate({ name, quantity });
                }
              }}
              style={{ flex: 1 }}
              title="Zapisz"
              variant="primary"
            />
          </View>
        }
        title="Dodaj do spiżarni"
        visible={modalVisible}
      >
        <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "800", marginBottom: 8 }}>Co masz w spiżarni?</Text>
        <TextInput
          autoFocus
          onChangeText={setName}
          onSubmitEditing={() => {
            if (name.trim()) {
              createMutation.mutate({ name, quantity });
            }
          }}
          placeholder="np. Mąka pszenna"
          placeholderTextColor={theme.colors.textMuted}
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: 8, borderWidth: 1, color: theme.colors.text, fontSize: 16, minHeight: 48, paddingHorizontal: 16 }}
          value={name}
        />
        {suggestedCategory ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
            Kategoria:{" "}
            {getShoppingCategoryMeta(suggestedCategory).title.toLowerCase()}
          </Text>
        ) : null}

        {productSuggestions.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {productSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion.name}
                onPress={() => setName(suggestion.name)}
                style={{ backgroundColor: theme.colors.cardMuted, borderColor: theme.colors.border, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "700" }}>{suggestion.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "800", marginBottom: 8, marginTop: 24 }}>Ile tego masz? (opcjonalnie)</Text>
        <TextInput
          onChangeText={setQuantity}
          onSubmitEditing={() => {
            if (name.trim()) {
              createMutation.mutate({ name, quantity });
            }
          }}
          placeholder="np. 2 kg, 3 szt."
          placeholderTextColor={theme.colors.textMuted}
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: 8, borderWidth: 1, color: theme.colors.text, fontSize: 16, minHeight: 48, paddingHorizontal: 16 }}
          value={quantity}
        />
      </FormModal>

      <FormModal
        onClose={() => setEditItem(null)}
        footer={
          <View style={{ flexDirection: "row", gap: 12 }}>
            <ActionButton
              onPress={() => setEditItem(null)}
              style={{ flex: 1 }}
              title="Anuluj"
              variant="secondary"
            />
            <ActionButton
              disabled={updateMutation.isPending}
              onPress={() => {
                if (editItem) {
                  updateMutation.mutate({ id: editItem.id, quantity: editQuantity });
                }
              }}
              style={{ flex: 1 }}
              title="Zapisz"
              variant="primary"
            />
          </View>
        }
        title="Edytuj produkt"
        visible={!!editItem}
      >
        <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: "800", marginBottom: 8 }}>Ilość w spiżarni</Text>
        <TextInput
          autoFocus
          onChangeText={setEditQuantity}
          onSubmitEditing={() => {
            if (editItem) {
              updateMutation.mutate({ id: editItem.id, quantity: editQuantity });
            }
          }}
          placeholder="np. 0, 2 kg, brak"
          placeholderTextColor={theme.colors.textMuted}
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: 8, borderWidth: 1, color: theme.colors.text, fontSize: 16, minHeight: 48, paddingHorizontal: 16 }}
          value={editQuantity}
        />
        <View style={{ marginTop: 24 }}>
          <ActionButton onPress={() => setEditQuantity("0")} title="Ustaw ilość na 0" variant="secondary" />
        </View>
      </FormModal>
    </View>
  );
}

function PantryGroupCard({
  category,
  items,
  meta,
  onItemPress,
}: {
  category: ShoppingCategory;
  items: ShoppingItem[];
  meta: ReturnType<typeof getShoppingCategoryMeta>;
  onItemPress: (item: ShoppingItem) => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  
  const isZeroQuantity = (qty: string | null | undefined) => {
    if (!qty) return false;
    const str = qty.trim().toLowerCase();
    return str === "0" || str.startsWith("0 ") || str === "brak" || str === "0szt";
  };

  return (
    <View style={styles.shoppingGroup}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: theme.colors.cardMuted, borderRadius: 12, height: 48, justifyContent: "center", width: 48 }}>
          <Image
            resizeMode="contain"
            source={getShoppingGroupIllustration(category, meta.title)}
            style={{ bottom: -8, height: 58, position: "absolute", right: -8, width: 58 }}
          />
        </View>
        <Text style={styles.shoppingGroupTitle}>{meta.title}</Text>
      </View>
      <View style={{ gap: 0, marginTop: 12 }}>
        {items.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => onItemPress(item)}
            style={[
              styles.shoppingItemRow,
              { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
              index < items.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: 1 },
              isZeroQuantity(item.quantity) && { opacity: 0.5 }
            ]}
          >
            <View style={{ flex: 1, gap: 2, paddingVertical: 12 }}>
              <Text style={styles.shoppingItemName}>{item.name}</Text>
              {item.quantity ? (
                <Text style={styles.shoppingItemMeta}>{item.quantity}</Text>
              ) : null}
            </View>
            <ChevronRight color={theme.colors.border} size={20} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: AppPalette) {
  const isDark = colors.background === "#0C1220";
  const shoppingCardBackground = isDark ? colors.card : "#FFFFFF";
  const shoppingCardBorder = isDark ? colors.border : "#E8DDCE";
  const shoppingHeaderBackground = isDark ? colors.cardMuted : "#F5F0E6";
  const shoppingRowBorder = isDark ? colors.line : "#EFE5D4";
  const shoppingText = isDark ? colors.text : "#2B2821";
  const shoppingMetaText = isDark ? colors.textMuted : "#7E7667";
  const shoppingMutedText = isDark ? colors.textSubtle : "#8B8478";
  const shoppingCountBackground = isDark ? colors.field : "#E7E0C8";
  const shoppingCountText = isDark ? colors.text : "#4E5435";

  return StyleSheet.create({
    checkBox: {
      alignItems: "center",
      backgroundColor: isDark ? colors.field : "#FFFCF5",
      borderColor: isDark ? colors.border : "#CFC5B3",
      borderRadius: 999,
      borderWidth: 1,
      height: 22,
      justifyContent: "center",
      width: 22,
    },
    aiHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    aiHeaderButton: {
      backgroundColor: colors.card,
      borderColor: "#448aff",
      elevation: 8,
      shadowColor: "#448aff",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    aiIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: radii.control,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    aiInsightCard: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    aiChatBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      maxWidth: "92%",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    aiChatBubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    aiChatList: {
      gap: spacing.sm,
    },
    aiChatText: {
      color: colors.text,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 18,
    },
    aiChatTextUser: {
      color: colors.inverseText,
      fontWeight: "700",
    },
    aiDraftCard: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    aiDraftDay: {
      gap: spacing.xs,
    },
    aiDraftHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    aiDraftMeal: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 30,
    },
    aiFooter: {
      gap: spacing.sm,
    },
    calendarPicker: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      overflow: "hidden",
    },
    calendarPickerMeta: {
      borderColor: colors.border,
      borderTopWidth: 1,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      padding: spacing.sm,
      textAlign: "center",
    },
    calendarToggle: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    calendarToggleChevronOpen: {
      transform: [{ rotate: "90deg" }],
    },
    calendarToggleIcon: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderRadius: radii.control,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    calendarToggleMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
    },
    calendarToggleText: {
      flex: 1,
      gap: 2,
    },
    calendarToggleTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    checkBoxDone: {
      backgroundColor: "#4F7D52",
      borderColor: "#4F7D52",
    },
    confirmText: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 18,
    },
    chip: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      minHeight: 34,
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    chipText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    chipTextActive: {
      color: colors.inverseText,
    },
    fabInline: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 999,
      elevation: 4,
      height: 44,
      justifyContent: "center",
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      width: 44,
    },
    groupBody: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 66,
    },
    groupCountPill: {
      alignItems: "center",
      backgroundColor: shoppingCountBackground,
      borderRadius: 999,
      justifyContent: "center",
      minHeight: 22,
      minWidth: 28,
      paddingHorizontal: 9,
    },
    groupCountText: {
      color: shoppingCountText,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
    },
    groupEmoji: {
      alignItems: "center",
      minWidth: 56,
    },
    groupEmojiText: {
      fontSize: 38,
      letterSpacing: 0,
    },
    groupHeader: {
      alignItems: "center",
      backgroundColor: shoppingHeaderBackground,
      borderBottomColor: shoppingRowBorder,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      marginHorizontal: -spacing.sm,
      marginTop: -spacing.sm,
      minHeight: 38,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    groupItems: {
      flex: 1,
      gap: 0,
      minWidth: 0,
    },
    groupIllustrationFrame: {
      alignItems: "center",
      alignSelf: "stretch",
      justifyContent: "center",
      width: 92,
    },
    groupIllustration: {
      height: 84,
      width: 92,
    },
    groupList: {
      gap: spacing.sm,
    },
    groupTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    input: {
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      letterSpacing: 0,
      minHeight: 46,
      paddingHorizontal: spacing.md,
    },
    inputLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      marginBottom: -spacing.xs,
    },
    dangerActionLabel: {
      color: colors.danger,
    },
    itemDone: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    itemMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 16,
    },
    itemName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 18,
    },
    itemRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 29,
    },
    itemMoveActions: {
      flexDirection: "column",
      gap: spacing.xs,
      justifyContent: "center",
      maxWidth: 76,
    },
    itemText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    listHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    mealDayCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    mealHero: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    mealHeroIcon: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderRadius: radii.control,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    mealHeroText: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
    },
    mealGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    mealLayoutButton: {
      backgroundColor: colors.card,
      borderColor: colors.food,
      elevation: 4,
      shadowColor: colors.food,
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
    },
    mealRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    mealRowActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    mealSlot: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    mealSlotText: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    mealTile: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexBasis: "47%",
      flexGrow: 1,
      gap: spacing.sm,
      minHeight: 178,
      minWidth: 150,
      padding: spacing.sm,
    },
    mealTileActive: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.food,
    },
    mealTileAdd: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 32,
    },
    mealTileAddText: {
      color: colors.food,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    mealTileCount: {
      color: colors.food,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    mealTileCountPill: {
      alignItems: "center",
      backgroundColor: colors.field,
      borderRadius: 999,
      minWidth: 38,
      paddingHorizontal: spacing.xs,
      paddingVertical: 4,
    },
    mealTileDate: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
    },
    mealTileDay: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    mealTileEmpty: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 16,
    },
    mealTileHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    mealTileList: {
      gap: spacing.xs,
      minHeight: 88,
    },
    mealTileName: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 16,
      minWidth: 0,
    },
    mealTileOverflow: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
    },
    mealTileRow: {
      alignItems: "center",
      backgroundColor: colors.field,
      borderRadius: radii.control,
      flexDirection: "row",
      gap: spacing.xs,
      minHeight: 30,
      paddingLeft: spacing.xs,
      paddingRight: 2,
    },
    mealTileSlot: {
      color: colors.food,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      minWidth: 14,
      textAlign: "center",
    },
    modalFooter: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    modalFooterButton: {
      flex: 1,
    },
    pressed: {
      opacity: 0.78,
    },
    productCategoryHint: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      marginTop: -spacing.xs,
    },
    productSuggestionCategory: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 13,
    },
    productSuggestionChip: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      flexBasis: "47%",
      flexDirection: "row",
      flexGrow: 1,
      gap: spacing.xs,
      minHeight: 42,
      minWidth: 130,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    productSuggestionEmoji: {
      fontSize: 18,
      letterSpacing: 0,
    },
    productSuggestionName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 15,
      textTransform: "capitalize",
    },
    productSuggestions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: -spacing.xs,
    },
    productSuggestionText: {
      flex: 1,
      minWidth: 0,
    },
    quickActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    sectionMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
    },
    shoppingGroup: {
      backgroundColor: shoppingCardBackground,
      borderColor: shoppingCardBorder,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      gap: spacing.sm,
      overflow: "hidden",
      padding: spacing.sm,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.07,
      shadowRadius: 18,
    },
    shoppingGroupTitle: {
      color: shoppingText,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    shoppingItemDone: {
      color: shoppingMutedText,
      textDecorationLine: "line-through",
    },
    shoppingItemMeta: {
      color: shoppingMetaText,
    },
    shoppingItemName: {
      color: shoppingText,
      fontWeight: "800",
    },
    shoppingItemRow: {
      borderBottomColor: shoppingRowBorder,
      borderBottomWidth: 1,
      minHeight: 33,
      paddingRight: spacing.xs,
    },
    textArea: {
      minHeight: 84,
      paddingTop: spacing.md,
      textAlignVertical: "top",
    },
  });
}
