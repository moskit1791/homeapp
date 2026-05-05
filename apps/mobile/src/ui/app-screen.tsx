import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../theme/tokens';
import { useAppTheme, type AppPalette } from '../theme/use-app-theme';

interface AppScreenProps extends PropsWithChildren {
  actions?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  leading?: ReactNode;
  subtitle?: string;
  title: string;
  titleAlign?: 'left' | 'center';
}

export function AppScreen({
  actions,
  children,
  contentStyle,
  leading,
  subtitle,
  title,
  titleAlign = 'left'
}: AppScreenProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);
  const centered = titleAlign === 'center';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {leading ? <View style={styles.leading}>{leading}</View> : null}
          <View style={[styles.headerText, centered && styles.headerTextCentered]}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {actions ? (
            <View style={styles.actions}>{actions}</View>
          ) : leading && centered ? (
            <View style={styles.leadingSpacer} />
          ) : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: 128
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    minHeight: 42
  },
  headerText: {
    flex: 1,
    gap: spacing.xs
  },
  headerTextCentered: {
    alignItems: 'center'
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38
  },
  leadingSpacer: {
    width: 38
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
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
