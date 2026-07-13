/** Platform & billing-subscription contracts, mirrored from the backend (kept in sync manually). */

// ── Enums ──────────────────────────────────────────────────────────────────
export const TENANT_STATUSES = [
  "PENDING_VERIFICATION",
  "TRIAL",
  "ACTIVE",
  "SUSPENDED",
  "EXPIRED",
  "ARCHIVED",
  "TERMINATED",
] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const ESTABLISHMENT_TYPES = ["PRIMAIRE", "COLLEGE", "LYCEE", "SUPERIEUR", "MIXTE"] as const;
export type EstablishmentType = (typeof ESTABLISHMENT_TYPES)[number];

export const PLAN_CODES = ["STARTER", "STANDARD", "PREMIUM", "COMPTABILITE"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const BILLING_PERIODS = ["MONTHLY", "ANNUAL"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const SUBSCRIPTION_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "PARTIAL", "OVERDUE", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_CHANNELS = ["ORANGE_MONEY", "MTN_MONEY", "WAVE", "VISA", "MASTERCARD", "DJOMY"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

export const PAYMENT_TYPES = ["PARTIAL", "FULL"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = ["INITIATED", "PENDING", "SUCCESSFUL", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PLAN_CHANGE_TYPES = ["UPGRADE", "DOWNGRADE", "RENEWAL"] as const;
export type PlanChangeType = (typeof PLAN_CHANGE_TYPES)[number];

// ── Resources ──────────────────────────────────────────────────────────────
export interface Plan {
  id: number;
  name: string;
  code: PlanCode;
  studentLimit: number | null;
  monthlyPrice: string | null;
  annualPrice: string | null;
  description: string | null;
  archived: boolean;
}

export interface Tenant {
  id: number;
  schoolName: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  director: string | null;
  establishmentTypes: EstablishmentType[] | null;
  status: TenantStatus;
  trialEndsAt: string | null;
  activatedAt: string | null;
  createdAt: string | null;
  /** Mot de passe temporaire généré, renvoyé une seule fois à la création ; null sinon. */
  temporaryPassword?: string | null;
}

export interface TenantDetail {
  tenant: Tenant;
  currentSubscriptionId: number | null;
  subscriptionStatus: SubscriptionStatus | null;
  planId: number | null;
  planName: string | null;
  studentLimit: number | null;
  consumedStudents: number;
}

/** Utilisateur vu depuis l'espace Plateforme (toutes écoles confondues) — voir PlatformUserController. */
export interface PlatformUser {
  id: number;
  tenantId: number | null;
  firstName: string;
  lastName: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  roles: string[];
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  /** Actif dans les 5 dernières minutes. */
  online: boolean;
}

export interface Subscription {
  id: number;
  tenantId: number;
  planId: number;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  autoRenewal: boolean | null;
  amount: string;
}

export interface SubscriptionInvoice {
  id: number;
  subscriptionId: number;
  reference: string;
  billingPeriod: BillingPeriod;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  remainingBalance: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
}

export interface SubscriptionPayment {
  id: number;
  invoiceId: number;
  reference: string;
  amount: string;
  channel: PaymentChannel;
  paymentType: PaymentType;
  status: PaymentStatus;
  externalTransactionId: string | null;
  redirectUrl: string | null;
  paidAt: string | null;
}

export interface PlanChange {
  id: number;
  subscriptionId: number;
  oldPlanId: number;
  newPlanId: number;
  type: PlanChangeType;
  proratedAmount: string | null;
  effectiveDate: string;
}

// ── Public signup ────────────────────────────────────────────────────────────
export interface SignupResult {
  tenantId: number;
  slug: string;
  status: TenantStatus;
  message: string;
}

export interface SchoolBranding {
  tenantId: number;
  slug: string;
  schoolName: string;
  logo: string | null;
  brandColor: string | null;
}

// ── Input commands ──────────────────────────────────────────────────────────
export interface SignupInput {
  nomEcole: string;
  slugSouhaite?: string;
  /** Email facultatif (tout le monde n'en a pas). */
  emailDirecteur?: string;
  /** Identifiant de connexion : l'admin se connecte avec le username OU l'email. */
  username: string;
  password: string;
  directeur?: string;
  ville?: string;
  pays?: string;
  /** Un ou plusieurs types d'établissement. */
  typesEtablissement?: EstablishmentType[];
  planSouhaite?: string;
  /** Numéro marchand de reversement (facultatif à l'inscription, complétable dans les paramètres). */
  numeroMarchand?: string;
  /** Opérateur du numéro marchand (ORANGE_MONEY, MTN_MONEY, WAVE…). */
  operateurMarchand?: string;
  // Compte administrateur de l'école (obligatoire).
  prenomAdmin: string;
  nomAdmin: string;
  telephoneAdmin?: string;
}

export interface CreateTenantInput {
  schoolName: string;
  slug?: string;
  /** Email facultatif (login possible par identifiant). */
  email?: string;
  /** Identifiant de connexion de l'admin (login par username OU email) ; généré si vide. */
  username?: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  director?: string;
  establishmentTypes?: EstablishmentType[];
  initialState?: "TRIAL" | "ACTIVE";
  /** Mot de passe initial du compte admin de l'école (optionnel ; généré si vide). */
  adminPassword?: string;
}

export interface UpdateTenantInput {
  schoolName: string;
  logo?: string | null;
  brandColor?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  director?: string | null;
}

export interface PlanInput {
  name: string;
  code: PlanCode;
  studentLimit?: number | null;
  monthlyPrice?: string | null;
  annualPrice?: string | null;
  description?: string | null;
}

// ── Module M: functional modules per plan / per tenant ──────────────────────
export interface ModuleInfo {
  code: string;
  label: string;
  premium: boolean;
  dependencies: string[];
}

export interface PlanModule {
  id: number;
  planId: number;
  moduleCode: string;
  active: boolean;
}

export interface TenantModule {
  id: number;
  tenantId: number;
  moduleCode: string;
  active: boolean;
  activationDate: string | null;
  expirationDate: string | null;
}
