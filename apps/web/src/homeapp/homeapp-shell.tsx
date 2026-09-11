import { Outlet, useLocation } from 'react-router';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert, Stack, Button, TextField, Typography } from '@mui/material';

import { DashboardLayout } from 'src/layouts/dashboard';
import { AuthCenteredLayout } from 'src/layouts/auth-centered';

import { SplashScreen } from 'src/components/loading-screen';

import { AuthPage } from './pages/auth-page';
import { buildHomeAppNavData } from './navigation';
import { useSession } from './auth/session-context';
import { useEncryption } from './auth/encryption-context';
import { Page, SectionCard, errorMessage } from './components/ui';
import { CreateHouseholdPage } from './pages/create-household-page';
import { encryptionRouteForPath, routeNeedsEncryptionUnlock } from './encryption-route';

export function HomeAppShell() {
  const { permissions, status } = useSession();
  const encryption = useEncryption();
  const location = useLocation();
  const navData = useMemo(() => buildHomeAppNavData(permissions), [permissions]);
  const encryptedRoute = encryptionRouteForPath(location.pathname);
  const routeIsLocked =
    encryption.lockState === 'locked' &&
    routeNeedsEncryptionUnlock(location.pathname, encryption.settings?.enabledModules ?? []);

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

  if (encryption.lockState === 'loading') return <SplashScreen />;

  return (
    <DashboardLayout slotProps={{ nav: { data: navData } }}>
      {routeIsLocked ? <EncryptionUnlock viewLabel={encryptedRoute?.label} /> : <Outlet />}
    </DashboardLayout>
  );
}

function EncryptionUnlock({ viewLabel }: { viewLabel?: string }) {
  const encryption = useEncryption();
  const [recovering, setRecovering] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (recovering) {
        const nextCode = await encryption.recover(recoveryCode, passphrase);
        window.alert(`Nowy kod odzyskiwania:\n${nextCode}\n\nZapisz go w bezpiecznym miejscu.`);
      } else await encryption.unlock(passphrase);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page>
      <SectionCard sx={{ width: 1, maxWidth: 560, mx: 'auto', mt: { xs: 2, md: 6 } }}>
        <Stack component="form" onSubmit={submit} spacing={2.5}>
          <Typography variant="h3" sx={{ textAlign: 'center' }}>
            Odblokuj {viewLabel ?? 'zaszyfrowane dane'}
          </Typography>
          <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
            Ten widok zawiera zaszyfrowane dane. Pozostałe części aplikacji są nadal dostępne.
            Klucz pozostaje wyłącznie w tej karcie przeglądarki.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {recovering && (
            <TextField
              label="Kod odzyskiwania"
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              multiline
              minRows={2}
            />
          )}
          <TextField
            label={recovering ? 'Nowe hasło szyfrowania' : 'Hasło szyfrowania'}
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            required
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || passphrase.length < 12 || (recovering && !recoveryCode)}
          >
            {recovering ? 'Odzyskaj dostęp' : 'Odblokuj widok'}
          </Button>
          {encryption.settings?.canManage && (
            <Button
              type="button"
              variant="text"
              onClick={() => {
                setRecovering((value) => !value);
                setError(null);
              }}
            >
              {recovering ? 'Wróć do odblokowania hasłem' : 'Użyj kodu odzyskiwania'}
            </Button>
          )}
        </Stack>
      </SectionCard>
    </Page>
  );
}
