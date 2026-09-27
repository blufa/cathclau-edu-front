import { addExpenseLine } from "@/lib/api/expense";
import { isNetworkError } from "@/lib/api/errors";
import type { Expense, ExpenseLineInput } from "@/lib/types/expense";
import { useNetworkStore } from "./network-store";
import { isDesktop } from "./desktop-runtime";
import { queueOfflineExpense } from "./desktop-expenses";

export type ExpenseLineAttempt =
  | { outcome: "online"; expense: Expense }
  | { outcome: "queued-desktop"; id: string };

/**
 * Point d'entrée unique pour l'ajout d'une ligne de dépense (`SheetDetailView`, page `/budget`) :
 * tente l'appel réel en premier, ne bascule sur la file locale que si l'appel échoue pour une raison
 * réseau — jamais pour une vraie erreur métier (422, 403…), qui remonte normalement. Avant ce correctif,
 * `queueOfflineExpense`/`pushOfflineExpenses` existaient déjà (SQLite desktop, branché dans le cycle de
 * synchro) mais n'étaient jamais appelés : une dépense saisie hors-ligne échouait silencieusement et
 * n'était enregistrée nulle part (§retour comptable).
 *
 * Web (hors desktop) : pas de file locale pour les dépenses (seules les inscriptions/paiements en ont
 * une, via IndexedDB/Dexie) — une coupure réseau web fait simplement remonter l'erreur normalement.
 */
export async function submitExpenseLineOfflineAware(
  tenantId: number | null,
  sheetId: number,
  input: ExpenseLineInput,
): Promise<ExpenseLineAttempt> {
  if (useNetworkStore.getState().online) {
    try {
      return { outcome: "online", expense: await addExpenseLine(sheetId, input) };
    } catch (err) {
      if (!isNetworkError(err) || !isDesktop()) throw err;
    }
  } else if (!isDesktop()) {
    // Web hors-ligne : pas de file locale disponible, on tente quand même l'appel pour obtenir
    // l'erreur réseau standard (message cohérent avec le reste de l'app).
    return { outcome: "online", expense: await addExpenseLine(sheetId, input) };
  }
  const id = await queueOfflineExpense({
    etablissementId: tenantId ?? 0,
    ficheId: sheetId,
    libelle: input.label,
    montant: input.amount,
    necessaire: input.necessary,
    dateDepense: input.expenseDate || new Date().toISOString().slice(0, 10),
  });
  return { outcome: "queued-desktop", id };
}
