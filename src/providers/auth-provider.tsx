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
import {
  getImpersonatedTenantId,
  setImpersonatedTenantId as storeImpersonatedTenantId,
} from "@/lib/auth/impersonation";
import type { AuthUser } from "@/lib/types/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** SUPER_ADMIN-only: the school currently being impersonated, if any. */
  impersonatedTenantId: number | null;
  setImpersonatedTenant: (id: number | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  // Restore impersonation choice (client-only; returns null on the server).
  const [impersonatedTenantId, setImpId] = useState<number | null>(() => getImpersonatedTenantId());

  const setImpersonatedTenant = useCallback((id: number | null) => {
    storeImpersonatedTenantId(id);
    setImpId(id);
  }, []);

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

  // For a SUPER_ADMIN impersonating a school, expose that school as the effective tenant so every
  // tenant-scoped page (which reads user.tenantId) operates on it — mirrored by the X-Tenant-Id header.
  const effectiveUser = useMemo<AuthUser | null>(() => {
    if (!user) return null;
    const isSuperAdmin = user.roles?.some((r) => r.replace(/^ROLE_/, "") === "SUPER_ADMIN");
    if (isSuperAdmin && impersonatedTenantId != null) return { ...user, tenantId: impersonatedTenantId };
    return user;
  }, [user, impersonatedTenantId]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: effectiveUser, status, login, logout, refreshUser: loadUser, impersonatedTenantId, setImpersonatedTenant }),
    [effectiveUser, status, login, logout, loadUser, impersonatedTenantId, setImpersonatedTenant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}
