import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  ApiError,
  createHousehold,
  getMyPermissions,
  login,
  logoutSession,
  refreshSession,
  register,
  verifyEmail,
  type CreateHouseholdRequest,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
} from "../api";

interface Session {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

type SessionStatus = "checking" | "needs-household" | "ready" | "signed-out";

interface SessionContextValue {
  accessToken: string | null;
  createFirstHousehold: (input: CreateHouseholdRequest) => Promise<void>;
  logout: () => Promise<void>;
  registerAccount: (
    input: RegisterRequest,
  ) => Promise<"signed-in" | "verification-required">;
  signIn: (input: LoginRequest, remember: boolean) => Promise<void>;
  status: SessionStatus;
}

const storageKey = "homeapp.web.session.v1";
const SessionContext = createContext<SessionContextValue | null>(null);

function readStoredSession(): Session | null {
  const raw =
    localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey);
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
    accessTokenExpiresAt: new Date(
      Date.now() + response.expiresIn * 1000,
    ).toISOString(),
    refreshToken: response.refreshToken,
    refreshTokenExpiresAt: response.refreshTokenExpiresAt,
  };
}

function storeSession(session: Session, remember: boolean) {
  localStorage.removeItem(storageKey);
  sessionStorage.removeItem(storageKey);
  (remember ? localStorage : sessionStorage).setItem(
    storageKey,
    JSON.stringify(session),
  );
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
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<SessionStatus>("checking");

  async function verifyHousehold(next: Session) {
    try {
      await getMyPermissions({ accessToken: next.accessToken });
      setStatus("ready");
    } catch (error) {
      if (isNoHousehold(error)) setStatus("needs-household");
      else throw error;
    }
  }

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored || Date.parse(stored.refreshTokenExpiresAt) <= Date.now()) {
      setStatus("signed-out");
      return;
    }

    const persistent = Boolean(localStorage.getItem(storageKey));
    setRemember(persistent);
    void (async () => {
      try {
        const next =
          Date.parse(stored.accessTokenExpiresAt) - Date.now() < 60_000
            ? toSession(
                await refreshSession({ refreshToken: stored.refreshToken }),
              )
            : stored;
        setSession(next);
        storeSession(next, persistent);
        await verifyHousehold(next);
      } catch {
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(storageKey);
        setSession(null);
        setStatus("signed-out");
      }
    })();
  }, []);

  useEffect(() => {
    if (!session) return;
    const delay = Math.max(
      Date.parse(session.accessTokenExpiresAt) - Date.now() - 60_000,
      1_000,
    );
    const timer = window.setTimeout(() => {
      void refreshSession({ refreshToken: session.refreshToken })
        .then((result) => {
          const next = toSession(result);
          setSession(next);
          storeSession(next, remember);
        })
        .catch(() => {
          localStorage.removeItem(storageKey);
          sessionStorage.removeItem(storageKey);
          setSession(null);
          setStatus("signed-out");
        });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [remember, session]);

  const value = useMemo<SessionContextValue>(
    () => ({
      accessToken: session?.accessToken ?? null,
      createFirstHousehold: async (input) => {
        if (!session) throw new Error("Brak aktywnej sesji.");
        await createHousehold(input, { accessToken: session.accessToken });
        await verifyHousehold(session);
      },
      logout: async () => {
        if (session)
          await logoutSession({ accessToken: session.accessToken }).catch(
            () => undefined,
          );
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(storageKey);
        queryClient.clear();
        setSession(null);
        setStatus("signed-out");
      },
      registerAccount: async (input) => {
        const result = await register(input);
        if (!result.devVerificationToken) return "verification-required";
        await verifyEmail({
          email: input.email,
          token: result.devVerificationToken,
        });
        const next = toSession(
          await login({ email: input.email, password: input.password }),
        );
        setSession(next);
        setRemember(true);
        storeSession(next, true);
        setStatus("needs-household");
        return "signed-in";
      },
      signIn: async (input, shouldRemember) => {
        const next = toSession(await login(input));
        setSession(next);
        setRemember(shouldRemember);
        storeSession(next, shouldRemember);
        await verifyHousehold(next);
      },
      status,
    }),
    [queryClient, remember, session, status],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession wymaga SessionProvider.");
  return context;
}
