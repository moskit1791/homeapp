import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  clearShoppingList,
  createMealPlan,
  createShoppingItem,
  deleteShoppingItem,
  getCurrentMealPlanWeek,
  getMealPlanWeek,
  getMyHousehold,
  listMealPlanHistory,
  listShoppingItems,
  listShoppingLists,
  moveShoppingItem,
  moveUncheckedShoppingToTomorrow,
  queryKeys,
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
  Check,
  ChevronRight,
  Plus,
  Trash2,
  Utensils,
} from "../../src/ui/icon";

type MainSegment = "shopping" | "meals";

const listTypes: Array<{ label: string; value: ShoppingListType }> = [
  { label: "Dzisiaj", value: "daily" },
  { label: "Jutro", value: "tomorrow" },
  { label: "Na później", value: "long_term" },
];

export default function ListaScreen() {
  const params = useLocalSearchParams<{ action?: string; segment?: MainSegment }>();
  const permissionsQuery = usePermissions();
  const shoppingPermission = useModulePermission("shopping");
  const mealPermission = useModulePermission("meal_planner");
  const [activeSegment, setActiveSegment] = useState<MainSegment>("shopping");
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
      setActiveSegment(availableSegments[0]!.value);
    }
  }, [activeSegment, availableSegments]);

  useEffect(() => {
    if (params.segment && availableSegments.some((segment) => segment.value === params.segment)) {
      setActiveSegment(params.segment);
    }
  }, [availableSegments, params.segment]);

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
    <AppScreen title="Lista">
      <SegmentedControl
        onChange={setActiveSegment}
        options={availableSegments}
        value={activeSegment}
      />

      {activeSegment === "shopping" ? (
        <ShoppingBoard action={params.action} onOpenMealPlan={() => setActiveSegment("meals")} />
      ) : null}
      {activeSegment === "meals" ? <MealsBoard action={params.action} /> : null}
    </AppScreen>
  );
}

function ShoppingBoard({ action, onOpenMealPlan }: { action?: string; onOpenMealPlan: () => void }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("shopping");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [activeType, setActiveType] = useState<ShoppingListType>("daily");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (action === "addShopping") {
      setModalVisible(true);
    }
  }, [action]);

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
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

  const items = itemsQuery.data ?? [];
  const uncheckedItems = items.filter((item) => !item.isChecked);
  const checkedItems = items.filter((item) => item.isChecked);
  const groups = groupShoppingItems(uncheckedItems);
  const currentList =
    listsQuery.data?.find((list) => list.type === activeType)?.name ??
    (activeType === "daily" ? "Zakupy na dzis" : activeType === "tomorrow" ? "Zakupy na jutro" : "Lista na pozniej");
  const canAdd = permission.canCreate && Boolean(name.trim()) && !createMutation.isPending;

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
            onPress={() => clearMutation.mutate()}
            size="small"
            title="Wyczyść całą listę"
            variant="ghost"
          />
        ) : null}
      </View>

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

      <MealPlanBanner onOpenMealPlan={onOpenMealPlan} />

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
            ? "Dodajesz produkt na dzis."
            : activeType === "tomorrow"
              ? "Dodajesz produkt na jutro."
              : "Dodajesz produkt na pozniej."
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
    </>
  );
}

function MealsBoard({ action }: { action?: string }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("meal_planner");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [didInitCurrentWeek, setDidInitCurrentWeek] = useState(false);
  const [weekday, setWeekday] = useState(weekdayFromIsoDate(todayIso()));
  const [slotIndex, setSlotIndex] = useState(0);
  const [mealDate, setMealDate] = useState(todayIso());
  const [mealName, setMealName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [note, setNote] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
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
  const selectedPlanQuery = useQuery({
    enabled:
      permission.canRead &&
      Boolean(accessToken) &&
      Boolean(selectedWeekId) &&
      selectedWeekId !== currentQuery.data?.week.id,
    queryFn: () => getMealPlanWeek(selectedWeekId!, { accessToken }),
    queryKey: [...queryKeys.meal, selectedWeekId],
  });

  useEffect(() => {
    if (currentQuery.data?.week.id && !didInitCurrentWeek) {
      setSelectedWeekId(currentQuery.data.week.id);
      setDidInitCurrentWeek(true);
    }
  }, [currentQuery.data?.week.id, didInitCurrentWeek]);

  useEffect(() => {
    if (action === "addMeal") {
      const nextDate = todayIso();

      setMealDate(nextDate);
      setWeekday(weekdayFromIsoDate(nextDate));
      setModalVisible(true);
    }
  }, [action]);

  const activePlan =
    selectedWeekId && selectedWeekId !== currentQuery.data?.week.id
      ? selectedPlanQuery.data
      : currentQuery.data;

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const targetWeekStartDate = weekStartFromIsoDate(mealDate) ?? currentWeekStart();
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
            linkUrl: linkUrl.trim() || null,
            mealName: mealName.trim(),
            note: note.trim() || null,
            slotIndex,
            weekday: weekdayFromIsoDate(mealDate),
          },
        ],
        { accessToken },
      );
    },
    onSuccess: async (updatedPlan) => {
      setSelectedWeekId(updatedPlan.week.id);
      setMealName("");
      setLinkUrl("");
      setNote("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.meal });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const entries = [...(activePlan?.entries ?? [])].sort(
    (left, right) => left.weekday - right.weekday || left.slotIndex - right.slotIndex,
  );
  const groupedEntries = groupMeals(entries);
  const mealSlots = buildMealSlotIndexes(householdQuery.data?.mealSlotsPerDay);
  const historyWeeks = mergeMealHistory(currentQuery.data?.week, historyQuery.data ?? []);
  const canSave =
    permission.canUpdate &&
    Boolean(mealName.trim()) &&
    Boolean(weekStartFromIsoDate(mealDate)) &&
    !upsertMutation.isPending;

  return (
    <>
      <View style={styles.mealHero}>
        <View style={styles.mealHeroIcon}>
          <Utensils color={theme.colors.food} size={22} />
        </View>
        <View style={styles.mealHeroText}>
          <Text style={styles.sectionTitle}>Plan posiłków</Text>
          <Text style={styles.sectionMeta}>
            {activePlan?.week.weekStartDate ? formatWeekRange(activePlan.week.weekStartDate) : formatMealPlanSummary(entries.length)}
          </Text>
        </View>
        {permission.canUpdate ? (
          <Pressable
            onPress={() => {
              const nextDate = todayIso();

              setMealDate(nextDate);
              setWeekday(weekdayFromIsoDate(nextDate));
              setModalVisible(true);
            }}
            style={styles.fabInline}
          >
            <Plus color={theme.colors.card} size={22} />
          </Pressable>
        ) : null}
      </View>

      {historyWeeks.length > 0 ? (
        <View style={styles.chips}>
          {historyWeeks.map((week) => (
            <Chip
              active={selectedWeekId === week.id}
              key={week.id}
              onPress={() => setSelectedWeekId(week.id)}
              title={formatWeekChip(week.weekStartDate)}
            />
          ))}
        </View>
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
                    <ChevronRight color={theme.colors.food} size={17} />
                  </IconButton>
                ) : null}
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
        subtitle="Wybierz date, numer posilku i wpisz nazwe."
        title="Dodaj posiłek"
        visible={modalVisible}
      >
        <TextInput
          onChangeText={(value) => {
            setMealDate(value);
            setWeekday(weekdayFromIsoDate(value));
          }}
          placeholder="Data posilku, np. 2026-05-12"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={mealDate}
        />
        <View style={styles.chips}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <Chip
              active={weekday === day}
              key={day}
              onPress={() => {
                setWeekday(day);
                setMealDate(dateForWeekday(activePlan?.week.weekStartDate ?? currentWeekStart(), day));
              }}
              title={weekdayShort(day)}
            />
          ))}
        </View>
        <View style={styles.chips}>
          {mealSlots.map((slot) => (
            <Chip active={slotIndex === slot} key={slot} onPress={() => setSlotIndex(slot)} title={`Posiłek ${slot + 1}`} />
          ))}
        </View>
        <TextInput
          onChangeText={setMealName}
          placeholder="Nazwa posiłku"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={mealName}
        />
        <TextInput
          multiline
          onChangeText={setNote}
          placeholder="Notatka"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={note}
        />
        <TextInput
          autoCapitalize="none"
          keyboardType="url"
          onChangeText={setLinkUrl}
          placeholder="Link URL"
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.input}
          value={linkUrl}
        />
        {upsertMutation.error ? (
          <InlineAlert text="Nie udało się zapisać posiłku." tone="error" />
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

function MealPlanBanner({ onOpenMealPlan }: { onOpenMealPlan: () => void }) {
  const { session } = useSession();
  const query = useQuery({
    enabled: Boolean(session?.accessToken),
    queryFn: () => getCurrentMealPlanWeek({ accessToken: session?.accessToken }),
    queryKey: [...queryKeys.meal, "shopping-banner"],
  });
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const count = query.data?.entries.length ?? 0;
  const summary = query.isLoading ? "Sprawdzam plan posiłków" : formatMealPlanSummary(count);

  return (
    <Pressable
      accessibilityLabel="Zobacz plan posiłków"
      accessibilityRole="button"
      onPress={onOpenMealPlan}
      style={({ pressed }) => [styles.mealBanner, pressed && styles.pressed]}
    >
      <View>
        <Text style={styles.mealBannerTitle}>Powiązany plan posiłków</Text>
        <Text style={styles.mealBannerMeta}>{summary}</Text>
      </View>
      <Text style={styles.mealBannerAction}>Zobacz plan</Text>
    </Pressable>
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
    keywords: /pomidor|ogorek|ogor|salat|papryk|marchew|ziemni|cebula|czosn|warzyw|brokul|kalaf|kapust|cukini|awokado/,
    title: "Warzywa",
  },
  {
    emoji: "🍎",
    keywords: /banan|jablko|grusz|cytryn|limonk|owoc|truskawk|malin|borow|winogron|pomarancz|mandaryn|kiwi/,
    title: "Owoce",
  },
  {
    emoji: "🧀",
    keywords: /mleko|jogurt|kefir|maslank|ser|twarog|serek|maslo|smietan|mozzarell|feta|skyr|jajk/,
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
    const targetRule = shoppingCategoryRules.find((rule) => rule.keywords.test(name));
    const target = groups.get(targetRule?.title ?? "Pozostałe");

    target?.items.push(item);
  });

  return [...groups.values()].filter((group) => group.items.length > 0);
}

function normalizeShoppingName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
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

function formatMealPlanSummary(count: number): string {
  if (count === 0) {
    return "Brak posiłków w planie na ten tydzień";
  }

  if (count === 1) {
    return "1 posiłek w planie na ten tydzień";
  }

  return `${count} posiłków w planie na ten tydzień`;
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

function formatWeekChip(weekStartDate: string): string {
  return weekStartDate === currentWeekStart() ? "Ten tydzien" : `od ${weekStartDate.slice(5)}`;
}

function formatWeekRange(weekStartDate: string): string {
  const from = new Date(`${weekStartDate}T12:00:00`);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);

  return `Tydzien ${formatDateShort(from)} - ${formatDateShort(to)}`;
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
    checkBoxDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
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
      shadowColor: colors.primary,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.24,
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
    mealBanner: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      padding: spacing.md,
    },
    mealBannerAction: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    mealBannerMeta: {
      color: colors.primaryDark,
      fontSize: 12,
      letterSpacing: 0,
      marginTop: 2,
    },
    mealBannerTitle: {
      color: colors.primaryDark,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
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
      backgroundColor: colors.warningSoft,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    mealHeroIcon: {
      alignItems: "center",
      backgroundColor: colors.card,
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
