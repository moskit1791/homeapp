import type { ModuleKey } from "@homeapp/shared-types";
import { Tabs, useRouter } from "expo-router";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CalendarDays,
  CheckSquare,
  Home,
  MoreHorizontal,
  ShoppingCart,
  Sun,
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
type TabBarButtonProps = Pick<
  ComponentProps<typeof Pressable>,
  | "accessibilityLabel"
  | "accessibilityRole"
  | "accessibilityState"
  | "children"
  | "onLongPress"
  | "onPress"
  | "testID"
>;

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
        <Text
          style={[styles.authRedirectText, { color: theme.colors.textMuted }]}
        >
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
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarShowLabel: false,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: {
          alignItems: "center",
          height: 42,
          justifyContent: "center",
          margin: 0,
          width: 42,
        },
        tabBarItemStyle: {
          alignItems: "center",
          flex: 1,
          height: 42,
          justifyContent: "center",
          padding: 0,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.overlay,
          borderColor: theme.colors.border,
          borderRadius: 16,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          borderWidth: 1,
          elevation: 0,
          height: 52,
          marginBottom: 12,
          marginHorizontal: 12,
          overflow: "hidden",
          paddingBottom: 6,
          paddingHorizontal: 8,
          paddingTop: 6,
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
            <TabGlyph
              focused={focused}
              icon={(color) => <Sun color={color} size={25} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="kalendarz"
        options={{
          href: shouldShow(["calendar"]) ? undefined : null,
          title: "Kalendarz",
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              focused={focused}
              icon={(color) => <CalendarDays color={color} size={25} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="finanse"
        options={{
          href: shouldShow(["finances"]) ? undefined : null,
          title: "Finanse",
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              focused={focused}
              icon={(color) => <WalletCards color={color} size={25} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="lista"
        options={{
          href: shouldShow(["shopping", "meal_planner"]) ? undefined : null,
          title: "Jedzenie",
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              focused={focused}
              icon={(color) => <Utensils color={color} size={25} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="zadania"
        options={{
          href: shouldShow(["notes", "todo"]) ? undefined : null,
          title: "Zadania",
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              focused={focused}
              icon={(color) => <CheckSquare color={color} size={25} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="zakupy"
        options={{
          href: null,
          title: "Zakupy",
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              focused={focused}
              icon={(color) => <ShoppingCart color={color} size={25} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          href: null,
          title: "Plan",
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              focused={focused}
              icon={(color) => <Utensils color={color} size={25} />}
            />
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
            <TabGlyph
              focused={focused}
              icon={(color) => <Home color={color} size={25} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wiecej"
        options={{
          href: null,
          title: "Więcej",
          tabBarIcon: ({ focused }) => (
            <TabGlyph
              focused={focused}
              icon={(color) => <MoreHorizontal color={color} size={25} />}
            />
          ),
        }}
      />
    </Tabs>
  );
}

function TabBarButton({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  children,
  onLongPress,
  onPress,
  testID,
}: TabBarButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      android_ripple={{ color: "transparent" }}
      onLongPress={onLongPress}
      onPress={onPress}
      style={styles.tabBarButton}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

function TabGlyph({
  focused,
  icon,
}: {
  focused: boolean;
  icon: (color: string) => ReactNode;
}) {
  const theme = useAppTheme();
  const color = focused ? theme.colors.primary : theme.colors.textMuted;

  return (
    <View style={styles.tabGlyph}>
      <View
        style={[
          styles.tabIconSlot,
          focused && { backgroundColor: theme.colors.primarySoft },
        ]}
      >
        {icon(color)}
      </View>
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
    borderColor: "transparent",
    elevation: 0,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  tabBarButton: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    justifyContent: "center",
    padding: 0,
  },
  tabIconSlot: {
    alignItems: "center",
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
});
