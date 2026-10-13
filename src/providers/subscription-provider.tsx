"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentSubscription, getSchoolProfile, listPlans } from "@/lib/api/platform";
import { useAuth } from "@/providers/auth-provider";
import type { Plan, Subscription, TenantStatus } from "@/lib/types/platform";

interface SubscriptionContextValue {
  subscription: Subscription | null;
  plan: Plan | null;
  /** Tenant lifecycle status (TRIAL/ACTIVE/…) — known only for SCHOOL_ADMIN, else null. */
  tenantStatus: TenantStatus | null;
  loading: boolean;
  /** True for tenant-scoped users (ADMIN_ECOLE…); false for the platform SUPER_ADMIN. */
  tenantScoped: boolean;
  refresh: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // user.tenantId est déjà résolu vers l'école impersonnée pour un SUPER_ADMIN (voir
  // auth-provider.tsx) — exclure le rôle en plus empêchait tout accès au tableau de bord pendant
  // l'impersonation (bug réel constaté : école bien impersonnée dans le header, mais /dashboard
  // affichait quand même le message "administrateur de la plateforme").
  const tenantScoped = !!user?.tenantId;
  const isSchoolAdmin = !!user?.roles.includes("SCHOOL_ADMIN");

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tenantStatus, setTenantStatus] = useState<TenantStatus | null>(null);
  const [loading, setLoading] = useState(tenantScoped);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!tenantScoped) return; // loading is initialised to `tenantScoped` (false here)
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const sub = await getCurrentSubscription();
        if (!active) return;
        setSubscription(sub);
        if (sub) {
          const plans = await listPlans();
          if (active) setPlan(plans.find((p) => p.id === sub.planId) ?? null);
        } else {
          setPlan(null);
        }
        // Le statut du tenant (essai vs activé) n'est lisible que par le SCHOOL_ADMIN.
        if (isSchoolAdmin) {
          try {
            const profile = await getSchoolProfile();
            if (active) setTenantStatus(profile.status ?? null);
          } catch {
            if (active) setTenantStatus(null);
          }
        }
      } catch {
        if (active) {
          setSubscription(null);
          setPlan(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tenantScoped, isSchoolAdmin, tick]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({ subscription, plan, tenantStatus, loading, tenantScoped, refresh }),
    [subscription, plan, tenantStatus, loading, tenantScoped, refresh],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within a <SubscriptionProvider>");
  return ctx;
}
