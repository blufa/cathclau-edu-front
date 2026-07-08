"use client";

import { Building2, CreditCard, TrendingUp, Wallet, AlertTriangle, Activity, CheckCircle2, PauseCircle } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { getPlatformDashboard, type PlatformDashboard } from "@/lib/api/platform";
import { SUBSCRIPTION_STATUS_LABEL } from "@/lib/platform-labels";
import type { SubscriptionStatus } from "@/lib/types/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { StatCard } from "@/components/ui/stat-card";
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
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tableau de bord plateforme</h1>
        <p className="text-sm text-slate-500">Écoles, revenus récurrents et santé des abonnements</p>
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

  return (
    <div className="space-y-6">
      {/* Revenus */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="MRR" value={formatGNF(d.mrr)} hint="Revenu mensuel récurrent" icon={TrendingUp} accent="teal" />
        <StatCard title="ARR" value={formatGNF(d.arr)} hint="Revenu annuel récurrent" icon={TrendingUp} accent="indigo" />
        <StatCard title="Revenu du mois" value={formatGNF(d.revenueThisMonth)} hint={`${d.paymentsThisMonth} paiement(s)`} icon={Wallet} accent="emerald" />
        <StatCard title="Taux de churn" value={churnPct} hint="Abonnements résiliés" icon={Activity} accent={d.churnRate > 0.1 ? "rose" : "sky"} />
      </div>

      {/* Écoles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Écoles" value={d.totalTenants} hint="Total sur la plateforme" icon={Building2} accent="indigo" />
        <StatCard title="Actives" value={d.activeTenants} icon={CheckCircle2} accent="emerald" />
        <StatCard title="Suspendues" value={d.suspendedTenants} icon={PauseCircle} accent="amber" />
        <StatCard title="Archivées" value={d.archivedTenants} icon={Building2} accent="rose" />
      </div>

      {/* Abonnements */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Abonnements" value={d.totalSubscriptions} hint="Toutes écoles confondues" icon={CreditCard} accent="teal" />
        <StatCard title="Échéances proches" value={d.expiringSoon} hint="À renouveler sous 7 jours" icon={AlertTriangle} accent={d.expiringSoon > 0 ? "amber" : "emerald"} />
      </div>

      {/* Répartitions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownCard
          title="Répartition par statut"
          data={d.subscriptionsByStatus}
          total={d.totalSubscriptions}
          label={(k) => SUBSCRIPTION_STATUS_LABEL[k as SubscriptionStatus] ?? k}
        />
        <BreakdownCard
          title="Répartition par plan"
          data={d.subscriptionsByPlan}
          total={d.totalSubscriptions}
          label={(k) => k}
        />
      </div>
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
