import type { ModuleKey } from "@homeapp/shared-types";
import { Tabs, useRouter } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  CalendarDays,
  CheckCircle2,
  Home,
  ListChecks,
  MoreHorizontal,
  NotebookText,
  ShoppingCart,
  Utensils,
  WalletCards,
} from "../../src/ui/icon";
import {
  hasModuleRead,
  usePermissions,
} from "../../src/permissions/use-permissions";
import { useRealtimeInvalidations } from "../../src/realtime";
import { useSession } from "../../src/session/session-context";
import { spacing } from "../../src/theme/tokens";
import { useAppTheme } from "../../src/theme/use-app-theme";

let redirectingFromTabsToLogin = false;

export default function TabsLayout() {
  const { session, status } = useSession();
  const permissionsQuery = usePermissions();
  const theme = useAppTheme();
  const router = useRouter();

  useEffect(() => {
    if (status === "ready") {
      redirectingFromTabsToLogin = false;
      return;
    }

    if (
      (status === "signed-out" || status === "needs-household") &&
      !redirectingFromTabsToLogin
    ) {
      redirectingFromTabsToLogin = true;
      router.replace("/login" as never);
    }
  }, [router, status]);

  useRealtimeInvalidations({ accessToken: session?.accessToken });

  if (status !== "ready") {
    return (
      <View
        style={[
          styles.authRedirect,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={[styles.authRedirectText, { color: theme.colors.textMuted }]}>
          Wracam do logowania...
        </Text>
      </View>
    );
  }

  const permissions = permissionsQuery.data;
  const shouldShow = (moduleKeys: ModuleKey[]) =>
    !permissionsQuery.isSuccess || hasModuleRead(permissions, moduleKeys);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarShowLabel: false,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: {
          alignItems: "stretch",
          flex: 1,
          height: 58,
          justifyContent: "center",
          width: "100%",
        },
        tabBarItemStyle: {
          alignItems: "stretch",
          flex: 1,
          height: 58,
          justifyContent: "center",
          padding: 0,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.overlay,
          borderColor: theme.colors.border,
          borderRadius: 18,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          borderWidth: 1,
          elevation: 0,
          height: 76,
          marginBottom: 10,
          marginHorizontal: 12,
          overflow: "hidden",
          paddingBottom: 10,
          paddingHorizontal: 8,
          paddingTop: 8,
          position: "absolute",
          shadowColor: theme.colors.text,
          shadowOffset: { height: 8, width: 0 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dzisiaj",
          tabBarIcon: ({ focused }) => (
            <TabGlyph focused={focused} icon={(color) => <CheckCircle2 color={color} size={20} />} label="Dzisiaj" />
          ),
        }}
      />
      <Tabs.Screen
        name="kalendarz"
        options={{
          href: shouldShow(["calendar"]) ? undefined : null,
          title: "Kalendarz",
          tabBarIcon: ({ focused }) => (
            <TabGlyph focused={focused} icon={(color) => <CalendarDays color={color} size={20} />} label="Kalendarz" />
          ),
        }}
      />
      <Tabs.Screen
        name="finanse"
        options={{
          href: shouldShow(["finances"]) ? undefined : null,
          title: "Finanse",
          tabBarIcon: ({ focused }) => (
            <TabGlyph focused={focused} icon={(color) => <WalletCards color={color} size={20} />} label="Finanse" />
          ),
        }}
      />
      <Tabs.Screen
        name="lista"
        options={{
          href: shouldShow(["shopping", "meal_planner"]) ? undefined : null,
          title: "Jedzenie",
          tabBarIcon: ({ focused }) => (
            <TabGlyph focused={focused} icon={(color) => <Utensils color={color} size={20} />} label="Jedzenie" />
          ),
        }}
      />
      <Tabs.Screen
        name="zadania"
        options={{
          href: shouldShow(["notes", "todo"]) ? undefined : null,
          title: "Zadania",
          tabBarIcon: ({ focused }) => (
            <TabGlyph focused={focused} icon={(color) => <NotebookText color={color} size={20} />} label="Zadania" />
          ),
        }}
      />
      <Tabs.Screen
        name="zakupy"
        options={{
          href: null,
          title: "Zakupy",
          tabBarIcon: ({ focused }) => (
            <TabGlyph focused={focused} icon={(color) => <ShoppingCart color={color} size={18} />} label="Zakupy" />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          href: null,
          title: "Plan",
          tabBarIcon: ({ focused }) => (
            <TabGlyph focused={focused} icon={(color) => <Utensils color={color} size={18} />} label="Plan" />
          ),
        }}
      />
      <Tabs.Screen
        name="dom"
        options={{
          href: shouldShow([
            "cleaning",
            "annual_costs",
            "data_entries",
            "attachments",
          ])
            ? undefined
            : null,
          title: "Dom",
          tabBarIcon: ({ focused }) => (
            <TabGlyph focused={focused} icon={(color) => <Home color={color} size={20} />} label="Dom" />
          ),
        }}
      />
      <Tabs.Screen
        name="wiecej"
        options={{
          href: null,
          title: "Więcej",
          tabBarIcon: ({ color }) => <MoreHorizontal color={color} size={18} />,
        }}
      />
    </Tabs>
  );
}

function TabGlyph({
  focused,
  icon,
  label,
}: {
  focused: boolean;
  icon: (color: string) => ReactNode;
  label: string;
}) {
  const theme = useAppTheme();
  const color = focused ? theme.colors.primary : theme.colors.textMuted;

  return (
    <View
      style={styles.tabGlyph}
    >
      <View style={styles.tabIconSlot}>{icon(color)}</View>
      <Text
        numberOfLines={1}
        style={[
          styles.tabGlyphLabel,
          {
            color,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  authRedirect: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  authRedirectText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  tabGlyph: {
    alignItems: "center",
    alignSelf: "stretch",
    borderColor: "transparent",
    borderRadius: 18,
    elevation: 0,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    marginHorizontal: 1,
    minHeight: 56,
    paddingHorizontal: 2,
    paddingVertical: 5,
  },
  tabGlyphLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 14,
    maxWidth: "100%",
    textAlign: "center",
  },
  tabIconSlot: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
  },
});
