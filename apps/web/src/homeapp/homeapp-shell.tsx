import { useMemo } from 'react';
import { Outlet } from 'react-router';

import { DashboardLayout } from 'src/layouts/dashboard';
import { AuthCenteredLayout } from 'src/layouts/auth-centered';

import { SplashScreen } from 'src/components/loading-screen';

import { AuthPage } from './pages/auth-page';
import { buildHomeAppNavData } from './navigation';
import { useSession } from './auth/session-context';
import { CreateHouseholdPage } from './pages/create-household-page';

export function HomeAppShell() {
  const { permissions, status } = useSession();
  const navData = useMemo(() => buildHomeAppNavData(permissions), [permissions]);

  if (status === 'checking') return <SplashScreen />;

  if (status === 'signed-out') {
    return (
      <AuthCenteredLayout>
        <AuthPage />
      </AuthCenteredLayout>
    );
  }

  if (status === 'needs-household') {
    return (
      <AuthCenteredLayout>
        <CreateHouseholdPage />
      </AuthCenteredLayout>
    );
  }

  return (
    <DashboardLayout slotProps={{ nav: { data: navData } }}>
      <Outlet />
    </DashboardLayout>
  );
}
