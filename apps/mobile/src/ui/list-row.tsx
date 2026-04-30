import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface ListRowProps {
  action?: ReactNode;
  meta?: string;
  title: string;
}

export function ListRow({ action, meta, title }: ListRowProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {action}
    </View>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.xs
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 17
  },
  root: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 19
  }
});
}
