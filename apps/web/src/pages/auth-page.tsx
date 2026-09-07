import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type FormEvent } from "react";

import { useSession } from "../auth/session-context";
import { errorMessage } from "../components/ui";

export function AuthPage() {
  const { registerAccount, signIn } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
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
      if (mode === "login") {
        await signIn({ email: email.trim(), password }, remember);
      } else {
        const result = await registerAccount({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
        });
        if (result === "verification-required") {
          setMessage(
            "Konto utworzone. Potwierdź adres e-mail, a następnie zaloguj się.",
          );
          setMode("login");
        }
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 15% 20%, rgba(0,167,111,.18), transparent 35%), radial-gradient(circle at 85% 80%, rgba(142,51,255,.14), transparent 35%)",
        }}
      />
      <Paper
        component="form"
        onSubmit={submit}
        elevation={0}
        sx={{
          zIndex: 1,
          width: "100%",
          maxWidth: 440,
          p: { xs: 3, sm: 5 },
          borderRadius: 3,
          boxShadow: "0 24px 64px rgba(145,158,171,.24)",
        }}
      >
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              component="img"
              src="/homeapp-icon.png"
              alt="HomeApp"
              sx={{ width: 48, height: 48, borderRadius: 2 }}
            />
            <Typography variant="h2">HomeApp</Typography>
          </Stack>
          <Box>
            <Typography variant="h1">
              {mode === "login" ? "Witaj ponownie" : "Załóż konto"}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Twój dom, plan i finanse w jednym miejscu.
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}
          {mode === "register" && (
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
            autoFocus={mode === "login"}
          />
          <TextField
            label="Hasło"
            type={showPassword ? "text" : "password"}
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
                      <Icon
                        icon={
                          showPassword
                            ? "solar:eye-closed-bold"
                            : "solar:eye-bold"
                        }
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {mode === "login" && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
              }
              label="Zapamiętaj mnie"
            />
          )}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
          >
            {loading
              ? "Proszę czekać…"
              : mode === "login"
                ? "Zaloguj się"
                : "Utwórz konto"}
          </Button>
          <Typography textAlign="center" color="text.secondary">
            {mode === "login" ? "Nie masz konta? " : "Masz już konto? "}
            <Link
              component="button"
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              fontWeight={700}
            >
              {mode === "login" ? "Zarejestruj się" : "Zaloguj się"}
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
