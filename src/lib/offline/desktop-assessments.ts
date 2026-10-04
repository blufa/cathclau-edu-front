import { createAssessment } from "@/lib/api/grading";
import type { AssessmentInput, AssessmentType } from "@/lib/types/grading";
import { getDesktopDb } from "./desktop-db";

export interface QueueOfflineAssessmentInput extends AssessmentInput {
  etablissementId: number;
}

interface OfflineAssessmentRow {
  id: string;
  classe_id: number;
  matiere_id: number;
  enseignant_id: number | null;
  periode_id: number;
  type_evaluation: AssessmentType;
  libelle: string;
  date_evaluation: string;
  note_sur: number;
  coefficient: number;
}

/** Met en file la création d'une évaluation — le seul refus possible à la synchro (période clôturée
 * entre-temps, voir `AssessmentService.requireOpenPeriod` côté serveur) ne peut être détecté qu'au
 * rejeu (`pushOfflineAssessments`), jamais localement. Rejouée AVANT les notes dans `runSync()` :
 * une évaluation doit exister côté serveur avant que ses notes ne puissent être rejouées. */
export async function queueOfflineAssessment(input: QueueOfflineAssessmentInput): Promise<string> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO evaluations_offline
       (id, etablissement_id, classe_id, matiere_id, enseignant_id, periode_id, type_evaluation,
        libelle, date_evaluation, note_sur, coefficient, synced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
    [
      id, input.etablissementId, input.classId, input.subjectId, input.teacherId ?? null,
      input.periodId, input.type, input.label, input.date ?? new Date().toISOString().slice(0, 10),
      input.maxScore, input.coefficient,
    ],
  );
  return id;
}

export async function pushOfflineAssessments(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflineAssessmentRow[]>("SELECT * FROM evaluations_offline WHERE synced = 0");

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await createAssessment({
        classId: row.classe_id,
        subjectId: row.matiere_id,
        teacherId: row.enseignant_id,
        periodId: row.periode_id,
        type: row.type_evaluation,
        label: row.libelle,
        date: row.date_evaluation,
        coefficient: row.coefficient,
        maxScore: row.note_sur,
      });
      await db.execute("UPDATE evaluations_offline SET synced = 1 WHERE id = $1", [row.id]);
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE evaluations_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE id = $2",
        [message, row.id],
      );
    }
  }
  return { synced, failed };
}
