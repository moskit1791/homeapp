import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  checkShoppingItem,
  createMealPlan,
  createShoppingItem,
  deleteShoppingItem,
  getCurrentMealPlanWeek,
  listShoppingItems,
  listShoppingLists,
  queryKeys,
  type MealPlanEntry,
  type ShoppingItem,
  type ShoppingListType,
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
  DotsVertical,
  Plus,
  Trash2,
  Utensils,
  UserPlus,
} from "../../src/ui/icon";

type MainSegment = "shopping" | "meals";

const listTypes: Array<{ label: string; value: ShoppingListType }> = [
  { label: "Dzisiaj", value: "daily" },
  { label: "Na później", value: "long_term" },
];

export default function ListaScreen() {
  const permissionsQuery = usePermissions();
  const shoppingPermission = useModulePermission("shopping");
  const mealPermission = useModulePermission("meal_planner");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
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
        <View style={styles.headerActions}>
          <UserPlus color={theme.colors.text} size={19} />
          <DotsVertical color={theme.colors.text} size={19} />
        </View>
      }
      title="Lista"
    >
      <SegmentedControl
        onChange={setActiveSegment}
        options={availableSegments}
        value={activeSegment}
      />

      {activeSegment === "shopping" ? <ShoppingBoard /> : null}
      {activeSegment === "meals" ? <MealsBoard /> : null}
    </AppScreen>
  );
}

function ShoppingBoard() {
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
  const checkMutation = useMutation({
    mutationFn: (id: string) => checkShoppingItem(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id, { accessToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
  });

  const items = itemsQuery.data ?? [];
  const uncheckedItems = items.filter((item) => !item.isChecked);
  const checkedItems = items.filter((item) => item.isChecked);
  const groups = groupShoppingItems(uncheckedItems);
  const currentList =
    listsQuery.data?.find((list) => list.type === activeType)?.name ??
    (activeType === "daily" ? "Zakupy na dziś" : "Lista na później");
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
            onCheck={(item) => checkMutation.mutate(item.id)}
            onDelete={(item) => deleteMutation.mutate(item.id)}
            updating={checkMutation.isPending}
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
            onCheck={(item) => checkMutation.mutate(item.id)}
            onDelete={(item) => deleteMutation.mutate(item.id)}
            updating={checkMutation.isPending}
          />
        ) : null}
      </View>

      <MealPlanBanner />

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
        subtitle={activeType === "daily" ? "Dodajesz produkt na dziś." : "Dodajesz produkt na później."}
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

function MealsBoard() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permission = useModulePermission("meal_planner");
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [weekday, setWeekday] = useState(1);
  const [slotIndex, setSlotIndex] = useState(0);
  const [mealName, setMealName] = useState("");
  const [note, setNote] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const currentQuery = useQuery({
    enabled: permission.canRead && Boolean(accessToken),
    queryFn: () => getCurrentMealPlanWeek({ accessToken }),
    queryKey: [...queryKeys.meal, "current"],
  });
  const upsertMutation = useMutation({
    mutationFn: async () => {
      const currentPlan =
        currentQuery.data ??
        (await createMealPlan({ weekStartDate: currentWeekStart() }, { accessToken }));
      const weekId = currentPlan?.week?.id;

      if (!weekId) {
        throw new Error("Missing meal plan week");
      }

      return upsertMealSlot(
        weekId,
        [
          {
            mealName: mealName.trim(),
            note: note.trim() || null,
            slotIndex,
            weekday,
          },
        ],
        { accessToken },
      );
    },
    onSuccess: async () => {
      setMealName("");
      setNote("");
      setModalVisible(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.meal });
      await queryClient.invalidateQueries({ queryKey: queryKeys.start });
    },
  });
  const entries = [...(currentQuery.data?.entries ?? [])].sort(
    (left, right) => left.weekday - right.weekday || left.slotIndex - right.slotIndex,
  );
  const groupedEntries = groupMeals(entries);
  const canSave = permission.canUpdate && Boolean(mealName.trim()) && !upsertMutation.isPending;

  return (
    <>
      <View style={styles.mealHero}>
        <View style={styles.mealHeroIcon}>
          <Utensils color={theme.colors.food} size={22} />
        </View>
        <View style={styles.mealHeroText}>
          <Text style={styles.sectionTitle}>Plan posiłków</Text>
          <Text style={styles.sectionMeta}>
            {entries.length ? `${entries.length} wpisów w tym tygodniu` : "Zaplanuj, kup i gotuj bez chaosu"}
          </Text>
        </View>
        {permission.canUpdate ? (
          <Pressable onPress={() => setModalVisible(true)} style={styles.fabInline}>
            <Plus color={theme.colors.card} size={22} />
          </Pressable>
        ) : null}
      </View>

      <QueryState
        emptyText="Brak posiłków w planie."
        error={currentQuery.error}
        isEmpty={!currentQuery.isLoading && entries.length === 0}
        isLoading={currentQuery.isLoading}
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
        subtitle="Wybierz dzień i slot, potem wpisz posiłek."
        title="Dodaj posiłek"
        visible={modalVisible}
      >
        <View style={styles.chips}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <Chip active={weekday === day} key={day} onPress={() => setWeekday(day)} title={weekdayShort(day)} />
          ))}
        </View>
        <View style={styles.chips}>
          {[0, 1, 2, 3].map((slot) => (
            <Chip active={slotIndex === slot} key={slot} onPress={() => setSlotIndex(slot)} title={`Slot ${slot + 1}`} />
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
          placeholder="Notatka lub link"
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, styles.textArea]}
          value={note}
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
  onCheck,
  onDelete,
  updating,
}: {
  canDelete: boolean;
  canUpdate: boolean;
  deleting: boolean;
  group: ShoppingGroup;
  onCheck: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  updating: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.shoppingGroup}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{group.title}</Text>
        <DotsVertical color={theme.colors.textMuted} size={18} />
      </View>
      <View style={styles.groupBody}>
        <View style={styles.groupItems}>
          {group.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Pressable
                disabled={!canUpdate || updating || item.isChecked}
                onPress={() => onCheck(item)}
                style={[styles.checkBox, item.isChecked && styles.checkBoxDone]}
              >
                {item.isChecked ? <Check color={theme.colors.card} size={14} /> : null}
              </Pressable>
              <View style={styles.itemText}>
                <Text style={[styles.itemName, item.isChecked && styles.itemDone]}>{item.name}</Text>
                {item.quantity ? (
                  <Text numberOfLines={1} style={styles.itemMeta}>
                    {item.quantity}
                  </Text>
                ) : null}
              </View>
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

function MealPlanBanner() {
  const { session } = useSession();
  const query = useQuery({
    enabled: Boolean(session?.accessToken),
    queryFn: () => getCurrentMealPlanWeek({ accessToken: session?.accessToken }),
    queryKey: [...queryKeys.meal, "shopping-banner"],
  });
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const count = query.data?.entries.length ?? 0;

  return (
    <View style={styles.mealBanner}>
      <View>
        <Text style={styles.mealBannerTitle}>Powiązany plan posiłków</Text>
        <Text style={styles.mealBannerMeta}>{count} z 7 posiłków zaplanowanych na dziś</Text>
      </View>
      <Text style={styles.mealBannerAction}>Zobacz plan</Text>
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

type ShoppingGroup = {
  emoji: string;
  items: ShoppingItem[];
  title: string;
};

function groupShoppingItems(items: ShoppingItem[]): ShoppingGroup[] {
  const groups: ShoppingGroup[] = [
    { emoji: "🥒", items: [], title: "Warzywa i owoce" },
    { emoji: "🧀", items: [], title: "Nabiał" },
    { emoji: "🫙", items: [], title: "Spiżarnia" },
    { emoji: "🛒", items: [], title: "Pozostałe" },
  ];

  items.forEach((item) => {
    const name = item.name.toLowerCase();
    const target = groups.find((group) => {
      if (group.title === "Warzywa i owoce") {
        return /pomidor|og[oó]rek|banan|sa[łl]ata|jab[łl]ko|owoc|warzyw/.test(name);
      }

      if (group.title === "Nabiał") {
        return /mleko|jogurt|ser|twar[oó]g|mas[łl]o|śmietan/.test(name);
      }

      if (group.title === "Spiżarnia") {
        return /makaron|ryż|oliw|kasz|m[ąa]k|cukier|s[óo]l/.test(name);
      }

      return false;
    });

    (target ?? groups[3]!).items.push(item);
  });

  return groups.filter((group) => group.items.length > 0);
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

function currentWeekStart(): string {
  const today = new Date();
  const day = today.getDay() === 0 ? 7 : today.getDay();
  const from = new Date(today);
  from.setDate(today.getDate() - day + 1);

  return isoFromDate(from);
}

function isoFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
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
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 34,
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
