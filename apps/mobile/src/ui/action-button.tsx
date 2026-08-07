import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";

interface ActionButtonProps {
  disabled?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  loading?: boolean;
  onPress: () => void;
  size?: "medium" | "small";
  style?: StyleProp<ViewStyle>;
  title: string;
  variant?: "primary" | "secondary" | "ghost";
}

export function ActionButton({
  disabled = false,
  labelStyle,
  loading = false,
  onPress,
  size = "medium",
  style,
  title,
  variant = "primary",
}: ActionButtonProps) {
  const isDisabled = disabled || loading;
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const actionAccent = theme.isDark ? theme.colors.primary : "#4F8D2C";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[size],
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "primary"
              ? theme.colors.inverseText
              : actionAccent
          }
        />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`], labelStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: AppPalette) {
  const isDark = colors.isDark;
  const actionAccent = isDark ? colors.primary : "#4F8D2C";
  const actionAccentBorder = isDark ? colors.primaryLight : "#DDE7D7";
  const actionAccentDark = isDark ? colors.primaryDark : "#4F8D2C";

  return StyleSheet.create({
    button: {
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    disabled: {
      opacity: isDark ? 0.48 : 0.56,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
    ghostLabel: {
      color: colors.textMuted,
    },
    label: {
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    medium: {
      minHeight: 46,
    },
    pressed: {
      opacity: isDark ? 0.9 : 0.84,
    },
    primary: {
      backgroundColor: actionAccent,
      borderColor: actionAccent,
      elevation: isDark ? 1 : 3,
      shadowColor: actionAccent,
      shadowOffset: { height: 0, width: 0 },
      shadowOpacity: isDark ? 0.16 : 0.24,
      shadowRadius: isDark ? 8 : 12,
    },
    primaryLabel: {
      color: colors.inverseText,
    },
    secondary: {
      backgroundColor: colors.card,
      borderColor: actionAccentBorder,
    },
    secondaryLabel: {
      color: actionAccentDark,
    },
    small: {
      minHeight: 36,
      paddingHorizontal: 12,
    },
  });
}
