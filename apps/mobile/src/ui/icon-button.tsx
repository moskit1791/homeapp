import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { spacing } from '../theme/tokens';

interface IconButtonProps {
  accessibilityLabel?: string;
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
  style
}: IconButtonProps) {
  const styles = createStyles();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
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

function createStyles() {
  return StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 999,
    elevation: 0,
    height: 38,
    justifyContent: 'center',
    padding: spacing.sm,
    width: 38
  },
  disabled: {
    opacity: 0.48
  },
  pressed: {
    opacity: 0.62
  }
});
}
