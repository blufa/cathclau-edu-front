"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/providers/auth-provider";
import { useSubscription } from "@/providers/subscription-provider";
import { useQuery } from "@/hooks/use-query";
import {
  changePlan,
  getPlanChanges,
  subscribeSelf,
  listPlans,
  setAutoRenewal,
} from "@/lib/api/platform";
import { ApiError } from "@/lib/api/errors";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PlanCard } from "@/components/platform/plan-card";
import { SubscriptionStatusBadge } from "@/components/platform/status-badge";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate, formatGNF } from "@/lib/format";
import { BILLING_PERIOD_LABEL, PLAN_CHANGE_TYPE_LABEL } from "@/lib/platform-labels";
import type { BillingPeriod, Plan } from "@/lib/types/platform";

const PLAN_ORDER = ["STARTER", "STANDARD", "PREMIUM"];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { subscription, plan: currentPlan, loading, refresh } = useSubscription();
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");
  const [busy, setBusy] = useState(false);

  const plansQuery = useQuery(() => listPlans(), []);
  const changesQuery = useQuery(
    () => (subscription ? getPlanChanges(subscription.id) : Promise.resolve([])),
    [subscription?.id],
  );

  const plans = (plansQuery.data ?? [])
    .filter((p) => !p.archived)
    .sort((a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code));

  async function toggleAutoRenew(enabled: boolean) {
    if (!subscription) return;
    try {
      await setAutoRenewal(subscription.id, enabled);
      notifySuccess(enabled ? "Renouvellement automatique activé" : "Renouvellement automatique désactivé");
      refresh();
    } catch (err) {
      notifyError(err);
    }
  }

  function handleChoose(target: Plan) {
    if (subscription) {
      // Change plan on the existing subscription.
      const upgrade = PLAN_ORDER.indexOf(target.code) > PLAN_ORDER.indexOf(currentPlan?.code ?? "STARTER");
      confirmAction({
        title: upgrade ? "Mise à niveau du plan" : "Changement de plan",
        message: upgrade
          ? `Passer au plan ${target.name} prend effet immédiatement (un prorata sera facturé). Continuer ?`
          : `Passer au plan ${target.name} prendra effet au prochain renouvellement. Continuer ?`,
        confirmLabel: "Confirmer",
        onConfirm: async () => {
          setBusy(true);
          try {
            await changePlan(subscription.id, target.id, period);
            notifySuccess("Plan modifié");
            refresh();
            changesQuery.refetch();
          } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
              notifyError(err, "Trop d'élèves pour ce plan — réduisez les effectifs ou choisissez un plan supérieur.");
            } else {
              notifyError(err);
            }
          } finally {
            setBusy(false);
          }
        },
      });
      return;
    }

    // No subscription yet: initiate one (creates an invoice → payment).
    if (!user?.tenantId) return;
    confirmAction({
      title: `Souscrire au plan ${target.name}`,
      message: `Une facture sera générée pour le plan ${target.name} (${BILLING_PERIOD_LABEL[period].toLowerCase()}). Vous serez ensuite invité à payer. Continuer ?`,
      confirmLabel: "Souscrire",
      onConfirm: async () => {
        setBusy(true);
        try {
          await subscribeSelf({
            planId: target.id,
            billingPeriod: period,
            autoRenewal: true,
          });
          notifySuccess("Abonnement créé — procédez au paiement");
          refresh();
          router.push("/subscription/invoices");
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) {
            notifyError(err, "Action non autorisée pour votre rôle.");
          } else {
            notifyError(err);
          }
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Abonnement</h1>
        <p className="text-sm text-gray-500">Gérez le plan d&apos;abonnement de votre école.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* Overview */}
          <Card>
            <CardHeader><CardTitle>Vue d&apos;ensemble</CardTitle></CardHeader>
            <CardBody>
              {subscription ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div><p className="text-gray-500">Plan</p><p className="font-medium">{currentPlan?.name ?? "—"}</p></div>
                  <div><p className="text-gray-500">Statut</p><SubscriptionStatusBadge status={subscription.status} /></div>
                  <div><p className="text-gray-500">Période</p><p className="font-medium">{formatDate(subscription.startDate)} → {formatDate(subscription.endDate)}</p></div>
                  <div>
                    <p className="text-gray-500">Renouvellement auto</p>
                    <div className="mt-1"><Switch checked={!!subscription.autoRenewal} onChange={toggleAutoRenew} ariaLabel="Renouvellement automatique" /></div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-900">
                  Vous êtes en période d&apos;essai. Choisissez un plan ci-dessous pour activer durablement votre école.
                </div>
              )}
            </CardBody>
          </Card>

          {/* Plan selection */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{subscription ? "Changer de plan" : "Choisir un plan"}</CardTitle>
                <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                  {([{ label: "Mensuel", value: "MONTHLY" }, { label: "Annuel", value: "ANNUAL" }] as { label: string; value: BillingPeriod }[]).map((o) => (
                    <button key={o.value} type="button" onClick={() => setPeriod(o.value)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition ${period === o.value ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {plansQuery.loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <div className="grid gap-6 md:grid-cols-3">
                  {plans.map((p) => (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      period={period}
                      current={currentPlan?.id === p.id}
                      ctaLabel={subscription ? "Choisir ce plan" : "Souscrire"}
                      disabled={busy}
                      onChoose={handleChoose}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Plan-change history */}
          {subscription && (
            <Card>
              <CardHeader><CardTitle>Historique des changements</CardTitle></CardHeader>
              <CardBody>
                {changesQuery.loading ? (
                  <div className="flex justify-center py-6"><Spinner /></div>
                ) : (changesQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400">Aucun changement de plan.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 text-sm">
                    {(changesQuery.data ?? []).map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2">
                        <span>{PLAN_CHANGE_TYPE_LABEL[c.type]}</span>
                        <span className="text-gray-500">{formatDate(c.effectiveDate)}</span>
                        <span className="text-gray-700">{c.proratedAmount ? formatGNF(c.proratedAmount) : "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}

          <p className="text-xs text-gray-400">
            Besoin d&apos;aide ? Consultez vos <Link href="/subscription/invoices" className="text-indigo-600 hover:underline">factures d&apos;abonnement</Link>.
          </p>
        </>
      )}
    </div>
  );
}
