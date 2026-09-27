import { addExpenseLine } from "@/lib/api/expense";
import { getDesktopDb } from "./desktop-db";

export interface QueueOfflineExpenseInput {
  etablissementId: number;
  /** Fiche de dépense mensuelle CIBLE — doit déjà exister localement (voir `fiches_depense`, alimentée
   * par `pullReferenceData`) : impossible de créer une nouvelle fiche hors ligne, seulement d'y ajouter
   * des lignes à une fiche déjà ouverte et connue avant la coupure réseau. */
  ficheId: number;
  libelle: string;
  montant: number;
  necessaire: boolean;
  dateDepense: string;
}

interface OfflineExpenseRow {
  id: string;
  id_serveur: number | null;
  fiche_id: number;
  libelle: string;
  montant: number;
  necessaire: number;
  date_depense: string;
}

export async function queueOfflineExpense(input: QueueOfflineExpenseInput): Promise<string> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO depenses_offline
       (id, etablissement_id, fiche_id, libelle, montant, necessaire, date_depense, synced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
    [id, input.etablissementId, input.ficheId, input.libelle, input.montant, input.necessaire ? 1 : 0, input.dateDepense],
  );
  return id;
}

export async function pushOfflineExpenses(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflineExpenseRow[]>(
    "SELECT * FROM depenses_offline WHERE synced = 0 ORDER BY date_depense ASC",
  );

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const created = await addExpenseLine(row.fiche_id, {
        label: row.libelle,
        amount: row.montant,
        necessary: !!row.necessaire,
        expenseDate: row.date_depense,
      });
      await db.execute("UPDATE depenses_offline SET id_serveur = $1, synced = 1 WHERE id = $2", [created.id, row.id]);
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE depenses_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE id = $2",
        [message, row.id],
      );
    }
  }
  return { synced, failed };
}
