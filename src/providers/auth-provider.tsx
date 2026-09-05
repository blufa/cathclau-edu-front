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
import { isNetworkError } from "@/lib/api/errors";
import * as authService from "@/lib/auth/auth-service";
import { getAccessToken } from "@/lib/auth/tokens";
import {
  getImpersonatedTenantId,
  setImpersonatedTenantId as storeImpersonatedTenantId,
} from "@/lib/auth/impersonation";
import type { AuthUser } from "@/lib/types/auth";
import { getMyParent } from "@/lib/api/parents";
import { getMyStudent } from "@/lib/api/students";
import { getMyTeacher } from "@/lib/api/staff";
import { offlineDb } from "@/lib/offline/db";

/** Clé du dernier profil connu, pour rester connecté hors-ligne (voir bootstrap ci-dessous). */
const AUTH_CACHE_KEY = "auth:me";

function roleNames(roles: string[]): string[] {
  return roles.map((r) => r.replace(/^ROLE_/, ""));
}

/**
 * Les rôles avec fiche métier dédiée (Parent/Student/Teacher) stockent leur téléphone/photo sur CETTE
 * fiche, pas sur `User` (iam) — c'est elle que lisent les autres modules (facturation, diffusion SMS).
 * On la récupère ici pour que l'avatar/téléphone affichés partout dans l'app (header compris)
 * reflètent la vraie donnée, quel que soit le rôle, sans dupliquer cette logique sur chaque page.
 */
async function enrichWithBusinessProfile(me: AuthUser): Promise<AuthUser> {
  const roles = roleNames(me.roles);
  try {
    if (roles.includes("PARENT")) {
      const p = await getMyParent();
      return { ...me, phone: p.phone ?? me.phone, photo: p.photo ?? me.photo };
    }
    if (roles.includes("STUDENT")) {
      const s = await getMyStudent();
      return { ...me, phone: s.phone ?? me.phone, photo: s.photo ?? me.photo };
    }
    if (roles.includes("TEACHER")) {
      const t = await getMyTeacher();
      return { ...me, phone: t.phone ?? me.phone, photo: t.photo ?? me.photo };
    }
  } catch {
    // Pas de fiche liée (ou erreur réseau) : on garde le profil générique tel quel.
  }
  return me;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
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
    const me = await enrichWithBusinessProfile(await authService.fetchMe());
    setUser(me);
    setStatus("authenticated");
    // Dernier profil connu, pour pouvoir rester connecté si le prochain chargement de l'app tombe
    // hors-ligne (voir le bootstrap ci-dessous) — jamais utilisé pour authentifier, seulement pour
    // afficher l'identité/permissions déjà validées par le serveur lors de cette connexion.
    void offlineDb.readCache.put({ key: AUTH_CACHE_KEY, payload: me, updatedAt: new Date().toISOString() });
    return me;
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // Bootstrap : un jeton présent suppose une session déjà validée par le serveur. On tente de
  // rafraîchir le profil ; si l'appareil est hors-ligne, on retombe sur le dernier profil connu
  // plutôt que de déconnecter localement quelqu'un qui s'était déjà authentifié avec succès — c'est
  // ce qui permet de continuer à utiliser l'app (files d'attente hors-ligne) sans réseau. Une vraie
  // session invalide (401) reste, elle, gérée par `setSessionExpiredHandler` (rejet non réseau).
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!getAccessToken()) {
        if (active) setStatus("unauthenticated");
        return;
      }
      try {
        await loadUser();
      } catch (err) {
        if (!active) return;
        if (isNetworkError(err)) {
          const cached = await offlineDb.readCache.get(AUTH_CACHE_KEY);
          if (cached) {
            setUser(cached.payload as AuthUser);
            setStatus("authenticated");
            return;
          }
        }
        clearSession();
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
      return loadUser();
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

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: effectiveUser, status, login, logout, refreshUser, impersonatedTenantId, setImpersonatedTenant }),
    [effectiveUser, status, login, logout, refreshUser, impersonatedTenantId, setImpersonatedTenant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}
