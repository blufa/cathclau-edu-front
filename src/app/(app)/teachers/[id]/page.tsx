"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@/hooks/use-query";
import {
  getTeacher,
  getTeacherClasses,
  getTeacherSchedule,
  getTeacherSubjects,
} from "@/lib/api/staff";
import { listRooms, listSubjects } from "@/lib/api/academics";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TeacherAvailabilitySection } from "@/components/staff/teacher-availability";
import { TeacherClassesSection } from "@/components/staff/teacher-classes";
import { TeacherSubjectsSection } from "@/components/staff/teacher-subjects";
import { TeacherLevelsSection } from "@/components/staff/teacher-levels";

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  PERMANENT: "Permanent",
  VACATAIRE: "Vacataire",
  CONTRACTUEL: "Contractuel",
};
const REMUNERATION_LABEL: Record<string, string> = {
  MENSUEL: "Mensuel",
  HORAIRE: "Horaire",
  FORFAIT: "Forfait",
};

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");
  const teacherQuery = useQuery(() => getTeacher(id), [id]);
  const classesQuery = useQuery(() => getTeacherClasses(id), [id]);
  const subjectsQuery = useQuery(() => getTeacherSubjects(id), [id]);
  const scheduleQuery = useQuery(() => getTeacherSchedule(id), [id]);
  const allSubjectsQuery = useQuery(listSubjects, []);
  const roomsQuery = useQuery(listRooms, []);

  const subjectLabel = useMemo(
    () => new Map((allSubjectsQuery.data ?? []).map((s) => [s.id, s.label])),
    [allSubjectsQuery.data],
  );
  const roomLabel = useMemo(
    () => new Map((roomsQuery.data ?? []).map((r) => [r.id, r.label])),
    [roomsQuery.data],
  );

  if (teacherQuery.loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (teacherQuery.error || !teacherQuery.data) {
    return (
      <div className="space-y-4">
        <Link href="/teachers" className="text-sm text-brand-600 hover:underline">
          ← Retour aux enseignants
        </Link>
        <p className="rounded-md bg-error-50 px-4 py-3 text-sm text-error-700">Enseignant introuvable.</p>
      </div>
    );
  }

  const t = teacherQuery.data;
  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const schedule = (scheduleQuery.data ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-6">
      <Link href="/teachers" className="text-sm text-brand-600 hover:underline">
        ← Retour aux enseignants
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
          {t.firstName[0]}
          {t.lastName[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {t.firstName} {t.lastName}
          </h1>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-500">{t.staffNumber}</span>
            <Badge tone={t.active ? "green" : "gray"}>{t.active ? "Actif" : "Inactif"}</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info label="Spécialité" value={t.specialization} />
            <Info label="Téléphone" value={t.phone} />
            <Info label="Email" value={t.email} />
            <Info label="Date d'embauche" value={t.hireDate} />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dossier professionnel</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info label="Statut" value={EMPLOYMENT_LABEL[t.employmentStatus ?? ""] ?? t.employmentStatus} />
            <Info label="Diplôme" value={t.diploma} />
            <Info label="Type de rémunération" value={REMUNERATION_LABEL[t.remunerationType ?? ""] ?? t.remunerationType} />
            <Info label="Taux / montant" value={t.remunerationRate ? `${t.remunerationRate} GNF` : null} />
            <Info label="N° autorisation (SNEPUP)" value={t.teachingAuthorizationNumber} />
            <Info label="N° CNSS" value={t.cnssNumber} />
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Classes enseignées</CardTitle>
          </CardHeader>
          <CardBody>
            <TeacherClassesSection teacherId={id} canWrite={canWrite} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Matières enseignées</CardTitle>
          </CardHeader>
          <CardBody>
            <TeacherSubjectsSection teacherId={id} canWrite={canWrite} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Niveaux enseignés</CardTitle>
          </CardHeader>
          <CardBody>
            <TeacherLevelsSection teacherId={id} canWrite={canWrite} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Disponibilités</CardTitle>
          </CardHeader>
          <CardBody>
            <TeacherAvailabilitySection teacherId={id} canWrite={canWrite} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Classes (prof. principal)</CardTitle>
          </CardHeader>
          <CardBody>
            {classes.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune classe.</p>
            ) : (
              <ul className="space-y-2">
                {classes.map((c) => (
                  <li key={c.id} className="text-sm">
                    <Link href={`/classes/${c.id}`} className="font-medium text-brand-600 hover:underline">
                      {c.label}
                    </Link>
                    {c.levelLabel && <span className="text-gray-500"> · {c.levelLabel}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matières enseignées</CardTitle>
          </CardHeader>
          <CardBody>
            {subjects.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune matière affectée.</p>
            ) : (
              <ul className="space-y-2">
                {subjects.map((s, i) => (
                  <li key={`${s.subjectId}-${i}`} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`}</span>
                    <span className="text-gray-400">coef. {s.coefficient}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emploi du temps</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {schedule.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Aucun créneau.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Jour</TH>
                  <TH>Horaire</TH>
                  <TH>Matière</TH>
                  <TH>Classe</TH>
                  <TH>Salle</TH>
                </tr>
              </THead>
              <TBody>
                {schedule.map((slot) => (
                  <TR key={slot.id}>
                    <TD>{DAY_LABEL[slot.day] ?? slot.day}</TD>
                    <TD>
                      {slot.startTime} – {slot.endTime}
                    </TD>
                    <TD>{subjectLabel.get(slot.subjectId) ?? `#${slot.subjectId}`}</TD>
                    <TD>
                      <Link href={`/classes/${slot.classId}`} className="text-brand-600 hover:underline">
                        #{slot.classId}
                      </Link>
                    </TD>
                    <TD>{slot.roomId ? (roomLabel.get(slot.roomId) ?? `#${slot.roomId}`) : "—"}</TD>
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
