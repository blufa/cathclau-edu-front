"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery as useLegacyQuery } from "@/hooks/use-query";
import { getClassStudents, getEnrollmentCount, listLevels, listRooms, setClassRepresentative } from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { QuickBadgeButton } from "@/components/biometric/quick-badge-button";
import { ClassSubjectsSection } from "./class-subjects-section";
import { useClassQuery } from "../hooks/use-classes";
import { notifyError, notifySuccess } from "@/lib/feedback";

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["classe:manage"]);

  const classQuery = useClassQuery(id);
  const countQuery = useLegacyQuery(() => getEnrollmentCount(id), [id]);
  const studentsQuery = useLegacyQuery(() => getClassStudents(id), [id]);
  const levelsQuery = useLegacyQuery(listLevels, []);
  const roomsQuery = useLegacyQuery(listRooms, []);
  const teachersQuery = useLegacyQuery(listTeachers, []);

  if (classQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (classQuery.error || !classQuery.data) {
    return (
      <div className="space-y-4">
        <Link href="/classes" className="text-sm text-brand-600 hover:underline">
          ← Retour aux classes
        </Link>
        <p className="rounded-md bg-error-50 px-4 py-3 text-sm text-error-700">Classe introuvable.</p>
      </div>
    );
  }

  const classe = classQuery.data;
  const count = countQuery.data;
  const students = [...(studentsQuery.data ?? [])].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"));
  const levelLabel = classe.levelId
    ? (levelsQuery.data?.find((l) => l.id === classe.levelId)?.label ?? "—")
    : "—";
  const roomLabel = classe.roomId
    ? (roomsQuery.data?.find((r) => r.id === classe.roomId)?.label ?? "—")
    : "—";
  const headTeacher = classe.headTeacherId
    ? teachersQuery.data?.find((t) => t.id === classe.headTeacherId)
    : null;
  const headTeacherLabel = headTeacher
    ? `${headTeacher.firstName} ${headTeacher.lastName}`
    : classe.headTeacherId ? `#${classe.headTeacherId}` : "Non assigné";

  const current = count?.currentCount ?? classe.headcount ?? 0;
  const capacity = count?.maxCapacity ?? classe.maxCapacity ?? null;
  const ratio = capacity ? Math.min(100, Math.round((current / capacity) * 100)) : 0;

  const studentOptions: SearchableOption[] = [
    { value: "", trigger: "Aucun", label: "Aucun", searchText: "aucun" },
    ...students.map((s) => {
      const label = `${s.firstName} ${s.lastName}`;
      return { value: String(s.id), trigger: label, label, searchText: `${label} ${s.studentNumber}` };
    }),
  ];

  return (
    <div className="space-y-6">
      <Link href="/classes" className="text-sm text-brand-600 hover:underline">
        ← Retour aux classes
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{classe.label}</h1>
        <p className="text-sm text-gray-500">
          {levelLabel} · Salle {roomLabel}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Effectif</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-2xl font-semibold text-gray-900">
              {current}
              {capacity != null && <span className="text-base text-gray-400"> / {capacity}</span>}
            </p>
            {capacity != null && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={ratio >= 100 ? "h-full bg-error-500" : "h-full bg-brand-500"}
                  style={{ width: `${ratio}%` }}
                />
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Places disponibles</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-2xl font-semibold text-gray-900">
              {count ? count.available : capacity != null ? capacity - current : "—"}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prof. principal</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm font-medium text-gray-700">{headTeacherLabel}</p>
            <p className="mt-1 text-xs text-gray-400">Se désigne depuis le tableau des matières</p>
          </CardBody>
        </Card>
      </div>

      <ClassSubjectsSection classId={id} canWrite={canWrite}
        headTeacherId={classe.headTeacherId ?? null}
        onHeadTeacherChange={() => classQuery.refetch()} />

      <Card>
        <CardHeader>
          <CardTitle>Chef de classe</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-3 text-xs text-gray-400">
            L&apos;élève désigné scanne les badges de ses camarades le matin depuis son compte élève.
          </p>
          {canWrite ? (
            <SearchableSelect
              value={classe.classRepresentativeStudentId != null ? String(classe.classRepresentativeStudentId) : ""}
              options={studentOptions}
              onChange={async (val) => {
                try {
                  await setClassRepresentative(id, val ? Number(val) : null);
                  notifySuccess("Chef de classe mis à jour");
                  classQuery.refetch();
                } catch (err) { notifyError(err); }
              }}
              triggerClassName="w-full max-w-sm justify-between px-3"
              noResultsLabel="Aucun élève inscrit"
            />
          ) : (
            <p className="text-sm font-medium text-gray-700">
              {students.find((s) => s.id === classe.classRepresentativeStudentId)
                ? `${students.find((s) => s.id === classe.classRepresentativeStudentId)!.firstName} ${students.find((s) => s.id === classe.classRepresentativeStudentId)!.lastName}`
                : "Non désigné"}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Élèves inscrits</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {studentsQuery.loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : students.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Aucun élève inscrit.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Matricule</TH>
                  <TH>Nom</TH>
                  <TH>Email</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {students.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-mono text-xs">{s.studentNumber}</TD>
                    <TD>
                      <Link href={`/students/${s.id}`} className="font-medium text-brand-600 hover:underline">
                        {s.firstName} {s.lastName}
                      </Link>
                    </TD>
                    <TD>{s.email ?? "—"}</TD>
                    <TD className="text-right">
                      <QuickBadgeButton studentId={s.id} studentName={`${s.firstName} ${s.lastName}`} studentNumber={s.studentNumber} classId={id} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
