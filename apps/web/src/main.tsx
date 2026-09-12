import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router';

import App from './app';
import { routesSection } from './routes/sections';
import { ErrorBoundary } from './routes/components';
import { SessionProvider } from './homeapp/auth/session-context';
import { EncryptionProvider } from './homeapp/auth/encryption-context';

// ----------------------------------------------------------------------

const preloadReloadKey = 'homeapp.web.preload-reload-at';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const previousReload = Number(sessionStorage.getItem(preloadReloadKey) ?? 0);
  if (Date.now() - previousReload < 10_000) return;
  sessionStorage.setItem(preloadReloadKey, String(Date.now()));
  window.location.reload();
});

const router = createBrowserRouter([
  {
    Component: () => (
      <App>
        <Outlet />
      </App>
    ),
    errorElement: <ErrorBoundary />,
    children: routesSection,
  },
]);

const root = createRoot(document.getElementById('root')!);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <EncryptionProvider>
          <RouterProvider router={router} />
        </EncryptionProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>
);
