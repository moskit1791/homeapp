import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing } from '../theme/tokens';
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
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
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
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  activeLabel: {
    color: colors.primaryDark
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0
  },
  option: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderWidth: 1,
    borderRadius: radii.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: spacing.xs
  },
  pressed: {
    opacity: 0.78
  },
  root: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.control,
    flexDirection: 'row',
    gap: 4,
    padding: 4
  }
});
}
