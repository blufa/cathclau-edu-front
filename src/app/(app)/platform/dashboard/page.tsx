"use client";

import Link from "next/link";
import { Building2, TrendingUp, Wallet, AlertTriangle, CheckCircle2, PauseCircle, MessageSquare, Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { getPlatformDashboard, type PlatformDashboard } from "@/lib/api/platform";
import { getSmsBalance } from "@/lib/api/communication";
import { SUBSCRIPTION_STATUS_LABEL } from "@/lib/platform-labels";
import type { SubscriptionStatus } from "@/lib/types/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";

export default function PlatformDashboardPage() {
  return (
    <RequireSuperAdmin>
      <Dashboard />
    </RequireSuperAdmin>
  );
}

function Dashboard() {
  const { data, loading, error } = useQuery(() => getPlatformDashboard(), []);

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Plateforme</h1>
          <p className="text-sm text-slate-500">Vos écoles et vos revenus, en un coup d&apos;œil.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button component={Link} href="/platform/tenants" leftSection={<Plus className="h-4 w-4" />}>Nouvelle école</Button>
          <Button component={Link} href="/platform/tenants" variant="secondary">Écoles</Button>
          <Button component={Link} href="/platform/subscriptions" variant="secondary">Abonnements</Button>
          <Button component={Link} href="/platform/plans" variant="secondary">Plans</Button>
        </div>
      </Reveal>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error || !data ? (
        <p className="rounded-xl bg-red-50 px-4 py-8 text-center text-sm text-red-600">Impossible de charger les indicateurs.</p>
      ) : (
        <DashboardContent d={data} />
      )}
    </div>
  );
}

function DashboardContent({ d }: { d: PlatformDashboard }) {
  const churnPct = `${(d.churnRate * 100).toFixed(1)} %`;
  const attention = d.expiringSoon > 0 || d.suspendedTenants > 0;

  return (
    <div className="space-y-6">
      {/* Ce qui demande votre attention */}
      {attention && (
        <div className="flex flex-wrap gap-2">
          {d.expiringSoon > 0 && (
            <Link href="/platform/subscriptions" className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100">
              <AlertTriangle className="h-4 w-4" /> {d.expiringSoon} abonnement(s) à renouveler bientôt
            </Link>
          )}
          {d.suspendedTenants > 0 && (
            <Link href="/platform/tenants" className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100">
              <PauseCircle className="h-4 w-4" /> {d.suspendedTenants} école(s) suspendue(s)
            </Link>
          )}
        </div>
      )}

      {/* Mes écoles */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Mes écoles</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Écoles inscrites" value={d.totalTenants} hint="Total sur la plateforme" icon={Building2} accent="indigo" />
          <StatCard title="Actives" value={d.activeTenants} hint="En service" icon={CheckCircle2} accent="emerald" />
          <StatCard title="Suspendues" value={d.suspendedTenants} hint="Accès bloqué" icon={PauseCircle} accent="amber" />
          <StatCard title="À renouveler" value={d.expiringSoon} hint="Sous 7 jours" icon={AlertTriangle} accent={d.expiringSoon > 0 ? "amber" : "emerald"} />
        </div>
      </section>

      {/* Mes revenus */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Mes revenus</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Revenu du mois" value={formatGNF(d.revenueThisMonth)} hint={`${d.paymentsThisMonth} paiement(s) reçu(s)`} icon={Wallet} accent="emerald" />
          <StatCard title="Revenu mensuel récurrent" value={formatGNF(d.mrr)} hint="Abonnements en cours" icon={TrendingUp} accent="teal" />
          <StatCard title="Revenu annuel projeté" value={formatGNF(d.arr)} hint={`Taux de résiliation : ${churnPct}`} icon={TrendingUp} accent="indigo" />
        </div>
      </section>

      {/* Répartition des abonnements */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Répartition des abonnements</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <BreakdownCard
            title="Par statut"
            data={d.subscriptionsByStatus}
            total={d.totalSubscriptions}
            label={(k) => SUBSCRIPTION_STATUS_LABEL[k as SubscriptionStatus] ?? k}
          />
          <BreakdownCard
            title="Par plan"
            data={d.subscriptionsByPlan}
            total={d.totalSubscriptions}
            label={(k) => k}
          />
        </div>
      </section>

      {/* Solde SMS (Orange) */}
      <SmsBalanceCard />
    </div>
  );
}

function SmsBalanceCard() {
  const { data, loading } = useQuery(() => getSmsBalance(), []);
  const balances = data ?? [];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <MessageSquare className="h-4 w-4 text-brand-600" /> Solde SMS (Orange)
      </h2>
      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : balances.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          Aucun solde disponible — le fournisseur SMS Orange n&apos;est pas encore configuré.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((b, i) => {
            const low = b.availableUnits != null && b.availableUnits < 50;
            return (
              <div key={`${b.country}-${i}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">{b.country ?? "—"}</span>
                  <Badge tone={b.status === "ACTIVE" ? (low ? "amber" : "green") : "gray"}>
                    {b.status ?? "—"}
                  </Badge>
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {b.availableUnits ?? "—"} <span className="text-sm font-normal text-slate-400">SMS</span>
                </p>
                {low && <p className="text-xs font-medium text-amber-600">Crédit bas — pensez à recharger</p>}
                {b.expirationDate && (
                  <p className="text-xs text-slate-400">Expire le {b.expirationDate.slice(0, 10)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BreakdownCard({
  title, data, total, label,
}: { title: string; data: Record<string, number>; total: number; label: (key: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">{title}</h2>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Aucune donnée.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map(([key, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li key={key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-700">{label(key)}</span>
                  <span className="font-medium text-slate-900">{count} <span className="text-xs text-slate-400">({pct}%)</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
