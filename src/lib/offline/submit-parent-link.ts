import { createParent, linkParentToStudent, type ParentInput, type Relationship } from "@/lib/api/parents";
import { isNetworkError } from "@/lib/api/errors";
import { useNetworkStore } from "./network-store";
import { enqueueExistingParentLink, enqueueNewParent } from "./sync-engine";
import type { QueuedParent } from "./db";

export type ParentLinkAttempt = { outcome: "online" } | { outcome: "queued"; entry: QueuedParent };

/**
 * Créer un nouveau parent puis le lier à un élève réel (`AddParentForm.createAndLink`) : tente l'appel
 * réel en premier, ne bascule sur la file d'attente locale que si l'appel échoue pour une raison
 * réseau. La création d'un compte portail (« créer un accès ») reste exclue du mode hors-ligne — voir
 * l'appelant, qui doit bloquer cette option avant même d'appeler cette fonction si hors-ligne.
 */
export async function submitNewParentOfflineAware(
  input: ParentInput, studentId: number, relationship: Relationship,
  /** Compte portail déjà créé en ligne (« créer un accès ») — toujours null hors-ligne, voir l'appelant. */
  userId: number | null = null,
): Promise<ParentLinkAttempt> {
  if (useNetworkStore.getState().online) {
    let createdParentId: number | null = null;
    try {
      const parent = await createParent({ ...input, idempotencyKey: crypto.randomUUID() }, userId);
      createdParentId = parent.id;
      await linkParentToStudent(parent.id, studentId, relationship);
      return { outcome: "online" };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Le parent a bien été créé (id réel obtenu) mais le lien a échoué juste après pour une raison
      // réseau : mettre en file la LIAISON de ce parent existant, jamais une nouvelle création (qui
      // créerait un second parent en double une fois reconnecté).
      if (createdParentId != null) {
        return { outcome: "queued", entry: await enqueueExistingParentLink(createdParentId, studentId, relationship) };
      }
    }
  }
  return { outcome: "queued", entry: await enqueueNewParent(input, studentId, relationship) };
}

/** Lier un parent DÉJÀ EXISTANT à un élève réel (`AddParentForm.linkExisting`) — même stratégie. */
export async function submitExistingParentLinkOfflineAware(
  parentId: number, studentId: number, relationship: Relationship,
): Promise<ParentLinkAttempt> {
  if (useNetworkStore.getState().online) {
    try {
      await linkParentToStudent(parentId, studentId, relationship);
      return { outcome: "online" };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  return { outcome: "queued", entry: await enqueueExistingParentLink(parentId, studentId, relationship) };
}
