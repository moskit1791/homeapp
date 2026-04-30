import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';
import { EmptyState } from './empty-state';

interface QueryStateProps {
  emptyText?: string;
  error?: unknown;
  isEmpty?: boolean;
  isLoading?: boolean;
}

export function QueryState({
  emptyText = 'Brak danych.',
  error,
  isEmpty = false,
  isLoading = false
}: QueryStateProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  if (isLoading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, styles.errorRoot]}>
        <Text style={styles.errorText}>Nie udało się pobrać danych.</Text>
      </View>
    );
  }

  if (isEmpty) {
    return <EmptyState text={emptyText} />;
  }

  return null;
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  errorRoot: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0
  },
  root: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 76,
    padding: spacing.lg
  }
});
}
