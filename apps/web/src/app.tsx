import { CssBaseline, ThemeProvider } from "@mui/material";
import { lazy, Suspense, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router";

import { useSession } from "./auth/session-context";
import { LoadingView } from "./components/ui";
import { DashboardLayout } from "./layout/dashboard-layout";
import { AuthPage } from "./pages/auth-page";
import { CreateHouseholdPage } from "./pages/create-household-page";
import { createAppTheme } from "./theme";

const CalendarPage = lazy(() =>
  import("./pages/calendar-page").then((module) => ({
    default: module.CalendarPage,
  })),
);
const FinancePage = lazy(() =>
  import("./pages/finance-page").then((module) => ({
    default: module.FinancePage,
  })),
);
const HomePage = lazy(() =>
  import("./pages/home-page").then((module) => ({ default: module.HomePage })),
);
const HouseholdPage = lazy(() =>
  import("./pages/household-page").then((module) => ({
    default: module.HouseholdPage,
  })),
);
const MealsPage = lazy(() =>
  import("./pages/meals-page").then((module) => ({
    default: module.MealsPage,
  })),
);
const PantryPage = lazy(() =>
  import("./pages/pantry-page").then((module) => ({
    default: module.PantryPage,
  })),
);
const ShoppingPage = lazy(() =>
  import("./pages/shopping-page").then((module) => ({
    default: module.ShoppingPage,
  })),
);
const TasksPage = lazy(() =>
  import("./pages/tasks-page").then((module) => ({
    default: module.TasksPage,
  })),
);
const TodayPage = lazy(() =>
  import("./pages/today-page").then((module) => ({
    default: module.TodayPage,
  })),
);

export function App() {
  const { status } = useSession();
  const [mode, setMode] = useState<"dark" | "light">(() =>
    localStorage.getItem("homeapp.web.theme") === "dark" ? "dark" : "light",
  );
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  function toggleMode() {
    setMode((current) => {
      const next = current === "light" ? "dark" : "light";
      localStorage.setItem("homeapp.web.theme", next);
      return next;
    });
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {status === "checking" ? (
        <LoadingView />
      ) : status === "signed-out" ? (
        <AuthPage />
      ) : status === "needs-household" ? (
        <CreateHouseholdPage />
      ) : (
        <Suspense fallback={<LoadingView />}>
          <Routes>
            <Route
              element={<DashboardLayout mode={mode} toggleMode={toggleMode} />}
            >
              <Route index element={<TodayPage />} />
              <Route path="kalendarz" element={<CalendarPage />} />
              <Route path="zakupy" element={<ShoppingPage />} />
              <Route path="spizarnia" element={<PantryPage />} />
              <Route path="posilki" element={<MealsPage />} />
              <Route path="zadania" element={<TasksPage />} />
              <Route path="finanse" element={<FinancePage />} />
              <Route path="dom" element={<HomePage />} />
              <Route path="domownicy" element={<HouseholdPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      )}
    </ThemeProvider>
  );
}
