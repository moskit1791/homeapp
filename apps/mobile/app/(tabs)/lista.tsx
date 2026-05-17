import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  type MealPlanAiDraftEntry,
  type MealPlanAiMessage,
  type MealPlanEntry,
  type MealPlanDetail,
  type MealPlanSummary,
  type ShoppingItem,
  type ShoppingListType,
  toggleShoppingItem,
  upsertMealSlot,
} from "../../src/api";
import { hasModuleRead, useModulePermission, usePermissions } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
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
  Trash2,
  Utensils,
} from "../../src/ui/icon";

type MainSegment = "shopping" | "meals";

const listTypes: Array<{ label: string; value: ShoppingListType }> = [
  { label: "Dzisiaj", value: "daily" },
  { label: "Jutro", value: "tomorrow" },
  { label: "Na później", value: "long_term" },
];

LocaleConfig.locales.pl = {
  dayNames: ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"],
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
  monthNamesShort: ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"],
  today: "Dzisiaj",
};
LocaleConfig.defaultLocale = "pl";

export default function ListaScreen() {
  const params = useLocalSearchParams<{ action?: string; segment?: MainSegment }>();
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
  const clearRouteAction = useCallback(() => {
    router.setParams({ action: undefined });
  }, [router]);
  const availableSegments = useMemo(
    () =>
      [
        shoppingPermission.canRead
          ? { label: "Zakupy", value: "shopping" as const }
          : null,
        mealPermission.canRead ? { label: "Posiłki", value: "meals" as const } : null,
      ].filter(Boolean) as Array<{ label: string; value: MainSegment }>,
    [mealPermission.canRead, shoppingPermission.canRead],
  );

  useEffect(() => {
    if (availableSegments.length > 0 && !availableSegments.some((segment) => segment.value === activeSegment)) {
      selectMainSegment(availableSegments[0]!.value);
    }
  }, [activeSegment, availableSegments]);

  useEffect(() => {
    if (params.segment && availableSegments.some((segment) => segment.value === params.segment)) {
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

  function selectMainSegment(segment: MainSegment) {
    setActiveSegment(segment);

    if (segment === "meals") {
      setMealViewResetRequest((value) => value + 1);
    }
  }

  if (permissionsQuery.isLoading) {
    return (
      <AppScreen title="Lista">
        <QueryState isLoading />
      </AppScreen>
    );
  }

  if (!hasModuleRead(permissionsQuery.data, ["shopping", "meal_planner"])) {
    return (
      <AppScreen title="Lista">
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
        ) : activeSegment === "meals" && mealPermission.canCreate && mealPermission.canUpdate ? (
          <IconButton
            accessibilityLabel="AI do planu posilkow"
            onPress={() => setMealAiOpenRequest((value) => value + 1)}
            style={styles.aiHeaderButton}
          >
            <Sparkles color={theme.colors.food} size={22} />
          </IconButton>
        ) : undefined
      }
      title="Lista"
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
          onRouteActionHandled={clearRouteAction}
          resetRequest={mealViewResetRequest}
        />
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
  const [handledAiOpenRequest, setHandledAiOpenRequest] = useState(aiOpenRequest);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

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
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleShoppingItem(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });
  const clearMutation = useMutation({
    mutationFn: () => clearShoppingList(activeType, { accessToken }),
    onSuccess: async () => {
      setClearConfirmVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });
  const moveMutation = useMutation({
    mutationFn: ({ id, targetType }: { id: string; targetType: ShoppingListType }) =>
      moveShoppingItem(id, { targetType }, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });
  const moveUncheckedMutation = useMutation({
    mutationFn: () => moveUncheckedShoppingToTomorrow({ accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });
  const aiImportMutation = useMutation({
    mutationFn: () => importShoppingItemsWithAi(activeType, { message: aiMessage.trim() }, { accessToken }),
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
    (activeType === "daily" ? "Zakupy na dziś" : activeType === "tomorrow" ? "Zakupy na jutro" : "Lista na później");
  const canAdd = permission.canCreate && Boolean(name.trim()) && !createMutation.isPending;
  const canImportWithAi =
    permission.canCreate && aiMessage.trim().length >= 3 && !aiImportMutation.isPending;

  return (
    <>
      <SegmentedControl onChange={setActiveType} options={listTypes} value={activeType} />

      <QueryState error={itemsQuery.error} isLoading={itemsQuery.isLoading} />

      <View style={styles.listHeader}>
        <View>
          <Text style={styles.sectionTitle}>{currentList}</Text>
          <Text style={styles.sectionMeta}>
            {uncheckedItems.length} do kupienia / {checkedItems.length} kupione
          </Text>
        </View>
        {permission.canCreate ? (
          <Pressable onPress={() => setModalVisible(true)} style={styles.fabInline}>
            <Plus color={theme.colors.card} size={22} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.quickActions}>
        {activeType === "daily" && uncheckedItems.length > 0 && permission.canUpdate ? (
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

      {!itemsQuery.isLoading && uncheckedItems.length === 0 && checkedItems.length === 0 ? (
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
            onCheck={(item) => toggleMutation.mutate(item.id)}
            onDelete={(item) => deleteMutation.mutate(item.id)}
            onMove={(item, targetType) => moveMutation.mutate({ id: item.id, targetType })}
            updating={toggleMutation.isPending}
          />
        ))}
        {checkedItems.length > 0 ? (
          <ShoppingGroupCard
            canDelete={permission.canDelete}
            canUpdate={permission.canUpdate}
            deleting={deleteMutation.isPending}
            group={{
              emoji: "✓",
              items: checkedItems,
              title: "Kupione",
            }}
            listType={activeType}
            moving={moveMutation.isPending}
            onCheck={(item) => toggleMutation.mutate(item.id)}
            onDelete={(item) => deleteMutation.mutate(item.id)}
            onMove={(item, targetType) => moveMutation.mutate({ id: item.id, targetType })}
            updating={toggleMutation.isPending}
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
              loading={clearMutation.isPending}
              onPress={() => clearMutation.mutate()}
              style={styles.modalFooterButton}
              title="Wyczyść"
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
          Ta akcja usunie wszystkie produkty z tej listy zakupów. Nie da się jej cofnąć.
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
          <Text style={styles.sectionMeta}>Produkty trafią do aktualnie wybranej listy.</Text>
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
          <InlineAlert tone="error" text="AI nie dodało produktów. Sprawdź konfigurację albo treść listy." />
        ) : null}
      </FormModal>
    </>
  );
}

function MealsBoard({
  action,
  aiOpenRequest,
  onRouteActionHandled,
  resetRequest,
}: {
  action?: string;
  aiOpenRequest: number;
  onRouteActionHandled: () => void;
  resetRequest: number;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("meal_planner");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [selectedWeekStartDate, setSelectedWeekStartDate] = useState(currentWeekStart());
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
  const [aiTargetWeekConfirmed, setAiTargetWeekConfirmed] = useState(false);
  const [aiTargetWeekStartDate, setAiTargetWeekStartDate] = useState(selectedWeekStartDate);
  const [aiNotice, setAiNotice] = useState("");
  const [handledAiOpenRequest, setHandledAiOpenRequest] = useState(aiOpenRequest);
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
  const historyWeeks = mergeMealHistory(currentQuery.data?.week, historyQuery.data ?? []);
  const selectedWeek = historyWeeks.find((week) => week.weekStartDate === selectedWeekStartDate);
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
      const nextWeekStart = weekStartFromIsoDate(nextDate) ?? currentWeekStart();

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
  const selectedDraftKey = mealDraftKey(selectedWeekStartDate, weekday, slotIndex);

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

      if (!aiTargetWeekConfirmed || !isValidWeekStartDate(aiTargetWeekStartDate)) {
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
        setAiNotice("Limit AI jest wyczerpany. Aplikacja uzyla lokalnego algorytmu.");
        setTimeout(() => setAiNotice(""), 3500);
      }
    },
  });
  const aiSaveMutation = useMutation({
    mutationFn: async () => {
      if (!aiTargetWeekConfirmed || !isValidWeekStartDate(aiTargetWeekStartDate)) {
        throw new Error("Missing AI target week");
      }

      if (!aiMessages.some((message) => message.role === "user")) {
        throw new Error("Najpierw wyslij wiadomosc do AI.");
      }

      const finalizeResponse = await finalizeMealPlanWithAi(
        {
          currentDraft: aiDraft,
          messages: aiMessages,
          targetWeekStartDate: aiTargetWeekStartDate,
        },
        { accessToken },
      );

      if (finalizeResponse.entries.length === 0) {
        throw new Error(
          finalizeResponse.assistantMessage || "AI nie przygotowalo planu do zapisu.",
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
    (left, right) => left.weekday - right.weekday || left.slotIndex - right.slotIndex,
  );
  const groupedEntries = groupMeals(entries);
  const mealSlots = buildMealSlotIndexes(householdQuery.data?.mealSlotsPerDay);
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
    aiDraft.length > 0 || aiMessages.some((message) => message.role === "assistant");
  const canSaveAi =
    permission.canCreate &&
    permission.canUpdate &&
    aiTargetWeekConfirmed &&
    isValidWeekStartDate(aiTargetWeekStartDate) &&
    hasAiConversation &&
    !aiChatMutation.isPending &&
    !aiSaveMutation.isPending;
  const aiDraftGroups = groupMealDraftEntries(aiDraft);

  useEffect(() => {
    if (!modalVisible) {
      return;
    }

    const draft =
      mealDrafts[selectedDraftKey] ??
      findMealDraftForSelection(activePlan, selectedWeekStartDate, weekday, slotIndex);

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
    const base = mealDrafts[selectedDraftKey] ??
      findMealDraftForSelection(activePlan, selectedWeekStartDate, weekday, slotIndex);

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
          <Text style={styles.sectionMeta}>{formatWeekRange(selectedWeekStartDate)}</Text>
        </View>
        {permission.canUpdate ? (
          <Pressable onPress={openCreateMealModal} style={styles.fabInline}>
            <Plus color={theme.colors.card} size={22} />
          </Pressable>
        ) : null}
      </View>
      {aiNotice ? <InlineAlert text={aiNotice} /> : null}

      <Pressable
        accessibilityLabel={isCalendarExpanded ? "Zwin wybor tygodnia" : "Zmien tydzien posilkow"}
        accessibilityRole="button"
        onPress={() => setCalendarExpanded((value) => !value)}
        style={({ pressed }) => [styles.calendarToggle, pressed && styles.pressed]}
      >
        <View style={styles.calendarToggleIcon}>
          <CalendarDays color={theme.colors.food} size={19} />
        </View>
        <View style={styles.calendarToggleText}>
          <Text style={styles.calendarToggleTitle}>{isCalendarExpanded ? "Zwin kalendarz" : "Zmien tydzien"}</Text>
          <Text style={styles.calendarToggleMeta}>{formatWeekRange(selectedWeekStartDate)}</Text>
        </View>
        <View style={isCalendarExpanded ? styles.calendarToggleChevronOpen : undefined}>
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
        isEmpty={!currentQuery.isLoading && !selectedPlanQuery.isLoading && entries.length === 0}
        isLoading={currentQuery.isLoading || selectedPlanQuery.isLoading}
      />

      <View style={styles.groupList}>
        {groupedEntries.map((group) => (
          <View key={group.day} style={styles.mealDayCard}>
            <Text style={styles.groupTitle}>{weekdayLabel(group.day)}</Text>
            {group.entries.map((entry) => (
              <View key={entry.id} style={styles.mealRow}>
                <View style={styles.mealSlot}>
                  <Text style={styles.mealSlotText}>{entry.slotIndex + 1}</Text>
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
                  <IconButton accessibilityLabel="Otworz link" onPress={() => Linking.openURL(entry.linkUrl!)}>
                    <ExternalLink color={theme.colors.food} size={17} />
                  </IconButton>
                ) : null}
                <View style={styles.mealRowActions}>
                  {permission.canUpdate ? (
                    <IconButton accessibilityLabel="Edytuj posiłek" onPress={() => openEditMealModal(entry)}>
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
            <Chip active={slotIndex === slot} key={slot} onPress={() => setSlotIndex(slot)} title={`Posiłek ${slot + 1}`} />
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
                  <View key={`${entry.weekday}-${entry.slotIndex}`} style={styles.aiDraftMeal}>
                    <View style={styles.mealSlot}>
                      <Text style={styles.mealSlotText}>{entry.slotIndex + 1}</Text>
                    </View>
                    <View style={styles.itemText}>
                      <Text style={styles.itemName}>{entry.mealName}</Text>
                      {entry.sourceHint || entry.note || entry.linkUrl ? (
                        <Text numberOfLines={2} style={styles.itemMeta}>
                          {[entry.sourceHint, entry.linkUrl ? "link" : null, entry.note]
                            .filter(Boolean)
                            .join(" / ")}
                        </Text>
                      ) : null}
                    </View>
                    {entry.linkUrl ? (
                      <IconButton accessibilityLabel="Otworz link z AI" onPress={() => Linking.openURL(entry.linkUrl!)}>
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
        {aiSaveMutation.error ? (
          <InlineAlert
            tone="error"
            text={getMealAiErrorText(aiSaveMutation.error, "Nie udalo sie zapisac planu z AI.")}
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
  listType,
  moving,
  onCheck,
  onDelete,
  onMove,
  updating,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  deleting: boolean;
  group: ShoppingGroup;
  listType: ShoppingListType;
  moving: boolean;
  onCheck: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  onMove: (item: ShoppingItem, targetType: ShoppingListType) => void;
  updating: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.shoppingGroup}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{group.title}</Text>
      </View>
      <View style={styles.groupBody}>
        <View style={styles.groupItems}>
          {group.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Pressable
                disabled={!canUpdate || updating}
                onPress={() => onCheck(item)}
                style={[styles.checkBox, item.isChecked && styles.checkBoxDone]}
              >
                {item.isChecked ? <Check color={theme.colors.card} size={14} /> : null}
              </Pressable>
              <Pressable
                disabled={!canUpdate || updating}
                onPress={() => onCheck(item)}
                style={styles.itemText}
              >
                <Text style={[styles.itemName, item.isChecked && styles.itemDone]}>{item.name}</Text>
                {item.quantity ? (
                  <Text numberOfLines={1} style={styles.itemMeta}>
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
        <View style={styles.groupEmoji}>
          <Text style={styles.groupEmojiText}>{group.emoji}</Text>
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
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{title}</Text>
    </Pressable>
  );
}

function CalendarWeekPicker({
  mealWeeks,
  onSelect,
  selectedWeekStartDate,
}: {
  mealWeeks: Array<{ entriesCount?: number; id: string; weekStartDate: string }>;
  onSelect: (weekStartDate: string) => void;
  selectedWeekStartDate: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const markedDates = useMemo(
    () => buildMarkedMealWeekDates(selectedWeekStartDate, mealWeeks, theme.colors),
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
      <Text style={styles.calendarPickerMeta}>Wybrany tydzien: {formatWeekRange(selectedWeekStartDate)}</Text>
    </View>
  );
}

type MealDraft = {
  linkUrl: string;
  mealName: string;
  note: string;
};

type ShoppingGroup = {
  emoji: string;
  items: ShoppingItem[];
  title: string;
};

type ShoppingCategoryRule = {
  emoji: string;
  keywords: RegExp;
  title: string;
};

const shoppingCategoryRules: ShoppingCategoryRule[] = [
  {
    emoji: "🥦",
    keywords: /pomidor|ogorek|ogor|salat|papryk|marchew|ziemni|cebula|czosn|warzyw|brokul|kalaf|kapust|cukini|awokado|pieczark|boczniak|rukol|szpinak/,
    title: "Warzywa",
  },
  {
    emoji: "🍎",
    keywords: /banan|jabl|granat|grusz|cytryn|limonk|owoc|truskawk|malin|borow|winogron|pomarancz|mandaryn|kiwi/,
    title: "Owoce",
  },
  {
    emoji: "🧀",
    keywords: /mleko|jogurt|kefir|maslank|ser|twarog|serek|maslo|smietan|mozzarell|feta|burrat|buratt|skyr|jajk/,
    title: "Nabiał i jajka",
  },
  {
    emoji: "🥖",
    keywords: /chleb|bulka|bulki|bagiet|kajzer|tost|pieczyw|tortill|croissant|drozdz/,
    title: "Pieczywo",
  },
  {
    emoji: "🍗",
    keywords: /kurczak|indyk|wolow|wieprz|mieso|wedlin|szynk|kielbas|parowk|boczek|ryb|losos|tunczyk|dorsz|sledz/,
    title: "Mięso i ryby",
  },
  {
    emoji: "🫙",
    keywords: /makaron|ryz|kasz|oliw|olej|maka|cukier|sol|pieprz|platk|musli|konserw|puszk|sos|passat|przypraw|ketchup|majonez|musztard|ocet|dzem|miod/,
    title: "Spiżarnia",
  },
  {
    emoji: "🧊",
    keywords: /mrozon|lody|frytki|pizza|pierog/,
    title: "Mrożonki",
  },
  {
    emoji: "🧃",
    keywords: /woda|sok|napoj|cola|pepsi|kawa|herbat|piwo|wino|smoothie/,
    title: "Napoje",
  },
  {
    emoji: "🍫",
    keywords: /czekolad|ciastk|baton|chips|chrupk|orzech|palusz|cukierk|zelk|przekask|deser/,
    title: "Słodycze i przekąski",
  },
  {
    emoji: "🧼",
    keywords: /plyn|proszek|kapsulk|zmywark|prani|papier|recznik|worki|gabka|scierk|mop|chemia|sprzat|odkamieniacz/,
    title: "Chemia i sprzątanie",
  },
  {
    emoji: "🧴",
    keywords: /szampon|mydlo|zel|pasta|szczotecz|dezodorant|krem|balsam|kosmet|higien|chustecz|wacik/,
    title: "Higiena",
  },
];

function groupShoppingItems(items: ShoppingItem[]): ShoppingGroup[] {
  const groups = new Map<string, ShoppingGroup>();

  shoppingCategoryRules.forEach((rule) => {
    groups.set(rule.title, { emoji: rule.emoji, items: [], title: rule.title });
  });
  groups.set("Pozostałe", { emoji: "🛒", items: [], title: "Pozostałe" });

  items.forEach((item) => {
    const name = normalizeShoppingName(item.name);
    const target = groups.get(resolveShoppingGroupTitle(item, name));

    (target ?? groups.get("Pozostałe"))?.items.push(item);
  });

  return [...groups.values()].filter((group) => group.items.length > 0);
}

function normalizeShoppingName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveShoppingGroupTitle(item: ShoppingItem, normalizedName: string): string {
  const keywordRule = shoppingCategoryRules.find((rule) => rule.keywords.test(normalizedName));

  if (keywordRule) {
    return keywordRule.title;
  }

  switch (item.category) {
    case "Nabial":
      return "Nabiał i jajka";
    case "Mieso i wedliny":
    case "Ryby i owoce morza":
      return "Mięso i ryby";
    case "Pieczywo":
      return "Pieczywo";
    case "Mrozonki":
      return "Mrożonki";
    case "Produkty suche i spizarnia":
    case "Sosy i dodatki":
      return "Spiżarnia";
    case "Przekaski i slodycze":
      return "Słodycze i przekąski";
    case "Napoje":
      return "Napoje";
    case "Chemia i dom":
      return "Chemia i sprzątanie";
    default:
      return "Pozostałe";
  }
}

function mealDraftKey(weekStartDate: string, weekday: number, slotIndex: number): string {
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
    plan.entries.find((entry) => entry.weekday === weekday && entry.slotIndex === slotIndex),
  );
}

function buildAiMealNote(entry: MealPlanAiDraftEntry): string | null {
  const note = entry.note?.trim();
  const sourceHint = entry.sourceHint?.trim();

  if (note && sourceHint && !note.toLowerCase().includes(sourceHint.toLowerCase())) {
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

  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function buildMarkedMealWeekDates(
  selectedWeekStartDate: string,
  mealWeeks: Array<{ entriesCount?: number; id: string; weekStartDate: string }>,
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
    marked[week.weekStartDate] = {
      dotColor: colors.food,
      marked: Boolean(week.entriesCount),
    };
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
): Array<{ entriesCount?: number; id: string; weekStartDate: string }> {
  const weeks = new Map<string, { entriesCount?: number; id: string; weekStartDate: string }>();

  if (currentWeek) {
    weeks.set(currentWeek.id, currentWeek);
  }

  history.forEach((week) => weeks.set(week.id, week));

  return [...weeks.values()].sort((left, right) => right.weekStartDate.localeCompare(left.weekStartDate));
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

  const historicalWeek = history.find((week) => week.weekStartDate === targetWeekStartDate);

  if (historicalWeek) {
    return getMealPlanWeek(historicalWeek.id, { accessToken });
  }

  return createMealPlan({ weekStartDate: targetWeekStartDate }, { accessToken });
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

function buildMealSlotIndexes(value: number | null | undefined): number[] {
  const count = Number.isFinite(value) ? Math.max(1, Math.min(8, Number(value))) : 4;

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

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    checkBox: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
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
    aiIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: radii.control,
      height: 38,
      justifyContent: "center",
      width: 38,
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
      backgroundColor: colors.primary,
      borderColor: colors.primary,
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
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
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
      flexDirection: "row",
      justifyContent: "space-between",
    },
    groupItems: {
      flex: 1,
      gap: spacing.xs,
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
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      justifyContent: "flex-end",
      maxWidth: 118,
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    textArea: {
      minHeight: 84,
      paddingTop: spacing.md,
      textAlignVertical: "top",
    },
  });
}
