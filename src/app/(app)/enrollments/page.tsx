"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { searchStudents } from "@/lib/api/students";
import {
  cancelEnrollment,
  deleteEnrollment,
  searchEnrollments,
  validateEnrollment,
} from "@/lib/api/enrollments";
import type { EnrollmentStatus } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<EnrollmentStatus, "amber" | "green" | "red"> = {
  PENDING: "amber",
  VALIDATED: "green",
  CANCELLED: "red",
};
const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  PENDING: "En attente",
  VALIDATED: "Validée",
  CANCELLED: "Annulée",
};

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const canDecide = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const yearsQuery = useQuery(listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);

  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<EnrollmentStatus | "">("PENDING");

  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const yearId = selectedYearId ?? defaultYearId;

  const classesQuery = useQuery(
    () => (yearId ? listClasses(yearId) : Promise.resolve([])),
    [yearId],
  );
  const classLabel = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])),
    [classesQuery.data],
  );

  // Resolve student names in bulk (single large page) for display in the queue.
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }), []);
  const studentName = useMemo(
    () =>
      new Map(
        (studentsQuery.data?.content ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
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
  const enrollments = enrollmentsQuery.data ?? [];

  async function handleValidate(id: number) {
    try {
      await validateEnrollment(id);
      notifySuccess("Inscription validée");
      enrollmentsQuery.refetch();
    } catch (err) {
      notifyError(err);
    }
  }
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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Inscriptions</h1>
        <p className="text-sm text-gray-500">Suivi et validation des inscriptions</p>
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
              <TH>Élève</TH>
              <TH>Classe</TH>
              <TH>Type</TH>
              <TH>Date</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {enrollments.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-gray-400">
                  Aucune inscription pour ces filtres.
                </TD>
              </TR>
            )}
            {enrollments.map((e) => (
              <TR key={e.id}>
                <TD>
                  <Link href={`/students/${e.studentId}`} className="font-medium text-indigo-600 hover:underline">
                    {studentName.get(e.studentId) ?? `#${e.studentId}`}
                  </Link>
                </TD>
                <TD>{classLabel.get(e.classId) ?? `#${e.classId}`}</TD>
                <TD>{e.type === "RE_ENROLLMENT" ? "Réinscription" : "Inscription"}</TD>
                <TD>{e.enrolledAt ?? "—"}</TD>
                <TD>
                  <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-2">
                    {canDecide && e.status === "PENDING" && (
                      <Button size="sm" variant="ghost" className="text-green-700" onClick={() => handleValidate(e.id)}>
                        Valider
                      </Button>
                    )}
                    {canDecide && e.status !== "CANCELLED" && (
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
    </div>
  );
}
