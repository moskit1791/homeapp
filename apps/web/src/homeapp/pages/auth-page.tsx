import { Icon } from '@iconify/react';
import { useSearchParams } from 'react-router';
import { useRef, useState, useEffect, type FormEvent } from 'react';

import { Box, Link, Alert, Stack, Button, Divider, Checkbox, TextField, IconButton, Typography, InputAdornment, FormControlLabel } from '@mui/material';

import { errorMessage } from '../components/ui';
import { useSession } from '../auth/session-context';
import { verifyEmail, resetPassword, forgotPassword, acceptInvitation, previewInvitation, resendVerification, completeInvitationRegistration } from '../api';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'invitation';

interface GoogleCredentialResponse { credential: string }
interface GoogleAccounts {
  id: {
    initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
    renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
  };
}

declare global { interface Window { google?: { accounts: GoogleAccounts } } }

export function AuthPage() {
  const { registerAccount, signIn, signInWithGoogle } = useSession();
  const [params] = useSearchParams();
  const invitationToken = params.get('invitation') ?? (location.pathname.includes('invitation') ? params.get('token') : null);
  const resetToken = params.get('reset') ?? (location.pathname.includes('reset-password') ? params.get('token') : null);
  const verifyToken = params.get('verify') ?? params.get('verificationToken');
  const [mode, setMode] = useState<Mode>(invitationToken ? 'invitation' : resetToken ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [remember, setRemember] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invitationName, setInvitationName] = useState<string | null>(null);
  const googleButton = useRef<HTMLDivElement>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!invitationToken) return;
    void previewInvitation(invitationToken).then((preview) => {
      setEmail(preview.email);
      setInvitationName(preview.householdName);
    }).catch((caught) => setError(errorMessage(caught)));
  }, [invitationToken]);

  useEffect(() => {
    if (!verifyToken || !params.get('email')) return;
    void verifyEmail({ email: params.get('email')!, token: verifyToken })
      .then(() => setMessage('Adres e-mail został potwierdzony. Możesz się zalogować.'))
      .catch((caught) => setError(errorMessage(caught)));
  }, [params, verifyToken]);

  useEffect(() => {
    if (!googleClientId || mode !== 'login') return undefined;
    const render = () => {
      if (!window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => void signInWithGoogle(response.credential, remember).catch((caught) => setError(errorMessage(caught))),
      });
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current, { theme: 'outline', size: 'large', width: 360, text: 'continue_with' });
    };
    if (window.google) { render(); return undefined; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, [googleClientId, mode, remember, signInWithGoogle]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null); setMessage(null); setLoading(true);
    try {
      if (mode === 'forgot') {
        const result = await forgotPassword({ email: email.trim() });
        setMessage('Jeśli konto istnieje, wysłaliśmy wiadomość z linkiem do zmiany hasła.');
        if (result.devResetToken) window.history.replaceState(null, '', `?reset=${encodeURIComponent(result.devResetToken)}`);
      } else if (mode === 'reset') {
        if (!resetToken) throw new Error('Brak tokenu resetowania hasła.');
        if (password.length < 8) throw new Error('Hasło musi mieć co najmniej 8 znaków.');
        if (password !== confirmPassword) throw new Error('Hasła nie są takie same.');
        await resetPassword({ password, token: resetToken });
        setMessage('Hasło zostało zmienione. Zaloguj się.'); setMode('login'); setPassword(''); setConfirmPassword('');
      } else if (mode === 'invitation') {
        if (!invitationToken) throw new Error('Brak tokenu zaproszenia.');
        if (!acceptedTerms || !acceptedPrivacy) throw new Error('Zaakceptuj regulamin i politykę prywatności.');
        await completeInvitationRegistration({ token: invitationToken, displayName: displayName.trim(), password, acceptedTerms, acceptedPrivacy });
        await signIn({ email: email.trim(), password }, remember);
        window.location.assign('/');
      } else if (mode === 'login') {
        const token = await signIn({ email: email.trim(), password }, remember);
        if (invitationToken) await acceptInvitation({ token: invitationToken }, { accessToken: token });
      } else {
        if (!acceptedTerms || !acceptedPrivacy) throw new Error('Zaakceptuj regulamin i politykę prywatności.');
        const result = await registerAccount({ displayName: displayName.trim(), email: email.trim(), password });
        if (result === 'verification-required') { setMessage('Konto utworzone. Potwierdź adres e-mail, a następnie zaloguj się.'); setMode('login'); }
      }
    } catch (caught) { setError(errorMessage(caught)); } finally { setLoading(false); }
  }

  async function resend() {
    setLoading(true); setError(null);
    try { await resendVerification({ email: email.trim() }); setMessage('Wysłaliśmy nową wiadomość weryfikacyjną.'); }
    catch (caught) { setError(errorMessage(caught)); } finally { setLoading(false); }
  }

  const title = mode === 'login' ? 'Zaloguj się do HomeApp' : mode === 'register' ? 'Załóż konto HomeApp' : mode === 'forgot' ? 'Odzyskaj dostęp' : mode === 'reset' ? 'Ustaw nowe hasło' : `Dołącz do ${invitationName ?? 'domu'}`;
  const needsProfile = mode === 'register' || mode === 'invitation';

  return (
    <Stack component="form" onSubmit={submit} spacing={2.5} sx={{ width: 1 }}>
      <Box sx={{ textAlign: 'center' }}><Typography variant="h3">{title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Twój dom, plan i finanse w jednym miejscu</Typography></Box>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      {needsProfile && <TextField label="Imię i nazwisko" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required autoFocus />}
      {mode !== 'reset' && <TextField label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={mode === 'invitation'} required />}
      {mode !== 'forgot' && <TextField label="Hasło" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword((value) => !value)} edge="end"><Icon icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} /></IconButton></InputAdornment> } }} />}
      {mode === 'reset' && <TextField label="Powtórz hasło" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />}
      {(mode === 'login' || needsProfile) && <FormControlLabel control={<Checkbox checked={remember} onChange={(event) => setRemember(event.target.checked)} />} label="Zapamiętaj mnie" />}
      {needsProfile && <Stack spacing={0}><FormControlLabel control={<Checkbox checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />} label="Akceptuję regulamin" /><FormControlLabel control={<Checkbox checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)} />} label="Akceptuję politykę prywatności" /></Stack>}
      <Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? 'Proszę czekać…' : mode === 'login' ? 'Zaloguj się' : mode === 'register' ? 'Utwórz konto' : mode === 'forgot' ? 'Wyślij link' : mode === 'reset' ? 'Zmień hasło' : 'Dołącz do domu'}</Button>
      {mode === 'login' && googleClientId && <><Divider>lub</Divider><Box ref={googleButton} sx={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} /></>}
      {mode === 'login' && <Stack direction="row" sx={{ justifyContent: 'center' }}><Link component="button" type="button" onClick={() => setMode('forgot')}>Nie pamiętam hasła</Link><Typography sx={{ mx: 1 }}>·</Typography><Link component="button" type="button" onClick={() => void resend()} disabled={!email}>Wyślij ponownie weryfikację</Link></Stack>}
      {(mode === 'login' || mode === 'register') && <Typography color="text.secondary" sx={{ textAlign: 'center' }}>{mode === 'login' ? 'Nie masz konta? ' : 'Masz już konto? '}<Link component="button" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>{mode === 'login' ? 'Zarejestruj się' : 'Zaloguj się'}</Link></Typography>}
      {(mode === 'forgot' || mode === 'reset') && <Link component="button" type="button" onClick={() => setMode('login')} sx={{ textAlign: 'center' }}>Wróć do logowania</Link>}
    </Stack>
  );
}
