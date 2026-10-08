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
import { getTransportPaidStudentIds, listSubscriptions } from "@/lib/api/transport";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  const [page, setPage] = useState(0);

  const [editing, setEditing] = useState<Student | null>(null);

  // Résumé (élève + classe courante + parent principal) en un seul appel, déjà trié alphabétiquement
  // (nom, ascendant) côté serveur — voir searchStudentsSummary.
  const { data, isLoading: loading, error } = useStudentsSummaryQuery({
    search: search || undefined,
    gender: gender || undefined,
    enrollmentStatus: status && status !== "NOT_ENROLLED" ? status : undefined,
    notEnrolled: status === "NOT_ENROLLED" || undefined,
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

  // Badge « Transport » (§retour comptable : "savoir qui a payé le transport") : élèves actuellement
  // abonnés à une ligne de bus — pas de filtre studentId côté API, donc tous les abonnements du
  // tenant sont récupérés une seule fois (mis en cache) puis filtrés sur ceux affichés à l'écran.
  // Distingue en plus ceux qui ont déjà réellement réglé au moins un mois de ceux qui n'ont encore
  // rien payé (le transport est facturé mois par mois, à la demande — un abonnement actif ne veut pas
  // dire qu'une facture a déjà été générée/encaissée).
  const subscriptionsQuery = useCachedQuery("transport-subscriptions-all", () => listSubscriptions(), []);
  const activeTransportStudentIds = useMemo(
    () => new Set((subscriptionsQuery.data ?? []).filter((s) => s.status === "ACTIVE").map((s) => s.studentId)),
    [subscriptionsQuery.data],
  );
  const transportPaidQuery = useCachedQuery("transport-paid-student-ids", () => getTransportPaidStudentIds(), []);
  const transportPaidStudentIds = useMemo(() => new Set(transportPaidQuery.data ?? []), [transportPaidQuery.data]);

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
          {activeTransportStudentIds.has(row.student.id) && (
            transportPaidStudentIds.has(row.student.id) ? (
              <Badge tone="blue" title="Abonné au transport — au moins un mois déjà réglé">
                Transport — payé
              </Badge>
            ) : (
              <Badge tone="amber" title="Abonné au transport — aucun mois encore réglé">
                Transport — pas payé
              </Badge>
            )
          )}
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
        <Select
          className="max-w-[160px]"
          value={gender}
          onChange={(e) => {
            setPage(0);
            setGender(e.target.value as Gender | "");
          }}
        >
          <option value="">Tous sexes</option>
          <option value="MALE">Masculin</option>
          <option value="FEMALE">Féminin</option>
        </Select>
        <Select
          className="max-w-[200px]"
          value={status}
          onChange={(e) => {
            setPage(0);
            setStatus(e.target.value as EnrollmentStatus | "NOT_ENROLLED" | "");
          }}
        >
          <option value="">Toutes inscriptions</option>
          <option value="NOT_ENROLLED">Non inscrits</option>
          <option value="PENDING">En attente</option>
          <option value="VALIDATED">Validée</option>
          <option value="CANCELLED">Annulée</option>
        </Select>
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
