import { enterBulkGrades } from "@/lib/api/grading";
import { getDesktopDb } from "./desktop-db";

interface OfflineNotesRow {
  evaluation_id: number;
  notes_json: string;
}

/** Enregistre/REMPLACE la saisie de notes d'une évaluation — comme `/grading/assessments/{id}/grades/bulk`
 * côté serveur, c'est un upsert complet de la classe pour cette évaluation : rejouer la même
 * évaluation plusieurs fois hors ligne écrase la ligne précédente au lieu de s'empiler (identique à
 * `gradeQueue` côté web, voir db.ts). */
export async function queueOfflineGrades(
  etablissementId: number, evaluationId: number, grades: { studentId: number; value: number }[],
): Promise<void> {
  const db = await getDesktopDb();
  await db.execute(
    `INSERT INTO notes_offline (evaluation_id, etablissement_id, notes_json, synced)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (evaluation_id) DO UPDATE SET notes_json = excluded.notes_json, synced = 0`,
    [evaluationId, etablissementId, JSON.stringify(grades)],
  );
}

export async function pushOfflineGrades(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflineNotesRow[]>("SELECT * FROM notes_offline WHERE synced = 0");

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const grades = JSON.parse(row.notes_json) as { studentId: number; value: number }[];
      await enterBulkGrades(row.evaluation_id, grades);
      await db.execute("UPDATE notes_offline SET synced = 1 WHERE evaluation_id = $1", [row.evaluation_id]);
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE notes_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE evaluation_id = $2",
        [message, row.evaluation_id],
      );
    }
  }
  return { synced, failed };
}
