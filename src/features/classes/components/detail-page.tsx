"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery as useLegacyQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getClassStudents, getEnrollmentCount, listLevels, listRooms, setClassHeadTeacher, setClassRepresentative } from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import type { ClassStudent } from "@/lib/types/academics";
import { QuickBadgeButton } from "@/components/biometric/quick-badge-button";
import { ClassSubjectsSection } from "./class-subjects-section";
import { useClassQuery } from "../hooks/use-classes";
import { notifyError, notifySuccess } from "@/lib/feedback";

export default function ClassDetailPage() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["classe:manage"]);

  const classQuery = useClassQuery(id);
  const countQuery = useLegacyQuery(() => getEnrollmentCount(id), [id]);
  const studentsQuery = useLegacyQuery(() => getClassStudents(id), [id]);
  const levelsQuery = useCachedQuery(tenantId ? `levels:${tenantId}` : null, listLevels, [tenantId]);
  const roomsQuery = useCachedQuery(tenantId ? `rooms:${tenantId}` : null, listRooms, [tenantId]);
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  // Désignation directe du professeur principal (§retour utilisateur : un moniteur maternelle/primaire
  // sans AUCUNE matière affectée — cas normal, voir LessonService#resolveHeadTeacherId — n'avait aucun
  // moyen d'être désigné "professeur principal", puisque ce bouton n'existait que sur une ligne du
  // tableau "Matières & enseignants" (donc jamais accessible sans matière). Sans professeur principal,
  // la masse salariale du tableau de bord le classait par défaut en Secondaire, même pour un enseignant
  // de primaire/maternelle à salaire déjà configuré).
  const [savingHeadTeacher, setSavingHeadTeacher] = useState(false);

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
  const studentColumns: Column<ClassStudent>[] = [
    { key: "studentNumber", header: "Matricule", accessor: (s) => s.studentNumber ?? "", render: (s) => <span className="font-mono text-xs">{s.studentNumber}</span> },
    {
      key: "name", header: "Nom", accessor: (s) => `${s.firstName} ${s.lastName}`,
      render: (s) => (
        <Link href={`/students/detail?id=${s.id}`} className="font-medium text-brand-600 hover:underline">
          {s.firstName} {s.lastName}
        </Link>
      ),
    },
    { key: "email", header: "Email", accessor: (s) => s.email ?? "", render: (s) => s.email ?? "—" },
    {
      key: "actions", header: "Actions", align: "right",
      render: (s) => <QuickBadgeButton studentId={s.id} studentName={`${s.firstName} ${s.lastName}`} studentNumber={s.studentNumber} classId={id} />,
    },
  ];
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

  const teacherOptions: SearchableOption[] = [
    { value: "", trigger: "Non assigné", label: "Non assigné", searchText: "aucun non assigné" },
    ...(teachersQuery.data ?? []).map((t) => {
      const label = `${t.firstName} ${t.lastName}`;
      return { value: String(t.id), trigger: label, label, searchText: label };
    }),
  ];
  async function designateHeadTeacher(value: string) {
    setSavingHeadTeacher(true);
    try {
      await setClassHeadTeacher(id, value ? Number(value) : null);
      notifySuccess(value ? "Professeur principal désigné" : "Professeur principal retiré");
      classQuery.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingHeadTeacher(false);
    }
  }

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
              <>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={ratio >= 100 ? "h-full bg-error-500" : ratio >= 90 ? "h-full bg-amber-500" : "h-full bg-brand-500"}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
                {ratio >= 100 ? (
                  <p className="mt-1 text-xs font-medium text-error-600">Capacité atteinte — tout dépassement devra être forcé explicitement.</p>
                ) : ratio >= 90 ? (
                  <p className="mt-1 text-xs font-medium text-amber-600">Capacité presque atteinte.</p>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Places disponibles</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-2xl font-semibold text-gray-900">
              {count?.available != null ? count.available : capacity != null ? capacity - current : "—"}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prof. principal</CardTitle>
          </CardHeader>
          <CardBody>
            {canWrite ? (
              <SearchableSelect
                value={classe.headTeacherId != null ? String(classe.headTeacherId) : ""}
                options={teacherOptions}
                onChange={designateHeadTeacher}
                disabled={savingHeadTeacher}
                triggerClassName="w-full justify-between px-3"
              />
            ) : (
              <p className="text-sm font-medium text-gray-700">{headTeacherLabel}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Aussi désignable depuis le tableau des matières — utile pour un enseignant unique sans
              matière précise (moniteur maternelle/primaire).
            </p>
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
            <DataTable
              columns={studentColumns}
              rows={students}
              getRowKey={(s) => s.id}
              emptyLabel="Aucun élève inscrit."
              searchable
              searchPlaceholder="Rechercher un élève (nom, prénom, matricule)…"
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
