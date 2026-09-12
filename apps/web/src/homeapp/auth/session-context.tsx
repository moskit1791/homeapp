import { useQueryClient } from '@tanstack/react-query';
import {
  useRef,
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
  createContext,
  type PropsWithChildren,
} from 'react';

import {
  login,
  ApiError,
  register,
  verifyEmail,
  logoutSession,
  refreshSession,
  loginWithGoogle,
  createHousehold,
  getMyPermissions,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  setApiAuthRefreshHandler,
  type EffectivePermission,
  type CreateHouseholdRequest,
} from '../api';

interface Session {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

type SessionStatus = 'checking' | 'needs-household' | 'ready' | 'signed-out';

interface SessionContextValue {
  accessToken: string | null;
  createFirstHousehold: (input: CreateHouseholdRequest) => Promise<void>;
  logout: () => Promise<void>;
  registerAccount: (input: RegisterRequest) => Promise<'signed-in' | 'verification-required'>;
  signIn: (input: LoginRequest, remember: boolean) => Promise<string>;
  signInWithGoogle: (idToken: string, remember: boolean) => Promise<string>;
  permissions: EffectivePermission[];
  status: SessionStatus;
}

const storageKey = 'homeapp.web.session.v1';
const SessionContext = createContext<SessionContextValue | null>(null);

function readStoredSession(): Session | null {
  const raw = localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

function toSession(response: LoginResponse): Session {
  return {
    accessToken: response.accessToken,
    accessTokenExpiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString(),
    refreshToken: response.refreshToken,
    refreshTokenExpiresAt: response.refreshTokenExpiresAt,
  };
}

function storeSession(session: Session, remember: boolean) {
  localStorage.removeItem(storageKey);
  sessionStorage.removeItem(storageKey);
  (remember ? localStorage : sessionStorage).setItem(storageKey, JSON.stringify(session));
}

function removeStoredSession() {
  localStorage.removeItem(storageKey);
  sessionStorage.removeItem(storageKey);
}

function isNoHousehold(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    (error.message.includes('aktywnego domu') || error.message.includes('active household'))
  );
}

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<EffectivePermission[]>([]);
  const [status, setStatus] = useState<SessionStatus>('checking');
  const sessionRef = useRef<Session | null>(null);
  const rememberRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  const commitSession = useCallback((next: Session, persistent: boolean) => {
    sessionRef.current = next;
    rememberRef.current = persistent;
    setSession(next);
    storeSession(next, persistent);
  }, []);

  const clearSession = useCallback(() => {
    removeStoredSession();
    sessionRef.current = null;
    refreshInFlightRef.current = null;
    setSession(null);
    setPermissions([]);
    setStatus('signed-out');
    queryClient.clear();
  }, [queryClient]);

  const verifyHousehold = useCallback(async (next: Session) => {
    try {
      const nextPermissions = await getMyPermissions({ accessToken: next.accessToken });
      setPermissions(nextPermissions);
      setStatus('ready');
    } catch (error) {
      if (isNoHousehold(error)) {
        setPermissions([]);
        setStatus('needs-household');
      } else throw error;
    }
  }, []);

  const refreshAccessToken = useCallback(
    async (failedAccessToken: string): Promise<string | null> => {
      const current = sessionRef.current;
      if (!current) return null;
      if (current.accessToken !== failedAccessToken) return current.accessToken;
      if (refreshInFlightRef.current) return refreshInFlightRef.current;

      const pending = refreshSession({ refreshToken: current.refreshToken })
        .then((result) => {
          if (sessionRef.current?.refreshToken !== current.refreshToken) {
            return sessionRef.current?.accessToken ?? null;
          }
          const next = toSession(result);
          commitSession(next, rememberRef.current);
          return next.accessToken;
        })
        .catch((error: unknown) => {
          clearSession();
          throw error;
        })
        .finally(() => {
          refreshInFlightRef.current = null;
        });

      refreshInFlightRef.current = pending;
      return pending;
    },
    [clearSession, commitSession]
  );

  useEffect(() => {
    setApiAuthRefreshHandler(refreshAccessToken);
    return () => setApiAuthRefreshHandler(null);
  }, [refreshAccessToken]);

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored || Date.parse(stored.refreshTokenExpiresAt) <= Date.now()) {
      setStatus('signed-out');
      return;
    }

    const persistent = Boolean(localStorage.getItem(storageKey));
    commitSession(stored, persistent);
    void (async () => {
      try {
        if (Date.parse(stored.accessTokenExpiresAt) - Date.now() < 60_000) {
          await refreshAccessToken(stored.accessToken);
        }
        const next = sessionRef.current;
        if (!next) return;
        await verifyHousehold(next);
      } catch {
        clearSession();
      }
    })();
  }, [clearSession, commitSession, refreshAccessToken, verifyHousehold]);

  useEffect(() => {
    if (!session) return undefined;
    const delay = Math.max(Date.parse(session.accessTokenExpiresAt) - Date.now() - 60_000, 1_000);
    const timer = window.setTimeout(() => {
      void refreshAccessToken(session.accessToken).catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [refreshAccessToken, session]);

  const value = useMemo<SessionContextValue>(
    () => ({
      accessToken: session?.accessToken ?? null,
      createFirstHousehold: async (input) => {
        if (!session) throw new Error('Brak aktywnej sesji.');
        await createHousehold(input, { accessToken: session.accessToken });
        await verifyHousehold(session);
      },
      logout: async () => {
        if (session)
          await logoutSession({ accessToken: session.accessToken }).catch(() => undefined);
        clearSession();
      },
      registerAccount: async (input) => {
        const result = await register(input);
        if (!result.devVerificationToken) return 'verification-required';
        await verifyEmail({
          email: input.email,
          token: result.devVerificationToken,
        });
        const next = toSession(await login({ email: input.email, password: input.password }));
        commitSession(next, true);
        setStatus('needs-household');
        return 'signed-in';
      },
      signIn: async (input, shouldRemember) => {
        const next = toSession(await login(input));
        commitSession(next, shouldRemember);
        await verifyHousehold(next);
        return next.accessToken;
      },
      signInWithGoogle: async (idToken, shouldRemember) => {
        const next = toSession(await loginWithGoogle({ idToken }));
        commitSession(next, shouldRemember);
        await verifyHousehold(next);
        return next.accessToken;
      },
      permissions,
      status,
    }),
    [clearSession, commitSession, permissions, session, status, verifyHousehold]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession wymaga SessionProvider.');
  return context;
}
