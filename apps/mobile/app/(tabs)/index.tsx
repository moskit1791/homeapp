import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import {
  getStartDashboard,
  listShoppingItems,
  queryKeys,
  type StartCalendarEvent,
  type StartMealEntry,
  type StartTodoItem,
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
import {
  ActionButton,
  AppScreen,
  AppToast,
  IconButton,
  QueryState,
} from "../../src/ui";
import {
  AccountCircle,
  Bell,
  CalendarDays,
  CartPlus,
  ChevronRight,
  Close,
  MoreHorizontal,
  NotePlus,
  ReceiptText,
  ShoppingCart,
  Utensils,
} from "../../src/ui/icon";
import mealCardImage from "../../assets/today-meal.png";
import shoppingCardImage from "../../assets/today-shopping.png";

export default function DzisiajScreen() {
  const { session } = useSession();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const accessToken = session?.accessToken;
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [pushNotifications, setPushNotifications] = useState<
    StoredNotification[]
  >([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const shoppingPermission = useModulePermission("shopping");
  const todoPermission = useModulePermission("todo");

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
  const dashboard = dashboardQuery.data;
  const upcomingEvents = dashboard?.upcomingEvents ?? [];
  const todayEvents = upcomingEvents.filter(isTodayEvent);
  const nextEvent = todayEvents[0] ?? upcomingEvents[0];
  const mealEntries = dashboard?.mealPlan?.entries ?? [];
  const currentWeekday = todayWeekday();
  const todayMeals = useMemo(
    () => getTodayMeals(mealEntries, currentWeekday),
    [currentWeekday, mealEntries],
  );
  const openShopping = (shoppingQuery.data ?? []).filter(
    (item) => !item.isChecked,
  );
  const todoPreview = (dashboard?.todoPreview ?? []).slice(0, 3);
  const openFromNotification = useCallback(
    (
      route:
        | "/(tabs)/kalendarz"
        | "/(tabs)/finanse"
        | "/(tabs)/lista"
        | "/(tabs)/dom"
        | "/(tabs)/zadania",
    ) => {
      setNotificationsVisible(false);
      router.push(route as never);
    },
    [router],
  );
  const openCalendarForDate = useCallback(
    (date: string, action?: "create") => {
      router.push({
        pathname: "/(tabs)/kalendarz",
        params: { action, date, intent: String(Date.now()) },
      } as never);
    },
    [router],
  );
  const openCalendarNotification = useCallback(
    (date: string) => {
      setNotificationsVisible(false);
      openCalendarForDate(date);
    },
    [openCalendarForDate],
  );
  const openNotificationSettings = useCallback(() => {
    setNotificationsVisible(false);
    router.push({
      pathname: "/(tabs)/dom",
      params: { settings: "1" },
    } as never);
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
        title:
          todayEvents.length === 1
            ? "Masz 1 wydarzenie dzisiaj"
            : `Masz ${todayEvents.length} wydarzenia dzisiaj`,
      });
    }

    if (openShopping.length > 0) {
      items.push({
        body:
          openShopping.length === 1
            ? "1 produkt czeka na liście."
            : `${openShopping.length} produktów czeka na liście.`,
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
              <Bell
                color={
                  unreadNotificationsCount > 0
                    ? theme.colors.warning
                    : theme.colors.text
                }
                size={19}
              />
              {unreadNotificationsCount > 0 ? (
                <View style={styles.bellDot} />
              ) : null}
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
      <QueryState
        error={dashboardQuery.error}
        isLoading={dashboardQuery.isLoading}
      />

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
            icon={<CalendarDays color={theme.colors.calendar} size={29} />}
            label="Wydarzenie"
            onPress={() => openCalendarForDate(todayIso(), "create")}
            showDivider
          />
          <QuickAction
            icon={<ReceiptText color={theme.colors.finance} size={29} />}
            label="Wydatek"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/finanse",
                params: { action: "expense", intent: String(Date.now()) },
              } as never)
            }
            showDivider
          />
          <QuickAction
            icon={<CartPlus color={theme.colors.shopping} size={29} />}
            label="Zakupy"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/lista",
                params: { action: "addShopping", segment: "shopping" },
              } as never)
            }
            showDivider
          />
          <QuickAction
            icon={<NotePlus color={theme.colors.primaryDark} size={29} />}
            label="Notatka"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/zadania",
                params: { action: "note", segment: "notes" },
              } as never)
            }
          />
        </View>
      </View>

      <NextEventCard
        event={nextEvent}
        onPress={() =>
          nextEvent
            ? openCalendarForDate(nextEvent.eventDate)
            : openCalendarForDate(todayIso(), "create")
        }
      />

      {todoPermission.canRead ? (
        <TodayOverviewGrid
          error={dashboardQuery.error}
          isLoading={dashboardQuery.isLoading}
          mealCount={todayMeals.length}
          onOpenMeals={() =>
            router.push({
              pathname: "/(tabs)/lista",
              params: { segment: "meals" },
            } as never)
          }
          onOpenShopping={() =>
            router.push({
              pathname: "/(tabs)/lista",
              params: { segment: "shopping" },
            } as never)
          }
          onOpenTodo={() =>
            router.push({
              pathname: "/(tabs)/zadania",
              params: { segment: "todo" },
            } as never)
          }
          shoppingCount={openShopping.length}
          tasks={todoPreview}
        />
      ) : null}
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
        <IconButton
          accessibilityLabel="Zamknij powiadomienia"
          onPress={onClose}
        >
          <Close color={theme.colors.textMuted} size={18} />
        </IconButton>
      </View>

      <View style={styles.notificationList}>
        {pushNotifications.length > 0 ? (
          <>
            {pushNotifications.map((item) => (
              <StoredNotificationRow item={item} key={item.id} />
            ))}
            <ActionButton
              onPress={onClear}
              title="Wyczyść listę"
              variant="ghost"
            />
          </>
        ) : notificationItems.length > 0 ? (
          notificationItems.map((item) => (
            <NotificationRow item={item} key={item.id} />
          ))
        ) : (
          <View style={styles.emptyNotifications}>
            <Bell color={theme.colors.textSubtle} size={24} />
            <Text style={styles.emptyNotificationsTitle}>Brak powiadomień</Text>
            <Text style={styles.emptyNotificationsText}>
              Najważniejsze rzeczy pojawią się tutaj.
            </Text>
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
      style={({ pressed }) => [
        styles.notificationRow,
        pressed && styles.pressed,
      ]}
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
        {item.body ? (
          <Text style={styles.notificationBody}>{item.body}</Text>
        ) : null}
        <Text style={styles.notificationTime}>
          {formatDateTime(item.receivedAt)}
        </Text>
      </View>
    </View>
  );
}

function NextEventCard({
  event,
  onPress,
}: {
  event: StartCalendarEvent | undefined;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const eventDateTime = event ? formatEventDateTime(event) : "Brak wydarzeń";
  const eventDetails = event?.title ?? "Dodaj wydarzenie do kalendarza";

  return (
    <Pressable
      accessibilityLabel={`Najbliższe wydarzenie: ${eventDateTime}. ${eventDetails}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.nextEventCard, pressed && styles.pressed]}
    >
      <Text style={styles.nextEventEyebrow}>PLAN DNIA</Text>
      <Text style={styles.nextEventTitle}>Najbliższe wydarzenie</Text>
      <View style={styles.nextEventBody}>
        <View style={styles.nextEventIcon}>
          <CalendarDays color={theme.colors.calendar} size={24} />
        </View>
        <View style={styles.nextEventText}>
          <Text numberOfLines={1} style={styles.nextEventTime}>
            {eventDateTime}
          </Text>
          <Text numberOfLines={2} style={styles.nextEventDetails}>
            {eventDetails}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function TodayOverviewGrid({
  error,
  isLoading,
  mealCount,
  onOpenMeals,
  onOpenShopping,
  onOpenTodo,
  shoppingCount,
  tasks,
}: {
  error: unknown;
  isLoading: boolean;
  mealCount: number;
  onOpenMeals: () => void;
  onOpenShopping: () => void;
  onOpenTodo: () => void;
  shoppingCount: number;
  tasks: StartTodoItem[];
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.todayOverviewGrid}>
      <Pressable
        accessibilityLabel="Do zrobienia"
        accessibilityRole="button"
        onPress={onOpenTodo}
        style={({ pressed }) => [
          styles.todoCompactCard,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.todoCompactHeader}>
          <Text style={styles.todoCompactTitle}>Do zrobienia</Text>
          <MoreHorizontal color={theme.colors.textMuted} size={20} />
        </View>
        <View style={styles.todoCompactList}>
          <QueryState
            emptyText="Brak rzeczy do zrobienia."
            error={error}
            isEmpty={!isLoading && tasks.length === 0}
            isLoading={isLoading}
          />
          {tasks.map((task, index) => (
            <View
              key={task.id}
              style={[
                styles.todoCompactRow,
                index < tasks.length - 1 && styles.todoCompactRowDivider,
              ]}
            >
              <View style={styles.todoCircle} />
              <Text numberOfLines={1} style={styles.todoCompactText}>
                {task.title}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.todoSeeAll}>
          <Text style={styles.todoSeeAllText}>Zobacz wszystkie</Text>
          <ChevronRight color={theme.colors.primaryDark} size={16} />
        </View>
      </Pressable>
      <View style={styles.todayMiniColumn}>
        <MiniTodayCard
          accent={theme.colors.shopping}
          illustration={shoppingCardImage}
          icon={<ShoppingCart color={theme.colors.shopping} size={20} />}
          label={productLabel(shoppingCount)}
          meta="na liście zakupów"
          onPress={onOpenShopping}
          value={String(shoppingCount)}
        />
        <MiniTodayCard
          accent={theme.colors.food}
          illustration={mealCardImage}
          icon={<Utensils color={theme.colors.food} size={20} />}
          label={mealLabel(mealCount)}
          meta="na dziś"
          onPress={onOpenMeals}
          value={String(mealCount)}
        />
      </View>
    </View>
  );
}

function MiniTodayCard({
  accent,
  illustration,
  icon,
  label,
  meta,
  onPress,
  value,
}: {
  accent: string;
  illustration: ImageSourcePropType;
  icon: ReactNode;
  label: string;
  meta: string;
  onPress: () => void;
  value: string;
}) {
  const styles = createStyles(useAppTheme().colors);

  return (
    <Pressable
      accessibilityLabel={`${value} ${label} ${meta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniTodayCard,
        { borderColor: `${accent}7A`, shadowColor: accent },
        pressed && styles.pressed,
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.miniTodayGlow, { backgroundColor: `${accent}1F` }]}
      />
      <Image
        resizeMode="contain"
        source={illustration}
        style={styles.miniTodayImage}
      />
      <View
        style={[
          styles.miniTodayIcon,
          { backgroundColor: `${accent}26`, borderColor: `${accent}99` },
        ]}
      >
        {icon}
      </View>
      <Text style={styles.miniTodayValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.miniTodayLabel}>
        {label}
      </Text>
      <Text numberOfLines={2} style={styles.miniTodayMeta}>
        {meta}
      </Text>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  showDivider = false,
}: {
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
      <View style={styles.quickIcon}>{icon}</View>
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
  return isoFromDate(new Date());
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

function getTodayMeals(
  entries: StartMealEntry[],
  weekday: number,
): StartMealEntry[] {
  return entries
    .filter((entry) => entry.weekday === weekday)
    .slice()
    .sort((left, right) => left.slotIndex - right.slotIndex);
}

function eventMeta(event: StartCalendarEvent): string {
  return [formatShortDate(event.eventDate), event.eventTime?.slice(0, 5)]
    .filter(Boolean)
    .join(" / ");
}

function formatEventDateTime(event: StartCalendarEvent): string {
  return [
    formatShortDate(event.eventDate),
    event.eventTime?.slice(0, 5) ?? "cały dzień",
  ]
    .filter(Boolean)
    .join(" / ");
}

function productLabel(count: number): string {
  if (count === 1) {
    return "produkt";
  }

  return count > 1 && count < 5 ? "produkty" : "produktów";
}

function mealLabel(count: number): string {
  if (count === 1) {
    return "posiłek";
  }

  return count > 1 && count < 5 ? "posiłki" : "posiłków";
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
    nextEventBody: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    nextEventCard: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 2,
      marginTop: spacing.sm,
      minHeight: 138,
      overflow: "hidden",
      padding: spacing.lg,
      shadowColor: "#000000",
      shadowOffset: { height: 12, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 28,
    },
    nextEventDetails: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 18,
    },
    nextEventEyebrow: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    nextEventIcon: {
      alignItems: "center",
      backgroundColor: colors.cardMuted,
      borderColor: colors.calendar,
      borderRadius: radii.control,
      borderWidth: 1,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    nextEventText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    nextEventTime: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 23,
    },
    nextEventTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 24,
      marginTop: 4,
    },
    miniTodayCard: {
      backgroundColor: "#101426",
      borderRadius: 14,
      borderWidth: 1,
      elevation: 5,
      flexBasis: 0,
      flex: 1,
      justifyContent: "flex-start",
      minHeight: 98,
      minWidth: 0,
      overflow: "hidden",
      padding: 10,
      position: "relative",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 18,
    },
    miniTodayGlow: {
      borderRadius: 999,
      bottom: -44,
      height: 118,
      position: "absolute",
      right: -44,
      width: 118,
    },
    miniTodayImage: {
      bottom: -18,
      height: 104,
      position: "absolute",
      right: -24,
      width: 104,
    },
    miniTodayIcon: {
      alignItems: "center",
      borderRadius: 999,
      borderWidth: 1,
      height: 32,
      justifyContent: "center",
      marginBottom: spacing.xs,
      width: 32,
      zIndex: 1,
    },
    miniTodayLabel: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 13,
      maxWidth: 72,
      zIndex: 1,
    },
    miniTodayMeta: {
      color: "#C8D2EA",
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 13,
      maxWidth: 68,
      zIndex: 1,
    },
    miniTodayValue: {
      color: "#FFFFFF",
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 32,
      zIndex: 1,
    },
    todayMiniColumn: {
      flex: 1,
      flexBasis: 0,
      gap: spacing.sm,
      minWidth: 92,
    },
    todayOverviewGrid: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    todoCircle: {
      borderColor: colors.textSubtle,
      borderRadius: 999,
      borderWidth: 1.5,
      height: 17,
      width: 17,
    },
    todoCompactCard: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 2,
      flex: 3,
      flexBasis: 0,
      gap: spacing.sm,
      minWidth: 0,
      minHeight: 204,
      padding: spacing.md,
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.07,
      shadowRadius: 22,
    },
    todoCompactHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    todoCompactList: {
      flex: 1,
      gap: 0,
    },
    todoCompactRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 36,
    },
    todoCompactRowDivider: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    todoCompactText: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 16,
      minWidth: 0,
    },
    todoCompactTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 0,
    },
    todoSeeAll: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: 3,
      justifyContent: "center",
      minHeight: 28,
      paddingHorizontal: spacing.sm,
    },
    todoSeeAllText: {
      color: colors.primaryDark,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
    },
    dashboardIcon: {
      alignItems: "center",
      borderRadius: radii.control,
      borderWidth: 2,
      backgroundColor: colors.cardMuted,
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
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 20,
    },
    todoPreviewPanel: {
      backgroundColor: colors.overlay,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      elevation: 2,
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.07,
      shadowRadius: 22,
    },
    todoPreviewRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    todoPreviewRowDivider: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    todoPreviewSection: {
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
      shadowColor: "#000000",
      shadowOffset: { height: 12, width: 0 },
      shadowOpacity: 0.08,
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
      fontWeight: "800",
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
      fontWeight: "800",
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
      justifyContent: "center",
      minHeight: 90,
      minWidth: 0,
      paddingHorizontal: spacing.xs,
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
      elevation: 0,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    quickLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 15,
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
      fontSize: 15,
      fontWeight: "800",
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
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.07,
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
      fontSize: 12,
      fontWeight: "800",
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
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 20,
    },
  });
}
