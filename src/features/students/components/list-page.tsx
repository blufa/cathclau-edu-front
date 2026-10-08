"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Upload } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useSubscription } from "@/providers/subscription-provider";
import { hasAnyPermission, hasPermission, hasRole } from "@/lib/auth/permissions";
import type { CreateStudentInput, EnrollmentStatus, Gender, Student, StudentSummary } from "@/lib/types/student";
import { useQuery } from "@/hooks/use-query";
import { getCurrentAcademicYear, listClasses } from "@/lib/api/academics";
import { getStaffChildCoverageBatch, getUncoveredStaffChildIds, listExemptions } from "@/lib/api/billing";
import type { Exemption } from "@/lib/types/billing";
import { getTransportPaidMonthsCount, listSubscriptions } from "@/lib/api/transport";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { QuotaProgress } from "@/components/platform/quota-progress";
import { QuickBadgeButton } from "@/components/biometric/quick-badge-button";
import { StudentForm } from "./student-form";
import { Reveal } from "@/components/public/reveal";
import { Meteors } from "@/components/ui/aceternity";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { useDeleteStudentMutation, useStudentsSummaryQuery, useUpdateStudentMutation } from "../hooks/use-students";

const PAGE_SIZE = 20;

function initials(s: Student) {
  return `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function StudentsPage() {
  const { user } = useAuth();
  const { plan, tenantScoped, refresh: refreshSubscription } = useSubscription();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "SECRETARY", "DIRECTOR") || hasAnyPermission(user, ["eleve:create", "eleve:update"]);
  const canDelete = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasPermission(user, "eleve:delete");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [status, setStatus] = useState<EnrollmentStatus | "NOT_ENROLLED" | "">("");
  const [transportFilter, setTransportFilter] = useState<"" | "SUBSCRIBED" | "NOT_SUBSCRIBED">("");
  const [minPaidMonths, setMinPaidMonths] = useState<"" | "0" | "1" | "2" | "3">("");
  const [page, setPage] = useState(0);

  const [editing, setEditing] = useState<Student | null>(null);

  // Résumé (élève + classe courante + parent principal) en un seul appel, déjà trié alphabétiquement
  // (nom, ascendant) côté serveur — voir searchStudentsSummary. Les filtres transport (abonné / mois
  // payés) sont passés tels quels à l'API (§retour comptable : "filtrer par transport, pour chercher
  // rapidement") — minPaidMonths="0" signifie "aucun mois payé" (égalité exacte côté serveur), toute
  // autre valeur signifie "au moins N mois payés".
  const { data, isLoading: loading, error } = useStudentsSummaryQuery({
    search: search || undefined,
    gender: gender || undefined,
    enrollmentStatus: status && status !== "NOT_ENROLLED" ? status : undefined,
    notEnrolled: status === "NOT_ENROLLED" || undefined,
    transportSubscribed: transportFilter === "SUBSCRIBED" ? true : transportFilter === "NOT_SUBSCRIBED" ? false : undefined,
    minPaidMonths: minPaidMonths ? Number(minPaidMonths) : undefined,
    page,
    size: PAGE_SIZE,
  });
  const updateMutation = useUpdateStudentMutation();
  const deleteMutation = useDeleteStudentMutation();

  // Libellés de classe (colonne « Classe ») — résolus depuis l'année scolaire courante.
  const currentYearQuery = useQuery(() => getCurrentAcademicYear(), []);
  const classesQuery = useQuery(
    () => (currentYearQuery.data ? listClasses(currentYearQuery.data.id) : Promise.resolve([])),
    [currentYearQuery.data?.id],
  );
  const classLabelById = useMemo(() => new Map(classesQuery.data?.map((c) => [c.id, c.label]) ?? []), [classesQuery.data]);

  // Abonnements + mois payés transport, tout le tenant (mis en cache) : servent uniquement au badge
  // « Transport » affiché sur chaque ligne (le filtrage lui-même est désormais fait côté serveur, voir
  // ci-dessus).
  const subscriptionsQuery = useCachedQuery("transport-subscriptions-all", () => listSubscriptions(), []);
  const activeTransportStudentIds = useMemo(
    () => new Set((subscriptionsQuery.data ?? []).filter((s) => s.status === "ACTIVE").map((s) => s.studentId)),
    [subscriptionsQuery.data],
  );
  const transportPaidMonthsQuery = useCachedQuery("transport-paid-months-count", () => getTransportPaidMonthsCount(), []);
  const transportPaidMonthsByStudentId = useMemo(
    () => new Map(Object.entries(transportPaidMonthsQuery.data ?? {}).map(([id, count]) => [Number(id), count])),
    [transportPaidMonthsQuery.data],
  );

  const pageStudentIds = useMemo(() => (data?.content ?? []).map((row) => row.student.id), [data]);

  // Badge « Enfant de personnel » : parmi les élèves affichés, ceux pris en charge (partiellement ou
  // totalement) via la politique de prise en charge des enfants du personnel (§6, frais MENSUALITE).
  const staffCoverageQuery = useQuery(
    () => getStaffChildCoverageBatch(pageStudentIds, "MONTHLY"),
    [pageStudentIds.join(",")],
  );
  const staffCoverageByStudentId = useMemo(
    () => new Map((staffCoverageQuery.data ?? []).map((c) => [c.studentId, c])),
    [staffCoverageQuery.data],
  );

  // Badge « Prélevé sur salaire » : enfants du personnel SANS aucune remise (donc absents du badge
  // ci-dessus, basé sur la politique de rang) — leur scolarité est quand même prélevée automatiquement
  // sur le salaire du parent (§retour comptable), sans que rien ne le montre sinon.
  const uncoveredStaffChildQuery = useQuery(
    () => getUncoveredStaffChildIds(pageStudentIds),
    [pageStudentIds.join(",")],
  );
  const uncoveredStaffChildIds = useMemo(() => new Set(uncoveredStaffChildQuery.data ?? []), [uncoveredStaffChildQuery.data]);

  // Badge « Exonéré » : pour que le comptable repère directement, sans ouvrir chaque fiche, les élèves
  // qui ont une exonération active (totale, partielle ou exceptionnelle — accordée à l'inscription,
  // §billing/Exonérations). Un élève peut avoir plusieurs exonérations (une par type de frais) : on
  // n'affiche que la plus avantageuse (le plus haut pourcentage), le motif complet reste en info-bulle.
  const exemptionsQuery = useQuery(() => listExemptions(), []);
  const exemptionByStudentId = useMemo(() => {
    const map = new Map<number, Exemption>();
    for (const e of exemptionsQuery.data ?? []) {
      if (!e.active) continue;
      const pct = e.percentage != null ? Number(e.percentage) : e.type === "TOTAL" ? 100 : 0;
      const current = map.get(e.studentId);
      const currentPct = current ? (current.percentage != null ? Number(current.percentage) : current.type === "TOTAL" ? 100 : 0) : -1;
      if (!current || pct > currentPct) map.set(e.studentId, e);
    }
    return map;
  }, [exemptionsQuery.data]);

  // Quota: limit from the current plan, consumed approximated by the total student count.
  const studentLimit = plan?.studentLimit ?? null;
  const consumedStudents = data?.totalElements ?? 0;
  const limitReached = studentLimit != null && consumedStudents >= studentLimit;

  // Dynamic search: results update as you type (debounced 300 ms), no button needed.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  }

  async function handleUpdate(input: CreateStudentInput) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input });
    setEditing(null);
    notifySuccess("Élève mis à jour");
  }

  function handleDelete(student: StudentSummary["student"]) {
    confirmAction({
      title: "Archiver l'élève",
      message: `Archiver l'élève ${student.firstName} ${student.lastName} ?`,
      confirmLabel: "Archiver",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(student.id);
          notifySuccess("Élève archivé");
          refreshSubscription();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  const columns: Column<StudentSummary>[] = [
    {
      key: "studentNumber",
      header: "Matricule",
      accessor: (row) => row.student.studentNumber ?? "",
      render: (row) => <span className="font-mono text-xs text-slate-500">{row.student.studentNumber}</span>,
    },
    {
      key: "name",
      header: "Élève",
      accessor: (row) => `${row.student.firstName} ${row.student.lastName}`,
      render: (row) => (
        <Link href={`/students/detail?id=${row.student.id}`} className="group flex items-center gap-3">
          {row.student.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.student.photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
              {initials(row.student)}
            </span>
          )}
          <span className="font-medium text-slate-900 group-hover:text-brand-700">
            {row.student.firstName} {row.student.lastName}
          </span>
          {staffCoverageByStudentId.has(row.student.id) && (
            <Badge
              tone="indigo"
              title={staffCoverageByStudentId.get(row.student.id)?.policyLabel ?? "Enfant de personnel pris en charge par l'école"}
            >
              Enfant de personnel −{staffCoverageByStudentId.get(row.student.id)?.coveragePercent}%
            </Badge>
          )}
          {uncoveredStaffChildIds.has(row.student.id) && (
            <Badge tone="blue" title="Enfant du personnel sans remise — scolarité prélevée automatiquement sur le salaire du parent">
              Enfant de personnel — prélevé sur salaire
            </Badge>
          )}
          {activeTransportStudentIds.has(row.student.id) && (() => {
            const paidMonths = transportPaidMonthsByStudentId.get(row.student.id) ?? 0;
            return (
              <Badge
                tone={paidMonths > 0 ? "blue" : "amber"}
                title={paidMonths > 0
                  ? `Abonné au transport — ${paidMonths} mois déjà réglé(s)`
                  : "Abonné au transport — aucun mois encore réglé"}
              >
                Transport {paidMonths} mois
              </Badge>
            );
          })()}
          {exemptionByStudentId.has(row.student.id) && (
            <Badge
              tone={exemptionByStudentId.get(row.student.id)?.type === "TOTAL" ? "green" : exemptionByStudentId.get(row.student.id)?.type === "EXCEPTIONAL" ? "blue" : "amber"}
              title={exemptionByStudentId.get(row.student.id)?.reason ?? undefined}
            >
              {exemptionByStudentId.get(row.student.id)?.type === "TOTAL"
                ? "Exonéré 100%"
                : exemptionByStudentId.get(row.student.id)?.percentage != null
                  ? `Exonéré ${exemptionByStudentId.get(row.student.id)?.percentage}%`
                  : "Remise exceptionnelle"}
            </Badge>
          )}
        </Link>
      ),
    },
    {
      key: "gender",
      header: "Sexe",
      accessor: (row) => (row.student.gender === "FEMALE" ? "F" : "M"),
      render: (row) => (
        <Badge tone={row.student.gender === "FEMALE" ? "indigo" : "blue"}>{row.student.gender === "FEMALE" ? "F" : "M"}</Badge>
      ),
    },
    {
      key: "class",
      header: "Classe",
      accessor: (row) => (row.classId != null ? (classLabelById.get(row.classId) ?? "") : ""),
      render: (row) => (row.classId != null ? (classLabelById.get(row.classId) ?? `#${row.classId}`) : "—"),
    },
    {
      key: "parent",
      header: "Parent",
      accessor: (row) => row.principalParentName ?? "",
      render: (row) => row.principalParentName ?? "—",
    },
    {
      key: "parentPhone",
      header: "Numéro parent",
      accessor: (row) => row.principalParentPhone ?? "",
      render: (row) => row.principalParentPhone ?? "—",
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => {
        const s = row.student;
        return (
          <div className="flex justify-end gap-2">
            <QuickBadgeButton studentId={s.id} studentName={`${s.firstName} ${s.lastName}`} studentNumber={s.studentNumber} photoUrl={s.photo} classId={row.classId} />
            {canWrite && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                Modifier
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(s)}>
                Archiver
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Élèves</h1>
          <p className="text-sm text-slate-500">Gestion des élèves de l&apos;établissement</p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button component={Link} href="/students/import" variant="outline" leftSection={<Upload className="h-4 w-4" />}>
              Import CSV
            </Button>
            {/* La création d'un élève se fait toujours via son inscription (Inscriptions → Inscrire) —
                jamais « à vide » depuis cette liste, pour garantir qu'un élève créé passe par le parent
                et la classe dès le départ. */}
            <Button component={Link} href="/enrollments" variant="secondary">
              Inscrire un élève
            </Button>
          </div>
        )}
      </Reveal>

      {/* Quota gauge (key constraint of the module) */}
      {tenantScoped && plan && (
        <Reveal y={12}>
          <Card className="relative overflow-hidden">
            {limitReached && <Meteors number={12} />}
            <CardBody className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-[220px] flex-1">
                <QuotaProgress consumed={consumedStudents} limit={studentLimit} />
              </div>
              {limitReached && (
                <Link
                  href="/subscription"
                  className="shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Changer de plan
                </Link>
              )}
            </CardBody>
          </Card>
        </Reveal>
      )}

      <form onSubmit={applySearch} className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="w-full pl-9"
            placeholder="Rechercher (nom, matricule)…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <SearchableSelect
          triggerClassName="max-w-[160px] justify-between px-3"
          value={gender}
          onChange={(v) => { setPage(0); setGender(v as Gender | ""); }}
          options={[
            { value: "", trigger: "Tous sexes", label: "Tous sexes", searchText: "tous" },
            { value: "MALE", trigger: "Masculin", label: "Masculin", searchText: "masculin" },
            { value: "FEMALE", trigger: "Féminin", label: "Féminin", searchText: "féminin" },
          ]}
        />
        <SearchableSelect
          triggerClassName="max-w-[200px] justify-between px-3"
          value={status}
          onChange={(v) => { setPage(0); setStatus(v as EnrollmentStatus | "NOT_ENROLLED" | ""); }}
          options={[
            { value: "", trigger: "Toutes inscriptions", label: "Toutes inscriptions", searchText: "toutes" },
            { value: "NOT_ENROLLED", trigger: "Non inscrits", label: "Non inscrits", searchText: "non inscrits" },
            { value: "PENDING", trigger: "En attente", label: "En attente", searchText: "en attente" },
            { value: "VALIDATED", trigger: "Validée", label: "Validée", searchText: "validée" },
            { value: "CANCELLED", trigger: "Annulée", label: "Annulée", searchText: "annulée" },
          ]}
        />
        <SearchableSelect
          triggerClassName="max-w-[200px] justify-between px-3"
          value={transportFilter}
          onChange={(v) => { setPage(0); setTransportFilter(v as "" | "SUBSCRIBED" | "NOT_SUBSCRIBED"); }}
          options={[
            { value: "", trigger: "Tous (transport)", label: "Tous (transport)", searchText: "tous transport" },
            { value: "SUBSCRIBED", trigger: "Abonnés au transport", label: "Abonnés au transport", searchText: "abonnés transport" },
            { value: "NOT_SUBSCRIBED", trigger: "Non abonnés", label: "Non abonnés", searchText: "non abonnés transport" },
          ]}
        />
        <SearchableSelect
          triggerClassName="max-w-[220px] justify-between px-3"
          value={minPaidMonths}
          onChange={(v) => { setPage(0); setMinPaidMonths(v as "" | "0" | "1" | "2" | "3"); }}
          options={[
            { value: "", trigger: "Tous (mois payés)", label: "Tous (mois payés)", searchText: "tous mois payés" },
            { value: "0", trigger: "Aucun mois payé", label: "Aucun mois payé", searchText: "aucun mois payé" },
            { value: "1", trigger: "Au moins 1 mois payé", label: "Au moins 1 mois payé", searchText: "1 mois payé" },
            { value: "2", trigger: "Au moins 2 mois payés", label: "Au moins 2 mois payés", searchText: "2 mois payés" },
            { value: "3", trigger: "Au moins 3 mois payés", label: "Au moins 3 mois payés", searchText: "3 mois payés" },
          ]}
        />
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      <DataTable
        columns={columns}
        page={data}
        loading={loading}
        error={!!error}
        getRowKey={(row) => row.student.id}
        onPageChange={setPage}
        emptyLabel="Aucun élève trouvé."
        columnToggle
        exportable
        exportFilename="eleves.csv"
        initialColumnVisibility={{ actions: false }}
      />

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'élève" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {editing && (
          <StudentForm
            initial={editing}
            submitLabel="Enregistrer"
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
