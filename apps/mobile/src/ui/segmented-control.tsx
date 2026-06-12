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
  presentation?: "default" | "mockup";
  value: TValue;
}

export function SegmentedControl<TValue extends string>({
  accentColor,
  accentTextColor,
  onChange,
  options,
  presentation = "default",
  value,
}: SegmentedControlProps<TValue>) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const isMockup = presentation === "mockup";
  const mockupSelectedTextColor = accentColor ?? theme.colors.primary;
  const selectedBackgroundColor = accentColor ?? theme.colors.primary;
  const selectedTextColor = accentTextColor ?? theme.colors.inverseText;

  return (
    <View style={[styles.root, isMockup && styles.mockupRoot]}>
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
              isMockup && styles.mockupOption,
              active && styles.active,
              active && isMockup
                ? styles.mockupActive
                : active && {
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
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={1}
                style={[
                  styles.label,
                  isMockup && styles.mockupLabel,
                  active && {
                    color: isMockup ? mockupSelectedTextColor : selectedTextColor,
                  },
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
      flexShrink: 0,
      justifyContent: "center",
    },
    label: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      minWidth: 0,
      textAlign: "center",
    },
    optionContent: {
      alignItems: "center",
      flexShrink: 1,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minWidth: 0,
    },
    option: {
      alignItems: "center",
      borderColor: "transparent",
      borderWidth: 1,
      borderRadius: radii.control,
      flex: 1,
      justifyContent: "center",
      minHeight: 34,
      minWidth: 0,
      paddingHorizontal: spacing.xs,
    },
    mockupActive: {
      backgroundColor:
        colors.background === "#0C1220" ? colors.cardMuted : "#F6FAF0",
      borderColor: colors.background === "#0C1220" ? colors.border : "#E2EAD9",
      elevation: 0,
      shadowOpacity: 0,
    },
    mockupLabel: {
      fontSize: 14,
      fontWeight: "700",
    },
    mockupOption: {
      borderRadius: 999,
      minHeight: 42,
    },
    mockupRoot: {
      backgroundColor: colors.background === "#0C1220" ? colors.card : "#FFFFFF",
      borderColor: colors.background === "#0C1220" ? colors.border : "#E8DED2",
      borderRadius: 12,
      elevation: 2,
      shadowColor: "#000000",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: colors.background === "#0C1220" ? 0.18 : 0.08,
      shadowRadius: 18,
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
