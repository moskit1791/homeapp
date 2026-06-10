import { PropsWithChildren, ReactNode, RefObject } from "react";
import {
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { spacing } from "../theme/tokens";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";

interface AppScreenProps extends PropsWithChildren {
  actions?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  floatingAction?: ReactNode;
  leading?: ReactNode;
  scrollRef?: RefObject<ScrollView>;
  subtitle?: string;
  title: string;
  titleAlign?: "left" | "center";
  titleVariant?: "default" | "display";
}

export function AppScreen({
  actions,
  children,
  contentStyle,
  floatingAction,
  leading,
  scrollRef,
  subtitle,
  title,
  titleAlign = "left",
  titleVariant = "default",
}: AppScreenProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const centered = titleAlign === "center";

  return (
    <View style={styles.safeArea}>
      <SafeAreaView style={styles.safeAreaContent}>
        <View style={styles.shell}>
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              {leading ? (
                <View style={styles.leading}>{leading}</View>
              ) : centered && actions ? (
                <View style={styles.leadingSpacer} />
              ) : null}
              <View
                style={[
                  styles.headerText,
                  centered && styles.headerTextCentered,
                ]}
              >
                <Text
                  style={[
                    styles.title,
                    titleVariant === "display" && styles.displayTitle,
                  ]}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={styles.subtitle}>{subtitle}</Text>
                ) : null}
              </View>
              {actions ? (
                <View style={styles.actions}>{actions}</View>
              ) : leading && centered ? (
                <View style={styles.leadingSpacer} />
              ) : null}
            </View>
            {children}
          </ScrollView>
          {floatingAction ? (
            <View pointerEvents="box-none" style={styles.floatingAction}>
              {floatingAction}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    content: {
      gap: spacing.md,
      padding: spacing.md,
      paddingBottom: 128,
    },
    actions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      marginBottom: spacing.xs,
      minHeight: 42,
    },
    headerText: {
      flex: 1,
      gap: spacing.xs,
    },
    headerTextCentered: {
      alignItems: "center",
    },
    leading: {
      alignItems: "center",
      justifyContent: "center",
      width: 38,
    },
    leadingSpacer: {
      width: 38,
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    safeAreaContent: {
      flex: 1,
    },
    title: {
      color: colors.text,
      fontSize: 23,
      fontWeight: "800",
      letterSpacing: 0,
    },
    displayTitle: {
      fontFamily: Platform.select({
        android: "serif",
        default: "Georgia",
        ios: "Georgia",
        web: "Georgia",
      }),
      fontSize: 40,
      fontWeight: "900",
      lineHeight: 48,
    },
    floatingAction: {
      alignItems: "center",
      bottom: 88,
      left: 0,
      position: "absolute",
      right: 0,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 19,
    },
    shell: {
      flex: 1,
    },
  });
}
