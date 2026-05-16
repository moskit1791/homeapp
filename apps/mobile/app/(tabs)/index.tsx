import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  getStartDashboard,
  listCleaningTasks,
  listShoppingItems,
  queryKeys,
  type CleaningTask,
  type StartCalendarEvent,
} from "../../src/api";
import {
  clearStoredNotifications,
  listUnreadStoredNotifications,
  listStoredNotifications,
  markStoredNotificationsRead,
  type StoredNotification,
} from "../../src/notifications/notification-center";
import { useModulePermission } from "../../src/permissions/use-permissions";
import { useSession } from "../../src/session/session-context";
import { radii, spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import { ActionButton, AppScreen, AppToast, IconButton, QueryState } from "../../src/ui";
import {
  AccountCircle,
  Bell,
  Broom,
  CalendarDays,
  CartPlus,
  ChevronRight,
  Close,
  ReceiptText,
  ShoppingCart,
  Utensils,
} from "../../src/ui/icon";

export default function DzisiajScreen() {
  const { session } = useSession();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [pushNotifications, setPushNotifications] = useState<StoredNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const cleaningPermission = useModulePermission("cleaning");
  const shoppingPermission = useModulePermission("shopping");

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
  const cleaningQuery = useQuery({
    enabled: cleaningPermission.canRead && Boolean(accessToken),
    queryFn: () => listCleaningTasks({ accessToken }),
    queryKey: [...queryKeys.cleaning, "today-preview"],
  });

  const dashboard = dashboardQuery.data;
  const upcomingEvents = dashboard?.upcomingEvents ?? [];
  const todayEvents = upcomingEvents.filter(isTodayEvent);
  const tomorrowEvents = upcomingEvents.filter(isTomorrowEvent);
  const nextEvent = todayEvents[0] ?? upcomingEvents[0];
  const mealEntries = dashboard?.mealPlan?.entries ?? [];
  const nextMeal = mealEntries.find((entry) => entry.weekday === todayWeekday());
  const openShopping = (shoppingQuery.data ?? []).filter(
    (item) => !item.isChecked,
  );
  const todayCleaningTasks = (cleaningQuery.data ?? []).filter(
    (task) => task.nextDueAt === todayIso(),
  );
  const openFromNotification = useCallback((route: "/(tabs)/kalendarz" | "/(tabs)/finanse" | "/(tabs)/lista" | "/(tabs)/dom" | "/(tabs)/zadania") => {
    setNotificationsVisible(false);
    router.push(route as never);
  }, [router]);
  const openCalendarForDate = useCallback((date: string, action?: "create") => {
    router.push({
      pathname: "/(tabs)/kalendarz",
      params: { action, date, intent: String(Date.now()) },
    } as never);
  }, [router]);
  const openCalendarNotification = useCallback((date: string) => {
    setNotificationsVisible(false);
    openCalendarForDate(date);
  }, [openCalendarForDate]);
  const openNotificationSettings = useCallback(() => {
    setNotificationsVisible(false);
    router.push({ pathname: "/(tabs)/dom", params: { settings: "1" } } as never);
  }, [router]);
  const refreshNotificationCenter = useCallback(async (markRead: boolean) => {
    const stored = await listStoredNotifications();

    setPushNotifications(stored);

    if (markRead && stored.length > 0) {
      await markStoredNotificationsRead(stored.map((item) => item.id));
      setUnreadNotificationsCount(0);
      return;
    }

    const unread = await listUnreadStoredNotifications();
    setUnreadNotificationsCount(unread.length);
  }, []);

  useEffect(() => {
    refreshNotificationCenter(false).catch(() => {
      setPushNotifications([]);
      setUnreadNotificationsCount(0);
    });
  }, [refreshNotificationCenter]);

  useEffect(() => {
    if (notificationsVisible) {
      refreshNotificationCenter(true).catch(() => setPushNotifications([]));
    }
  }, [notificationsVisible, refreshNotificationCenter]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }
  const notificationItems = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    if (todayEvents.length > 0) {
      items.push({
        body: nextEvent ? eventMeta(nextEvent) : "Sprawdź plan dnia.",
        icon: <CalendarDays color={theme.colors.calendar} size={20} />,
        id: "today-events",
        onPress: () => openCalendarNotification(todayIso()),
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

    return items;
  }, [
    nextEvent,
    openShopping.length,
    openCalendarNotification,
    openFromNotification,
    theme.colors.calendar,
    theme.colors.shopping,
    todayEvents.length,
  ]);

  return (
    <AppScreen
      actions={
        <View style={styles.headerActions}>
          <IconButton
            accessibilityLabel="Pokaż powiadomienia"
            onPress={() => setNotificationsVisible(true)}
          >
            <View style={styles.bellWrap}>
              <Bell color={unreadNotificationsCount > 0 ? theme.colors.warning : theme.colors.text} size={19} />
              {unreadNotificationsCount > 0 ? <View style={styles.bellDot} /> : null}
            </View>
          </IconButton>
        </View>
      }
      leading={
        <View style={styles.avatar}>
          <AccountCircle color={theme.colors.text} size={27} />
        </View>
      }
      title="Dzisiaj"
      titleAlign="center"
    >
      <AppToast offsetTop={74} text={toast} />
      <QueryState error={dashboardQuery.error} isLoading={dashboardQuery.isLoading} />

      {notificationsVisible ? (
        <NotificationCenterPanel
          notificationItems={notificationItems}
          onClear={() => {
            clearStoredNotifications()
              .then(() => {
                setPushNotifications([]);
                setUnreadNotificationsCount(0);
                showToast("Powiadomienia wyczyszczone");
              })
              .catch(() => showToast("Nie udało się wyczyścić powiadomień"));
          }}
          onClose={() => setNotificationsVisible(false)}
          onOpenSettings={openNotificationSettings}
          pushNotifications={pushNotifications}
        />
      ) : null}

      <View style={styles.quickSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Szybkie akcje</Text>
          <Text style={styles.sectionMeta}>{greetingTitle()}</Text>
        </View>
        <View style={styles.quickGrid}>
          <QuickAction
            color={theme.colors.calendar}
            icon={<CalendarDays color={theme.colors.calendar} size={24} />}
            label="Wydarzenie"
            onPress={() => openCalendarForDate(todayIso(), "create")}
            showDivider
          />
          <QuickAction
            color={theme.colors.finance}
            icon={<ReceiptText color={theme.colors.finance} size={24} />}
            label="Wydatek"
            onPress={() =>
              router.push({ pathname: "/(tabs)/finanse", params: { action: "expense" } } as never)
            }
            showDivider
          />
          <QuickAction
            color={theme.colors.shopping}
            icon={<CartPlus color={theme.colors.shopping} size={24} />}
            label="Zakupy"
            onPress={() => router.push({ pathname: "/(tabs)/lista", params: { action: "addShopping", segment: "shopping" } } as never)}
            showDivider
          />
          <QuickAction
            color={theme.colors.food}
            icon={<Utensils color={theme.colors.food} size={24} />}
            label="Posiłek"
            onPress={() => router.push({ pathname: "/(tabs)/lista", params: { action: "addMeal", segment: "meals" } } as never)}
          />
        </View>
      </View>

      <View style={styles.tileList}>
        <HomeTile
          accent={theme.colors.calendar}
          icon={<CalendarDays color={theme.colors.calendar} size={24} />}
          meta={nextEvent ? eventMeta(nextEvent) : "Brak planu na dziś"}
          onPress={() => openCalendarForDate(todayIso())}
          showDivider
          title="Wydarzenia dzisiaj"
          value={String(todayEvents.length || upcomingEvents.length)}
        />
        <HomeTile
          accent={theme.colors.calendar}
          icon={<CalendarDays color={theme.colors.calendar} size={24} />}
          meta={tomorrowEvents[0] ? eventMeta(tomorrowEvents[0]) : "Brak planu na jutro"}
          onPress={() => openCalendarForDate(offsetIsoDate(1))}
          showDivider
          title="Wydarzenia jutro"
          value={String(tomorrowEvents.length)}
        />
        <HomeTile
          accent={theme.colors.shopping}
          icon={<ShoppingCart color={theme.colors.shopping} size={24} />}
          meta={openShopping.length === 1 ? "1 pozycja czeka" : `${openShopping.length} pozycji czeka`}
          onPress={() => router.push({ pathname: "/(tabs)/lista", params: { segment: "shopping" } } as never)}
          showDivider
          title="Zakupy do zrobienia"
          value={`${openShopping.length} pozycji`}
        />
        <HomeTile
          accent={theme.colors.food}
          icon={<Utensils color={theme.colors.food} size={24} />}
          meta={nextMeal ? formatMealMeta(nextMeal.weekday, nextMeal.slotIndex) : "Ułóż plan posiłków"}
          onPress={() => router.push({ pathname: "/(tabs)/lista", params: { segment: "meals" } } as never)}
          title="Dzisiejszy posiłek"
          value={nextMeal?.mealName ?? "Brak planu"}
        />
      </View>

      <CleaningTodaySection
        error={cleaningQuery.error}
        isLoading={cleaningQuery.isLoading}
        onOpenCleaning={() => router.push("/(tabs)/dom" as never)}
        tasks={todayCleaningTasks}
      />

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

function NotificationCenterPanel({
  notificationItems,
  onClear,
  onClose,
  onOpenSettings,
  pushNotifications,
}: {
  notificationItems: NotificationItem[];
  onClear: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  pushNotifications: StoredNotification[];
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const activeCount = pushNotifications.length || notificationItems.length;
  const subtitle =
    activeCount === 0
      ? "Brak aktywnych spraw."
      : activeCount === 1
      ? "1 aktywna sprawa do sprawdzenia."
      : `${activeCount} aktywne sprawy do sprawdzenia.`;

  return (
    <View style={styles.notificationPanel}>
      <View style={styles.notificationPanelHeader}>
        <View style={styles.notificationPanelTitleWrap}>
          <Text style={styles.notificationPanelTitle}>Powiadomienia</Text>
          <Text style={styles.notificationPanelSubtitle}>{subtitle}</Text>
        </View>
        <IconButton accessibilityLabel="Zamknij powiadomienia" onPress={onClose}>
          <Close color={theme.colors.textMuted} size={18} />
        </IconButton>
      </View>

      <View style={styles.notificationList}>
        {pushNotifications.length > 0 ? (
          <>
            {pushNotifications.map((item) => (
              <StoredNotificationRow item={item} key={item.id} />
            ))}
            <ActionButton onPress={onClear} title="Wyczyść listę" variant="ghost" />
          </>
        ) : notificationItems.length > 0 ? (
          notificationItems.map((item) => <NotificationRow item={item} key={item.id} />)
        ) : (
          <View style={styles.emptyNotifications}>
            <Bell color={theme.colors.textSubtle} size={24} />
            <Text style={styles.emptyNotificationsTitle}>Brak powiadomień</Text>
            <Text style={styles.emptyNotificationsText}>Najważniejsze rzeczy pojawią się tutaj.</Text>
          </View>
        )}
      </View>

      <ActionButton
        onPress={onOpenSettings}
        title="Przejdź do ustawień powiadomień"
        variant="secondary"
      />
    </View>
  );
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

function StoredNotificationRow({ item }: { item: StoredNotification }) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.notificationRow}>
      <View style={styles.notificationIcon}>
        <Bell color={theme.colors.primary} size={20} />
      </View>
      <View style={styles.notificationText}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        {item.body ? <Text style={styles.notificationBody}>{item.body}</Text> : null}
        <Text style={styles.notificationTime}>{formatDateTime(item.receivedAt)}</Text>
      </View>
    </View>
  );
}

function HomeTile({
  accent,
  icon,
  meta,
  onPress,
  showDivider = false,
  title,
  value,
}: {
  accent: string;
  icon: ReactNode;
  meta: string;
  onPress: () => void;
  showDivider?: boolean;
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
        styles.dashboardRow,
        showDivider && styles.dashboardRowDivider,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.dashboardIcon, { backgroundColor: tint(accent, 0.1) }]}>{icon}</View>
      <View style={styles.dashboardText}>
        <Text numberOfLines={1} style={styles.dashboardTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.dashboardMeta}>
          {value}
        </Text>
        <Text numberOfLines={1} style={styles.dashboardSubMeta}>
          {meta}
        </Text>
      </View>
      <ChevronRight color={theme.colors.textSubtle} size={20} />
    </Pressable>
  );
}

function CleaningTodaySection({
  error,
  isLoading,
  onOpenCleaning,
  tasks,
}: {
  error: unknown;
  isLoading: boolean;
  onOpenCleaning: () => void;
  tasks: CleaningTask[];
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.cleaningSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Zaplanowane sprzątanie</Text>
        <Text style={styles.sectionMeta}>Dzisiaj</Text>
      </View>
      <View style={styles.cleaningPanel}>
        <QueryState
          emptyText="Brak sprzątania na dziś."
          error={error}
          isEmpty={!isLoading && tasks.length === 0}
          isLoading={isLoading}
        />
        {tasks.map((task, index) => (
          <Pressable
            accessibilityRole="button"
            key={task.id}
            onPress={onOpenCleaning}
            style={({ pressed }) => [
              styles.cleaningRow,
              index < tasks.length - 1 && styles.cleaningRowDivider,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.dashboardIcon, { backgroundColor: tint(theme.colors.shopping, 0.1) }]}>
              <Broom color={theme.colors.shopping} size={22} />
            </View>
            <View style={styles.dashboardText}>
              <Text numberOfLines={1} style={styles.dashboardTitle}>{task.name}</Text>
              <Text numberOfLines={1} style={styles.dashboardSubMeta}>
                Termin dzisiaj / co {task.frequencyDays} dni
              </Text>
            </View>
            <ChevronRight color={theme.colors.textSubtle} size={20} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function QuickAction({
  color,
  icon,
  label,
  onPress,
  showDivider = false,
}: {
  color: string;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        showDivider && styles.quickActionDivider,
        pressed && styles.quickActionPressed,
      ]}
    >
      <View
        style={[
          styles.quickIcon,
          {
            backgroundColor: tint(color, 0.08),
          },
        ]}
      >
        {icon}
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

function isTomorrowEvent(event: StartCalendarEvent): boolean {
  return event.eventDate === offsetIsoDate(1);
}

function todayIso(): string {
  return isoFromDate(new Date());
}

function offsetIsoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return isoFromDate(date);
}

function isoFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayWeekday(): number {
  const weekday = new Date().getDay();

  return weekday === 0 ? 7 : weekday;
}

function greetingTitle(): string {
  const hour = new Date().getHours();

  return hour >= 18 || hour < 5 ? "Dobry wieczór" : "Dzień dobry";
}

function formatMealMeta(weekday: number, slotIndex: number): string {
  return `${weekdayLabel(weekday)}, posiłek ${slotIndex + 1}`;
}

function weekdayLabel(day: number): string {
  return (
    [
      "poniedziałek",
      "wtorek",
      "środa",
      "czwartek",
      "piątek",
      "sobota",
      "niedziela",
    ][day - 1] ?? `dzień ${day}`
  );
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

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
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
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    emptyNotifications: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
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
    dashboardIcon: {
      alignItems: "center",
      borderRadius: radii.control,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    dashboardMeta: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 18,
    },
    dashboardRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 86,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    dashboardRowDivider: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    dashboardSubMeta: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    dashboardText: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    dashboardTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 20,
    },
    cleaningPanel: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 2,
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.13,
      shadowRadius: 22,
    },
    cleaningRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 76,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    cleaningRowDivider: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    cleaningSection: {
      gap: spacing.sm,
      marginTop: spacing.sm,
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
      borderColor: colors.border,
      borderRadius: radii.control,
      borderWidth: 1,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    notificationList: {
      gap: spacing.sm,
    },
    notificationPanel: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 4,
      gap: spacing.md,
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOffset: { height: 12, width: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 28,
    },
    notificationPanelHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    notificationPanelSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 17,
    },
    notificationPanelTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 22,
    },
    notificationPanelTitleWrap: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    notificationRow: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
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
    notificationTime: {
      color: colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0,
    },
    pressed: {
      opacity: 0.76,
    },
    quickAction: {
      alignItems: "center",
      backgroundColor: "transparent",
      flex: 1,
      gap: 6,
      minHeight: 88,
      justifyContent: "center",
      minWidth: 0,
      paddingHorizontal: 6,
      paddingVertical: spacing.sm,
    },
    quickActionDivider: {
      borderColor: colors.border,
      borderRightWidth: 1,
    },
    quickActionPressed: {
      backgroundColor: colors.cardMuted,
      opacity: 0.86,
    },
    quickGrid: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      elevation: 0,
      flexDirection: "row",
      gap: 0,
      overflow: "hidden",
      shadowColor: colors.text,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
    },
    quickIcon: {
      alignItems: "center",
      borderRadius: 999,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    quickLabel: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 14,
      textAlign: "center",
    },
    quickSection: {
      gap: spacing.sm,
    },
    sectionHeader: {
      alignItems: "flex-end",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 22,
    },
    sectionMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    tile: {
      backgroundColor: colors.card,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      minHeight: 126,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      width: "48.5%",
    },
    tileIcon: {
      alignItems: "center",
      borderRadius: radii.control,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    tileList: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 2,
      marginTop: spacing.xs,
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
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
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    tileTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    tileValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 20,
    },
  });
}
