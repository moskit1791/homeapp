import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface EmptyStateProps {
  action?: ReactNode;
  icon?: ReactNode;
  text: string;
  title?: string;
}

export function EmptyState({ action, icon, text, title }: EmptyStateProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.root}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.text}>{text}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  action: {
    marginTop: spacing.sm
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  root: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl
  },
  text: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 19,
    textAlign: 'center'
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center'
  }
});
}
