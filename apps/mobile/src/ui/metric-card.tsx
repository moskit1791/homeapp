import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface MetricCardProps {
  icon?: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
  value: string;
}

export function MetricCard({ icon, label, style, value }: MetricCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.root, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  icon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.control,
    height: 30,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    width: 30
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0
  },
  root: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    gap: spacing.xs,
    padding: spacing.md
  },
  value: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0
  }
});
}
