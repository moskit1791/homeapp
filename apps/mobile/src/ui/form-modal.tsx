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
import { SafeAreaView } from "react-native-safe-area-context";
import { radii, shadows, spacing } from "../theme/tokens";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";
import { Close } from "./icon";
import { IconButton } from "./icon-button";

interface FormModalProps extends PropsWithChildren {
  footer?: ReactNode;
  onClose: () => void;
  subtitle?: string;
  title: string;
  visible: boolean;
}

export function FormModal({
  children,
  footer,
  onClose,
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
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboard}
        >
          <Pressable onPress={onClose} style={styles.backdrop} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text numberOfLines={2} style={styles.title}>{title}</Text>
                {subtitle ? (
                  <Text style={styles.subtitle}>{subtitle}</Text>
                ) : null}
              </View>
              <IconButton accessibilityLabel="Zamknij okno" onPress={onClose}>
                <Close color={theme.colors.textMuted} size={18} />
              </IconButton>
            </View>
            <ScrollView
              contentContainerStyle={[styles.body, footer ? styles.bodyWithFooter : null]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
            >
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    footer: {
      borderColor: colors.border,
      borderTopWidth: 1,
      flexShrink: 0,
      gap: spacing.sm,
      padding: spacing.lg,
      paddingTop: spacing.md,
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
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderTopLeftRadius: radii.card,
      borderTopRightRadius: radii.card,
      borderTopWidth: 1,
      flexShrink: 1,
      marginHorizontal: spacing.md,
      maxHeight: "92%",
      overflow: "hidden",
      ...shadows.card,
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
  });
}
