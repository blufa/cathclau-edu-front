"use client";

import { Banknote, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { listPaymentsByTenant } from "@/lib/api/payment";
import { listExpenses } from "@/lib/api/expense";
import { StatCard } from "@/components/ui/stat-card";
import { StatCardSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { BarTrendChart } from "@/components/charts/bar-trend-chart";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";

const MONTHS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

/**
 * Vision Fondateur (§5) : vue épurée, centrée sur la consolidation en temps réel des recettes de
 * l'école (scolarité, inscriptions, frais annexes — tous les paiements réussis) et la balance
 * globale (recettes - dépenses payées). Volontairement sans plan comptable ni écritures.
 */
export default function FounderDashboard() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;

  const paymentsQuery = useQuery(() => (tenantId ? listPaymentsByTenant(tenantId) : Promise.resolve([])), [tenantId]);
  const expensesQuery = useQuery(() => listExpenses("PAID"), []);
  const loading = paymentsQuery.loading || expensesQuery.loading;

  const payments = paymentsQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];
  const revenue = payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const balance = revenue - totalExpenses;

  const revenueByMonth = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== "SUCCEEDED" || !p.paidAt) continue;
    const key = p.paidAt.slice(0, 7);
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(p.amount));
  }
  const expensesByMonth = new Map<string, number>();
  for (const e of expenses) {
    const key = (e.expenseDate ?? e.paidAt ?? "").slice(0, 7);
    if (!key) continue;
    expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + Number(e.amount));
  }
  const months = [...new Set([...revenueByMonth.keys(), ...expensesByMonth.keys()])].sort().slice(-6);
  const trend = months.map((k) => ({
    name: MONTHS[Number(k.slice(5, 7)) - 1] ?? k,
    Recettes: Math.round(revenueByMonth.get(k) ?? 0),
    Dépenses: Math.round(expensesByMonth.get(k) ?? 0),
  }));

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vision Fondateur</h1>
        <p className="text-sm text-gray-500">Recettes de l&apos;école et balance globale, en temps réel</p>
      </Reveal>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
        </div>
      ) : (
        <Reveal y={12}>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Recettes de l'école" value={formatGNF(revenue)} icon={TrendingUp} accent="teal"
              hint="Scolarité, inscriptions, frais annexes" />
            <StatCard title="Dépenses totales" value={formatGNF(totalExpenses)} icon={TrendingDown} accent="rose"
              hint="Dépenses payées, toutes catégories" />
            <StatCard title="Balance globale" value={formatGNF(balance)} icon={balance >= 0 ? Wallet : Banknote}
              accent={balance >= 0 ? "indigo" : "rose"} />
          </div>
        </Reveal>
      )}

      {loading ? <CardSkeleton lines={6} /> : (
        <Card>
          <CardHeader><CardTitle>Recettes vs dépenses — 6 derniers mois</CardTitle></CardHeader>
          <CardBody>
            {trend.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Pas encore de données.</p>
            ) : (
              <BarTrendChart data={trend} valueFormatter={(v) => formatGNF(v)}
                series={[{ key: "Recettes", name: "Recettes", color: "#14b8a6" }, { key: "Dépenses", name: "Dépenses", color: "#f43f5e" }]} />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
