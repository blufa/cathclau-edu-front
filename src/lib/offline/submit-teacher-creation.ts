import { createTeacher } from "@/lib/api/staff";
import { isNetworkError } from "@/lib/api/errors";
import type { CreateTeacherInput } from "@/lib/types/staff";
import type { Teacher } from "@/lib/types/staff";
import { useNetworkStore } from "./network-store";
import { enqueueTeacher } from "./sync-engine";
import type { QueuedTeacher } from "./db";

export type TeacherCreationAttempt =
  | { outcome: "online"; teacher: Teacher }
  | { outcome: "queued"; entry: QueuedTeacher };

/**
 * Point d'entrée unique pour la création d'un enseignant (`/teachers`) : tente l'appel réel en
 * premier, ne bascule sur la file d'attente locale que si l'appel échoue pour une raison réseau —
 * une vraie erreur métier (matricule dupliqué, validation) remonte normalement, jamais mise en file.
 */
export async function submitTeacherOfflineAware(input: CreateTeacherInput): Promise<TeacherCreationAttempt> {
  if (useNetworkStore.getState().online) {
    try {
      const teacher = await createTeacher({ ...input, idempotencyKey: crypto.randomUUID() });
      return { outcome: "online", teacher };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  return { outcome: "queued", entry: await enqueueTeacher(input) };
}
