import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  CreateHouseholdRequest,
  LoginResponse,
  LoginRequest,
  RegisterRequest,
  acceptInvitation,
  createHousehold,
  getStartDashboard,
  login,
  loginWithGoogle,
  register,
  refreshSession,
  verifyEmail,
} from "../api";
import {
  clearRememberedEmail,
  clearStoredSession,
  loadStoredSession,
  saveRememberedEmail,
  saveStoredSession,
} from "./secure-session-store";

interface Session {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

type SessionStatus = "checking" | "signed-out" | "needs-household" | "ready";

interface SignInOptions {
  invitationToken?: string | null;
  remember?: boolean;
}

interface SessionContextValue {
  createFirstHousehold: (input: CreateHouseholdRequest) => Promise<void>;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  registerAndSignIn: (
    input: RegisterRequest,
    options?: SignInOptions,
  ) => Promise<void>;
  session: Session | null;
  signIn: (input: LoginRequest, options?: SignInOptions) => Promise<void>;
  signInWithGoogle: (idToken: string, options?: SignInOptions) => Promise<void>;
  status: SessionStatus;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);
const accessTokenRefreshLeadMs = 60_000;

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [rememberSession, setRememberSession] = useState(false);
  const [status, setStatus] = useState<SessionStatus>("checking");

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const storedSession = await loadStoredSession();

      if (!active) {
        return;
      }

      if (!storedSession) {
        setStatus("signed-out");
        return;
      }

      try {
        let nextSession = normalizeStoredSession(storedSession);

        if (isRefreshTokenExpired(nextSession)) {
          await clearStoredSession();
          setStatus("signed-out");
          return;
        }

        if (shouldRefreshAccessToken(nextSession)) {
          nextSession = toSession(
            await refreshSession({ refreshToken: nextSession.refreshToken }),
          );
          await saveStoredSession(nextSession);
        }

        setRememberSession(true);
        setSession(nextSession);
        await getStartDashboard({ accessToken: nextSession.accessToken });

        if (active) {
          setStatus("ready");
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          if (active) {
            setStatus("needs-household");
          }
          return;
        }

        await clearStoredSession();

        if (active) {
          setSession(null);
          setStatus("signed-out");
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let active = true;
    const refreshAt =
      Date.parse(session.accessTokenExpiresAt) - accessTokenRefreshLeadMs;
    const delay = Math.max(refreshAt - Date.now(), 1_000);

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const nextSession = toSession(
            await refreshSession({ refreshToken: session.refreshToken }),
          );

          if (!active) {
            return;
          }

          setSession(nextSession);

          if (rememberSession) {
            await saveStoredSession(nextSession);
          }
        } catch {
          await clearStoredSession();

          if (active) {
            setSession(null);
            setRememberSession(false);
            setStatus("signed-out");
          }
        }
      })();
    }, delay);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [rememberSession, session]);

  const value = useMemo<SessionContextValue>(
    () => ({
      createFirstHousehold: async (input) => {
        if (!session) {
          throw new Error("Brak aktywnej sesji");
        }

        await createHousehold(input, { accessToken: session.accessToken });
        setStatus("ready");
      },
      isAuthenticated: Boolean(session),
      logout: async () => {
        try {
          await clearStoredSession();
        } finally {
          setSession(null);
          setRememberSession(false);
          setStatus("signed-out");
        }
      },
      registerAndSignIn: async (input, options) => {
        const registration = await register(input);

        if (registration.devVerificationToken) {
          await verifyEmail({
            email: input.email,
            token: registration.devVerificationToken,
          });
        } else {
          throw new Error(
            "Konto utworzone. Sprawdź e-mail, aby zweryfikować adres przed logowaniem.",
          );
        }

        const nextSession = await login({
          email: input.email,
          password: input.password,
        });
        const authSession = toSession(nextSession);
        setSession(authSession);
        setRememberSession(Boolean(options?.remember));

        if (options?.remember) {
          await saveStoredSession(authSession);
          await saveRememberedEmail(input.email);
        } else {
          await clearStoredSession();
          await clearRememberedEmail();
        }

        if (options?.invitationToken) {
          await acceptInvitation(
            { token: options.invitationToken },
            { accessToken: authSession.accessToken },
          );
          await getStartDashboard({ accessToken: authSession.accessToken });
          setStatus("ready");
          return;
        }

        setStatus("needs-household");
      },
      session,
      signIn: async (input, options) => {
        const nextSession = await login(input);
        const authSession = toSession(nextSession);

        setSession(authSession);
        setRememberSession(Boolean(options?.remember));

        if (options?.remember) {
          await saveStoredSession(authSession);
          await saveRememberedEmail(input.email);
        } else {
          await clearStoredSession();
          await clearRememberedEmail();
        }

        try {
          if (options?.invitationToken) {
            await acceptInvitation(
              { token: options.invitationToken },
              { accessToken: authSession.accessToken },
            );
          }

          await getStartDashboard({ accessToken: authSession.accessToken });
          setStatus("ready");
        } catch (error) {
          if (error instanceof ApiError && error.status === 403) {
            setStatus("needs-household");
            return;
          }

          throw error;
        }
      },
      signInWithGoogle: async (idToken, options) => {
        const nextSession = await loginWithGoogle({ idToken });
        const authSession = toSession(nextSession);

        setSession(authSession);
        setRememberSession(Boolean(options?.remember));

        if (options?.remember) {
          await saveStoredSession(authSession);
        } else {
          await clearStoredSession();
          await clearRememberedEmail();
        }

        try {
          if (options?.invitationToken) {
            await acceptInvitation(
              { token: options.invitationToken },
              { accessToken: authSession.accessToken },
            );
          }

          await getStartDashboard({ accessToken: authSession.accessToken });
          setStatus("ready");
        } catch (error) {
          if (error instanceof ApiError && error.status === 403) {
            setStatus("needs-household");
            return;
          }

          throw error;
        }
      },
      status,
    }),
    [session, status],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
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

function normalizeStoredSession(session: {
  accessToken: string;
  accessTokenExpiresAt?: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string;
}): Session {
  return {
    accessToken: session.accessToken,
    accessTokenExpiresAt:
      session.accessTokenExpiresAt ?? new Date(0).toISOString(),
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt:
      session.refreshTokenExpiresAt ??
      new Date(Date.now() + 2_592_000_000).toISOString(),
  };
}

function shouldRefreshAccessToken(session: Session): boolean {
  return (
    Date.parse(session.accessTokenExpiresAt) - Date.now() <=
    accessTokenRefreshLeadMs
  );
}

function isRefreshTokenExpired(session: Session): boolean {
  return Date.parse(session.refreshTokenExpiresAt) <= Date.now();
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }

  return context;
}
