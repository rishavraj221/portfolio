import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { decodeAccessToken, type AccessTokenClaims } from "../lib/jwt";

interface MeState {
  tokenPolicyVersion: number;
  currentPolicyVersion: number;
  stale: boolean;
}

interface AuthValue {
  accessToken: string | null;
  claims: AccessTokenClaims | null;
  me: MeState | null;
  login: (email: string, password: string, tenant: string) => Promise<void>;
  logout: () => void;
  // Local check: reads straight from the decoded token, no request made.
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [claims, setClaims] = useState<AccessTokenClaims | null>(null);
  const [me, setMe] = useState<MeState | null>(null);
  const pollRef = useRef<number | null>(null);

  const login = useCallback(async (email: string, password: string, tenant: string) => {
    const tokens = await api.login(email, password, tenant);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    setClaims(decodeAccessToken(tokens.accessToken));
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setClaims(null);
    setMe(null);
  }, []);

  // Pure read, safe to call during render: no side effects. Logging the
  // check happens separately, in an effect, so it can't trigger a render
  // loop by calling setState while React is still rendering.
  const hasPermission = useCallback(
    (permission: string) => claims?.permissions.includes(permission) ?? false,
    [claims],
  );

  // Poll /v1/me so the policy-version badge updates live when an admin
  // changes a role in another tab, without the user taking any action.
  useEffect(() => {
    if (!accessToken) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      return;
    }
    const poll = async () => {
      try {
        const result = await api.me(accessToken);
        setMe(result);
      } catch {
        // token likely expired; leave stale state for the UI to surface
      }
    };
    poll();
    pollRef.current = window.setInterval(poll, 3000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [accessToken]);

  // If a poll finds the token stale, force a refresh so the next request
  // uses a token minted under the current policy version.
  useEffect(() => {
    if (!me?.stale || !refreshToken) return;
    api.refresh(refreshToken).then((tokens) => {
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      setClaims(decodeAccessToken(tokens.accessToken));
    });
  }, [me?.stale, refreshToken]);

  return (
    <AuthContext.Provider value={{ accessToken, claims, me, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
