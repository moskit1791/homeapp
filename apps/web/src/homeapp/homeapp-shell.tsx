import { Outlet } from 'react-router';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert, Stack, Button, TextField, Typography } from '@mui/material';

import { DashboardLayout } from 'src/layouts/dashboard';
import { AuthCenteredLayout } from 'src/layouts/auth-centered';

import { SplashScreen } from 'src/components/loading-screen';

import { AuthPage } from './pages/auth-page';
import { errorMessage } from './components/ui';
import { buildHomeAppNavData } from './navigation';
import { useSession } from './auth/session-context';
import { useEncryption } from './auth/encryption-context';
import { CreateHouseholdPage } from './pages/create-household-page';

export function HomeAppShell() {
  const { permissions, status } = useSession();
  const encryption = useEncryption();
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

  if (encryption.lockState === 'loading') return <SplashScreen />;

  if (encryption.lockState === 'locked') return <EncryptionUnlock />;

  return (
    <DashboardLayout slotProps={{ nav: { data: navData } }}>
      <Outlet />
    </DashboardLayout>
  );
}

function EncryptionUnlock() {
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
    <AuthCenteredLayout>
      <Stack component="form" onSubmit={submit} spacing={2.5} sx={{ width: 1 }}>
        <Typography variant="h3" sx={{ textAlign: 'center' }}>Odblokuj zaszyfrowany dom</Typography>
        <Typography color="text.secondary" sx={{ textAlign: 'center' }}>Klucz pozostaje wyłącznie w tej karcie przeglądarki.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {recovering && <TextField label="Kod odzyskiwania" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} multiline minRows={2} />}
        <TextField label={recovering ? 'Nowe hasło szyfrowania' : 'Hasło szyfrowania'} type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} required />
        <Button type="submit" variant="contained" size="large" disabled={loading || passphrase.length < 12 || (recovering && !recoveryCode)}>{recovering ? 'Odzyskaj dostęp' : 'Odblokuj'}</Button>
        <Button type="button" variant="text" onClick={() => { setRecovering((value) => !value); setError(null); }}>{recovering ? 'Wróć do odblokowania hasłem' : 'Użyj kodu odzyskiwania'}</Button>
      </Stack>
    </AuthCenteredLayout>
  );
}
