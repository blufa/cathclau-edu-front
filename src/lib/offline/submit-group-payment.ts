import { initiateGroupPayment, type GroupPaymentInput } from "@/lib/api/payment";
import { isNetworkError } from "@/lib/api/errors";
import type { InitiatePaymentResponse } from "@/lib/types/payment";
import { isDeskManualChannel } from "./payment-channels";
import { useNetworkStore } from "./network-store";
import { enqueuePayment } from "./sync-engine";
import type { QueuedGroupPayment } from "./db";
import { isDesktop } from "./desktop-runtime";
import { queueOfflineEncaissement } from "./desktop-payments";
import { getCurrentUserId } from "@/lib/auth/tokens";

export type GroupPaymentAttempt =
  | { outcome: "online"; response: InitiatePaymentResponse }
  | { outcome: "queued"; entry: QueuedGroupPayment }
  | { outcome: "queued-desktop"; ids: string[] };

/**
 * Point d'entrée unique pour un encaissement groupé (CollectFeeModal / MultiChildCollectModal) :
 * tente l'appel réel en premier, ne bascule sur la file d'attente locale que si l'appel échoue pour
 * une raison réseau (`ApiError.status === 0`) ET que le canal est encaissé au guichet (espèces, Orange
 * Money, virement) — une vraie erreur métier (422, 403…) remonte normalement, jamais mise en file.
 * Les canaux fournisseur en ligne (DJOMY, MTN Money, Wave) ne sont jamais mis en file : par nature, un
 * paiement en ligne ne peut pas aboutir sans réseau.
 *
 * Sur desktop (Tauri), la file locale est SQLite (`encaissements_offline`, une ligne par part/facture)
 * plutôt qu'IndexedDB — jamais les deux dans le même environnement, voir `desktop-runtime.ts`.
 */
export async function submitGroupPaymentOfflineAware(input: GroupPaymentInput): Promise<GroupPaymentAttempt> {
  if (!isDeskManualChannel(input.channel)) {
    return { outcome: "online", response: await initiateGroupPayment(input) };
  }
  if (useNetworkStore.getState().online) {
    try {
      return { outcome: "online", response: await initiateGroupPayment(input) };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  if (isDesktop()) {
    // Qui encaisse réellement, capturé MAINTENANT (pas à la synchro, potentiellement sous une session
    // différente si le poste a changé d'utilisateur entre-temps) — §retour comptable.
    const collecteParUserId = getCurrentUserId();
    const datePaiement = new Date().toISOString();
    const ids = await Promise.all(
      input.shares.map((share) =>
        queueOfflineEncaissement({
          etablissementId: input.tenantId ?? 0,
          eleveId: share.studentId ?? input.studentId,
          factureId: share.invoiceId,
          montant: share.amount,
          modePaiement: input.channel as "CASH" | "ORANGE_MONEY" | "BANK_CARD",
          collecteParUserId,
          datePaiement,
        }),
      ),
    );
    return { outcome: "queued-desktop", ids };
  }
  return { outcome: "queued", entry: await enqueuePayment(input) };
}
