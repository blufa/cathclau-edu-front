"use client";

import { useEffect } from "react";
import { useCashierSessionStore } from "@/lib/store/cashier-session-store";
import { useAuth } from "@/providers/auth-provider";
import { isExemptFromCashierGate } from "@/lib/auth/permissions";

/**
 * Session de caisse ouverte pour l'utilisateur connecté — même barrière que côté backend
 * (`PaymentService`/`MonthlyExpenseSheetService` rejettent déjà l'encaissement/la dépense guichet
 * sans session ouverte) : ici seulement pour désactiver le bouton et expliquer pourquoi, avant même
 * l'appel réseau, plutôt que de laisser l'utilisateur découvrir le rejet après coup.
 *
 * SCHOOL_ADMIN/SUPER_ADMIN sont dispensés de la barrière (voir `isExemptFromCashierGate`) : on
 * renvoie `sessionOpen: true` pour eux afin que tous les consommateurs de ce hook (boutons
 * "Encaisser", nav "Dépenses", rappel à la connexion) se débloquent sans dupliquer le check dans
 * chaque composant — même règle, un seul endroit.
 *
 * L'état lui-même vient d'un store partagé (`cashier-session-store`), pas d'une requête locale :
 * sans ça, ouvrir sa caisse sur /cashier-session ne mettait à jour QUE cette page, et la sidebar
 * (montée une seule fois dans AppShell) restait grisée jusqu'au rechargement complet.
 */
export function useCashierSessionGate() {
  const { user } = useAuth();
  const exempt = isExemptFromCashierGate(user);
  const sessionOpen = useCashierSessionStore((s) => s.sessionOpen);
  const loading = useCashierSessionStore((s) => s.loading);
  const fetchedForUserId = useCashierSessionStore((s) => s.fetchedForUserId);
  const refresh = useCashierSessionStore((s) => s.refresh);

  useEffect(() => {
    if (exempt) return;
    if (fetchedForUserId === (user?.userId ?? null)) return;
    void refresh(user?.userId ?? null);
  }, [exempt, user?.userId, fetchedForUserId, refresh]);

  return {
    sessionOpen: exempt ? true : sessionOpen === true,
    loading: exempt ? false : loading,
    refetch: () => refresh(user?.userId ?? null),
  };
}
