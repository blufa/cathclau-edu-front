"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GraduationCap,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listExpenses } from "@/lib/api/expense";
import { getCurrentAcademicYear, listAcademicYears } from "@/lib/api/academics";
import { getAbandonedStudents, getFounderDashboard, getHrDashboard } from "@/lib/api/reporting";
import { listEmployees, listTeachers } from "@/lib/api/staff";
import { listPayslips } from "@/lib/api/payroll";
import { listCommunicationsByTenant } from "@/lib/api/communication";
import { checkOverdueInstallmentsNow } from "@/lib/api/billing";
import { searchStudents } from "@/lib/api/students";
import { notifyError, notifySuccess } from "@/lib/feedback";
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
import { formatGNF, formatMinutes } from "@/lib/format";

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

  const expensesQuery = useQuery(() => listExpenses(), []);
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, () => listTeachers(), [tenantId]);
  const employeesQuery = useCachedQuery(tenantId ? `employees-all:${tenantId}` : null, () => listEmployees(), [tenantId]);
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
  const loading = expensesQuery.loading;

  // Le job de relance des échéances en retard ne tourne automatiquement qu'une fois par jour à 6h —
  // ce bouton permet de le déclencher tout de suite (utile en test, ou si le serveur n'a pas tourné en
  // continu depuis le dernier passage), plutôt que d'attendre le lendemain matin pour voir un résultat.
  const [checkingOverdue, setCheckingOverdue] = useState(false);
  // Détails/projections repliés par défaut : chiffres utiles mais moins urgents au quotidien que le
  // reste de la page (heures réalisées par enseignant, projection sur toute l'année scolaire).
  const [showPayrollDetails, setShowPayrollDetails] = useState(false);
  async function runOverdueCheckNow() {
    setCheckingOverdue(true);
    try {
      await checkOverdueInstallmentsNow();
      notifySuccess("Vérification des échéances en retard effectuée.");
      communicationsQuery.refetch();
    } catch (err) { notifyError(err); } finally { setCheckingOverdue(false); }
  }

  const expenses = expensesQuery.data ?? [];
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const teacherPhotoById = new Map((teachersQuery.data ?? []).map((t) => [t.id, t.photo]));
  const teacherSpecializationById = new Map((teachersQuery.data ?? []).map((t) => [t.id, t.specialization]));
  const hrByTeacherId = new Map((hrQuery.data?.teachers ?? []).map((t) => [t.teacherId, t]));

  const currentMonthKey = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, "0")}`;

  // SMS de relance de recouvrement envoyés ce mois (motif PAYMENT_DUE, canal SMS uniquement).
  const smsRecoveryThisMonth = (communicationsQuery.data ?? []).filter(
    (c) => c.channel === "SMS" && c.reason === "PAYMENT_DUE" && (c.sentAt ?? "").startsWith(currentMonthKey),
  ).length;

  // Enseignants payés / non payés ce mois — distingue les fiches déjà réglées (statut PAID) du reste.
  // employeeType filtré explicitement : teacherId est un champ partagé entre les référentiels
  // Teacher/Employee (deux séquences d'identifiants distinctes pouvant coïncider), sans quoi un
  // employé portant le même numéro qu'un enseignant pouvait être compté comme "payé" à sa place.
  const teacherIds = new Set((teachersQuery.data ?? []).map((t) => t.id));
  const paidTeacherIdsThisMonth = new Set(
    (payslipsQuery.data ?? [])
      .filter((p) => p.employeeType === "TEACHER" && teacherIds.has(p.teacherId)
        && (p.periodStart ?? "").startsWith(currentMonthKey) && p.status === "PAID")
      .map((p) => p.teacherId),
  );
  const teachersPaidCount = paidTeacherIdsThisMonth.size;
  const teachersUnpaidCount = Math.max(0, teacherIds.size - teachersPaidCount);

  // Personnel administratif payé / non payé ce mois — même logique, côté Employee.
  const activeEmployeeIds = new Set((employeesQuery.data ?? []).filter((e) => e.active).map((e) => e.id));
  const paidEmployeeIdsThisMonth = new Set(
    (payslipsQuery.data ?? [])
      .filter((p) => p.employeeType !== "TEACHER" && activeEmployeeIds.has(p.teacherId)
        && (p.periodStart ?? "").startsWith(currentMonthKey) && p.status === "PAID")
      .map((p) => p.teacherId),
  );
  const employeesPaidCount = paidEmployeeIdsThisMonth.size;
  const employeesUnpaidCount = Math.max(0, activeEmployeeIds.size - employeesPaidCount);

  // ── Année scolaire courante + précédente (comparatif automatique, §V3) ────
  const { data: currentYear } = useQuery(() => getCurrentAcademicYear(), []);
  const { data: allYears } = useCachedQuery("academic-years", () => listAcademicYears(), []);
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

  // Élèves partis en cours d'année (abandon) : leurs anciennes factures impayées ont été annulées
  // automatiquement (voir EnrollmentAbandonedInvoiceListener côté billing) — cette liste permet au
  // comptable de justifier pourquoi ces montants ont disparu des statistiques de recouvrement,
  // plutôt que de sembler oubliés ou effacés sans explication.
  const abandonedQuery = useQuery(
    () => (currentYear ? getAbandonedStudents(currentYear.id) : Promise.resolve([])),
    [currentYear?.id],
  );
  const abandonedStudents = abandonedQuery.data ?? [];

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
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCardSkeleton /><StatCardSkeleton />
        </div>
      ) : (
        <Reveal y={12}>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard title="Élèves dans l'école" value={studentsCountQuery.data ?? 0} icon={GraduationCap} accent="indigo" />
            <StatCard title="Dépenses totales" value={formatGNF(totalExpenses)} icon={TrendingDown} accent="rose"
              hint="Dépenses payées, toutes catégories (toutes périodes confondues)" />
          </div>
        </Reveal>
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
            <StatCard title="Encaissé" value={formatGNF(founder?.recovery.overall.collected)} icon={TrendingUp} accent="emerald"
              hint={`${founder?.recovery.overall.paidCount ?? 0} facture(s)`} />
            <StatCard title="Impayés" value={formatGNF(founder?.recovery.overall.outstanding)} icon={AlertTriangle} accent="rose"
              hint={`${founder?.recovery.overall.unpaidCount ?? 0} facture(s)`} />
            <StatCard title="Taux de recouvrement" value={pct(founder?.recovery.overall.recoveryRate)} icon={Award} accent="teal" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" loading={checkingOverdue} onClick={runOverdueCheckNow}>
            Vérifier les échéances en retard maintenant
          </Button>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <MessageSquare className="h-3.5 w-3.5" /> {smsRecoveryThisMonth} SMS de relance envoyé(s) ce mois
          </span>
          <p className="w-full text-xs text-gray-400 sm:w-auto">
            La relance automatique ne tourne qu&apos;une fois par jour à 6h — utile pour tester sans
            attendre le lendemain.
          </p>
        </div>

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
      </section>

      {/* ── Élèves partis en cours d'année (abandon) ─────────────────────── */}
      {!abandonedQuery.loading && abandonedStudents.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Élèves partis en cours d&apos;année (abandon)</h2>
            <p className="text-sm text-gray-500">
              Leurs anciennes factures impayées ont été annulées automatiquement à l&apos;abandon — ne
              comptent plus dans les impayés ci-dessus. Ce qui avait déjà été encaissé n&apos;est jamais
              touché.
            </p>
          </div>
          <Table>
            <THead>
              <tr><TH>Élève</TH><TH>Classe</TH><TH className="text-right">Factures annulées</TH></tr>
            </THead>
            <TBody>
              {abandonedStudents.map((a) => (
                <TR key={a.studentId}>
                  <TD className="font-medium text-gray-900">{a.studentName}</TD>
                  <TD className="text-gray-600">{a.className ?? "—"}</TD>
                  <TD className="text-right text-gray-600">{formatGNF(a.writtenOffAmount)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      )}

      {/* ── Masse salariale ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Masse salariale du mois</h2>
        {founderQuery.loading ? (
          <div className="grid gap-4 sm:grid-cols-3"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Masse salariale théorique" value={formatGNF(founder?.payroll.totalMonthlyPayroll)} icon={Wallet} accent="rose"
              hint={`${founder?.payroll.teacherCount ?? 0} enseignant(s) (${formatGNF(founder?.payroll.teacherMonthlyPayroll)}) + ${founder?.payroll.staffCount ?? 0} personnel (${formatGNF(founder?.payroll.staffMonthlyPayroll)}) — estimation, pas forcément déjà versée`} />
            <StatCard title="Enseignants payés ce mois" value={`${teachersPaidCount} / ${teacherIds.size}`} icon={Award}
              accent={teachersUnpaidCount === 0 ? "emerald" : "amber"}
              hint={teachersUnpaidCount > 0 ? `${teachersUnpaidCount} pas encore payé(s)` : "Tous payés"} />
            <StatCard title="Personnel payé ce mois" value={`${employeesPaidCount} / ${activeEmployeeIds.size}`} icon={Award}
              accent={employeesUnpaidCount === 0 ? "emerald" : "amber"}
              hint={employeesUnpaidCount > 0 ? `${employeesUnpaidCount} pas encore payé(s)` : "Tous payés"} />
          </div>
        )}
      </section>

      {/* ── Salaire par enseignant ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Salaire par enseignant</h2>
        <p className="-mt-2 text-sm text-gray-500">
          Estimation théorique (emploi du temps/tarif horaire, ou salaire fixe) du mois et projection
          cumulée jusqu&apos;à la fin de l&apos;année scolaire — pas forcément le montant déjà versé,
          voir la fiche de paie réelle de l&apos;enseignant pour ce qui a été effectivement payé.
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

      {/* ── Détails & projections (repliés par défaut) ───────────────────── */}
      <button
        type="button"
        onClick={() => setShowPayrollDetails((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        {showPayrollDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Détails & projections (heures réalisées, estimation sur l&apos;année)
      </button>

      {showPayrollDetails && (
      <>
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
        <p className="-mt-2 text-sm text-gray-500">
          Masse salariale sur heures réellement réalisées (cahier de textes) : {formatGNF(founder?.realPayroll.teacherMonthlyPayroll)}
          {" "}sur {formatMinutes(founder?.realPayroll.totalRealizedMinutes)} — écart de {formatGNF(teacherPayrollGap)} avec
          {" "}l&apos;estimation théorique ci-dessus, principalement dû aux séances non réalisées (annulées ou non
          {" "}encore consignées), pas aux simples retards/départs anticipés (informatifs, jamais déduits du salaire).
        </p>
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
      </>
      )}

      {/* ── Élèves pris en charge ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Élèves pris en charge</h2>
        {founderQuery.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Exonérations actives" value={(founder?.subsidy.totalExemptions ?? 0) + (founder?.subsidy.partialExemptions ?? 0)} icon={Users} accent="indigo"
              hint={`${founder?.subsidy.totalExemptions ?? 0} totale(s), ${founder?.subsidy.partialExemptions ?? 0} partielle(s)`} />
            <StatCard title="Remises exonérations appliquées" value={formatGNF(founder?.subsidy.exemptionDiscountAmount)} icon={Wallet} accent="teal"
              hint={`${founder?.subsidy.exemptionDiscountInvoiceCount ?? 0} facture(s), dont ${founder?.subsidy.exemptionDiscountInvoicePaidCount ?? 0} encaissée(s)`} />
            <StatCard title="Élèves à jour sur l'année" value={founder?.subsidy.studentsFullySettledMonthlyFees ?? 0} icon={Award} accent="emerald"
              hint="Toutes les mensualités payées" />
          </div>
        )}
      </section>
    </div>
  );
}

const PEOPLE_PAGE_SIZE = 12;

/**
 * Grille de cartes « personne » (enseignant ou personnel) avec recherche par nom + pagination — sans
 * ça, une école avec une centaine d'enseignants/personnel rend la page interminable à faire défiler
 * (et « afficher tout » n'aide pas : la liste redevient interminable dès qu'on clique).
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
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((it) => getName(it).toLowerCase().includes(q)) : items;
  }, [items, search, getName]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PEOPLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PEOPLE_PAGE_SIZE, (currentPage + 1) * PEOPLE_PAGE_SIZE);

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {items.length > PEOPLE_PAGE_SIZE && (
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder={searchPlaceholder} className="max-w-xs" />
      )}
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucun résultat.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((it) => <div key={getKey(it)}>{renderCard(it)}</div>)}
        </div>
      )}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-500">Page {currentPage + 1} / {pageCount}</span>
          <Button variant="secondary" size="sm" disabled={currentPage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
