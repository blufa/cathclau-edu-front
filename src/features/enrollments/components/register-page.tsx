"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { searchStudents } from "@/lib/api/students";
import {
  abandonEnrollment,
  cancelEnrollment,
  deleteEnrollment,
  searchEnrollments,
  updatePlatformAccess,
} from "@/lib/api/enrollments";
import type { Enrollment, EnrollmentStatus } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EnrollModal } from "./enroll-modal";
import { EnrollNewStudentWizard } from "./enroll-new-student-wizard";
import { PassageMasseModal } from "./passage-masse-modal";
import { CollectFeeModal } from "@/features/billing/components/collect-fee-modal";
import { MultiChildCollectModal } from "@/features/billing/components/multi-child-collect-modal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<EnrollmentStatus, "amber" | "green" | "red" | "indigo"> = {
  PENDING: "amber",
  VALIDATED: "green",
  CANCELLED: "red",
  ABANDONED: "indigo",
};
const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  PENDING: "En attente",
  VALIDATED: "Validée",
  CANCELLED: "Annulée",
  ABANDONED: "Abandon",
};

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canDecide = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["inscription:validate"]);
  const canCollect = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY") || hasAnyPermission(user, ["paiement:create"]);
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["inscription:create"]);
  // Colonne de sélection partagée par les deux actions en masse (encaissement famille + accès plateforme).
  const canBulkSelect = canCollect || canEdit;

  // Open the enrollment fee invoice for collection; full payment validates the enrollment server-side.
  const [collectFor, setCollectFor] = useState<{ studentId: number; classId: number } | null>(null);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  // Multi-student family checkout: pick several students, pay all their unpaid invoices at once.
  const [picked, setPicked] = useState<number[]>([]);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [passageOpen, setPassageOpen] = useState(false);
  const [bulkPlatformLoading, setBulkPlatformLoading] = useState(false);

  // Mis en cache (IndexedDB) sous les mêmes clés que le formulaire d'inscription hors-ligne
  // (OfflineEnrollFields) : visiter cette page en ligne pré-charge la liste des classes qui sera
  // ensuite disponible hors-ligne, au lieu de dépendre d'un premier appel jamais fait hors-ligne.
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);

  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<EnrollmentStatus | "">("PENDING");
  const [platformAccess, setPlatformAccess] = useState<"" | "yes" | "no">("");

  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const yearId = selectedYearId ?? defaultYearId;

  const classesQuery = useCachedQuery(
    yearId != null ? `classes:${yearId}` : null,
    () => listClasses(yearId as number),
    [yearId],
  );
  const classLabel = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])),
    [classesQuery.data],
  );

  // Resolve student names in bulk (single large page) for display in the queue.
  const studentsQuery = useCachedQuery(tenantId ? `students-all-v2:${tenantId}` : null, () => searchStudents({ size: 1000 }).then((p) => p.content), [tenantId]);
  const studentName = useMemo(
    () =>
      new Map(
        (studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
      ),
    [studentsQuery.data],
  );

  const enrollmentsQuery = useQuery(
    () =>
      yearId
        ? searchEnrollments({
            academicYearId: yearId,
            classId: classId ? Number(classId) : undefined,
            status: status || undefined,
          })
        : Promise.resolve([]),
    [yearId, classId, status],
  );
  const enrollments = useMemo(() => {
    const all = enrollmentsQuery.data ?? [];
    if (!platformAccess) return all;
    return all.filter((e) => (platformAccess === "yes" ? e.platformAccessOptIn : !e.platformAccessOptIn));
  }, [enrollmentsQuery.data, platformAccess]);

  function handleCancel(id: number) {
    confirmAction({
      title: "Annuler l'inscription",
      message: "Annuler cette inscription ?",
      confirmLabel: "Annuler l'inscription",
      onConfirm: async () => {
        try {
          await cancelEnrollment(id);
          notifySuccess("Inscription annulée");
          enrollmentsQuery.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }
  function handleAbandon(id: number) {
    confirmAction({
      title: "Marquer comme abandon",
      message: "L'élève arrête les cours en cours d'année ? Il restera visible pour cette classe "
        + "(facturation, recouvrement) mais disparaîtra des listes d'appel et de saisie de notes.",
      confirmLabel: "Marquer comme abandon",
      onConfirm: async () => {
        try {
          await abandonEnrollment(id);
          notifySuccess("Inscription marquée comme abandon");
          enrollmentsQuery.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }
  async function bulkSetPlatformAccess(optIn: boolean) {
    // picked contient des studentId (partagé avec la sélection "Encaisser famille") — on retrouve
    // l'inscription correspondante dans la liste déjà filtrée à l'écran pour récupérer son id.
    const targets = picked
      .map((studentId) => enrollments.find((e) => e.studentId === studentId))
      .filter((e): e is Enrollment => !!e);
    if (targets.length === 0) return;
    setBulkPlatformLoading(true);
    try {
      const results = await Promise.allSettled(targets.map((e) => updatePlatformAccess(e.id, optIn)));
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (failed === 0) {
        notifySuccess(`Accès plateforme ${optIn ? "activé" : "désactivé"} pour ${ok} élève(s)`);
      } else {
        notifyError(`${ok} mis à jour, ${failed} échec(s) — réessayez pour les élèves restants`);
      }
      enrollmentsQuery.refetch();
      setPicked([]);
    } finally {
      setBulkPlatformLoading(false);
    }
  }

  function handleDelete(id: number) {
    confirmAction({
      title: "Supprimer l'inscription",
      message: "Supprimer définitivement cette inscription ?",
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteEnrollment(id);
          notifySuccess("Inscription supprimée");
          enrollmentsQuery.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inscriptions</h1>
          <p className="text-sm text-gray-500">Suivi et validation des inscriptions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <EnrollNewStudentWizard />}
          {canDecide && (
            <Button onClick={() => setPassageOpen(true)}>Passage en masse</Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          className="max-w-xs"
          value={yearId ?? ""}
          onChange={(e) => {
            setSelectedYearId(e.target.value ? Number(e.target.value) : null);
            setClassId("");
          }}
        >
          {years.length === 0 && <option value="">—</option>}
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
              {y.current ? " (courante)" : ""}
            </option>
          ))}
        </Select>

        <Select className="max-w-[200px]" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Toutes les classes</option>
          {(classesQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>

        <Select
          className="max-w-[180px]"
          value={status}
          onChange={(e) => setStatus(e.target.value as EnrollmentStatus | "")}
        >
          <option value="">Tous statuts</option>
          <option value="PENDING">En attente</option>
          <option value="VALIDATED">Validée</option>
          <option value="CANCELLED">Annulée</option>
        </Select>

        <Select
          className="max-w-[190px]"
          value={platformAccess}
          onChange={(e) => setPlatformAccess(e.target.value as "" | "yes" | "no")}
          aria-label="Filtrer par accès plateforme"
        >
          <option value="">Accès plateforme : tous</option>
          <option value="yes">Accès plateforme activé</option>
          <option value="no">Accès plateforme non activé</option>
        </Select>

        {canBulkSelect && picked.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500">{picked.length} élève(s) sélectionné(s)</span>
            {canCollect && <Button size="sm" onClick={() => setFamilyOpen(true)}>Encaisser (famille)</Button>}
            {canEdit && (
              <>
                <Button size="sm" variant="secondary" loading={bulkPlatformLoading} onClick={() => bulkSetPlatformAccess(true)}>
                  Activer l&apos;accès plateforme
                </Button>
                <Button size="sm" variant="ghost" loading={bulkPlatformLoading} onClick={() => bulkSetPlatformAccess(false)}>
                  Désactiver
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Effacer</Button>
          </div>
        )}
      </div>

      {enrollmentsQuery.error ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger les inscriptions.
        </p>
      ) : enrollmentsQuery.loading && enrollments.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              {canBulkSelect && <TH className="w-8"></TH>}
              <TH>Élève</TH>
              <TH>Classe</TH>
              <TH className="hidden sm:table-cell">Type</TH>
              <TH className="hidden sm:table-cell">Date</TH>
              <TH className="hidden sm:table-cell">Plateforme</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {enrollments.length === 0 && (
              <TR>
                <TD colSpan={100} className="py-10 text-center text-gray-400">
                  Aucune inscription pour ces filtres.
                </TD>
              </TR>
            )}
            {enrollments.map((e) => (
              <TR key={e.id}>
                {canBulkSelect && (
                  <TD>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={picked.includes(e.studentId)}
                      onChange={() =>
                        setPicked((p) => (p.includes(e.studentId) ? p.filter((x) => x !== e.studentId) : [...p, e.studentId]))
                      }
                      aria-label="Sélectionner pour action en masse"
                    />
                  </TD>
                )}
                <TD>
                  <Link href={`/students/detail?id=${e.studentId}`} className="font-medium text-indigo-600 hover:underline">
                    {studentName.get(e.studentId) ?? `#${e.studentId}`}
                  </Link>
                </TD>
                <TD>{classLabel.get(e.classId) ?? `#${e.classId}`}</TD>
                <TD className="hidden sm:table-cell">{e.type === "RE_ENROLLMENT" ? "Réinscription" : "Inscription"}</TD>
                <TD className="hidden sm:table-cell">{e.enrolledAt ?? "—"}</TD>
                <TD className="hidden sm:table-cell">
                  <Badge tone={e.platformAccessOptIn ? "green" : "gray"}>
                    {e.platformAccessOptIn ? "Activé" : "Non activé"}
                  </Badge>
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-2">
                    {canCollect && e.status !== "CANCELLED" && (
                      <Button size="sm" onClick={() => setCollectFor({ studentId: e.studentId, classId: e.classId })}>
                        Facture
                      </Button>
                    )}
                    {canEdit && e.status === "PENDING" && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                        Modifier
                      </Button>
                    )}
                    {canDecide && e.status === "VALIDATED" && (
                      <Button size="sm" variant="ghost" className="text-amber-700" onClick={() => handleAbandon(e.id)}>
                        Abandon
                      </Button>
                    )}
                    {canDecide && e.status !== "CANCELLED" && e.status !== "ABANDONED" && (
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(e.id)}>
                        Annuler
                      </Button>
                    )}
                    {canDecide && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(e.id)}>
                        Suppr.
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {tenantId != null && collectFor != null && (
        <CollectFeeModal
          studentId={collectFor.studentId}
          classId={collectFor.classId}
          tenantId={tenantId}
          open={collectFor != null}
          onClose={() => setCollectFor(null)}
          onCollected={() => enrollmentsQuery.refetch()}
        />
      )}

      {tenantId != null && familyOpen && (
        <MultiChildCollectModal
          students={picked.map((id) => ({ id, name: studentName.get(id) ?? `#${id}` }))}
          tenantId={tenantId}
          open={familyOpen}
          onClose={() => setFamilyOpen(false)}
          onCollected={() => { enrollmentsQuery.refetch(); setPicked([]); }}
        />
      )}

      {editing && (
        <EnrollModal
          studentId={editing.studentId}
          enrollment={editing}
          open={!!editing}
          onClose={() => setEditing(null)}
          onEnrolled={() => {
            setEditing(null);
            enrollmentsQuery.refetch();
          }}
        />
      )}

      {passageOpen && (
        <PassageMasseModal
          open={passageOpen}
          onClose={() => setPassageOpen(false)}
          onDone={() => enrollmentsQuery.refetch()}
        />
      )}
    </div>
  );
}
