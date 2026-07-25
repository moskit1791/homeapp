import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Component, PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerForPushNotifications } from '../src/notifications/register-push-notifications';
import { EncryptionProvider } from '../src/encryption/encryption-context';
import { storeNotificationFromExpo } from '../src/notifications/notification-center';
import { SessionProvider, useSession } from '../src/session/session-context';
import { spacing } from '../src/theme/tokens';
import { AppThemeProvider, useAppTheme, type AppPalette } from '../src/theme/use-app-theme';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={rootStyles.gestureRoot}>
        <SafeAreaProvider>
          <AppThemeProvider>
            <ThemedRootLayout />
          </AppThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

function ThemedRootLayout() {
  const theme = useAppTheme();

  useEffect(() => {
    hideSplashScreen();
  }, []);

  return (
    <RootErrorBoundary>
      <SessionProvider>
        <EncryptionProvider>
          <PushNotificationBootstrap />
          <NotificationCenterBootstrap />
          <StatusBar style={theme.isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }} />
        </EncryptionProvider>
      </SessionProvider>
    </RootErrorBoundary>
  );
}

function NotificationCenterBootstrap() {
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      storeNotificationFromExpo(notification).catch(() => undefined);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        storeNotificationFromExpo(response.notification).catch(() => undefined);
      }
    );

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return null;
}

function PushNotificationBootstrap() {
  const { session, status } = useSession();

  useEffect(() => {
    if (status !== 'ready' || !session?.accessToken) {
      return;
    }

    registerForPushNotifications(session.accessToken).catch((error: unknown) => {
      console.warn('Push notification registration failed', error);
    });
  }, [session?.accessToken, status]);

  return null;
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
    errorText: { color: colors.textMuted, fontSize: 14, letterSpacing: 0 },
    errorTitle: { color: colors.danger, fontSize: 20, fontWeight: '800', letterSpacing: 0 }
  });
}

const rootStyles = StyleSheet.create({ gestureRoot: { flex: 1 } });
