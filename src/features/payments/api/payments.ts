/**
 * Réexport fin de `lib/api/payment.ts` (source de vérité inchangée — 7 importeurs hors périmètre
 * flagship, ex. l'historique de paiement d'une fiche élève). Le feature-folder ne possède que les
 * hooks TanStack Query et les composants ; voir §2 étape 7 du plan de refonte admin.
 */
export {
  listPaymentsByTenant,
  getPaymentReceiptPdf,
  getPaymentDjomyStatus,
  refundPayment,
  listTransactions,
  listReceipts,
  getReceiptByReference,
  getReceiptPdfObjectUrlById,
  refreshReceiptStudentName,
} from "@/lib/api/payment";
