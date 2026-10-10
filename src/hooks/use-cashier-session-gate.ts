"use client";

import { useQuery } from "@/hooks/use-query";
import { getCurrentCashierSession } from "@/lib/api/payment";
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
 */
export function useCashierSessionGate() {
  const { user } = useAuth();
  const exempt = isExemptFromCashierGate(user);
  const q = useQuery(() => (exempt ? Promise.resolve(null) : getCurrentCashierSession()), [exempt]);
  return {
    sessionOpen: exempt ? true : q.data != null,
    loading: exempt ? false : q.loading,
    refetch: q.refetch,
  };
}
