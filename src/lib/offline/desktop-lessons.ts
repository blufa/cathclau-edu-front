import { createLesson, markLessonDone } from "@/lib/api/lessons";
import type { LessonStatus } from "@/lib/types/lesson";
import { getDesktopDb } from "./desktop-db";

export interface QueueOfflineLessonInput {
  etablissementId: number;
  classeId: number;
  matiereId: number | null;
  enseignantId: number | null;
  dateSeance: string;
  titre: string;
  contenu?: string | null;
  devoirs?: string | null;
  dureeMinutes?: number | null;
  statut?: LessonStatus;
}

interface OfflineLessonRow {
  id: string;
  id_serveur: number | null;
  classe_id: number;
  matiere_id: number | null;
  enseignant_id: number | null;
  date_seance: string;
  titre: string;
  contenu: string | null;
  devoirs: string | null;
  duree_minutes: number | null;
  statut: LessonStatus;
}

/** Ouvre ou complète une entrée de cahier de texte hors ligne — l'enseignant programme une séance
 * (`statut: "PLANNED"`) et/ou la clôture après l'avoir donnée (`statut: "DONE"`, avec la durée
 * réellement réalisée) sans jamais avoir eu besoin de réseau entre les deux. */
export async function queueOfflineLesson(input: QueueOfflineLessonInput): Promise<string> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO seances_offline
       (id, etablissement_id, classe_id, matiere_id, enseignant_id, date_seance, titre, contenu, devoirs, duree_minutes, statut, synced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
    [
      id, input.etablissementId, input.classeId, input.matiereId, input.enseignantId,
      input.dateSeance, input.titre, input.contenu ?? null, input.devoirs ?? null,
      input.dureeMinutes ?? null, input.statut ?? "PLANNED",
    ],
  );
  return id;
}

/** Marque une séance DÉJÀ en file (encore non synchronisée) comme réalisée — ex. l'enseignant avait
 * programmé la séance le matin hors ligne, la clôture le soir toujours hors ligne : on met simplement
 * à jour la ligne locale, encore une seule ligne à envoyer, plutôt que d'empiler une seconde entrée. */
export async function markOfflineLessonDone(localId: string, realizedDurationMinutes?: number | null): Promise<void> {
  const db = await getDesktopDb();
  await db.execute(
    "UPDATE seances_offline SET statut = 'DONE', duree_minutes = COALESCE($1, duree_minutes) WHERE id = $2",
    [realizedDurationMinutes ?? null, localId],
  );
}

/** Rejoue le cahier de texte : `createLesson` pour toute ligne pas encore connue du serveur (même si
 * elle est déjà `DONE` — créée directement dans son état final en un seul appel), puis `markLessonDone`
 * pour une ligne déjà créée en ligne (`id_serveur` connu) qu'on vient seulement de clôturer. */
export async function pushOfflineLessons(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflineLessonRow[]>(
    "SELECT * FROM seances_offline WHERE synced = 0 ORDER BY date_seance ASC",
  );

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (row.id_serveur == null) {
        const created = await createLesson({
          classId: row.classe_id,
          subjectId: row.matiere_id,
          teacherId: row.enseignant_id,
          lessonDate: row.date_seance,
          title: row.titre,
          content: row.contenu,
          homework: row.devoirs,
          durationMinutes: row.duree_minutes,
          status: row.statut,
        });
        await db.execute(
          "UPDATE seances_offline SET id_serveur = $1, synced = 1 WHERE id = $2",
          [created.id, row.id],
        );
      } else {
        if (row.statut === "DONE") await markLessonDone(row.id_serveur, row.duree_minutes);
        await db.execute("UPDATE seances_offline SET synced = 1 WHERE id = $1", [row.id]);
      }
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE seances_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE id = $2",
        [message, row.id],
      );
    }
  }
  return { synced, failed };
}
