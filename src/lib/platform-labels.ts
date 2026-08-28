/** French labels + badge tones for platform / billing-subscription enums. */

import type {
  BillingPeriod,
  EstablishmentType,
  InvoiceStatus,
  PaymentChannel,
  PaymentStatus,
  PlanChangeType,
  SubscriptionStatus,
  TenantStatus,
} from "@/lib/types/platform";

type Tone = "gray" | "green" | "amber" | "red" | "indigo" | "blue";

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  PENDING_VERIFICATION: "En attente de vérification",
  TRIAL: "Essai gratuit",
  ACTIVE: "Active",
  SUSPENDED: "Suspendue",
  EXPIRED: "Expirée",
  ARCHIVED: "Archivée",
  TERMINATED: "Résiliée",
};

export const TENANT_STATUS_TONE: Record<TenantStatus, Tone> = {
  PENDING_VERIFICATION: "amber",
  TRIAL: "blue",
  ACTIVE: "green",
  SUSPENDED: "red",
  EXPIRED: "amber",
  ARCHIVED: "gray",
  TERMINATED: "gray",
};

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  EXPIRED: "Expiré",
  CANCELLED: "Annulé",
};

export const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, Tone> = {
  PENDING: "amber",
  ACTIVE: "green",
  SUSPENDED: "red",
  EXPIRED: "amber",
  CANCELLED: "gray",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Brouillon",
  ISSUED: "Émise",
  PAID: "Payée",
  PARTIAL: "Partielle",
  OVERDUE: "Impayée",
  CANCELLED: "Annulée",
};

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, Tone> = {
  DRAFT: "gray",
  ISSUED: "blue",
  PAID: "green",
  PARTIAL: "amber",
  OVERDUE: "red",
  CANCELLED: "gray",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  INITIATED: "Initié",
  PENDING: "En attente",
  SUCCESSFUL: "Réussi",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  INITIATED: "gray",
  PENDING: "amber",
  SUCCESSFUL: "green",
  FAILED: "red",
  REFUNDED: "blue",
};

export const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  MONTHLY: "Mensuel",
  ANNUAL: "Annuel",
};

export const ESTABLISHMENT_TYPE_LABEL: Record<EstablishmentType, string> = {
  MATERNELLE: "Maternelle (Petite, Moyenne, Grande Section)",
  PRIMAIRE: "Primaire",
  COLLEGE: "Collège",
  LYCEE: "Lycée",
  SUPERIEUR: "Supérieur",
  MIXTE: "Mixte",
};

export const PLAN_CHANGE_TYPE_LABEL: Record<PlanChangeType, string> = {
  UPGRADE: "Mise à niveau",
  DOWNGRADE: "Rétrogradation",
  RENEWAL: "Renouvellement",
};

export const PAYMENT_CHANNEL_LABEL: Record<PaymentChannel, string> = {
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN MoMo",
  WAVE: "Wave",
  VISA: "Visa",
  MASTERCARD: "MasterCard",
  DJOMY: "Djomy",
};

/** Channels that need a payer phone number (mobile money / aggregator). */
export const MOBILE_MONEY_CHANNELS: PaymentChannel[] = ["ORANGE_MONEY", "MTN_MONEY", "WAVE", "DJOMY"];
