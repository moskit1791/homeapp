import { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { spacing } from "../theme/tokens";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";
import { Close } from "./icon";
import { IconButton } from "./icon-button";

interface FormModalProps extends PropsWithChildren {
  compact?: boolean;
  footer?: ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
  scrollEnabled?: boolean;
  subtitle?: string;
  title: string;
  visible: boolean;
}

export function FormModal({
  children,
  compact = false,
  footer,
  onClose,
  showCloseButton = true,
  scrollEnabled = true,
  subtitle,
  title,
  visible,
}: FormModalProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboard}
          >
            <Pressable onPress={onClose} style={styles.backdrop} />
            <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={[styles.header, compact && styles.headerCompact]}>
              <View style={styles.headerText}>
                <Text
                  numberOfLines={2}
                  style={[styles.title, compact && styles.titleCompact]}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={styles.subtitle}>{subtitle}</Text>
                ) : null}
              </View>
              {showCloseButton ? (
                <IconButton accessibilityLabel="Zamknij okno" onPress={onClose}>
                  <Close color={theme.colors.textMuted} size={18} />
                </IconButton>
              ) : null}
            </View>
            {scrollEnabled ? (
              <ScrollView
                contentContainerStyle={[
                  styles.body,
                  footer ? styles.bodyWithFooter : null,
                  compact && styles.bodyCompact,
                ]}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={styles.scroll}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={styles.customScrollBody}>{children}</View>
            )}
            {footer ? (
              <View style={[styles.footer, compact && styles.footerCompact]}>
                {footer}
              </View>
            ) : null}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    body: {
      gap: spacing.md,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    bodyWithFooter: {
      paddingBottom: spacing.xxl + spacing.xl,
    },
    bodyCompact: {
      gap: 10,
      padding: 12,
      paddingBottom: 20,
    },
    footer: {
      borderColor: colors.border,
      borderTopWidth: 1,
      flexShrink: 0,
      gap: spacing.sm,
      padding: spacing.lg,
      paddingTop: spacing.md,
    },
    customScrollBody: {
      flexShrink: 1,
      minHeight: 0,
    },
    footerCompact: {
      padding: 12,
    },
    gestureRoot: {
      flex: 1,
    },
    handle: {
      alignSelf: "center",
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 4,
      marginTop: spacing.sm,
      width: 44,
    },
    header: {
      alignItems: "center",
      borderColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerCompact: {
      paddingBottom: 10,
      paddingHorizontal: 12,
      paddingTop: 12,
    },
    headerText: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
    },
    keyboard: {
      flex: 1,
      justifyContent: "flex-end",
    },
    safeArea: {
      flex: 1,
    },
    sheet: {
      alignSelf: "stretch",
      backgroundColor: colors.modalSurface,
      borderColor: colors.border,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: 1,
      elevation: 12,
      flexShrink: 1,
      marginHorizontal: spacing.md,
      maxHeight: "92%",
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
    },
    scroll: {
      flexShrink: 1,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 18,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 0,
    },
    titleCompact: {
      fontFamily: Platform.select({
        android: "serif",
        default: "Georgia",
        ios: "Georgia",
        web: "Georgia",
      }),
      fontSize: 16,
      fontWeight: "700",
    },
  });
}
