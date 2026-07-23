"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/providers/subscription-provider";
import { daysUntil } from "@/lib/platform-utils";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "danger" | "warning" | "caution";

const TONE: Record<AlertTone, string> = {
  info: "border-info-200 bg-info-50 text-info-800",
  danger: "border-error-200 bg-error-600 text-white",
  warning: "border-warning-200 bg-warning-50 text-warning-800",
  caution: "border-warning-300 bg-warning-50 text-warning-900",
};

function Alert({ tone, title, children }: { tone: AlertTone; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("mb-4 rounded-xl border px-4 py-3 text-sm", TONE[tone])}>
      <p className="mb-1 font-semibold">{title}</p>
      {children}
    </div>
  );
}

/**
 * Contextual banner shown across the connected app, driven by the current subscription
 * (features/01-platform.md §3). No subscription / PENDING ⇒ trial CTA; SUSPENDED ⇒ regularise;
 * EXPIRED ⇒ subscribe; ACTIVE near expiry ⇒ reminder.
 */
export function SubscriptionBanner() {
  const { subscription, tenantStatus, loading, tenantScoped } = useSubscription();
  if (!tenantScoped || loading) return null;

  const cta = (label: string, href: string) => (
    <Button component={Link} href={href} size="sm" variant="secondary">
      {label}
    </Button>
  );

  // Une école activée par l'éditeur (tenant ACTIVE) n'est PAS en essai, même sans abonnement payant.
  // On ne propose l'essai que lorsque le tenant est réellement en période d'essai (TRIAL).
  const noPaidSub = !subscription || subscription.status === "PENDING";
  if (noPaidSub && tenantStatus === "TRIAL") {
    return (
      <Alert tone="info" title="Période d'essai">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Profitez de votre essai gratuit. Choisissez un plan pour continuer sans interruption.</span>
          {cta("Voir les plans", "/subscription")}
        </div>
      </Alert>
    );
  }
  // Sans abonnement payant mais tenant non-TRIAL (activé, ou statut inconnu pour un non-admin) : pas de bandeau.
  if (noPaidSub) return null;

  if (subscription.status === "SUSPENDED") {
    return (
      <Alert tone="danger" title="Accès suspendu">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Votre accès est suspendu (paiement en attente). Régularisez pour rétablir le service.</span>
          {cta("Régulariser", "/subscription/invoices")}
        </div>
      </Alert>
    );
  }

  if (subscription.status === "EXPIRED" || subscription.status === "CANCELLED") {
    return (
      <Alert tone="caution" title="Abonnement expiré">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Votre abonnement a pris fin. Souscrivez à nouveau pour continuer.</span>
          {cta("Souscrire", "/subscription")}
        </div>
      </Alert>
    );
  }

  // ACTIVE: gentle reminder when the end date is near.
  const left = daysUntil(subscription.endDate);
  if (left > 0 && left <= 7) {
    return (
      <Alert tone="warning" title="Renouvellement proche">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Votre abonnement se termine dans {left} jour{left > 1 ? "s" : ""}.</span>
          {cta("Gérer l'abonnement", "/subscription")}
        </div>
      </Alert>
    );
  }

  return null;
}
