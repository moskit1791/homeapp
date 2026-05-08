import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  getStartDashboard,
  listNotes,
  listShoppingItems,
  queryKeys,
  type StartCalendarEvent,
} from "../../src/api";
import { useModulePermission } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import { ActionButton, AppScreen, FormModal, IconButton, QueryState } from "../../src/ui";
import {
  AccountCircle,
  Bell,
  CalendarDays,
  CartPlus,
  ChevronRight,
  NotePlus,
  NotebookText,
  Plus,
  ReceiptText,
  RefreshCcw,
  ShoppingCart,
  Utensils,
  WalletCards,
} from "../../src/ui/icon";

export default function DzisiajScreen() {
  const { session } = useSession();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const shoppingPermission = useModulePermission("shopping");
  const notesPermission = useModulePermission("notes");

  const dashboardQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getStartDashboard({ accessToken }),
    queryKey: queryKeys.startDashboard,
  });
  const shoppingQuery = useQuery({
    enabled: shoppingPermission.canRead && Boolean(accessToken),
    queryFn: () => listShoppingItems("daily", { accessToken }),
    queryKey: [...queryKeys.shopping, "daily", "today-preview"],
  });
  const notesQuery = useQuery({
    enabled: notesPermission.canRead && Boolean(accessToken),
    queryFn: () => listNotes({ accessToken }),
    queryKey: [...queryKeys.notes, "today-preview"],
  });

  const dashboard = dashboardQuery.data;
  const upcomingEvents = dashboard?.upcomingEvents ?? [];
  const todayEvents = upcomingEvents.filter(isTodayEvent);
  const nextEvent = todayEvents[0] ?? upcomingEvents[0];
  const mealEntries = dashboard?.mealPlan?.entries ?? [];
  const nextMeal = mealEntries[0];
  const openShopping = (shoppingQuery.data ?? []).filter(
    (item) => !item.isChecked,
  );
  const latestNote = [...(notesQuery.data ?? [])].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0];
  const remainingBudget = dashboard?.finance?.totalRemainingAmount;
  const remainingBudgetAmount = Number(remainingBudget ?? 0);
  const openFromNotification = useCallback((route: "/(tabs)/kalendarz" | "/(tabs)/finanse" | "/(tabs)/lista" | "/(tabs)/dom") => {
    setNotificationsVisible(false);
    router.push(route as never);
  }, [router]);
  const notificationItems = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    if (todayEvents.length > 0) {
      items.push({
        body: nextEvent ? eventMeta(nextEvent) : "Sprawdź plan dnia.",
        icon: <CalendarDays color={theme.colors.calendar} size={20} />,
        id: "today-events",
        onPress: () => openFromNotification("/(tabs)/kalendarz"),
        title: todayEvents.length === 1 ? "Masz 1 wydarzenie dzisiaj" : `Masz ${todayEvents.length} wydarzenia dzisiaj`,
      });
    }

    if (openShopping.length > 0) {
      items.push({
        body: openShopping.length === 1 ? "1 produkt czeka na liście." : `${openShopping.length} produktów czeka na liście.`,
        icon: <ShoppingCart color={theme.colors.shopping} size={20} />,
        id: "shopping-open",
        onPress: () => openFromNotification("/(tabs)/lista"),
        title: "Zakupy do zrobienia",
      });
    }

    if (Number.isFinite(remainingBudgetAmount) && remainingBudgetAmount < 0) {
      items.push({
        body: `Budżet jest przekroczony o ${formatMoney(Math.abs(remainingBudgetAmount))}.`,
        icon: <WalletCards color={theme.colors.danger} size={20} />,
        id: "budget-negative",
        onPress: () => openFromNotification("/(tabs)/finanse"),
        title: "Budżet wymaga uwagi",
      });
    }

    if (!nextMeal) {
      items.push({
        body: "Nie ma zaplanowanego posiłku na dziś.",
        icon: <Utensils color={theme.colors.food} size={20} />,
        id: "meal-missing",
        onPress: () => openFromNotification("/(tabs)/lista"),
        title: "Plan posiłków jest pusty",
      });
    }

    return items;
  }, [
    nextEvent,
    nextMeal,
    openShopping.length,
    remainingBudgetAmount,
    openFromNotification,
    theme.colors.calendar,
    theme.colors.danger,
    theme.colors.food,
    theme.colors.shopping,
    todayEvents.length,
  ]);

  return (
    <AppScreen
      actions={
        <View style={styles.headerActions}>
          <IconButton
            accessibilityLabel="Odśwież ekran Dzisiaj"
            disabled={dashboardQuery.isFetching}
            onPress={() => dashboardQuery.refetch()}
          >
            <RefreshCcw color={theme.colors.textMuted} size={17} />
          </IconButton>
          <IconButton
            accessibilityLabel="Pokaż powiadomienia"
            onPress={() => setNotificationsVisible(true)}
          >
            <View style={styles.bellWrap}>
              <Bell color={theme.colors.text} size={19} />
              {notificationItems.length > 0 ? <View style={styles.bellDot} /> : null}
            </View>
          </IconButton>
        </View>
      }
      leading={
        <View style={styles.avatar}>
          <AccountCircle color={theme.colors.text} size={27} />
        </View>
      }
      subtitle="Masz wszystko pod kontrolą."
      title="Dzisiaj"
      titleAlign="center"
    >
      <QueryState error={dashboardQuery.error} isLoading={dashboardQuery.isLoading} />

      <View style={styles.greeting}>
        <Text style={styles.greetingTitle}>Dzień dobry!</Text>
        <Text style={styles.greetingText}>Najważniejsze rzeczy są teraz 1-2 tapnięcia stąd.</Text>
      </View>

      <View style={styles.tileList}>
        <HomeTile
          accent={theme.colors.calendar}
          icon={<CalendarDays color={theme.colors.calendar} size={24} />}
          meta={nextEvent ? eventMeta(nextEvent) : "Brak planu na dziś"}
          onPress={() => router.push("/(tabs)/kalendarz" as never)}
          title="Wydarzenia dzisiaj"
          value={String(todayEvents.length || upcomingEvents.length)}
        />
        <HomeTile
          accent={theme.colors.warning}
          icon={<NotebookText color={theme.colors.warning} size={24} />}
          meta={latestNote ? `Zaktualizowano ${formatShortDate(latestNote.updatedAt)}` : "Dodaj pierwszą notatkę"}
          onPress={() => router.push("/(tabs)/kalendarz" as never)}
          title="Ostatnia notatka"
          value={latestNote?.title ?? "Notatki"}
        />
        <HomeTile
          accent={theme.colors.finance}
          icon={<WalletCards color={theme.colors.finance} size={24} />}
          meta="zostaje do końca miesiąca"
          onPress={() => router.push("/(tabs)/finanse" as never)}
          title="Budżet w tym miesiącu"
          value={formatMoney(remainingBudget)}
        />
        <HomeTile
          accent={theme.colors.shopping}
          icon={<ShoppingCart color={theme.colors.shopping} size={24} />}
          meta={openShopping.length === 1 ? "1 pozycja czeka" : `${openShopping.length} pozycji czeka`}
          onPress={() => router.push("/(tabs)/lista" as never)}
          title="Zakupy do zrobienia"
          value={`${openShopping.length} pozycji`}
        />
        <HomeTile
          accent={theme.colors.food}
          icon={<Utensils color={theme.colors.food} size={24} />}
          meta={nextMeal ? `Dzień ${nextMeal.weekday}, slot ${nextMeal.slotIndex + 1}` : "Ułóż plan posiłków"}
          onPress={() => router.push("/(tabs)/lista" as never)}
          title="Dzisiejszy posiłek"
          value={nextMeal?.mealName ?? "Brak planu"}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Szybkie akcje</Text>
      </View>
      <View style={styles.quickGrid}>
        <QuickAction
          color={theme.colors.warning}
          icon={<NotePlus color={theme.colors.warning} size={21} />}
          label="Dodaj notatkę"
          onPress={() => router.push("/(tabs)/kalendarz" as never)}
        />
        <QuickAction
          color={theme.colors.finance}
          icon={<ReceiptText color={theme.colors.finance} size={21} />}
          label="Dodaj wydatek"
          onPress={() => router.push("/(tabs)/finanse" as never)}
        />
        <QuickAction
          color={theme.colors.shopping}
          icon={<CartPlus color={theme.colors.shopping} size={21} />}
          label="Dodaj zakupy"
          onPress={() => router.push("/(tabs)/lista" as never)}
        />
        <QuickAction
          color={theme.colors.food}
          icon={<Utensils color={theme.colors.food} size={21} />}
          label="Dodaj posiłek"
          onPress={() => router.push("/(tabs)/lista" as never)}
        />
      </View>

      <FormModal
        onClose={() => setNotificationsVisible(false)}
        subtitle={
          notificationItems.length === 0
            ? "Brak aktywnych spraw."
            : notificationItems.length === 1
            ? "1 aktywna sprawa do sprawdzenia."
            : `${notificationItems.length} aktywne sprawy do sprawdzenia.`
        }
        title="Powiadomienia"
        visible={notificationsVisible}
      >
        {notificationItems.length > 0 ? (
          notificationItems.map((item) => <NotificationRow item={item} key={item.id} />)
        ) : (
          <View style={styles.emptyNotifications}>
            <Bell color={theme.colors.textSubtle} size={24} />
            <Text style={styles.emptyNotificationsTitle}>Brak nowych powiadomień</Text>
            <Text style={styles.emptyNotificationsText}>Najważniejsze rzeczy pojawią się tutaj.</Text>
          </View>
        )}
        <ActionButton
          onPress={() => openFromNotification("/(tabs)/dom")}
          title="Ustawienia powiadomień push"
          variant="secondary"
        />
      </FormModal>
    </AppScreen>
  );
}

interface NotificationItem {
  body: string;
  icon: ReactNode;
  id: string;
  onPress: () => void;
  title: string;
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable
      accessibilityLabel={`${item.title}. ${item.body}`}
      accessibilityRole="button"
      onPress={item.onPress}
      style={({ pressed }) => [styles.notificationRow, pressed && styles.pressed]}
    >
      <View style={styles.notificationIcon}>{item.icon}</View>
      <View style={styles.notificationText}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
      </View>
      <ChevronRight color={theme.colors.textMuted} size={20} />
    </Pressable>
  );
}

function HomeTile({
  accent,
  icon,
  meta,
  onPress,
  title,
  value,
}: {
  accent: string;
  icon: ReactNode;
  meta: string;
  onPress: () => void;
  title: string;
  value: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable
      accessibilityLabel={`${title}: ${value}. ${meta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: tint(accent, 0.1), borderColor: tint(accent, 0.2) },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: tint(accent, 0.16) }]}>{icon}</View>
      <View style={styles.tileText}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.tileValue}>
          {value}
        </Text>
        <Text numberOfLines={1} style={styles.tileMeta}>
          {meta}
        </Text>
      </View>
      <ChevronRight color={theme.colors.textMuted} size={21} />
    </Pressable>
  );
}

function QuickAction({
  color,
  icon,
  label,
  onPress,
}: {
  color: string;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, { backgroundColor: tint(color, 0.14) }]}>
        {icon}
        <View style={styles.quickPlus}>
          <Plus color={theme.colors.card} size={10} />
        </View>
      </View>
      <Text numberOfLines={2} style={styles.quickLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function isTodayEvent(event: StartCalendarEvent): boolean {
  return event.eventDate === todayIso();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function eventMeta(event: StartCalendarEvent): string {
  return [formatShortDate(event.eventDate), event.eventTime?.slice(0, 5)]
    .filter(Boolean)
    .join(" / ");
}

function formatShortDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatMoney(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);

  return `${(Number.isFinite(amount) ? amount : 0).toLocaleString("pl-PL", {
    maximumFractionDigits: 0,
  })} zł`;
}

function tint(color: string, opacity: number): string {
  const value = color.replace("#", "");

  if (value.length !== 6) {
    return color;
  }

  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${value}${alpha}`;
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    avatar: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderRadius: 999,
      height: 34,
      justifyContent: "center",
      overflow: "hidden",
      width: 34,
    },
    bellDot: {
      backgroundColor: colors.warning,
      borderColor: colors.card,
      borderRadius: 999,
      borderWidth: 2,
      height: 10,
      position: "absolute",
      right: 2,
      top: 1,
      width: 10,
    },
    bellWrap: {
      alignItems: "center",
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    greeting: {
      alignItems: "center",
      gap: 2,
      marginTop: -2,
    },
    greetingText: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
    },
    greetingTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    emptyNotifications: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    emptyNotificationsText: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
      textAlign: "center",
    },
    emptyNotificationsTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "center",
    },
    notificationBody: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    notificationIcon: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderRadius: radii.control,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    notificationRow: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 68,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    notificationText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    notificationTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0,
    },
    pressed: {
      opacity: 0.76,
    },
    quickAction: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flex: 1,
      gap: spacing.xs,
      minHeight: 76,
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
    },
    quickGrid: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    quickIcon: {
      alignItems: "center",
      borderRadius: radii.control,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    quickLabel: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 14,
      textAlign: "center",
    },
    quickPlus: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 999,
      bottom: -2,
      height: 14,
      justifyContent: "center",
      position: "absolute",
      right: -2,
      width: 14,
    },
    sectionHeader: {
      marginTop: spacing.xs,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    tile: {
      alignItems: "center",
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 62,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
    },
    tileIcon: {
      alignItems: "center",
      borderRadius: radii.control,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    tileList: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    tileMeta: {
      color: colors.textMuted,
      fontSize: 11,
      letterSpacing: 0,
      lineHeight: 15,
    },
    tileText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    tileTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
    },
    tileValue: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 21,
    },
  });
}
