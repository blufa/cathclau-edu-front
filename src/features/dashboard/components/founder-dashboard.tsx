"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Award,
  Banknote,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { listPaymentsByTenant } from "@/lib/api/payment";
import { listExpenses } from "@/lib/api/expense";
import { getCurrentAcademicYear, listAcademicYears } from "@/lib/api/academics";
import { getFounderDashboard } from "@/lib/api/reporting";
import { StatCard } from "@/components/ui/stat-card";
import { StatCardSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarTrendChart } from "@/components/charts/bar-trend-chart";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";

const MONTHS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const pct = (v: string | number | null | undefined) => `${Number(v ?? 0).toFixed(2)} %`;

const ALERT_TONE: Record<string, "red" | "amber" | "blue"> = {
  CRITICAL: "red",
  WARNING: "amber",
  INFO: "blue",
};

/**
 * Vision Fondateur (§14) : consolidation en temps réel des recettes de l'école, puis, pour l'année
 * scolaire courante, le recouvrement détaillé (par classe, par mois/tranche, plus gros débiteurs),
 * la masse salariale complète (enseignants + personnel) et les élèves pris en charge (exonérations,
 * remises fratrie). Alertes automatiques et comparatif avec l'année précédente quand disponible.
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

  // ── Année scolaire courante + précédente (comparatif automatique, §V3) ────
  const { data: currentYear } = useQuery(() => getCurrentAcademicYear(), []);
  const { data: allYears } = useQuery(() => listAcademicYears(), []);
  const previousYearId = useMemo(() => {
    if (!currentYear || !allYears) return null;
    const sorted = [...allYears].sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
    const idx = sorted.findIndex((y) => y.id === currentYear.id);
    return idx >= 0 && idx + 1 < sorted.length ? sorted[idx + 1].id : null;
  }, [currentYear, allYears]);

  const now = new Date();
  const founderQuery = useQuery(
    () =>
      currentYear
        ? getFounderDashboard(currentYear.id, {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            compareAcademicYearId: previousYearId ?? undefined,
          })
        : Promise.resolve(null),
    [currentYear?.id, previousYearId],
  );
  const founder = founderQuery.data;

  const periodTrend = (founder?.recovery.byPeriod ?? []).map((p) => ({
    name: p.periodLabel,
    Facturé: Math.round(Number(p.invoiced)),
    Encaissé: Math.round(Number(p.collected)),
  }));

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vision Fondateur</h1>
        <p className="text-sm text-gray-500">Recettes de l&apos;école, recouvrement, masse salariale et élèves pris en charge</p>
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

      {/* ── Alertes automatiques ─────────────────────────────────────────── */}
      {!founderQuery.loading && (founder?.alerts ?? []).length > 0 && (
        <div className="space-y-2">
          {founder!.alerts.map((a) => (
            <div key={a.code} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="flex-1">
                <Badge tone={ALERT_TONE[a.level] ?? "gray"}>{a.level}</Badge>
                <span className="ml-2 text-sm text-gray-700">{a.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Recouvrement de l'année scolaire courante ────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Recouvrement — {currentYear?.label ?? "année scolaire courante"}
        </h2>
        {founderQuery.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Facturé" value={formatGNF(founder?.recovery.overall.invoiced)} icon={Wallet} accent="indigo" />
            <StatCard title="Encaissé" value={formatGNF(founder?.recovery.overall.collected)} icon={TrendingUp} accent="emerald" />
            <StatCard title="Impayés" value={formatGNF(founder?.recovery.overall.outstanding)} icon={AlertTriangle} accent="rose"
              hint={`${founder?.recovery.overall.unpaidInvoices ?? 0} facture(s)`} />
            <StatCard title="Taux de recouvrement" value={pct(founder?.recovery.overall.recoveryRate)} icon={Award} accent="teal" />
          </div>
        )}

        {founder?.comparison && (
          <p className="text-xs text-gray-500">
            Vs année précédente : facturé {Number(founder.comparison.invoicedDelta) >= 0 ? "+" : ""}
            {formatGNF(founder.comparison.invoicedDelta)}, encaissé {Number(founder.comparison.collectedDelta) >= 0 ? "+" : ""}
            {formatGNF(founder.comparison.collectedDelta)}, taux de recouvrement {Number(founder.comparison.recoveryRateDelta) >= 0 ? "+" : ""}
            {Number(founder.comparison.recoveryRateDelta).toFixed(2)} pt.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Recouvrement par mois / tranche</CardTitle></CardHeader>
            <CardBody>
              {periodTrend.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">Pas encore de factures pour cette année.</p>
              ) : (
                <BarTrendChart data={periodTrend} valueFormatter={(v) => formatGNF(v)}
                  series={[{ key: "Facturé", name: "Facturé", color: "#6366f1" }, { key: "Encaissé", name: "Encaissé", color: "#10b981" }]} />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recouvrement par classe</CardTitle></CardHeader>
            <CardBody>
              <Table>
                <THead><TR><TH>Classe</TH><TH>Facturé</TH><TH>Impayés</TH><TH>Taux</TH></TR></THead>
                <TBody>
                  {(founder?.recovery.byClass ?? []).map((c) => (
                    <TR key={c.classId}>
                      <TD>{c.className}</TD>
                      <TD>{formatGNF(c.invoiced)}</TD>
                      <TD>{formatGNF(c.outstanding)}</TD>
                      <TD>{pct(c.recoveryRate)}</TD>
                    </TR>
                  ))}
                  {!founderQuery.loading && !(founder?.recovery.byClass ?? []).length && (
                    <TR><TD colSpan={4} className="text-gray-400">Aucune facture pour cette année.</TD></TR>
                  )}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Plus gros débiteurs</CardTitle></CardHeader>
          <CardBody>
            <Table>
              <THead><TR><TH>Élève</TH><TH>Classe</TH><TH>Reste dû</TH></TR></THead>
              <TBody>
                {(founder?.recovery.topDebtors ?? []).map((d) => (
                  <TR key={d.studentId}>
                    <TD className="font-medium">{d.studentName}</TD>
                    <TD>{d.className ?? "—"}</TD>
                    <TD>{formatGNF(d.outstanding)}</TD>
                  </TR>
                ))}
                {!founderQuery.loading && !(founder?.recovery.topDebtors ?? []).length && (
                  <TR><TD colSpan={3} className="text-gray-400">Aucun impayé.</TD></TR>
                )}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      </section>

      {/* ── Masse salariale ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Masse salariale du mois</h2>
        {founderQuery.loading ? (
          <div className="grid gap-4 sm:grid-cols-3"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Enseignants" value={formatGNF(founder?.payroll.teacherMonthlyPayroll)} icon={Users} accent="indigo"
              hint={`${founder?.payroll.teacherCount ?? 0} enseignant(s)`} />
            <StatCard title="Personnel administratif" value={formatGNF(founder?.payroll.staffMonthlyPayroll)} icon={Users} accent="teal"
              hint={`${founder?.payroll.staffCount ?? 0} membre(s)`} />
            <StatCard title="Total masse salariale" value={formatGNF(founder?.payroll.totalMonthlyPayroll)} icon={Wallet} accent="rose" />
          </div>
        )}
      </section>

      {/* ── Salaire par enseignant ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Salaire par enseignant</h2>
        <p className="-mt-2 text-sm text-gray-500">
          Salaire du mois affiché et estimation cumulée jusqu&apos;à la fin de l&apos;année scolaire, pour
          chaque enseignant individuellement.
        </p>
        {founderQuery.loading ? <CardSkeleton lines={5} /> : (
          <Card>
            <CardBody className="p-0">
              <Table>
                <THead>
                  <tr><TH>Enseignant</TH><TH>Ce mois</TH><TH>Estimation annuelle</TH></tr>
                </THead>
                <TBody>
                  {(founder?.teacherSalaries ?? []).map((t) => (
                    <TR key={t.teacherId}>
                      <TD className="font-medium">{t.teacherName}</TD>
                      <TD>{formatGNF(t.monthlyPay)}</TD>
                      <TD className="font-semibold">{formatGNF(t.annualProjection)}</TD>
                    </TR>
                  ))}
                  {!founderQuery.loading && !(founder?.teacherSalaries ?? []).length && (
                    <TR><TD colSpan={3} className="py-6 text-center text-gray-400">Aucun enseignant configuré.</TD></TR>
                  )}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        )}
      </section>

      {/* ── Projection de la masse salariale sur l'année scolaire ────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Estimation de la masse salariale sur l&apos;année scolaire</h2>
        <p className="-mt-2 text-sm text-gray-500">
          Enseignants (heures théoriques selon l&apos;emploi du temps et le calendrier, jours fériés exclus,
          ou salaire fixe) + personnel non-enseignant, mois par mois.
        </p>
        {founderQuery.loading ? <CardSkeleton lines={5} /> : (
          <Card>
            <CardBody>
              <Table>
                <THead>
                  <tr><TH>Mois</TH><TH>Enseignants</TH><TH>Personnel</TH><TH>Total</TH></tr>
                </THead>
                <TBody>
                  {(founder?.payrollProjection.months ?? []).map((mp) => (
                    <TR key={`${mp.year}-${mp.month}`}>
                      <TD className="font-medium">{MONTHS[mp.month - 1]} {mp.year}</TD>
                      <TD>{formatGNF(mp.teacherPayroll)}</TD>
                      <TD>{formatGNF(mp.staffPayroll)}</TD>
                      <TD className="font-semibold">{formatGNF(mp.total)}</TD>
                    </TR>
                  ))}
                  {!founderQuery.loading && !(founder?.payrollProjection.months ?? []).length && (
                    <TR><TD colSpan={4} className="text-gray-400">Aucune donnée.</TD></TR>
                  )}
                </TBody>
              </Table>
              {founder && (
                <div className="mt-3 flex flex-wrap justify-end gap-6 border-t border-gray-100 pt-3 text-sm">
                  <span className="text-gray-500">Total enseignants : <span className="font-semibold text-gray-800">{formatGNF(founder.payrollProjection.totalTeachers)}</span></span>
                  <span className="text-gray-500">Total personnel : <span className="font-semibold text-gray-800">{formatGNF(founder.payrollProjection.totalStaff)}</span></span>
                  <span className="text-gray-500">Total général : <span className="font-bold text-gray-900">{formatGNF(founder.payrollProjection.grandTotal)}</span></span>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </section>

      {/* ── Heures enseignants (cahier de textes) ────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Heures réalisées vs heures dues du mois</h2>
        {founderQuery.loading ? <CardSkeleton lines={4} /> : (
          <Card>
            <CardBody className="space-y-3">
              {(founder?.teacherHours ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Aucun enseignant configuré.</p>
              ) : (
                founder!.teacherHours.map((t) => {
                  const rate = t.dueMinutes > 0 ? Math.min(100, Math.round((t.realizedMinutes / t.dueMinutes) * 100)) : 0;
                  const hours = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
                  return (
                    <div key={t.teacherId}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{t.teacherName}</span>
                        <span className="text-gray-500">{hours(t.realizedMinutes)} / {hours(t.dueMinutes)} ({rate} %)</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${rate >= 100 ? "bg-emerald-500" : rate >= 60 ? "bg-teal-500" : "bg-warning-500"}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        )}
      </section>

      {/* ── Élèves pris en charge ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Élèves pris en charge</h2>
        {founderQuery.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Exonérations actives" value={founder?.subsidy.activeExemptionsCount ?? 0} icon={Users} accent="indigo"
              hint={`${founder?.subsidy.totalExemptions ?? 0} totale(s), ${founder?.subsidy.partialExemptions ?? 0} partielle(s)`} />
            <StatCard title="Remises fratrie appliquées" value={formatGNF(founder?.subsidy.familyDiscountAmount)} icon={Wallet} accent="teal" />
            <StatCard title="Élèves à jour sur l'année" value={founder?.subsidy.studentsFullySettledMonthlyFees ?? 0} icon={Award} accent="emerald"
              hint="Toutes les mensualités payées" />
            <StatCard title="Économie estimée (paiement anticipé)" value={formatGNF(founder?.subsidy.estimatedEarlyPaymentSavings)} icon={Banknote} accent="rose"
              hint="Estimation à 5 % — aucune remise réelle appliquée aujourd'hui" />
          </div>
        )}
      </section>
    </div>
  );
}
