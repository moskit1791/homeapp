import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getStartDashboard, queryKeys } from "../../src/api";
import { useSession } from "../../src/session/session-context";
import { spacing } from "../../src/theme/tokens";
import { useAppTheme, type AppPalette } from "../../src/theme/use-app-theme";
import {
  AppScreen,
  ActionButton,
  EmptyState,
  IconButton,
  ListRow,
  MetricCard,
  QueryState,
  SectionCard,
} from "../../src/ui";
import {
  CalendarDays,
  CheckCircle2,
  RefreshCcw,
  Sparkles,
  Utensils,
  WalletCards,
} from "../../src/ui/icon";

export default function StartScreen() {
  const { session } = useSession();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const dashboardQuery = useQuery({
    enabled: Boolean(session?.accessToken),
    queryFn: () => getStartDashboard({ accessToken: session?.accessToken }),
    queryKey: queryKeys.startDashboard,
  });
  const dashboard = dashboardQuery.data;
  const upcomingEvents = dashboard?.upcomingEvents ?? [];
  const mealEntries = dashboard?.mealPlan?.entries ?? [];
  const todoPreview = dashboard?.todoPreview ?? [];
  const hasDashboardItems = Boolean(
    dashboard?.finance ||
    upcomingEvents.length > 0 ||
    mealEntries.length > 0 ||
    todoPreview.length > 0,
  );

  return (
    <AppScreen
      actions={
        <View style={styles.headerActions}>
          <ActionButton
            onPress={() => router.push("/(tabs)/wiecej" as never)}
            size="small"
            title="Menu"
            variant="secondary"
          />
          <IconButton
            disabled={dashboardQuery.isFetching}
            onPress={() => dashboardQuery.refetch()}
          >
            <RefreshCcw color={theme.colors.textMuted} size={17} />
          </IconButton>
        </View>
      }
      subtitle="Najważniejsze rzeczy z domu, bez szukania po modułach."
      title="Dzisiaj"
    >
      <QueryState
        error={dashboardQuery.error}
        isLoading={dashboardQuery.isLoading}
      />

      {dashboard ? (
        <>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Sparkles color={theme.colors.primary} size={22} />
            </View>
            <View style={styles.heroContent}>
              <Text style={styles.heroKicker}>Start domu</Text>
              <Text style={styles.heroTitle}>
                Masz{" "}
                {getDashboardCount(upcomingEvents, mealEntries, todoPreview)}{" "}
                spraw do sprawdzenia.
              </Text>
              <View style={styles.pillRow}>
                <Text style={[styles.pill, styles.financePill]}>
                  {formatMoney(dashboard.finance?.totalRemainingAmount)} zostaje
                </Text>
                <Text style={[styles.pill, styles.calendarPill]}>
                  {upcomingEvents.length} wydarzeń
                </Text>
                <Text style={[styles.pill, styles.todoPill]}>
                  {todoPreview.length} zadań
                </Text>
              </View>
            </View>
          </View>

          <SectionCard
            icon={<WalletCards color={theme.colors.finance} size={17} />}
            subtitle={
              dashboard.finance
                ? `${dashboard.finance.month.month}.${dashboard.finance.month.year}`
                : "Brak bieżącego miesiąca"
            }
            title="Finanse"
          >
            <MetricGrid>
              <MetricCard
                icon={<WalletCards color={theme.colors.finance} size={16} />}
                label="Dochód"
                style={styles.metricCard}
                value={formatMoney(dashboard.finance?.incomeAmount)}
              />
              <MetricCard
                icon={<Sparkles color={theme.colors.primary} size={16} />}
                label="Budżet"
                style={styles.metricCard}
                value={formatMoney(dashboard.finance?.totalBudgetAmount)}
              />
              <MetricCard
                icon={<WalletCards color={theme.colors.danger} size={16} />}
                label="Wydane"
                style={styles.metricCard}
                value={formatMoney(dashboard.finance?.totalSpentAmount)}
              />
              <MetricCard
                icon={<WalletCards color={theme.colors.primary} size={16} />}
                label="Zostaje"
                style={styles.metricCard}
                value={formatMoney(dashboard.finance?.totalRemainingAmount)}
              />
            </MetricGrid>
          </SectionCard>

          <SectionCard
            icon={<CalendarDays color={theme.colors.calendar} size={17} />}
            title="Wydarzenia"
          >
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <ListRow
                  key={event.id}
                  meta={[formatDate(event.eventDate), event.eventTime]
                    .filter(Boolean)
                    .join(" / ")}
                  title={event.title}
                />
              ))
            ) : (
              <EmptyState
                icon={<CalendarDays color={theme.colors.calendar} size={20} />}
                text="Brak najbliższych wydarzeń."
              />
            )}
          </SectionCard>

          <SectionCard
            icon={<Utensils color={theme.colors.food} size={17} />}
            title="Jedzenie"
          >
            {mealEntries.length > 0 ? (
              mealEntries.map((entry) => (
                <ListRow
                  key={entry.id}
                  meta={`Dzień ${entry.weekday}, slot ${entry.slotIndex + 1}`}
                  title={entry.mealName}
                />
              ))
            ) : (
              <EmptyState
                icon={<Utensils color={theme.colors.food} size={20} />}
                text="Brak planu na ten tydzień."
              />
            )}
          </SectionCard>

          <SectionCard
            icon={<CheckCircle2 color={theme.colors.primary} size={17} />}
            title="To-do"
          >
            {todoPreview.length > 0 ? (
              todoPreview.map((todo) => (
                <ListRow key={todo.id} meta="Do zrobienia" title={todo.title} />
              ))
            ) : (
              <EmptyState
                icon={<CheckCircle2 color={theme.colors.primary} size={20} />}
                text="Brak otwartych zadań."
              />
            )}
          </SectionCard>

          {!hasDashboardItems ? (
            <EmptyState text="Nie ma jeszcze danych do pokazania na starcie." />
          ) : null}
        </>
      ) : null}
    </AppScreen>
  );
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.metricGrid}>{children}</View>;
}

function getDashboardCount(
  upcomingEvents: unknown[],
  mealEntries: unknown[],
  todoPreview: unknown[],
): number {
  return upcomingEvents.length + mealEntries.length + todoPreview.length;
}

function formatMoney(value: string | undefined): string {
  return `${Number(value ?? "0").toLocaleString("pl-PL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} zł`;
}

function formatDate(value: string): string {
  return value.slice(5).replace("-", ".");
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    calendarPill: {
      backgroundColor: colors.softBlue,
      color: colors.calendar,
    },
    financePill: {
      backgroundColor: colors.softGreen,
      color: colors.finance,
    },
    hero: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.lg,
    },
    heroContent: {
      flex: 1,
      gap: spacing.sm,
    },
    heroIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: 8,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    heroKicker: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    heroTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 25,
    },
    metricCard: {
      minWidth: 0,
      width: "48%",
    },
    pill: {
      borderRadius: 999,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    todoPill: {
      backgroundColor: colors.softPurple,
      color: colors.shopping,
    },
  });
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
