import { Icon } from '@iconify/react';
import { useState, type FormEvent } from 'react';

import {
  Box,
  Link,
  Alert,
  Stack,
  Button,
  Checkbox,
  TextField,
  IconButton,
  Typography,
  InputAdornment,
  FormControlLabel,
} from '@mui/material';

import { errorMessage } from '../components/ui';
import { useSession } from '../auth/session-context';

export function AuthPage() {
  const { registerAccount, signIn } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn({ email: email.trim(), password }, remember);
      } else {
        const result = await registerAccount({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
        });
        if (result === 'verification-required') {
          setMessage('Konto utworzone. Potwierdź adres e-mail, a następnie zaloguj się.');
          setMode('login');
        }
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack component="form" onSubmit={submit} spacing={3} sx={{ width: 1 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h3">
          {mode === 'login' ? 'Zaloguj się do HomeApp' : 'Załóż konto HomeApp'}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Twój dom, plan i finanse w jednym miejscu
        </Typography>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      {mode === 'register' && (
        <TextField
          label="Imię i nazwisko"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          autoFocus
        />
      )}
      <TextField
        label="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus={mode === 'login'}
      />
      <TextField
        label="Hasło"
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((v) => !v)}
                  edge="end"
                  aria-label="Pokaż hasło"
                >
                  <Icon icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      {mode === 'login' && (
        <FormControlLabel
          control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
          label="Zapamiętaj mnie"
        />
      )}
      <Button type="submit" variant="contained" size="large" disabled={loading}>
        {loading ? 'Proszę czekać…' : mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
      </Button>
      <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
        {mode === 'login' ? 'Nie masz konta? ' : 'Masz już konto? '}
        <Link
          component="button"
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          sx={{ fontWeight: 700 }}
        >
          {mode === 'login' ? 'Zarejestruj się' : 'Zaloguj się'}
        </Link>
      </Typography>
    </Stack>
  );
}
