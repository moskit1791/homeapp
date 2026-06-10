import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "../theme/tokens";
import { useAppTheme, type AppPalette } from "../theme/use-app-theme";

export interface SegmentOption<TValue extends string> {
  icon?: ReactNode | ((active: boolean) => ReactNode);
  label: string;
  value: TValue;
}

interface SegmentedControlProps<TValue extends string> {
  accentColor?: string;
  accentTextColor?: string;
  onChange: (value: TValue) => void;
  options: SegmentOption<TValue>[];
  value: TValue;
}

export function SegmentedControl<TValue extends string>({
  accentColor,
  accentTextColor,
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const selectedBackgroundColor = accentColor ?? theme.colors.primary;
  const selectedTextColor = accentTextColor ?? theme.colors.inverseText;

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
              active && {
                backgroundColor: selectedBackgroundColor,
                borderColor: selectedBackgroundColor,
                shadowColor: selectedBackgroundColor,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.optionContent}>
              {option.icon ? (
                <View style={styles.iconWrap}>
                  {typeof option.icon === "function" ? option.icon(active) : option.icon}
                </View>
              ) : null}
              <Text
                style={[
                  styles.label,
                  active && { color: selectedTextColor },
                ]}
              >
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
    active: {
      elevation: 2,
      shadowOffset: { height: 0, width: 0 },
      shadowOpacity: 0.24,
      shadowRadius: 10,
    },
    iconWrap: {
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
    },
    optionContent: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
    },
    option: {
      alignItems: "center",
      borderColor: "transparent",
      borderWidth: 1,
      borderRadius: radii.control,
      flex: 1,
      justifyContent: "center",
      minHeight: 34,
      paddingHorizontal: spacing.xs,
    },
    pressed: {
      opacity: 0.78,
    },
    root: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.control,
      flexDirection: "row",
      gap: 4,
      padding: 4,
    },
  });
}
