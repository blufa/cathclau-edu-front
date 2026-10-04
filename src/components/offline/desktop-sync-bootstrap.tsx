"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { getCurrentAcademicYear } from "@/lib/api/academics";
import { isDesktop } from "@/lib/offline/desktop-runtime";
import { wireDesktopSyncTriggers, triggerDesktopSyncNow, type DesktopSyncContext } from "@/lib/offline/desktop-sync";
import { checkForDesktopUpdate } from "@/lib/offline/desktop-updater";

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
    const ready = tenantId != null && academicYearId != null;
    ctxRef.current = ready ? { tenantId, academicYearId } : null;
    // §retour fondateurs : le premier appel de wireDesktopSyncTriggers (ci-dessous) se déclenche
    // AVANT que tenantId/academicYearId ne soient résolus (requêtes async) — sans ce déclenchement
    // explicite dès que le contexte devient prêt, la copie initiale des classes/frais/élèves
    // n'arrivait qu'au bout de 15 minutes (minuteur de secours), pas à la connexion comme attendu.
    if (ready && isDesktop()) triggerDesktopSyncNow();
  }, [tenantId, academicYearId]);

  useEffect(() => {
    if (!isDesktop()) return;
    wireDesktopSyncTriggers(() => ctxRef.current);
    void checkForDesktopUpdate();
  }, []);

  return null;
}
