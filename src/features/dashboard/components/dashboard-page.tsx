"use client";

import Link from "next/link";
import { AlertTriangle, GraduationCap, Receipt, Wallet, TrendingUp } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useSubscription } from "@/providers/subscription-provider";
import { setAutoRenewal } from "@/lib/api/platform";
import { Switch } from "@/components/ui/switch";
import { INVOICE_STATUS_LABEL, type Invoice, type InvoiceStatus } from "@/lib/types/billing";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { CardSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BarTrendChart } from "@/components/charts/bar-trend-chart";
import { BarBreakdownChart, type BreakdownItem } from "@/components/charts/bar-breakdown-chart";
import { SubscriptionStatusBadge } from "@/components/platform/status-badge";
import { QuotaProgress } from "@/components/platform/quota-progress";
import { PendingSubscriptionBanner } from "@/components/platform/pending-subscription-banner";
import { Reveal } from "@/components/public/reveal";
import { formatDate, formatGNF } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { GettingStarted } from "./getting-started";
import { useRecentInvoicesQuery, useStudentsCountQuery } from "../hooks/use-dashboard";

const MONTHS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

const STATUS_COLOR: Record<string, string> = { PAID: "#10b981", PARTIAL: "#f59e0b", UNPAID: "#f43f5e", CANCELLED: "#cbd5e1" };
const STATUS_TONE: Record<InvoiceStatus, "green" | "amber" | "red"> = { PAID: "green", PARTIAL: "amber", UNPAID: "red" };

const num = (v: string | number | null | undefined) => Number(v ?? 0);

/** 6 derniers mois : frais émis vs encaissés, d'après la date d'émission des factures élèves. */
function billingByMonth(invoices: Invoice[]) {
  const map = new Map<string, { emis: number; encaisse: number }>();
  for (const i of invoices) {
    const key = (i.issueDate ?? "").slice(0, 7);
    if (!key) continue;
    const cur = map.get(key) ?? { emis: 0, encaisse: 0 };
    cur.emis += num(i.totalAmount);
    cur.encaisse += num(i.paidAmount);
    map.set(key, cur);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([key, v]) => ({
    name: MONTHS[Number(key.slice(5, 7)) - 1] ?? key,
    Émis: Math.round(v.emis),
    Encaissé: Math.round(v.encaisse),
  }));
}

function statusBreakdown(invoices: Invoice[]): BreakdownItem[] {
  const counts = new Map<string, number>();
  for (const i of invoices) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
  return [...counts.entries()].map(([status, value]) => ({
    name: INVOICE_STATUS_LABEL[status as InvoiceStatus] ?? status,
    value,
    color: STATUS_COLOR[status] ?? "#94a3b8",
  }));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { subscription, plan, tenantStatus, loading: subLoading, tenantScoped, refresh } = useSubscription();
  const tenantId = user?.tenantId ?? null;

  const studentsQuery = useStudentsCountQuery(tenantScoped);
  const invoicesQuery = useRecentInvoicesQuery(tenantId, tenantScoped);

  if (!user) return null;

  const invoices = invoicesQuery.data ?? [];
  const consumed = studentsQuery.data?.totalElements ?? 0;
  const totalBilled = invoices.reduce((s, i) => s + num(i.totalAmount), 0);
  const totalPaid = invoices.reduce((s, i) => s + num(i.paidAmount), 0);
  const due = invoices.reduce((s, i) => s + num(i.remainingBalance ?? num(i.totalAmount) - num(i.paidAmount)), 0);
  const recovery = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
  const unpaidCount = invoices.filter((i) => i.status === "UNPAID").length;
  const excludedCount = invoices.filter((i) => i.recoveryStage === "EXCLUDED").length;
  const monthly = billingByMonth(invoices);
  const breakdown = statusBreakdown(invoices);
  const quotaNearLimit = plan?.studentLimit != null && consumed >= plan.studentLimit * 0.9;
  // École qui a déjà des données réelles → on affiche le tableau financier ; sinon (école neuve) on
  // laisse le guide « Premiers pas » être le centre de la page, sans widgets vides qui l'encombrent.
  const hasData = consumed > 0 || invoices.length > 0;

  async function toggleAutoRenew(enabled: boolean) {
    if (!subscription) return;
    try {
      await setAutoRenewal(subscription.id, enabled);
      notifySuccess(enabled ? "Renouvellement automatique activé" : "Renouvellement automatique désactivé");
      refresh();
    } catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 p-6 text-white shadow-sm">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 right-24 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight">Bonjour {user.firstName} 👋</h1>
          <p className="mt-1 text-sm text-white/85">
            {tenantScoped && !hasData && !studentsQuery.isLoading && !invoicesQuery.isLoading
              ? "Configurons votre établissement — suivez le guide ci-dessous, étape par étape."
              : "Voici un aperçu de votre établissement aujourd'hui."}
          </p>
        </div>
      </div>

      {tenantScoped && <PendingSubscriptionBanner />}

      {/* Bannière cliquable vers le guide « Premiers pas » (page dédiée /onboarding) — se masque une
          fois configuré ou fermée manuellement. */}
      {tenantScoped && <GettingStarted compact />}

      {!tenantScoped ? (
        <Card>
          <CardBody className="text-sm text-gray-600">
            Vous êtes connecté en tant qu&apos;administrateur de la plateforme. Rendez-vous dans
            l&apos;espace <Link href="/platform/tenants" className="text-brand-700 hover:underline">Plateforme</Link>.
          </CardBody>
        </Card>
      ) : subLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <CardSkeleton lines={6} /><CardSkeleton lines={6} /><CardSkeleton lines={6} />
          </div>
        </div>
      ) : (
        <>
          {/* Alertes */}
          {(unpaidCount > 0 || excludedCount > 0 || quotaNearLimit) && (
            <Reveal y={8}>
              <div className="flex flex-wrap gap-2">
                {unpaidCount > 0 && (
                  <Link href="/invoices" className="inline-flex items-center gap-2 rounded-xl bg-error-50 px-3 py-2 text-sm text-error-700 hover:bg-error-100">
                    <AlertTriangle className="h-4 w-4" /> {unpaidCount} facture(s) impayée(s)
                  </Link>
                )}
                {excludedCount > 0 && (
                  <Link href="/invoices" className="inline-flex items-center gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-800 hover:bg-warning-100">
                    <AlertTriangle className="h-4 w-4" /> {excludedCount} élève(s) exclu(s) pour impayé
                  </Link>
                )}
                {quotaNearLimit && (
                  <Link href="/subscription" className="inline-flex items-center gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-800 hover:bg-warning-100">
                    <AlertTriangle className="h-4 w-4" /> Quota élèves bientôt atteint
                  </Link>
                )}
              </div>
            </Reveal>
          )}

          {/* KPI cards — données scolaires réelles (masqués tant qu'aucune donnée : école neuve) */}
          {hasData && (
          <Reveal y={12}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Élèves inscrits" value={consumed} icon={GraduationCap} accent="teal"
                hint={plan?.studentLimit != null ? `Limite : ${plan.studentLimit}` : "Plan illimité"} />
              <StatCard title="Frais facturés" value={formatGNF(totalBilled)} icon={Receipt} accent="indigo"
                hint={`Encaissé : ${formatGNF(totalPaid)}`} />
              <StatCard title="Reste à recouvrer" value={formatGNF(due)} icon={Wallet} accent={due > 0 ? "rose" : "emerald"}
                hint={`${unpaidCount} impayée(s)`} />
              <StatCard title="Taux de recouvrement" value={`${recovery}%`} icon={TrendingUp} accent="sky"
                trend={{ value: `${recovery}%`, positive: recovery >= 70 }} />
            </div>
          </Reveal>
          )}

          {/* Charts — frais élèves */}
          {hasData && (
          <Reveal y={12}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Frais scolaires — 6 derniers mois</CardTitle></CardHeader>
                <CardBody>
                  {monthly.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-400">Pas encore de factures de frais émises.</p>
                  ) : (
                    <BarTrendChart data={monthly} valueFormatter={(v) => formatGNF(v)}
                      series={[{ key: "Émis", name: "Émis", color: "#6366f1" }, { key: "Encaissé", name: "Encaissé", color: "#14b8a6" }]} />
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Statut des factures élèves</CardTitle></CardHeader>
                <CardBody>
                  {breakdown.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Aucune facture.</p>
                    : <BarBreakdownChart data={breakdown} centerLabel="factures" />}
                </CardBody>
              </Card>
            </div>
          </Reveal>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Mon abonnement</CardTitle></CardHeader>
              <CardBody className="space-y-3 text-sm text-gray-700">
                {subscription ? (
                  <>
                    <div className="flex justify-between"><span className="text-gray-500">Plan</span><span>{plan?.name ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Statut</span><SubscriptionStatusBadge status={subscription.status} /></div>
                    <div className="flex justify-between"><span className="text-gray-500">Fin de période</span><span>{formatDate(subscription.endDate)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Montant</span><span>{formatGNF(subscription.amount)}</span></div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Renouvellement auto</span>
                      <Switch checked={!!subscription.autoRenewal} onChange={toggleAutoRenew} ariaLabel="Renouvellement automatique" />
                    </div>
                    <div className="flex gap-2 pt-2"><Button component={Link} href="/subscription" size="sm">Gérer l&apos;abonnement</Button></div>
                  </>
                ) : tenantStatus === "ACTIVE" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-gray-500">Statut</span><span className="font-medium text-success-600">École activée</span></div>
                    <p className="text-xs text-gray-400">Votre établissement est actif. Aucune action requise.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-500">
                      {tenantStatus === "TRIAL" ? "Vous êtes en période d'essai. Choisissez un plan pour continuer." : "Choisissez un plan pour activer durablement votre école."}
                    </p>
                    <Button component={Link} href="/subscription" size="sm">Voir les plans</Button>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Quota élèves</CardTitle></CardHeader>
              <CardBody><QuotaProgress consumed={consumed} limit={plan?.studentLimit ?? null} /></CardBody>
            </Card>
          </div>

          {/* Dernières factures élèves */}
          {hasData && (
          <Card>
            <CardHeader><CardTitle>Dernières factures élèves</CardTitle></CardHeader>
            <CardBody>
              {invoicesQuery.isLoading ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune facture de frais émise pour le moment.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {[...invoices].sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? "")).slice(0, 6).map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="font-mono text-xs text-gray-600">{inv.reference}</span>
                      <span className="flex-1 truncate text-gray-500">{inv.periodLabel ?? "Frais"}</span>
                      <span className="text-gray-700">{formatGNF(inv.totalAmount)}</span>
                      <Badge tone={STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
                      <span className="text-gray-500">{formatDate(inv.issueDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-3"><Button component={Link} href="/invoices" size="sm" variant="ghost">Toutes les factures →</Button></div>
            </CardBody>
          </Card>
          )}
        </>
      )}
    </div>
  );
}
