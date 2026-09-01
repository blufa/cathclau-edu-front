import type { PaymentChannel } from "@/lib/types/payment";

/**
 * Canaux encaissés manuellement au guichet (espèces, Orange Money, virement bancaire) : le backend les
 * confirme immédiatement sans passerelle en ligne (voir PaymentChannel.isDeskManual() côté serveur) —
 * ce sont les seuls éligibles au mode hors-ligne. DJOMY/MTN_MONEY/WAVE appellent un vrai fournisseur en
 * ligne et ne peuvent, par nature, jamais être mis en file d'attente.
 */
export function isDeskManualChannel(channel: PaymentChannel): boolean {
  return channel === "CASH" || channel === "ORANGE_MONEY" || channel === "BANK_CARD";
}
