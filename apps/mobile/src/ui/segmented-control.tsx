import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, shadows, spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

export interface SegmentOption<TValue extends string> {
  label: string;
  value: TValue;
}

interface SegmentedControlProps<TValue extends string> {
  onChange: (value: TValue) => void;
  options: SegmentOption<TValue>[];
  value: TValue;
}

export function SegmentedControl<TValue extends string>({
  onChange,
  options,
  value
}: SegmentedControlProps<TValue>) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.root}>
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              active && styles.active,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  active: {
    backgroundColor: colors.card,
    ...shadows.control
  },
  activeLabel: {
    color: colors.text
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0
  },
  option: {
    alignItems: 'center',
    borderRadius: radii.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.sm
  },
  pressed: {
    opacity: 0.78
  },
  root: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs
  }
});
}
