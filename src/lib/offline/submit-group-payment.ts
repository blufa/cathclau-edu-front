import { initiateGroupPayment, type GroupPaymentInput } from "@/lib/api/payment";
import { isNetworkError } from "@/lib/api/errors";
import type { InitiatePaymentResponse } from "@/lib/types/payment";
import { isDeskManualChannel } from "./payment-channels";
import { useNetworkStore } from "./network-store";
import { enqueuePayment } from "./sync-engine";
import type { QueuedGroupPayment } from "./db";

export type GroupPaymentAttempt =
  | { outcome: "online"; response: InitiatePaymentResponse }
  | { outcome: "queued"; entry: QueuedGroupPayment };

/**
 * Point d'entrée unique pour un encaissement groupé (CollectFeeModal / MultiChildCollectModal) :
 * tente l'appel réel en premier, ne bascule sur la file d'attente locale que si l'appel échoue pour
 * une raison réseau (`ApiError.status === 0`) ET que le canal est encaissé au guichet (espèces, Orange
 * Money, virement) — une vraie erreur métier (422, 403…) remonte normalement, jamais mise en file.
 * Les canaux fournisseur en ligne (DJOMY, MTN Money, Wave) ne sont jamais mis en file : par nature, un
 * paiement en ligne ne peut pas aboutir sans réseau.
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
  return { outcome: "queued", entry: await enqueuePayment(input) };
}
