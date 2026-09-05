"use client";

import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { GettingStarted } from "@/features/dashboard/components/getting-started";

export default function OnboardingPage() {
  const { user } = useAuth();
  // Guide de configuration initiale (classes, enseignants, logo, modèles...) — réservé aux rôles qui
  // font cette configuration, pas à tout utilisateur connecté (§ dashboard-page.tsx, même garde).
  const allowed = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  if (!allowed) {
    return (
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Accès réservé aux administrateurs de l&apos;école.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GettingStarted forceShow />
    </div>
  );
}
