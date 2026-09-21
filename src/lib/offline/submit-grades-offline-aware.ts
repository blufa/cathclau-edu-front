import { enterBulkGrades } from "@/lib/api/grading";
import type { Grade } from "@/lib/types/grading";
import { isNetworkError } from "@/lib/api/errors";
import { useNetworkStore } from "./network-store";
import { enqueueGrades } from "./sync-engine";
import type { QueuedGradeEntry } from "./db";

export type GradeSubmitAttempt =
  | { outcome: "online"; result: Grade[] }
  | { outcome: "queued"; entry: QueuedGradeEntry };

/**
 * Point d'entrée unique pour la saisie en masse des notes (`GradeGrid`, §grading) : tente l'appel réel
 * en premier, ne bascule sur la file d'attente locale que si l'appel échoue pour une raison réseau —
 * une vraie erreur métier (période clôturée, note invalide) remonte normalement, jamais mise en file.
 * L'endpoint bulk est un UPSERT par élève (voir sync-engine.ts) : sans risque de rejouer la même
 * sauvegarde plusieurs fois si la connexion est instable.
 */
export async function submitGradesOfflineAware(
  assessmentId: number, grades: { studentId: number; value: number }[],
): Promise<GradeSubmitAttempt> {
  if (useNetworkStore.getState().online) {
    try {
      const result = await enterBulkGrades(assessmentId, grades);
      return { outcome: "online", result };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  return { outcome: "queued", entry: await enqueueGrades(assessmentId, grades) };
}
