"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getStudent } from "@/lib/api/students";
import { listClasses } from "@/lib/api/academics";
import {
  cancelEnrollment,
  deleteEnrollment,
  validateEnrollment,
} from "@/lib/api/enrollments";
import type { EnrollmentStatus } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EnrollModal } from "@/components/enrollments/enroll-modal";

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

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user } = useAuth();
  const canEnroll = hasRole(user, "SCHOOL_ADMIN", "SECRETARY", "DIRECTOR");
  const canDecide = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const { data, loading, error, refetch } = useQuery(() => getStudent(id), [id]);
  const [enrolling, setEnrolling] = useState(false);

  // Resolve class labels for the years referenced by the student's enrollments.
  const yearIds = useMemo(
    () => [...new Set((data?.enrollments ?? []).map((e) => e.academicYearId))],
    [data?.enrollments],
  );
  const classesQuery = useQuery(
    () =>
      yearIds.length
        ? Promise.all(yearIds.map((y) => listClasses(y))).then((lists) => lists.flat())
        : Promise.resolve([]),
    [yearIds.join(",")],
  );
  const classLabel = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])),
    [classesQuery.data],
  );

  async function handleValidate(enrollmentId: number) {
    await validateEnrollment(enrollmentId);
    refetch();
  }
  async function handleCancel(enrollmentId: number) {
    if (!confirm("Annuler cette inscription ?")) return;
    await cancelEnrollment(enrollmentId);
    refetch();
  }
  async function handleDelete(enrollmentId: number) {
    if (!confirm("Supprimer définitivement cette inscription ?")) return;
    await deleteEnrollment(enrollmentId);
    refetch();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/students" className="text-sm text-indigo-600 hover:underline">
          ← Retour à la liste
        </Link>
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Élève introuvable.</p>
      </div>
    );
  }

  const { student, enrollments, parents, documents } = data;

  return (
    <div className="space-y-6">
      <Link href="/students" className="text-sm text-indigo-600 hover:underline">
        ← Retour à la liste
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-semibold text-indigo-700">
          {student.firstName[0]}
          {student.lastName[0]}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {student.firstName} {student.lastName}
          </h1>
          <p className="font-mono text-sm text-gray-500">{student.studentNumber}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info label="Sexe" value={student.gender === "FEMALE" ? "Féminin" : "Masculin"} />
            <Info label="Date de naissance" value={student.birthDate} />
            <Info label="Lieu de naissance" value={student.birthPlace} />
            <Info label="Nationalité" value={student.nationality} />
            <Info label="Téléphone" value={student.phone} />
            <Info label="Email" value={student.email} />
            <Info label="Adresse" value={student.address} />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Inscriptions</CardTitle>
          {canEnroll && (
            <Button size="sm" onClick={() => setEnrolling(true)}>
              Inscrire
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {enrollments.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Aucune inscription.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Classe</TH>
                  <TH>Année</TH>
                  <TH>Type</TH>
                  <TH>Statut</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {enrollments.map((e) => (
                  <TR key={e.id}>
                    <TD>{classLabel.get(e.classId) ?? `#${e.classId}`}</TD>
                    <TD>#{e.academicYearId}</TD>
                    <TD>{e.type === "RE_ENROLLMENT" ? "Réinscription" : "Inscription"}</TD>
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
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Parents & tuteurs</CardTitle>
          </CardHeader>
          <CardBody>
            {parents.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun parent lié.</p>
            ) : (
              <ul className="space-y-3">
                {parents.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{p.phone ?? p.email ?? "—"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardBody>
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun document.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{d.documentType}</span>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Ouvrir
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <EnrollModal
        studentId={id}
        open={enrolling}
        onClose={() => setEnrolling(false)}
        onEnrolled={refetch}
      />
    </div>
  );
}
