/**
 * Réexport fin de `lib/api/billing.ts` (source de vérité inchangée — 12 importeurs hors périmètre
 * flagship, ex. `dashboard/rentree`). Voir §2 étape 7 du plan de refonte admin.
 */
export {
  listInvoicesByTenant,
  listInvoicesByStatus,
  listInvoicesByStudent,
  listFeesByTenant,
} from "@/lib/api/billing";
