import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface IconButtonProps {
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ children, disabled = false, onPress, style }: IconButtonProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      {children}
    </Pressable>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    padding: spacing.sm,
    width: 38
  },
  disabled: {
    opacity: 0.48
  },
  pressed: {
    opacity: 0.72
  }
});
}
