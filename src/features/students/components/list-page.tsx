"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Upload, UserPlus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useSubscription } from "@/providers/subscription-provider";
import { hasRole } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import type { CreateStudentInput, EnrollmentStatus, Gender, Student } from "@/lib/types/student";
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
import { EnrollModal } from "@/features/enrollments/components/enroll-modal";
import { Reveal } from "@/components/public/reveal";
import { Meteors } from "@/components/ui/aceternity";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { useCreateStudentMutation, useDeleteStudentMutation, useStudentsQuery, useUpdateStudentMutation } from "../hooks/use-students";

const PAGE_SIZE = 20;

function initials(s: Student) {
  return `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function StudentsPage() {
  const { user } = useAuth();
  const { plan, tenantScoped, refresh: refreshSubscription } = useSubscription();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "SECRETARY", "DIRECTOR");
  const canDelete = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [status, setStatus] = useState<EnrollmentStatus | "NOT_ENROLLED" | "">("");
  const [page, setPage] = useState(0);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  // Proposé juste après la création : inscrire immédiatement (utile pour un ancien élève de
  // l'établissement qui n'était pas encore dans le logiciel — il choisit « Réinscription » ici).
  const [enrollingNew, setEnrollingNew] = useState<Student | null>(null);

  const { data, isLoading: loading, error } = useStudentsQuery({
    search: search || undefined,
    gender: gender || undefined,
    enrollmentStatus: status && status !== "NOT_ENROLLED" ? status : undefined,
    notEnrolled: status === "NOT_ENROLLED" || undefined,
    page,
    size: PAGE_SIZE,
    sort: "lastName,asc",
  });
  const createMutation = useCreateStudentMutation();
  const updateMutation = useUpdateStudentMutation();
  const deleteMutation = useDeleteStudentMutation();

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

  async function handleCreate(input: CreateStudentInput) {
    try {
      const created = await createMutation.mutateAsync(input);
      setCreating(false);
      setQuotaError(null);
      notifySuccess("Élève créé");
      refreshSubscription();
      setEnrollingNew(created);
    } catch (err) {
      // Quota guard (§students): 403 with {resource:"ELEVES", limite, consomme}.
      if (err instanceof ApiError && err.status === 403) {
        const p = err.problem as { limite?: number; consomme?: number } | undefined;
        const detail =
          p?.limite != null
            ? `Limite de votre plan atteinte (${p.consomme ?? "?"}/${p.limite} élèves). Passez à un plan supérieur.`
            : "Limite de votre plan atteinte. Passez à un plan supérieur.";
        setQuotaError(detail);
        return; // keep the form open so the message is visible
      }
      throw err; // let the form surface validation/other errors
    }
  }

  async function handleUpdate(input: CreateStudentInput) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input });
    setEditing(null);
    notifySuccess("Élève mis à jour");
  }

  function handleDelete(student: Student) {
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

  function openCreate() {
    setQuotaError(null);
    setCreating(true);
  }

  const columns: Column<Student>[] = [
    {
      key: "name",
      header: "Élève",
      accessor: (s) => `${s.firstName} ${s.lastName}`,
      render: (s) => (
        <Link href={`/students/${s.id}`} className="group flex items-center gap-3">
          {s.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
              {initials(s)}
            </span>
          )}
          <span className="font-medium text-slate-900 group-hover:text-brand-700">
            {s.firstName} {s.lastName}
          </span>
        </Link>
      ),
    },
    {
      key: "studentNumber",
      header: "Matricule",
      accessor: (s) => s.studentNumber ?? "",
      render: (s) => <span className="font-mono text-xs text-slate-500">{s.studentNumber}</span>,
    },
    {
      key: "gender",
      header: "Sexe",
      accessor: (s) => (s.gender === "FEMALE" ? "F" : "M"),
      render: (s) => (
        <Badge tone={s.gender === "FEMALE" ? "indigo" : "blue"}>{s.gender === "FEMALE" ? "F" : "M"}</Badge>
      ),
    },
    { key: "birthDate", header: "Naissance", accessor: (s) => s.birthDate ?? "", render: (s) => s.birthDate ?? "—" },
    { key: "phone", header: "Téléphone", accessor: (s) => s.phone ?? "", render: (s) => s.phone ?? "—" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (s) => (
        <div className="flex justify-end gap-2">
          <QuickBadgeButton studentId={s.id} studentName={`${s.firstName} ${s.lastName}`} studentNumber={s.studentNumber} photoUrl={s.photo} />
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
      ),
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
            <Button onClick={openCreate} leftSection={<UserPlus className="h-4 w-4" />} disabled={limitReached}>
              Nouvel élève
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
        getRowKey={(s) => s.id}
        onPageChange={setPage}
        emptyLabel="Aucun élève trouvé."
        columnToggle
        exportable
        exportFilename="eleves.csv"
      />

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel élève" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {quotaError && (
          <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
            {quotaError}{" "}
            <Link href="/subscription" className="font-semibold underline">
              Voir les plans
            </Link>
          </div>
        )}
        <StudentForm submitLabel="Créer" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      </Modal>

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

      {enrollingNew && (
        <EnrollModal
          studentId={enrollingNew.id}
          open={!!enrollingNew}
          onClose={() => setEnrollingNew(null)}
          onEnrolled={() => setEnrollingNew(null)}
        />
      )}
    </div>
  );
}
