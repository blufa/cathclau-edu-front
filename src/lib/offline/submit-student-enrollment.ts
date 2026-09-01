import { createStudent } from "@/lib/api/students";
import { isNetworkError } from "@/lib/api/errors";
import type { CreateStudentInput, Student } from "@/lib/types/student";
import { useNetworkStore } from "./network-store";
import { enqueueStudent } from "./sync-engine";
import type { QueuedEnrollment } from "./db";

export type StudentEnrollmentAttempt =
  | { outcome: "online"; student: Student }
  | { outcome: "queued"; entry: QueuedEnrollment };

/**
 * Point d'entrée unique pour la création d'un élève (features/students/components/list-page.tsx) :
 * tente l'appel réel en premier, ne bascule sur la file d'attente locale (`enqueueStudent`) que si
 * l'appel échoue pour une raison réseau (`ApiError.status === 0`) — une vraie erreur métier (quota 403,
 * validation) remonte normalement, jamais mise en file. L'inscription (classe/année) est ajoutée
 * séparément une fois l'élève créé/mis en file, voir attachEnrollmentToQueuedStudent.
 */
export async function submitStudentOfflineAware(input: CreateStudentInput): Promise<StudentEnrollmentAttempt> {
  if (useNetworkStore.getState().online) {
    try {
      const student = await createStudent({ ...input, idempotencyKey: crypto.randomUUID() });
      return { outcome: "online", student };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  // enqueueStudent génère sa propre clé d'idempotence (utilisée aussi comme id local de l'entrée).
  return { outcome: "queued", entry: await enqueueStudent(input) };
}
