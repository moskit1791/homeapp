import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router';

import { AuthPage } from 'src/homeapp/pages/auth-page';
import { HomeAppShell } from 'src/homeapp/homeapp-shell';
import { AuthCenteredLayout } from 'src/layouts/auth-centered';

import { SplashScreen } from 'src/components/loading-screen';

const TodayPage = lazy(() =>
  import('src/homeapp/pages/today-page').then((module) => ({ default: module.TodayPage }))
);
const CalendarPage = lazy(() =>
  import('src/homeapp/pages/calendar-page').then((module) => ({ default: module.CalendarPage }))
);
const ShoppingPage = lazy(() =>
  import('src/homeapp/pages/shopping-page').then((module) => ({ default: module.ShoppingPage }))
);
const PantryPage = lazy(() =>
  import('src/homeapp/pages/pantry-page').then((module) => ({ default: module.PantryPage }))
);
const MealsPage = lazy(() =>
  import('src/homeapp/pages/meals-page').then((module) => ({ default: module.MealsPage }))
);
const TasksPage = lazy(() =>
  import('src/homeapp/pages/tasks-page').then((module) => ({ default: module.TasksPage }))
);
const FinancePage = lazy(() =>
  import('src/homeapp/pages/finance-page').then((module) => ({ default: module.FinancePage }))
);
const HomePage = lazy(() =>
  import('src/homeapp/pages/home-page').then((module) => ({ default: module.HomePage }))
);
const HouseholdPage = lazy(() =>
  import('src/homeapp/pages/household-page').then((module) => ({ default: module.HouseholdPage }))
);
const InvitationPage = lazy(() =>
  import('src/homeapp/pages/invitation-page').then((module) => ({ default: module.InvitationPage }))
);
const WebMockupsPrototype = lazy(() =>
  import('src/homeapp/pages/web-mockups-prototype').then((module) => ({
    default: module.WebMockupsPrototype,
  }))
);

const page = (element: React.ReactNode) => (
  <Suspense fallback={<SplashScreen />}>{element}</Suspense>
);

export const routesSection: RouteObject[] = [
  { path: '/auth/reset-password', element: <AuthCenteredLayout><AuthPage /></AuthCenteredLayout> },
  { path: '/auth/verify-email', element: <AuthCenteredLayout><AuthPage /></AuthCenteredLayout> },
  { path: '/prototype/web-mockups', element: page(<WebMockupsPrototype />) },
  {
    path: '/',
    element: <HomeAppShell />,
    children: [
      { index: true, element: page(<TodayPage />) },
      { path: 'kalendarz', element: page(<CalendarPage />) },
      { path: 'zakupy', element: page(<ShoppingPage />) },
      { path: 'spizarnia', element: page(<PantryPage />) },
      { path: 'posilki', element: page(<MealsPage />) },
      { path: 'zadania', element: page(<TasksPage />) },
      { path: 'finanse', element: page(<FinancePage />) },
      { path: 'dom', element: page(<HomePage />) },
      { path: 'domownicy', element: page(<HouseholdPage />) },
      { path: 'auth/invitation', element: page(<InvitationPage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
