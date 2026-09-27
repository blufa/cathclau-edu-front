"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { getCurrentAcademicYear } from "@/lib/api/academics";
import { isDesktop } from "@/lib/offline/desktop-runtime";
import { wireDesktopSyncTriggers, type DesktopSyncContext } from "@/lib/offline/desktop-sync";

/**
 * Branche la synchronisation SQLite desktop — équivalent de `wireSyncTriggers()` (Dexie, web) monté
 * dans `OfflineBanner`, mais celui-ci ne fait rien tant que `isDesktop()` est faux (navigateur web
 * classique) : composant invisible, à monter une fois dans `app-shell.tsx`, à côté d'`OfflineBanner`.
 *
 * Le contexte (tenant + année scolaire courante) est lu via une ref plutôt que capturé dans la
 * fermeture passée à `wireDesktopSyncTriggers` : cette dernière ne s'enregistre qu'UNE SEULE fois
 * (garde interne), donc la fonction fournie doit toujours refléter l'état le plus récent, pas l'état
 * du rendu où `wireDesktopSyncTriggers` a été appelée pour la première fois.
 */
export function DesktopSyncBootstrap() {
  const { user } = useAuth();
  const yearQuery = useQuery(() => getCurrentAcademicYear(), []);

  const ctxRef = useRef<DesktopSyncContext>(null);
  const tenantId = user?.tenantId ?? null;
  const academicYearId = yearQuery.data?.id ?? null;
  useEffect(() => {
    ctxRef.current = tenantId != null && academicYearId != null ? { tenantId, academicYearId } : null;
  }, [tenantId, academicYearId]);

  useEffect(() => {
    if (!isDesktop()) return;
    wireDesktopSyncTriggers(() => ctxRef.current);
  }, []);

  return null;
}
