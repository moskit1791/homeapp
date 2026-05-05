import type { ModuleKey } from "@homeapp/shared-types";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  CalendarDays,
  Home,
  ListChecks,
  MoreHorizontal,
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
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          paddingVertical: 3,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 0,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 7,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dzisiaj",
          tabBarIcon: ({ color }) => <Home color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="kalendarz"
        options={{
          href: shouldShow(["calendar", "notes", "todo"]) ? undefined : null,
          title: "Kalendarz",
          tabBarIcon: ({ color }) => <CalendarDays color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="finanse"
        options={{
          href: shouldShow(["finances"]) ? undefined : null,
          title: "Finanse",
          tabBarIcon: ({ color }) => <WalletCards color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="lista"
        options={{
          href: shouldShow(["shopping", "meal_planner"]) ? undefined : null,
          title: "Lista",
          tabBarIcon: ({ color }) => <ListChecks color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="zakupy"
        options={{
          href: null,
          title: "Zakupy",
          tabBarIcon: ({ color }) => <ShoppingCart color={color} size={18} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          href: null,
          title: "Plan",
          tabBarIcon: ({ color }) => <Utensils color={color} size={18} />,
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
          tabBarIcon: ({ color }) => <Home color={color} size={20} />,
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
});
