"use client";

import Link from "next/link";
import { Alert } from "@mantine/core";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/providers/subscription-provider";
import { daysUntil } from "@/lib/platform-utils";

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
      <Alert color="blue" variant="light" mb="md" title="Période d'essai">
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
      <Alert color="red" variant="filled" mb="md" title="Accès suspendu">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Votre accès est suspendu (paiement en attente). Régularisez pour rétablir le service.</span>
          {cta("Régulariser", "/subscription/invoices")}
        </div>
      </Alert>
    );
  }

  if (subscription.status === "EXPIRED" || subscription.status === "CANCELLED") {
    return (
      <Alert color="orange" variant="light" mb="md" title="Abonnement expiré">
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
      <Alert color="yellow" variant="light" mb="md" title="Renouvellement proche">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Votre abonnement se termine dans {left} jour{left > 1 ? "s" : ""}.</span>
          {cta("Gérer l'abonnement", "/subscription")}
        </div>
      </Alert>
    );
  }

  return null;
}
