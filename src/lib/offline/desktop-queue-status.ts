import { getDesktopDb } from "./desktop-db";

/** Une ligne par table `*_offline` — décrit comment l'interroger et la présenter dans le bandeau
 * desktop (voir `desktop-offline-banner.tsx`). Toute nouvelle file d'attente desktop (emploi du
 * temps, classes, évaluations…) s'ajoute ici pour être visible au même endroit — jusqu'ici, les
 * échecs de synchro desktop (`tentatives`/`derniere_erreur`, déjà sur chaque table) n'étaient
 * affichés NULLE PART : un comptable dont la clôture de caisse échouait à la synchro ne le savait
 * jamais (§retour fondateurs, gap découvert en préparant l'extension du hors-ligne). */
interface QueueTableConfig {
  table: string;
  idColumn: "id" | "evaluation_id";
  label: string;
  describe: (row: Record<string, unknown>) => string;
}

const QUEUE_TABLES: QueueTableConfig[] = [
  { table: "encaissements_offline", idColumn: "id", label: "Encaissement",
    describe: (r) => `Élève #${r.eleve_id} · ${r.montant} GNF` },
  { table: "presences_offline", idColumn: "id", label: "Présence",
    describe: (r) => `${r.type_sujet === "TEACHER" ? "Enseignant" : r.type_sujet === "EMPLOYEE" ? "Personnel" : "Élève"} #${r.sujet_id} · ${r.date_action}` },
  { table: "seances_offline", idColumn: "id", label: "Séance",
    describe: (r) => `${r.titre} (${r.date_seance})` },
  { table: "depenses_offline", idColumn: "id", label: "Dépense",
    describe: (r) => `${r.libelle} · ${r.montant} GNF` },
  { table: "notes_offline", idColumn: "evaluation_id", label: "Notes",
    describe: (r) => `Évaluation #${r.evaluation_id}` },
  { table: "caisse_sessions_offline", idColumn: "id", label: "Session de caisse",
    describe: (r) => (r.fermee_le ? `Clôture du ${r.fermee_le}` : `Ouverture du ${r.ouverte_le}`) },
  { table: "inscriptions_offline", idColumn: "id", label: "Inscription",
    describe: () => "Inscription (parent + enfant(s))" },
  { table: "emplois_du_temps_offline", idColumn: "id", label: "Emploi du temps",
    describe: (r) => `Classe #${r.classe_id} · ${r.jour} ${r.heure_debut}–${r.heure_fin}` },
  { table: "classes_offline", idColumn: "id", label: "Classe",
    describe: (r) => `${r.libelle}` },
  { table: "evaluations_offline", idColumn: "id", label: "Évaluation",
    describe: (r) => `${r.libelle} (classe #${r.classe_id})` },
];

export interface DesktopQueueItem {
  table: string;
  idColumn: "id" | "evaluation_id";
  rowId: string | number;
  label: string;
  description: string;
  attempts: number;
  lastError: string | null;
}

export interface DesktopQueueStatus {
  pendingCount: number;
  failedItems: DesktopQueueItem[];
}

export async function getDesktopQueueStatus(): Promise<DesktopQueueStatus> {
  const db = await getDesktopDb();
  let pendingCount = 0;
  const failedItems: DesktopQueueItem[] = [];
  for (const cfg of QUEUE_TABLES) {
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM ${cfg.table} WHERE synced = 0`,
    );
    for (const row of rows) {
      pendingCount++;
      const attempts = Number(row.tentatives ?? 0);
      if (attempts > 0) {
        failedItems.push({
          table: cfg.table,
          idColumn: cfg.idColumn,
          rowId: row[cfg.idColumn] as string | number,
          label: cfg.label,
          description: cfg.describe(row),
          attempts,
          lastError: (row.derniere_erreur as string | null) ?? null,
        });
      }
    }
  }
  return { pendingCount, failedItems };
}

export async function discardDesktopQueueItem(table: string, idColumn: string, rowId: string | number): Promise<void> {
  const db = await getDesktopDb();
  await db.execute(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [rowId]);
}
