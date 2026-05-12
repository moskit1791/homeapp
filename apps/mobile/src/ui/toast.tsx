import { StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "../theme/tokens";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";

type AppToastProps = {
  offsetTop?: number;
  text: string | null;
  tone?: "info" | "success" | "error";
};

export function AppToast({ offsetTop, text, tone = "success" }: AppToastProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  if (!text) {
    return null;
  }

  return (
    <View style={[styles.toast, offsetTop !== undefined && { top: offsetTop }, styles[tone]]}>
      <Text style={[styles.text, tone === "error" && styles.errorText]}>{text}</Text>
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    error: {
      backgroundColor: colors.dangerSoft,
      borderColor: `${colors.danger}44`,
    },
    errorText: {
      color: colors.danger,
    },
    info: {
      backgroundColor: colors.softBlue,
      borderColor: colors.border,
    },
    success: {
      backgroundColor: colors.softGreen,
      borderColor: `${colors.primary}33`,
    },
    text: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 18,
    },
    toast: {
      borderRadius: radii.control,
      borderWidth: 1,
      left: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      position: "absolute",
      right: spacing.md,
      top: spacing.md,
      zIndex: 20,
    },
  });
}
