import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { shadows } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface ActionButtonProps {
  disabled?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  loading?: boolean;
  onPress: () => void;
  size?: 'medium' | 'small';
  style?: StyleProp<ViewStyle>;
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function ActionButton({
  disabled = false,
  labelStyle,
  loading = false,
  onPress,
  size = 'medium',
  style,
  title,
  variant = 'primary'
}: ActionButtonProps) {
  const isDisabled = disabled || loading;
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

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
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.inverseText : theme.colors.primary} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`], labelStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  disabled: {
    opacity: 0.56
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent'
  },
  ghostLabel: {
    color: colors.textMuted
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0
  },
  medium: {
    minHeight: 46
  },
  pressed: {
    opacity: 0.82
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.control
  },
  primaryLabel: {
    color: colors.inverseText
  },
  secondary: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border
  },
  secondaryLabel: {
    color: colors.text
  },
  small: {
    minHeight: 36,
    paddingHorizontal: 12
  }
});
}
