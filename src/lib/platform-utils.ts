import type { BillingPeriod, Plan } from "@/lib/types/platform";

/** ASCII, lower-case, hyphen-separated slug (mirrors the backend SignupService.normalizeSlug). */
export function slugify(raw: string): string {
  const n = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return n || "ecole";
}

/** Masks an email for the "check your inbox" screen: j***@domain.com. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const head = user.slice(0, 1);
  return `${head}${"*".repeat(Math.max(user.length - 1, 1))}@${domain}`;
}

/** Whole days remaining until an ISO datetime (0 if past/absent). */
export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  const diff = target - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / 86_400_000);
}

/** Price (as a numeric string) for a plan on the given billing period. */
export function planPrice(plan: Plan, period: BillingPeriod): string | null {
  return period === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;
}

/** Human label for a plan's student limit (null = unlimited). */
export function studentLimitLabel(limit: number | null): string {
  return limit == null ? "Illimité" : `Jusqu'à ${limit} élèves`;
}

/** Static feature bullets per plan code (display only). */
export const PLAN_FEATURES: Record<string, string[]> = {
  STARTER: [
    "Gestion des élèves & inscriptions",
    "Classes, emploi du temps",
    "Notes & bulletins",
    "Communication parents (SMS/Email)",
  ],
  STANDARD: [
    "Tout du plan Starter",
    "Facturation des frais scolaires",
    "Paiements en ligne (mobile money)",
    "Tableaux de bord avancés",
  ],
  PREMIUM: [
    "Tout du plan Standard",
    "Multi-établissements",
    "Élèves illimités",
    "Support prioritaire",
  ],
};
