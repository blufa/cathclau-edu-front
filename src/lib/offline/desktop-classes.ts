import { createClass } from "@/lib/api/academics";
import type { ClassType, CreateClassInput, Grade } from "@/lib/types/academics";
import { getDesktopDb } from "./desktop-db";

export interface QueueOfflineClassInput extends CreateClassInput {
  etablissementId: number;
}

interface OfflineClassRow {
  id: string;
  niveau_id: number | null;
  annee_scolaire_id: number;
  enseignant_resp_id: number | null;
  salle_id: number | null;
  libelle: string;
  capacite_max: number | null;
  type_classe: ClassType | null;
  grade: Grade | null;
  serie: string | null;
}

/** Met en file la création d'une classe — le seul refus possible à la synchro (année scolaire
 * clôturée entre-temps, voir `AcademicsDataProvider`/`ClasseService.create` côté serveur) ne peut
 * être détecté qu'au rejeu (`pushOfflineClasses`), jamais localement. */
export async function queueOfflineClass(input: QueueOfflineClassInput): Promise<string> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO classes_offline
       (id, etablissement_id, niveau_id, annee_scolaire_id, enseignant_resp_id, salle_id, libelle,
        capacite_max, type_classe, grade, serie, synced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
    [
      id, input.etablissementId, input.levelId, input.academicYearId, input.headTeacherId ?? null,
      input.roomId ?? null, input.label, input.maxCapacity, input.classType ?? null,
      input.grade ?? null, input.serie ?? null,
    ],
  );
  return id;
}

export async function pushOfflineClasses(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflineClassRow[]>("SELECT * FROM classes_offline WHERE synced = 0");

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await createClass({
        levelId: row.niveau_id,
        academicYearId: row.annee_scolaire_id,
        headTeacherId: row.enseignant_resp_id,
        roomId: row.salle_id,
        label: row.libelle,
        maxCapacity: row.capacite_max,
        classType: row.type_classe,
        grade: row.grade,
        serie: row.serie,
      });
      await db.execute("UPDATE classes_offline SET synced = 1 WHERE id = $1", [row.id]);
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE classes_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE id = $2",
        [message, row.id],
      );
    }
  }
  return { synced, failed };
}
