"use client";

import { useMemo, useState } from "react";
import {
  Award,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getCurrentAcademicYear, listAcademicYears } from "@/lib/api/academics";
import { getAbandonedStudents, getFounderDashboard, getHrDashboard } from "@/lib/api/reporting";
import { listEmployees, listTeachers } from "@/lib/api/staff";
import { listPayslips } from "@/lib/api/payroll";
import { EMPLOYEE_CATEGORY_LABEL } from "@/components/staff/employee-form";
import { StatCard } from "@/components/ui/stat-card";
import { StatCardSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { PersonPayrollCard } from "./person-payroll-card";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";

/**
 * Vision Fondateur (§14) : masse salariale réelle par enseignant/personnel et élèves pris en charge
 * (exonérations, remises fratrie) pour l'année scolaire courante. Les cartes théoriques/redondantes
 * avec le tableau de bord principal (recouvrement, masse salariale projetée, dépenses, alertes
 * automatiques) ont été retirées (§retour fondateur : "n'ont pas de sens") — ce qui compte réellement
 * (salaires payés, heures réalisées) est déjà sur /dashboard depuis les correctifs état financier.
 */
export default function FounderDashboard() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;

  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, () => listTeachers(), [tenantId]);
  const employeesQuery = useCachedQuery(tenantId ? `employees-all:${tenantId}` : null, () => listEmployees(), [tenantId]);
  const now0 = new Date();
  const hrQuery = useQuery(() => getHrDashboard(now0.getFullYear(), now0.getMonth() + 1), []);
  // Fiches de paie enseignants du mois — pour distinguer qui est déjà payé de qui ne l'est pas encore.
  const payslipsQuery = useQuery(() => listPayslips(), []);

  // Détails/projections repliés par défaut : chiffres utiles mais moins urgents au quotidien que le
  // reste de la page (heures réalisées par enseignant).
  const [showPayrollDetails, setShowPayrollDetails] = useState(false);

  const teacherPhotoById = new Map((teachersQuery.data ?? []).map((t) => [t.id, t.photo]));
  const teacherSpecializationById = new Map((teachersQuery.data ?? []).map((t) => [t.id, t.specialization]));
  const hrByTeacherId = new Map((hrQuery.data?.teachers ?? []).map((t) => [t.teacherId, t]));

  const currentMonthKey = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, "0")}`;

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

  // ── Année scolaire courante + précédente (comparatif automatique côté API, §V3) ────
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

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vision Fondateur</h1>
      </Reveal>

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

      {/* ── Salaire par enseignant ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Salaire par enseignant</h2>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard title="Enseignants payés ce mois" value={`${teachersPaidCount} / ${teacherIds.size}`} icon={Award}
            accent={teachersUnpaidCount === 0 ? "emerald" : "amber"}
            hint={teachersUnpaidCount > 0 ? `${teachersUnpaidCount} pas encore payé(s)` : "Tous payés"} />
          <StatCard title="Personnel payé ce mois" value={`${employeesPaidCount} / ${activeEmployeeIds.size}`} icon={Award}
            accent={employeesUnpaidCount === 0 ? "emerald" : "amber"}
            hint={employeesUnpaidCount > 0 ? `${employeesUnpaidCount} pas encore payé(s)` : "Tous payés"} />
        </div>
      </section>

      {/* ── Personnel administratif ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Personnel administratif</h2>
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

      {/* ── Détails (replié par défaut) ───────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setShowPayrollDetails((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        {showPayrollDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Détails (heures réalisées du mois)
      </button>

      {showPayrollDetails && (
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
      )}

      {/* ── Élèves pris en charge ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Élèves pris en charge</h2>
        {founderQuery.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Exonérations actives" value={(founder?.subsidy.totalExemptions ?? 0) + (founder?.subsidy.partialExemptions ?? 0)} icon={Users} accent="indigo"
              hint={`${founder?.subsidy.totalExemptions ?? 0} totale(s) (${formatGNF(founder?.subsidy.totalExemptionEstimatedValue)}), `
                + `${founder?.subsidy.partialExemptions ?? 0} partielle(s) (${formatGNF(founder?.subsidy.exemptionDiscountAmount)})`} />
            <StatCard title="Remises exonérations appliquées" value={formatGNF(founder?.subsidy.exemptionDiscountAmount)} icon={Wallet} accent="teal"
              hint={`${founder?.subsidy.exemptionDiscountInvoiceCount ?? 0} facture(s), dont ${founder?.subsidy.exemptionDiscountInvoicePaidCount ?? 0} encaissée(s)`} />
            {/* Une exonération à 100% ne produit jamais de facture (pour qu'elle ne soit jamais cochée
                par erreur avec le reste à l'encaissement) — donc jamais comptée dans la carte
                "Remises appliquées" ci-dessus, basée sur de vraies factures. Carte séparée, "estimée"
                pour que le fondateur ne confonde pas les deux montants (§retour fondateurs). */}
            <StatCard title="Valeur estimée des exonérations totales" value={formatGNF(founder?.subsidy.totalExemptionEstimatedValue)} icon={Wallet} accent="indigo"
              hint="Estimation — aucune facture générée pour une exonération à 100%" />
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
