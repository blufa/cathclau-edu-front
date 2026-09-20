import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type {
  BillingPeriod,
  CreateTenantInput,
  Plan,
  PlanChange,
  PlanInput,
  PlatformFeeSettlement,
  PlatformUser,
  Prefecture,
  PrefectureInput,
  SchoolBranding,
  SignupInput,
  SignupResult,
  Subscription,
  SubscriptionInvoice,
  SubscriptionPayment,
  Tenant,
  TenantDetail,
  TenantStatus,
  UpdateTenantInput,
  PaymentChannel,
  PaymentType,
  ModuleInfo,
  PlanModule,
  TenantModule,
} from "@/lib/types/platform";

// ── Public: plans (tarifs) ───────────────────────────────────────────────────
export function listPlans(): Promise<Plan[]> {
  return api.get<Plan[]>("/platform/plans", { auth: false });
}

// ── Public: self-service signup & verification ───────────────────────────────
export function signup(input: SignupInput): Promise<SignupResult> {
  return api.post<SignupResult>("/public/signup", input, { auth: false });
}

export function verifyEmail(token: string): Promise<void> {
  return api.post<void>("/public/verify-email", { token }, { auth: false });
}

export function resendVerification(email: string): Promise<void> {
  return api.post<void>("/public/resend-verification", { email }, { auth: false });
}

// ── Self-service: the school admin reads/updates its own information ──────────
export interface SchoolProfile {
  id: number;
  schoolName: string;
  slug: string;
  email: string | null;
  phone: string | null;
  logo: string | null;
  brandColor: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  director: string | null;
  accreditationNumber: string | null;
  openingAuthorization: string | null;
  /** Devise de l'établissement (phrase courte et formelle) — imprimée au verso des badges/cartes,
   * et sous le nom de l'école dans l'en-tête des documents PDF générés. */
  motto: string | null;
  /** Slogan de l'établissement, imprimé au verso des badges/cartes. */
  slogan: string | null;
  /** Inspection Régionale de l'Éducation de rattachement (ex. "KINDIA") — en-tête officiel des
   * documents pédagogiques (bulletins, fiches de note...). */
  ire: string | null;
  /** Direction Préfectorale de l'Éducation de rattachement (ex. "COYAH"). */
  dpeLabel: string | null;
  /** Direction Sous-préfectorale/communale de l'Éducation de rattachement (ex. "MANGATA"). */
  sousPrefectureLabel: string | null;
  /** Numéro marchand de reversement (Mobile Money) où la plateforme reverse les fonds de l'école. */
  payoutMerchantNumber: string | null;
  /** Opérateur du numéro marchand (ORANGE_MONEY, MTN_MONEY, WAVE…). */
  payoutOperator: string | null;
  /** Nom du titulaire du compte marchand. */
  payoutAccountName: string | null;
  status?: TenantStatus;
  trialEndsAt?: string | null;
  activatedAt?: string | null;
}

export type SchoolProfileInput = Pick<
  SchoolProfile,
  "schoolName" | "logo" | "brandColor" | "address" | "city" | "country" | "phone" | "email"
  | "website" | "director" | "accreditationNumber" | "openingAuthorization" | "motto" | "slogan"
  | "ire" | "dpeLabel" | "sousPrefectureLabel"
  | "payoutMerchantNumber" | "payoutOperator" | "payoutAccountName"
>;

export function getSchoolProfile(): Promise<SchoolProfile> {
  return api.get<SchoolProfile>("/school/profile");
}

export function updateSchoolProfile(input: SchoolProfileInput): Promise<SchoolProfile> {
  return api.put<SchoolProfile>("/school/profile", input);
}

export function getSchoolBranding(slug: string): Promise<SchoolBranding> {
  return api.get<SchoolBranding>(`/public/ecoles/${encodeURIComponent(slug)}/branding`, { auth: false });
}

// ── Connected: current tenant subscription (ADMIN_ECOLE) ─────────────────────
/** Returns the current tenant's subscription, or null when there is none (404). */
export async function getCurrentSubscription(): Promise<Subscription | null> {
  try {
    return await api.get<Subscription>("/platform/subscriptions/active");
  } catch (err) {
    if (typeof err === "object" && err && "status" in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

/** The tenant's latest subscription whatever its status (incl. PENDING awaiting payment), or null. */
export async function getLatestSubscription(): Promise<Subscription | null> {
  try {
    return await api.get<Subscription>("/platform/subscriptions/current");
  } catch (err) {
    if (typeof err === "object" && err && "status" in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

export function getMyInvoices(): Promise<SubscriptionInvoice[]> {
  return api.get<SubscriptionInvoice[]>("/platform/subscriptions/active/invoices");
}

export function setAutoRenewal(subscriptionId: number, enabled: boolean): Promise<void> {
  return api.patch<void>(`/platform/subscriptions/${subscriptionId}/auto-renewal`, undefined, {
    query: { enabled },
  });
}

export function changePlan(
  subscriptionId: number,
  newPlanId: number,
  newBillingPeriod: BillingPeriod,
): Promise<void> {
  return api.post<void>(`/platform/subscriptions/${subscriptionId}/change-plan`, {
    newPlanId,
    newBillingPeriod,
  });
}

export function getPlanChanges(subscriptionId: number): Promise<PlanChange[]> {
  return api.get<PlanChange[]>(`/platform/subscriptions/${subscriptionId}/plan-changes`);
}

export function getSubscriptionInvoices(subscriptionId: number): Promise<SubscriptionInvoice[]> {
  return api.get<SubscriptionInvoice[]>(`/platform/subscriptions/${subscriptionId}/invoices`);
}

// ── Payment ──────────────────────────────────────────────────────────────────
export interface InitiatePaymentInput {
  invoiceId: number;
  amount: string;
  channel: PaymentChannel;
  paymentType: PaymentType;
  payerNumber?: string;
}

export function initiatePayment(
  subscriptionId: number,
  input: InitiatePaymentInput,
): Promise<SubscriptionPayment> {
  return api.post<SubscriptionPayment>(`/platform/subscriptions/${subscriptionId}/payments`, input);
}

export function getPayment(paymentId: number): Promise<SubscriptionPayment> {
  return api.get<SubscriptionPayment>(`/platform/subscriptions/payments/${paymentId}`);
}

/** Confirme et active l'abonnement en interrogeant Djomy à la demande (sans attendre le webhook). */
export function confirmPaymentViaDjomy(paymentId: number): Promise<SubscriptionPayment> {
  return api.post<SubscriptionPayment>(`/platform/subscriptions/payments/${paymentId}/confirm-djomy`);
}

export function getInvoicePdfUrl(invoiceId: number): Promise<{ pdfUrl: string }> {
  return api.get<{ pdfUrl: string }>(`/platform/subscriptions/invoices/${invoiceId}/pdf`);
}

export function markSubscriptionPaymentFailed(paymentId: number): Promise<SubscriptionPayment> {
  return api.put<SubscriptionPayment>(`/platform/subscriptions/payments/${paymentId}/fail`);
}

export function getSubscriptionPaymentDjomyStatus(
  paymentId: number,
): Promise<{ status?: string | null; providerStatus?: string | null }> {
  return api.get<{ status?: string | null; providerStatus?: string | null }>(
    `/platform/subscriptions/payments/${paymentId}/djomy-status`,
  );
}

export function getReceiptPdfUrl(receiptId: number): Promise<{ pdfUrl: string }> {
  return api.get<{ pdfUrl: string }>(`/platform/subscriptions/receipts/${receiptId}/pdf`);
}

// ── SUPER_ADMIN: tenants ─────────────────────────────────────────────────────
export interface TenantSearchParams {
  status?: string;
  city?: string;
  page?: number;
  size?: number;
}

export function searchTenants(params: TenantSearchParams): Promise<Page<Tenant>> {
  return api.get<Page<Tenant>>("/platform/tenants", {
    query: { status: params.status || undefined, city: params.city || undefined, page: params.page, size: params.size },
  });
}

export function getTenantDetail(id: number): Promise<TenantDetail> {
  return api.get<TenantDetail>(`/platform/tenants/${id}`);
}

export function createTenant(input: CreateTenantInput): Promise<Tenant> {
  return api.post<Tenant>("/platform/tenants", input);
}

export function updateTenant(id: number, input: UpdateTenantInput): Promise<Tenant> {
  return api.put<Tenant>(`/platform/tenants/${id}`, input);
}

/** Change the school status via the lifecycle state machine (ACTIVATE | SUSPEND | ARCHIVE). */
export function changeTenantStatus(id: number, action: "ACTIVATE" | "SUSPEND" | "ARCHIVE"): Promise<void> {
  return api.patch<void>(`/platform/tenants/${id}/status`, undefined, { query: { action } });
}

export function deleteTenant(id: number): Promise<void> {
  return api.delete<void>(`/platform/tenants/${id}`);
}

/** Tous les utilisateurs, toutes écoles confondues (ou d'une seule école si `tenantId` est fourni). */
export function listPlatformUsers(tenantId?: number): Promise<PlatformUser[]> {
  return api.get<PlatformUser[]>("/platform/users", { query: { tenantId } });
}

// ── SUPER_ADMIN: plans CRUD ──────────────────────────────────────────────────
export function createPlan(input: PlanInput): Promise<Plan> {
  return api.post<Plan>("/platform/plans", input);
}

export function updatePlan(id: number, input: Omit<PlanInput, "code">): Promise<Plan> {
  return api.put<Plan>(`/platform/plans/${id}`, input);
}

export function archivePlan(id: number): Promise<Plan> {
  return api.patch<Plan>(`/platform/plans/${id}/archive`);
}

export function deletePlan(id: number): Promise<void> {
  return api.delete<void>(`/platform/plans/${id}`);
}

export function setPlanDefaultTrial(id: number): Promise<Plan> {
  return api.patch<Plan>(`/platform/plans/${id}/definir-trial-defaut`);
}

/** Détail public d'un plan par son code (page tarifs). */
export function getPlanByCode(code: string): Promise<Plan> {
  return api.get<Plan>(`/platform/plans/code/${encodeURIComponent(code)}`, { auth: false });
}

// ── SUPER_ADMIN: dashboard plateforme (§10) ──────────────────────────────────
export interface PlatformDashboard {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  archivedTenants: number;
  totalSubscriptions: number;
  subscriptionsByStatus: Record<string, number>;
  subscriptionsByPlan: Record<string, number>;
  mrr: string;
  arr: string;
  expiringSoon: number;
  churnRate: number;
  paymentsThisMonth: number;
  revenueThisMonth: string;
}

export function getPlatformDashboard(): Promise<PlatformDashboard> {
  return api.get<PlatformDashboard>("/platform/dashboard");
}

// ── SUPER_ADMIN: functional modules (module M) ───────────────────────────────
export function listModuleCatalog(): Promise<ModuleInfo[]> {
  return api.get<ModuleInfo[]>("/platform/modules");
}

export function listPlanModules(planId: number): Promise<PlanModule[]> {
  return api.get<PlanModule[]>(`/platform/plans/${planId}/modules`);
}

export function addPlanModule(planId: number, moduleCode: string): Promise<PlanModule> {
  return api.post<PlanModule>(`/platform/plans/${planId}/modules`, { moduleCode });
}

export function removePlanModule(planId: number, moduleCode: string): Promise<void> {
  return api.delete<void>(`/platform/plans/${planId}/modules/${moduleCode}`);
}

export function setPlanModuleActive(planId: number, moduleCode: string, active: boolean): Promise<PlanModule> {
  return api.patch<PlanModule>(`/platform/plans/${planId}/modules/${moduleCode}/${active ? "activer" : "desactiver"}`);
}

export function listTenantModules(tenantId: number): Promise<TenantModule[]> {
  return api.get<TenantModule[]>(`/platform/tenants/${tenantId}/modules`);
}

export function setTenantModuleActive(
  tenantId: number,
  moduleCode: string,
  active: boolean,
  expiration?: string,
): Promise<TenantModule> {
  const suffix = active ? "activer" : "desactiver";
  return api.patch<TenantModule>(`/platform/tenants/${tenantId}/modules/${moduleCode}/${suffix}`, undefined, {
    query: active && expiration ? { expiration } : undefined,
  });
}

/** Preset « comptabilité seule » : active IAM + Comptabilité + Dépenses, désactive tout le reste. */
export function presetTenantAccountingOnly(tenantId: number): Promise<TenantModule[]> {
  return api.post<TenantModule[]>(`/platform/tenants/${tenantId}/modules/preset/comptabilite`);
}

// ── SUPER_ADMIN: subscriptions supervision ───────────────────────────────────
export interface SubscriptionSearchParams {
  status?: string;
  planId?: number;
  page?: number;
  size?: number;
}

export function searchSubscriptions(params: SubscriptionSearchParams): Promise<Page<Subscription>> {
  return api.get<Page<Subscription>>("/platform/subscriptions", {
    query: { status: params.status || undefined, planId: params.planId, page: params.page, size: params.size },
  });
}

export function initiateSubscription(input: {
  tenantId: number;
  planId: number;
  billingPeriod: BillingPeriod;
  autoRenewal?: boolean;
}): Promise<Subscription> {
  return api.post<Subscription>("/platform/subscriptions", input);
}

/** Self-service: the current school subscribes to a paid plan (EN_ATTENTE + invoice, pay via Djomy). */
export function subscribeSelf(input: {
  planId: number;
  billingPeriod: BillingPeriod;
  autoRenewal?: boolean;
}): Promise<Subscription> {
  return api.post<Subscription>("/platform/subscriptions/subscribe", input);
}

export function suspendSubscription(id: number): Promise<void> {
  return api.patch<void>(`/platform/subscriptions/${id}/suspend`);
}

export function cancelSubscription(id: number): Promise<void> {
  return api.patch<void>(`/platform/subscriptions/${id}/cancel`);
}

export function listAllSubscriptionInvoices(status?: string): Promise<SubscriptionInvoice[]> {
  return api.get<SubscriptionInvoice[]>("/platform/subscription-invoices", {
    query: { status: status || undefined },
  });
}

export function resendInvoice(id: number): Promise<SubscriptionInvoice> {
  return api.post<SubscriptionInvoice>(`/platform/subscription-invoices/${id}/resend`);
}

// ── Frais d'usage plateforme (frais annexe configuré par chaque école ; SUPER_ADMIN ne voit que le
// tableau des soldes dus, réglés ensuite par l'école via Djomy) ────────────────────────────────
export function getPlatformFeeBalance(): Promise<{ balance: string }> {
  return api.get<{ balance: string }>("/platform-fee/balance");
}

/** SUPER_ADMIN : combien chaque école doit actuellement à la plateforme (encaissé − déjà réglé). */
export interface PlatformFeeTenantBalance {
  tenantId: number;
  tenantName: string | null;
  collected: string | number;
  settled: string | number;
  balance: string | number;
}
export function listPlatformFeeBalancesByTenant(): Promise<PlatformFeeTenantBalance[]> {
  return api.get<PlatformFeeTenantBalance[]>("/platform/frais-plateforme/soldes");
}

export function initiatePlatformFeeSettlement(payerNumber: string): Promise<PlatformFeeSettlement> {
  return api.post<PlatformFeeSettlement>("/platform-fee/settlements", { payerNumber });
}

export function confirmPlatformFeeSettlementViaDjomy(id: number): Promise<PlatformFeeSettlement> {
  return api.post<PlatformFeeSettlement>(`/platform-fee/settlements/${id}/confirm-djomy`);
}

export function listPlatformFeeSettlements(): Promise<PlatformFeeSettlement[]> {
  return api.get<PlatformFeeSettlement[]>("/platform-fee/settlements");
}

// ── Préfectures/communes DPE/DCE (SUPER_ADMIN) ──────────────────────────────────
export function listPrefectures(): Promise<Prefecture[]> {
  return api.get<Prefecture[]>("/platform/prefectures");
}

export function getPrefecture(id: number): Promise<Prefecture> {
  return api.get<Prefecture>(`/platform/prefectures/${id}`);
}

export function createPrefecture(input: PrefectureInput): Promise<Prefecture> {
  return api.post<Prefecture>("/platform/prefectures", input);
}

export function updatePrefecture(id: number, input: PrefectureInput): Promise<Prefecture> {
  return api.put<Prefecture>(`/platform/prefectures/${id}`, input);
}

export function archivePrefecture(id: number): Promise<Prefecture> {
  return api.patch<Prefecture>(`/platform/prefectures/${id}/archiver`);
}

export function reactivatePrefecture(id: number): Promise<Prefecture> {
  return api.patch<Prefecture>(`/platform/prefectures/${id}/reactiver`);
}

export function listPrefectureSchools(id: number): Promise<Tenant[]> {
  return api.get<Tenant[]>(`/platform/prefectures/${id}/ecoles`);
}

export function assignSchoolToPrefecture(id: number, tenantId: number): Promise<Tenant> {
  return api.put<Tenant>(`/platform/prefectures/${id}/ecoles/${tenantId}`);
}

export function unassignSchoolFromPrefecture(tenantId: number): Promise<void> {
  return api.delete<void>(`/platform/prefectures/ecoles/${tenantId}`);
}

export function listPrefectureUserIds(id: number): Promise<number[]> {
  return api.get<number[]>(`/platform/prefectures/${id}/utilisateurs`);
}

export function assignUserToPrefecture(id: number, userId: number): Promise<void> {
  return api.post<void>(`/platform/prefectures/${id}/utilisateurs`, { userId });
}

export function unassignUserFromPrefecture(id: number, userId: number): Promise<void> {
  return api.delete<void>(`/platform/prefectures/${id}/utilisateurs/${userId}`);
}
