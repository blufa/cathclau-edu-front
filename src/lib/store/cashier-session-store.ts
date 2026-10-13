import { create } from "zustand";
import { getCurrentCashierSession } from "@/lib/api/payment";

interface CashierSessionState {
  /** `null` tant que l'état n'a jamais été chargé pour l'utilisateur courant. */
  sessionOpen: boolean | null;
  loading: boolean;
  fetchedForUserId: number | null | undefined;
  refresh: (userId: number | null) => Promise<void>;
}

/**
 * Source unique de l'état "caisse ouverte", partagée par tous les consommateurs
 * (`useCashierSessionGate` — sidebar "Dépenses", rappel à la connexion, boutons "Encaisser" sur
 * chaque page de facturation). Avant ce store, chaque composant tenait sa propre requête locale
 * (`useQuery`) : ouvrir sa caisse sur /cashier-session ne mettait à jour QUE la page elle-même, le
 * reste de l'app (notamment la sidebar, montée une seule fois dans AppShell) restait grisé jusqu'à
 * un rechargement complet (§retour comptable, caisse ouverte mais "Dépenses" toujours grisée).
 */
export const useCashierSessionStore = create<CashierSessionState>((set) => ({
  sessionOpen: null,
  loading: true,
  fetchedForUserId: undefined,
  refresh: async (userId) => {
    set({ loading: true });
    try {
      const data = await getCurrentCashierSession();
      set({ sessionOpen: data != null, loading: false, fetchedForUserId: userId });
    } catch {
      set({ sessionOpen: false, loading: false, fetchedForUserId: userId });
    }
  },
}));
