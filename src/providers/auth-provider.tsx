"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { setSessionExpiredHandler } from "@/lib/api/client";
import * as authService from "@/lib/auth/auth-service";
import { getAccessToken } from "@/lib/auth/tokens";
import type { AuthUser } from "@/lib/types/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const loadUser = useCallback(async () => {
    const me = await authService.fetchMe();
    setUser(me);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // Bootstrap: if a token is present, resolve the profile; otherwise we're logged out.
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!getAccessToken()) {
        if (active) setStatus("unauthenticated");
        return;
      }
      try {
        await loadUser();
      } catch {
        if (active) clearSession();
      }
    })();
    return () => {
      active = false;
    };
  }, [loadUser, clearSession]);

  // Let the API client drop the session when a refresh ultimately fails.
  useEffect(() => {
    setSessionExpiredHandler(clearSession);
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      await authService.login(email, password);
      await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, refreshUser: loadUser }),
    [user, status, login, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}
