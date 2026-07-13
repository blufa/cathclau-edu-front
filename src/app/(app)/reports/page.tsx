"use client";

import { useMemo, useState } from "react";
import { Select } from "@mantine/core";
import { GraduationCap, TrendingUp, Wallet, AlertTriangle, Award, Users } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { getCurrentAcademicYear, listPeriods } from "@/lib/api/academics";
import {
  getAcademicDashboard,
  getFinanceDashboard,
  getCashflowProjection,
  getTeacherPerformance,
} from "@/lib/api/reporting";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatCardSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarTrendChart } from "@/components/charts/bar-trend-chart";
import { formatGNF } from "@/lib/format";

const MONTHS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const pct = (v: string | number | null | undefined) => `${Number(v ?? 0).toFixed(2)} %`;
const avg = (v: string | number | null | undefined) => Number(v ?? 0).toFixed(2);

export default function ReportsPage() {
  const now = new Date();
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: currentYear } = useQuery(() => getCurrentAcademicYear(), []);
  const { data: periods } = useQuery(
    () => (currentYear ? listPeriods(currentYear.id) : Promise.resolve([])),
    [currentYear?.id],
  );

  const resolvedPeriodId = periodId ?? (periods && periods.length ? String(periods[0].id) : null);

  const academic = useQuery(
    () => (resolvedPeriodId ? getAcademicDashboard(Number(resolvedPeriodId)) : Promise.resolve(null)),
    [resolvedPeriodId],
  );
  const finance = useQuery(() => getFinanceDashboard(), []);
  const projection = useQuery(() => getCashflowProjection(6), []);
  const performance = useQuery(() => getTeacherPerformance(year, month), [year, month]);

  const projectionData = useMemo(
    () =>
      (projection.data?.months ?? []).map((m) => ({
        name: `${MONTHS[m.month - 1]} ${String(m.year).slice(2)}`,
        Encaissements: Math.round(Number(m.expectedInflow)),
        "Masse salariale": Math.round(Number(m.expectedOutflow)),
      })),
    [projection.data],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Rapports &amp; analytique</h1>
        <p className="text-sm text-slate-500">Pilotage académique, financier et RH de l&apos;établissement.</p>
      </div>

      {/* ── Académique ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-800">Académique</h2>
          <Select
            aria-label="Période"
            data={(periods ?? []).map((p) => ({ value: String(p.id), label: p.label }))}
            value={resolvedPeriodId}
            onChange={setPeriodId}
            placeholder="Période"
            w={200}
          />
        </div>
        {academic.loading ? (
          <div className="grid gap-4 sm:grid-cols-3"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Élèves évalués" value={academic.data?.studentCount ?? 0} icon={Users} accent="indigo" />
            <StatCard title="Moyenne générale" value={avg(academic.data?.overallAverage)} icon={GraduationCap} accent="teal" />
            <StatCard title="Taux de réussite" value={pct(academic.data?.passRate)} icon={Award} accent="emerald" />
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Moyennes par classe</CardTitle></CardHeader>
            <CardBody>
              <Table>
                <THead><TR><TH>Classe</TH><TH>Effectif</TH><TH>Moyenne</TH><TH>Réussite</TH></TR></THead>
                <TBody>
                  {(academic.data?.classes ?? []).map((c) => (
                    <TR key={c.classId}>
                      <TD>{c.className}</TD>
                      <TD>{c.studentCount}</TD>
                      <TD>{avg(c.classAverage)}</TD>
                      <TD>{pct(c.passRate)}</TD>
                    </TR>
                  ))}
                  {!academic.loading && !(academic.data?.classes ?? []).length && (
                    <TR><TD colSpan={4} className="text-slate-400">Aucun bulletin pour cette période.</TD></TR>
                  )}
                </TBody>
              </Table>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Classement général</CardTitle></CardHeader>
            <CardBody>
              <Table>
                <THead><TR><TH>Rang</TH><TH>Élève</TH><TH>Classe</TH><TH>Moyenne</TH></TR></THead>
                <TBody>
                  {(academic.data?.topStudents ?? []).map((s, i) => (
                    <TR key={s.studentId}>
                      <TD>{s.rank ?? i + 1}</TD>
                      <TD>{s.studentName}</TD>
                      <TD>{s.className}</TD>
                      <TD className="font-medium">{avg(s.overallAverage)}</TD>
                    </TR>
                  ))}
                  {!academic.loading && !(academic.data?.topStudents ?? []).length && (
                    <TR><TD colSpan={4} className="text-slate-400">Aucun classement disponible.</TD></TR>
                  )}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── Financier ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Financier</h2>
        {finance.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Facturé" value={formatGNF(finance.data?.invoiced)} icon={Wallet} accent="indigo" />
            <StatCard title="Encaissé" value={formatGNF(finance.data?.collected)} icon={TrendingUp} accent="emerald" />
            <StatCard title="Impayés" value={formatGNF(finance.data?.outstanding)} icon={AlertTriangle} accent="rose"
              hint={`${finance.data?.unpaidInvoices ?? 0} facture(s)`} />
            <StatCard title="Taux de recouvrement" value={pct(finance.data?.recoveryRate)} icon={Award} accent="teal" />
          </div>
        )}
        <Card>
          <CardHeader><CardTitle>Prévisionnel de trésorerie (6 mois)</CardTitle></CardHeader>
          <CardBody>
            {projection.loading ? (
              <CardSkeleton />
            ) : (
              <>
                <BarTrendChart
                  data={projectionData}
                  series={[
                    { key: "Encaissements", name: "Encaissements attendus", color: "#10b981" },
                    { key: "Masse salariale", name: "Masse salariale", color: "#f43f5e" },
                  ]}
                  valueFormatter={(v) => formatGNF(v)}
                />
                <p className="mt-3 text-xs text-slate-500">
                  Encaissement moyen mensuel estimé : {formatGNF(projection.data?.avgMonthlyCollection)} ·
                  Masse salariale récurrente : {formatGNF(projection.data?.recurringPayroll)} ·
                  Reste à recouvrer : {formatGNF(projection.data?.outstandingReceivables)}
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </section>

      {/* ── RH : performance enseignant ────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-800">Performance enseignants</h2>
          <div className="flex gap-2">
            <Select aria-label="Mois" w={130} value={String(month)} onChange={(v) => v && setMonth(Number(v))}
              data={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
            <Select aria-label="Année" w={110} value={String(year)} onChange={(v) => v && setYear(Number(v))}
              data={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))} />
          </div>
        </div>
        <Card>
          <CardBody>
            <Table>
              <THead>
                <TR><TH>Enseignant</TH><TH>Indice</TH><TH>Charge</TH><TH>Assiduité</TH><TH>Ponctualité</TH><TH>Heures</TH></TR>
              </THead>
              <TBody>
                {(performance.data?.teachers ?? []).map((t) => (
                  <TR key={t.teacherId}>
                    <TD className="font-medium">{t.teacherName}</TD>
                    <TD>
                      <Badge tone={Number(t.performanceScore) >= 75 ? "green" : Number(t.performanceScore) >= 50 ? "amber" : "red"}>
                        {avg(t.performanceScore)}
                      </Badge>
                    </TD>
                    <TD>{pct(t.completionRate)}</TD>
                    <TD>{pct(t.attendanceRate)}</TD>
                    <TD>{pct(t.punctualityRate)}</TD>
                    <TD>{t.effectiveHours} h</TD>
                  </TR>
                ))}
                {!performance.loading && !(performance.data?.teachers ?? []).length && (
                  <TR><TD colSpan={6} className="text-slate-400">Aucune donnée de pointage pour ce mois.</TD></TR>
                )}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
