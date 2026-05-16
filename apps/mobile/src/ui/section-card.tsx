import { PropsWithChildren, ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface SectionCardProps extends PropsWithChildren {
  action?: ReactNode;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
  value?: string;
}

export function SectionCard({ action, children, icon, style, subtitle, title, value }: SectionCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        {icon ? <View style={styles.iconBadge}>{icon}</View> : null}
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {children}
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    elevation: 2,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 22
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm
  },
  headerText: {
    flex: 1,
    gap: 2
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 17
  },
  value: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0
  }
});
}
