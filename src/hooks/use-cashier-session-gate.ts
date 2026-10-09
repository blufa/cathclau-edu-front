"use client";

import { useQuery } from "@/hooks/use-query";
import { getCurrentCashierSession } from "@/lib/api/payment";

/**
 * Session de caisse ouverte pour l'utilisateur connecté — même barrière que côté backend
 * (`PaymentService`/`MonthlyExpenseSheetService` rejettent déjà l'encaissement/la dépense guichet
 * sans session ouverte) : ici seulement pour désactiver le bouton et expliquer pourquoi, avant même
 * l'appel réseau, plutôt que de laisser l'utilisateur découvrir le rejet après coup.
 */
export function useCashierSessionGate() {
  const q = useQuery(() => getCurrentCashierSession(), []);
  return {
    sessionOpen: q.data != null,
    loading: q.loading,
    refetch: q.refetch,
  };
}
