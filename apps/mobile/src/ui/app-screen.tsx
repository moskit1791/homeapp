import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface AppScreenProps extends PropsWithChildren {
  actions?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
}

export function AppScreen({ actions, children, contentStyle, subtitle, title }: AppScreenProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.xs
  },
  headerText: {
    flex: 1,
    gap: spacing.xs
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 19
  }
});
}
