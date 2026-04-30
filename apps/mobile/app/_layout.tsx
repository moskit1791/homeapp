import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Component, PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/session/session-context';
import { spacing } from '../src/theme/tokens';
import { useAppTheme, type AppPalette } from '../src/theme/use-app-theme';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const theme = useAppTheme();

  useEffect(() => {
    hideSplashScreen();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootErrorBoundary>
          <SessionProvider>
            <StatusBar style={theme.isDark ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }} />
          </SessionProvider>
        </RootErrorBoundary>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

interface RootErrorBoundaryState {
  error: Error | null;
}

class RootErrorBoundary extends Component<PropsWithChildren, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch() {
    hideSplashScreen();
  }

  render(): ReactNode {
    if (this.state.error) {
      return <RootErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function RootErrorFallback({ error }: { error: Error }) {
  const theme = useAppTheme();
  const styles = createStyles(theme.colors);

  useEffect(() => {
    hideSplashScreen();
  }, []);

  return (
    <View style={styles.errorScreen}>
      <Text style={styles.errorTitle}>Nie udało się uruchomić aplikacji</Text>
      <Text style={styles.errorText}>{error.message}</Text>
    </View>
  );
}

function hideSplashScreen() {
  SplashScreen.hideAsync().catch(() => undefined);
}

function createStyles(colors: AppPalette) {
  return StyleSheet.create({
  errorScreen: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 14,
    letterSpacing: 0
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0
  }
});
}
