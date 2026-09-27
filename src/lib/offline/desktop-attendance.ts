import {
  scanAttendance,
  recordStudentManualEntry, recordStudentManualExit,
  recordTeacherManualEntry, recordTeacherManualExit,
  recordEmployeeManualEntry, recordEmployeeManualExit,
  type ScanSubjectType,
} from "@/lib/api/attendance";
import type { ScanDirection } from "@/lib/types/attendance";
import { getDesktopDb } from "./desktop-db";

export interface QueueOfflinePresenceInput {
  etablissementId: number;
  typeSujet: ScanSubjectType;
  sujetId: number;
  /** Scan badge (entrée/sortie) — laisser `manuel` à false. */
  direction?: ScanDirection;
  /** Correction manuelle (chef de classe/personnel, badge oublié) — direction déduite de `manuel`. */
  manuel?: { direction: ScanDirection; date: string; heure: string };
}

interface OfflinePresenceRow {
  id: string;
  type_sujet: ScanSubjectType;
  sujet_id: number;
  direction: ScanDirection | null;
  date_action: string;
  heure: string | null;
  saisie_manuelle: number;
}

export async function queueOfflinePresence(input: QueueOfflinePresenceInput): Promise<string> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  const now = new Date();
  const manuel = input.manuel ?? null;
  await db.execute(
    `INSERT INTO presences_offline
       (id, etablissement_id, type_sujet, sujet_id, direction, date_action, heure, saisie_manuelle, synced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
    [
      id, input.etablissementId, input.typeSujet, input.sujetId,
      manuel?.direction ?? input.direction ?? null,
      manuel?.date ?? now.toISOString().slice(0, 10),
      manuel?.heure ?? null,
      manuel ? 1 : 0,
    ],
  );
  return id;
}

/** Rejoue les présences en attente — même mapping que `replayAttendanceAction` côté web
 * (`sync-engine.ts`) : un scan rejoué est nécessairement horodaté par le serveur au moment du rejeu
 * (pas de rétrodatation possible sur `/attendance/scan`, limitation déjà acceptée côté web), tandis
 * qu'une saisie manuelle conserve la date/heure d'origine saisie par l'agent. */
export async function pushOfflinePresences(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflinePresenceRow[]>(
    "SELECT * FROM presences_offline WHERE synced = 0 ORDER BY date_action ASC, heure ASC",
  );

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (!row.saisie_manuelle) {
        if (!row.direction) throw new Error("Scan sans direction — ligne corrompue");
        await scanAttendance({ subjectType: row.type_sujet, subjectId: row.sujet_id, direction: row.direction });
      } else if (row.direction === "EXIT") {
        if (row.type_sujet === "TEACHER") await recordTeacherManualExit(row.sujet_id, row.date_action, row.heure ?? "00:00");
        else if (row.type_sujet === "EMPLOYEE") await recordEmployeeManualExit(row.sujet_id, row.date_action, row.heure ?? "00:00");
        else await recordStudentManualExit(row.sujet_id, row.date_action, row.heure ?? "00:00");
      } else {
        if (row.type_sujet === "TEACHER") await recordTeacherManualEntry(row.sujet_id, row.date_action, row.heure ?? "00:00");
        else if (row.type_sujet === "EMPLOYEE") await recordEmployeeManualEntry(row.sujet_id, row.date_action, row.heure ?? "00:00");
        else await recordStudentManualEntry(row.sujet_id, row.date_action, row.heure ?? "00:00");
      }
      await db.execute("UPDATE presences_offline SET synced = 1 WHERE id = $1", [row.id]);
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE presences_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE id = $2",
        [message, row.id],
      );
    }
  }
  return { synced, failed };
}
