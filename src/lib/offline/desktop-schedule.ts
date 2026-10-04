import { createSchedule } from "@/lib/api/academics";
import type { CreateScheduleInput, JourSemaine } from "@/lib/types/academics";
import { getDesktopDb } from "./desktop-db";

export interface QueueOfflineScheduleInput extends CreateScheduleInput {
  etablissementId: number;
}

interface OfflineScheduleRow {
  id: string;
  classe_id: number;
  matiere_id: number | null;
  enseignant_id: number | null;
  salle_id: number | null;
  jour: JourSemaine;
  heure_debut: string;
  heure_fin: string;
  libelle: string | null;
}

/** Met en file la création d'un créneau d'emploi du temps — le conflit de salle/enseignant/classe
 * (voir EmploiDuTempsService côté serveur) ne peut être détecté qu'au rejeu (`pushOfflineSchedules`),
 * jamais localement : un refus à la synchro reste visible (voir `desktop-offline-banner.tsx`),
 * jamais silencieux. */
export async function queueOfflineSchedule(input: QueueOfflineScheduleInput): Promise<string> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO emplois_du_temps_offline
       (id, etablissement_id, classe_id, matiere_id, enseignant_id, salle_id, jour, heure_debut, heure_fin, libelle, synced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)`,
    [
      id, input.etablissementId, input.schoolClassId, input.subjectId, input.teacherId,
      input.roomId, input.day, input.startTime, input.endTime, input.label ?? null,
    ],
  );
  return id;
}

export async function pushOfflineSchedules(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflineScheduleRow[]>(
    "SELECT * FROM emplois_du_temps_offline WHERE synced = 0 ORDER BY jour ASC, heure_debut ASC",
  );

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await createSchedule({
        schoolClassId: row.classe_id,
        subjectId: row.matiere_id,
        teacherId: row.enseignant_id,
        roomId: row.salle_id,
        day: row.jour,
        startTime: row.heure_debut,
        endTime: row.heure_fin,
        label: row.libelle,
      });
      await db.execute("UPDATE emplois_du_temps_offline SET synced = 1 WHERE id = $1", [row.id]);
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE emplois_du_temps_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE id = $2",
        [message, row.id],
      );
    }
  }
  return { synced, failed };
}
