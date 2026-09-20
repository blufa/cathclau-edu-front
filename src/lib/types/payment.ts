/** Payment contracts mirrored from the backend payments module. */

export type PaymentChannel = "ORANGE_MONEY" | "MTN_MONEY" | "WAVE" | "BANK_CARD" | "DJOMY" | "CASH";
export type PaymentType = "PARTIAL" | "COMPLETE";
export type PaymentStatus = "INITIATED" | "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export const PAYMENT_CHANNEL_LABEL: Record<PaymentChannel, string> = {
  CASH: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN MoMo",
  WAVE: "Wave",
  BANK_CARD: "Carte bancaire",
  DJOMY: "Djomy",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  INITIATED: "Initié",
  PENDING: "En attente",
  SUCCEEDED: "Réussi",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};

export interface Payment {
  id: number;
  tenantId: number | null;
  invoiceId: number | null;
  studentId: number;
  /** Tous les élèves couverts (fratrie, §payments) ; un seul élément pour un paiement classique. */
  studentIds?: number[] | null;
  academicYearId: number | null;
  reference: string;
  amount: string;
  channel: PaymentChannel;
  type: PaymentType;
  status: PaymentStatus;
  paidAt: string | null;
  /** Utilisateur ayant physiquement encaissé (canal CASH uniquement, null sinon) — « Opérateur » du reçu. */
  collectedByUserId?: number | null;
}

/** Rapport « encaissements par comptable » (rapprochement de caisse). */
export interface CashierCollectionsSummary {
  cashierId: number;
  total: string;
  payments: Payment[];
}

/** Ligne du rapport « encaissements par jour » (tous canaux). */
export interface DailyCollectionsLine {
  date: string;
  total: string;
  count: number;
}

/** Rapport « encaissements par jour » — vue du fondateur pour son contrôle mensuel. */
export interface DailyCollectionsReport {
  grandTotal: string;
  days: DailyCollectionsLine[];
}

export type CashierSessionStatus = "OPEN" | "CLOSED";

export interface CashierSession {
  id: number;
  tenantId: number | null;
  cashierId: number;
  openedAt: string;
  closedAt: string | null;
  systemTotal: string | null;
  physicalCount: string | null;
  discrepancy: string | null;
  notes: string | null;
  status: CashierSessionStatus;
}

export interface InitiatePaymentInput {
  tenantId?: number | null;
  invoiceId: number;
  studentId: number;
  reference: string;
  amount: number;
  channel: PaymentChannel;
  type: PaymentType;
  payerNumber?: string | null;
  /** Année scolaire de la facture réglée — évite que le paiement se retrouve mélangé aux autres années. */
  academicYearId?: number | null;
}

export interface InitiatePaymentResponse {
  payment: Payment;
  redirectUrl: string | null;
}

export interface Receipt {
  id: number;
  paymentId: number;
  reference: string;
  amount: string;
  pdfFile: string | null;
  generatedAt: string | null;
}

// ── Provider transactions (traçabilité des appels fournisseur) ───────────────
export type PaymentProvider = "ORANGE_MONEY" | "MTN_MONEY" | "WAVE" | "STRIPE" | "DJOMY";

export interface PaymentTransaction {
  id: number;
  paymentId: number;
  provider: PaymentProvider;
  externalTransactionId: string | null;
  providerStatus: string | null;
  responsePayload: string | null;
  redirectUrl: string | null;
  createdAt: string | null;
}

export interface DjomyStatusResponse {
  status: string | null;
  providerStatus: string | null;
  externalTransactionId: string | null;
}
