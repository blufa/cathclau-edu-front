"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Banknote,
  Clock,
  GraduationCap,
  MessageSquare,
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
import { getFinanceDashboard, getFounderDashboard, getHrDashboard } from "@/lib/api/reporting";
import { listEmployees, listTeachers } from "@/lib/api/staff";
import { listPayslips } from "@/lib/api/payroll";
import { listCommunicationsByTenant } from "@/lib/api/communication";
import { searchStudents } from "@/lib/api/students";
import { EMPLOYEE_CATEGORY_LABEL } from "@/components/staff/employee-form";
import { StatCard } from "@/components/ui/stat-card";
import { StatCardSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarTrendChart } from "@/components/charts/bar-trend-chart";
import { PieBreakdownChart } from "@/components/charts/pie-breakdown-chart";
import { PersonPayrollCard } from "./person-payroll-card";
import { Reveal } from "@/components/public/reveal";
import { formatGNF, formatMinutes, formatTime } from "@/lib/format";

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
  // Même appel que /reports (Rapports & analytique) pour la carte « Recettes de l'école » — avant, ce
  // montant était recalculé ici à partir des paiements bruts (`Payment.amount`), une source différente
  // de celle des Rapports (`Invoice.paidAmount`), ce qui produisait deux chiffres divergents pour ce
  // qui devrait être « la même chose ». `paymentsQuery` reste utilisé, mais uniquement pour la courbe
  // mensuelle « Recettes vs dépenses » ci-dessous (vue de tendance, pas de total).
  const financeQuery = useQuery(() => getFinanceDashboard(), []);
  const teachersQuery = useQuery(() => listTeachers(), []);
  const employeesQuery = useQuery(() => listEmployees(), []);
  const now0 = new Date();
  const hrQuery = useQuery(() => getHrDashboard(now0.getFullYear(), now0.getMonth() + 1), []);
  // Nombre d'élèves de l'école — un seul élève réellement transféré (size=1), seul totalElements compte.
  const studentsCountQuery = useQuery(() => searchStudents({ size: 1 }).then((p) => p.totalElements), []);
  // SMS de relance de recouvrement envoyés ce mois-ci (motif ECHEANCE_PAIEMENT côté backend →
  // "PAYMENT_DUE" ici) — pour que le fondateur sache combien de relances sont réellement parties, pas
  // seulement combien de factures sont en retard.
  const communicationsQuery = useQuery(() => (tenantId ? listCommunicationsByTenant(tenantId) : Promise.resolve([])), [tenantId]);
  // Fiches de paie enseignants du mois — pour distinguer qui est déjà payé de qui ne l'est pas encore.
  const payslipsQuery = useQuery(() => listPayslips(), []);
  const loading = paymentsQuery.loading || expensesQuery.loading || financeQuery.loading;

  const payments = paymentsQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];
  const revenue = Number(financeQuery.data?.collected ?? 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const balance = revenue - totalExpenses;

  const teacherPhotoById = new Map((teachersQuery.data ?? []).map((t) => [t.id, t.photo]));
  const teacherSpecializationById = new Map((teachersQuery.data ?? []).map((t) => [t.id, t.specialization]));
  const hrByTeacherId = new Map((hrQuery.data?.teachers ?? []).map((t) => [t.teacherId, t]));
  const hr = hrQuery.data;
  const teacherAttendanceRate = hr && hr.totalPresentDays + hr.totalAbsentDays > 0
    ? (hr.totalPresentDays / (hr.totalPresentDays + hr.totalAbsentDays)) * 100
    : null;

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
  const currentMonthKey = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, "0")}`;

  // Derniers encaissements (date + heure précise) — le fondateur veut voir concrètement quand l'argent
  // rentre, pas seulement un total agrégé.
  const recentPayments = [...payments]
    .filter((p) => p.status === "SUCCEEDED" && p.paidAt)
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))
    .slice(0, 8);

  // SMS de relance de recouvrement envoyés ce mois (motif PAYMENT_DUE, canal SMS uniquement).
  const smsRecoveryThisMonth = (communicationsQuery.data ?? []).filter(
    (c) => c.channel === "SMS" && c.reason === "PAYMENT_DUE" && (c.sentAt ?? "").startsWith(currentMonthKey),
  ).length;

  // Enseignants payés / non payés ce mois — distingue les fiches déjà réglées (statut PAID) du reste.
  const teacherIds = new Set((teachersQuery.data ?? []).map((t) => t.id));
  const paidTeacherIdsThisMonth = new Set(
    (payslipsQuery.data ?? [])
      .filter((p) => teacherIds.has(p.teacherId) && (p.periodStart ?? "").startsWith(currentMonthKey) && p.status === "PAID")
      .map((p) => p.teacherId),
  );
  const teachersPaidCount = paidTeacherIdsThisMonth.size;
  const teachersUnpaidCount = Math.max(0, teacherIds.size - teachersPaidCount);

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

  // Bénéfice réel du mois : recettes − dépenses − masse salariale (enseignants + personnel) — un
  // chiffre qui n'existait nulle part ailleurs, contrairement à « Balance globale » (recettes −
  // dépenses seules, sans déduire la masse salariale) affichée plus haut.
  const monthlyProfit = (revenueByMonth.get(currentMonthKey) ?? 0)
    - (expensesByMonth.get(currentMonthKey) ?? 0)
    - Number(founder?.payroll.totalMonthlyPayroll ?? 0);

  // Coût des retards/départs anticipés des enseignants : écart entre la masse salariale théorique
  // (projetée depuis l'emploi du temps) et la masse salariale réelle (heures effectivement
  // réalisées, cahier de textes) — positif = économisé sur des heures non réalisées.
  const teacherPayrollGap = founder
    ? Number(founder.payroll.teacherMonthlyPayroll) - Number(founder.realPayroll.teacherMonthlyPayroll)
    : 0;

  const periodTrend = (founder?.recovery.byPeriod ?? []).map((p) => ({
    name: p.periodLabel,
    Facturé: Math.round(Number(p.invoiced)),
    Encaissé: Math.round(Number(p.collected)),
  }));

  const payrollProjectionTrend = (founder?.payrollProjection.months ?? []).map((mp) => ({
    name: `${MONTHS[mp.month - 1]} ${mp.year}`,
    Enseignants: Math.round(Number(mp.teacherPayroll)),
    Personnel: Math.round(Number(mp.staffPayroll)),
  }));

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vision Fondateur</h1>
        <p className="text-sm text-gray-500">Recettes de l&apos;école, recouvrement, masse salariale et élèves pris en charge</p>
      </Reveal>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
        </div>
      ) : (
        <Reveal y={12}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Élèves dans l'école" value={studentsCountQuery.data ?? 0} icon={GraduationCap} accent="indigo" />
            <StatCard title="Recettes de l'école" value={formatGNF(revenue)} icon={TrendingUp} accent="teal"
              hint="Scolarité, inscriptions, frais annexes" />
            <StatCard title="Dépenses totales" value={formatGNF(totalExpenses)} icon={TrendingDown} accent="rose"
              hint="Dépenses payées, toutes catégories" />
            <StatCard title="Balance globale" value={formatGNF(balance)} icon={balance >= 0 ? Wallet : Banknote}
              accent={balance >= 0 ? "indigo" : "rose"} hint="Recettes − dépenses, sans la masse salariale" />
            <StatCard title="Bénéfice du mois" value={formatGNF(monthlyProfit)} icon={monthlyProfit >= 0 ? Award : Banknote}
              accent={monthlyProfit >= 0 ? "emerald" : "rose"} hint="Recettes − dépenses − masse salariale, ce mois" />
          </div>
        </Reveal>
      )}

      {/* ── Derniers encaissements (date + heure précise) ────────────────── */}
      {loading ? <CardSkeleton lines={6} /> : (
        <Card>
          <CardHeader><CardTitle>Derniers encaissements</CardTitle></CardHeader>
          <CardBody>
            {recentPayments.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Pas encore d&apos;encaissements.</p>
            ) : (
              <Table>
                <THead><tr><TH>Date</TH><TH>Heure</TH><TH>Référence</TH><TH className="text-right">Montant</TH></tr></THead>
                <TBody>
                  {recentPayments.map((p) => (
                    <TR key={p.id}>
                      <TD>{p.paidAt?.slice(0, 10)}</TD>
                      <TD>{p.paidAt ? formatTime(p.paidAt.slice(11)) : "—"}</TD>
                      <TD className="font-mono text-xs">{p.reference}</TD>
                      <TD className="text-right font-semibold">{formatGNF(p.amount)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Facturé" value={formatGNF(founder?.recovery.overall.invoiced)} icon={Wallet} accent="indigo" />
            <StatCard title="Encaissé" value={formatGNF(founder?.recovery.overall.collected)} icon={TrendingUp} accent="emerald" />
            <StatCard title="Impayés" value={formatGNF(founder?.recovery.overall.outstanding)} icon={AlertTriangle} accent="rose"
              hint={`${founder?.recovery.overall.unpaidInvoices ?? 0} facture(s)`} />
            <StatCard title="Taux de recouvrement" value={pct(founder?.recovery.overall.recoveryRate)} icon={Award} accent="teal" />
            <StatCard title="SMS de relance (ce mois)" value={smsRecoveryThisMonth} icon={MessageSquare} accent="indigo"
              hint="Envoyés pour échéances impayées" />
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
            <CardHeader><CardTitle>Encaissé vs impayés</CardTitle></CardHeader>
            <CardBody>
              <PieBreakdownChart
                centerLabel="Facturé"
                valueFormatter={(v) => formatGNF(v)}
                data={[
                  { name: "Encaissé", value: Number(founder?.recovery.overall.collected ?? 0), color: "#10b981" },
                  { name: "Impayés", value: Number(founder?.recovery.overall.outstanding ?? 0), color: "#f43f5e" },
                ]}
              />
            </CardBody>
          </Card>
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
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
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
        </div>
      </section>

      {/* ── Masse salariale ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Masse salariale du mois</h2>
        {founderQuery.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Enseignants" value={formatGNF(founder?.payroll.teacherMonthlyPayroll)} icon={Users} accent="indigo"
              hint={`${founder?.payroll.teacherCount ?? 0} enseignant(s)`} />
            <StatCard title="Personnel administratif" value={formatGNF(founder?.payroll.staffMonthlyPayroll)} icon={Users} accent="teal"
              hint={`${founder?.payroll.staffCount ?? 0} membre(s)`} />
            <StatCard title="Total masse salariale" value={formatGNF(founder?.payroll.totalMonthlyPayroll)} icon={Wallet} accent="rose" />
            <StatCard title="Enseignants payés ce mois" value={`${teachersPaidCount} / ${teacherIds.size}`} icon={Award}
              accent={teachersUnpaidCount === 0 ? "emerald" : "amber"}
              hint={teachersUnpaidCount > 0 ? `${teachersUnpaidCount} pas encore payé(s)` : "Tous payés"} />
          </div>
        )}

        <h3 className="text-sm font-semibold text-gray-600">
          Masse salariale réelle (sur heures réalisées) — enseignants
        </h3>
        {founderQuery.loading ? (
          <div className="grid gap-4 sm:grid-cols-2"><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard title="Masse salariale réelle" value={formatGNF(founder?.realPayroll.teacherMonthlyPayroll)} icon={Wallet} accent="indigo"
              hint={`Sur ${formatMinutes(founder?.realPayroll.totalRealizedMinutes)} réalisées (cahier de textes)`} />
            <StatCard title="Retards & départs anticipés cumulés"
              value={formatMinutes((founder?.realPayroll.totalLateMinutes ?? 0) + (founder?.realPayroll.totalEarlyMinutes ?? 0))}
              icon={Clock} accent="amber"
              hint={
                <>
                  Retards {formatMinutes(founder?.realPayroll.totalLateMinutes)} · Départs anticipés {formatMinutes(founder?.realPayroll.totalEarlyMinutes)}
                  <br />
                  Coût estimé (déjà déduit du salaire) : <span className="font-semibold text-gray-600">{formatGNF(teacherPayrollGap)}</span>
                </>
              } />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Répartition de la masse salariale</CardTitle></CardHeader>
            <CardBody>
              <PieBreakdownChart
                centerLabel="Masse salariale"
                valueFormatter={(v) => formatGNF(v)}
                data={[
                  { name: "Enseignants", value: Number(founder?.payroll.teacherMonthlyPayroll ?? 0), color: "#6366f1" },
                  { name: "Personnel", value: Number(founder?.payroll.staffMonthlyPayroll ?? 0), color: "#14b8a6" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                Assiduité des enseignants — {MONTHS[now0.getMonth()]}
                {teacherAttendanceRate != null && <span className="ml-1.5 font-normal text-gray-400">({teacherAttendanceRate.toFixed(0)} %)</span>}
              </CardTitle>
            </CardHeader>
            <CardBody>
              {hr && hr.totalPresentDays + hr.totalAbsentDays > 0 ? (
                <PieBreakdownChart
                  centerLabel="Jours cumulés"
                  data={[
                    { name: "Présences", value: hr.totalPresentDays, color: "#10b981" },
                    { name: "Absences", value: hr.totalAbsentDays, color: "#f43f5e" },
                  ]}
                />
              ) : (
                <p className="py-10 text-center text-sm text-gray-400">Pas encore de pointages ce mois-ci.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── Salaire par enseignant ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Salaire par enseignant</h2>
        <p className="-mt-2 text-sm text-gray-500">
          Salaire du mois affiché, estimation cumulée jusqu&apos;à la fin de l&apos;année scolaire, et
          assiduité du mois — pour chaque enseignant individuellement.
        </p>
        {founderQuery.loading ? <CardSkeleton lines={5} /> : (
          <PersonGridSection
            items={founder?.teacherSalaries ?? []}
            getKey={(t) => t.teacherId}
            getName={(t) => t.teacherName}
            emptyLabel="Aucun enseignant configuré."
            searchPlaceholder="Rechercher un enseignant..."
            renderCard={(t) => (
              <PersonPayrollCard
                name={t.teacherName}
                photoUrl={teacherPhotoById.get(t.teacherId)}
                subtitle={teacherSpecializationById.get(t.teacherId) ?? "Enseignant"}
                monthlyAmount={Number(t.monthlyPay)}
                secondaryAmount={Number(t.annualProjection)}
                secondaryLabel="Estimation annuelle"
                attendanceRate={hrByTeacherId.get(t.teacherId)?.attendanceRate != null ? Number(hrByTeacherId.get(t.teacherId)!.attendanceRate) : null}
              />
            )}
          />
        )}
      </section>

      {/* ── Personnel administratif ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Personnel administratif</h2>
        <p className="-mt-2 text-sm text-gray-500">Salaire fixe mensuel, par membre du personnel non-enseignant.</p>
        {employeesQuery.loading ? <CardSkeleton lines={5} /> : (
          <PersonGridSection
            items={(employeesQuery.data ?? []).filter((e) => e.active)}
            getKey={(e) => e.id}
            getName={(e) => `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || "—"}
            emptyLabel="Aucun membre du personnel configuré."
            searchPlaceholder="Rechercher un membre du personnel..."
            renderCard={(e) => (
              <PersonPayrollCard
                name={`${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || "—"}
                subtitle={e.jobTitle ?? EMPLOYEE_CATEGORY_LABEL[e.category]}
                monthlyAmount={Number(e.baseSalary ?? 0)}
                monthlyLabel="Salaire fixe"
              />
            )}
          />
        )}
      </section>

      {/* ── Projection de la masse salariale sur l'année scolaire ────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Estimation de la masse salariale sur l&apos;année scolaire</h2>
        <p className="-mt-2 text-sm text-gray-500">
          Enseignants (heures théoriques selon l&apos;emploi du temps et le calendrier, jours fériés exclus,
          ou salaire fixe) + personnel non-enseignant, mois par mois — vue agrégée dans le temps,
          distincte du détail par enseignant ci-dessus.
        </p>
        {founderQuery.loading ? <CardSkeleton lines={5} /> : (
          <Card>
            <CardHeader><CardTitle>Évolution mensuelle</CardTitle></CardHeader>
            <CardBody>
              {payrollProjectionTrend.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">Pas encore de données.</p>
              ) : (
                <BarTrendChart data={payrollProjectionTrend} valueFormatter={(v) => formatGNF(v)}
                  series={[{ key: "Enseignants", name: "Enseignants", color: "#6366f1" }, { key: "Personnel", name: "Personnel", color: "#14b8a6" }]} />
              )}
            </CardBody>
          </Card>
        )}
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

const PEOPLE_PAGE_SIZE = 12;

/**
 * Grille de cartes « personne » (enseignant ou personnel) avec recherche par nom + affichage limité
 * par défaut — sans ça, une école avec une centaine d'enseignants/personnel rend la page interminable
 * à faire défiler.
 */
function PersonGridSection<T>({ items, getName, getKey, renderCard, emptyLabel, searchPlaceholder }: {
  items: T[];
  getName: (item: T) => string;
  getKey: (item: T) => string | number;
  renderCard: (item: T) => React.ReactNode;
  emptyLabel: string;
  searchPlaceholder: string;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((it) => getName(it).toLowerCase().includes(q)) : items;
  }, [items, search]);
  const visible = showAll ? filtered : filtered.slice(0, PEOPLE_PAGE_SIZE);

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {items.length > PEOPLE_PAGE_SIZE && (
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
          placeholder={searchPlaceholder} className="max-w-xs" />
      )}
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucun résultat.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((it) => <div key={getKey(it)}>{renderCard(it)}</div>)}
        </div>
      )}
      {!showAll && filtered.length > PEOPLE_PAGE_SIZE && (
        <div className="text-center">
          <Button variant="secondary" size="sm" onClick={() => setShowAll(true)}>
            Afficher les {filtered.length - PEOPLE_PAGE_SIZE} autres
          </Button>
        </div>
      )}
    </div>
  );
}
