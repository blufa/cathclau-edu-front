"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@/hooks/use-query";
import {
  getClass,
  getClassStudents,
  getEnrollmentCount,
  listLevels,
  listRooms,
} from "@/lib/api/academics";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const classQuery = useQuery(() => getClass(id), [id]);
  const countQuery = useQuery(() => getEnrollmentCount(id), [id]);
  const studentsQuery = useQuery(() => getClassStudents(id), [id]);
  const levelsQuery = useQuery(listLevels, []);
  const roomsQuery = useQuery(listRooms, []);

  if (classQuery.loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (classQuery.error || !classQuery.data) {
    return (
      <div className="space-y-4">
        <Link href="/classes" className="text-sm text-indigo-600 hover:underline">
          ← Retour aux classes
        </Link>
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Classe introuvable.</p>
      </div>
    );
  }

  const classe = classQuery.data;
  const count = countQuery.data;
  const students = studentsQuery.data ?? [];
  const levelLabel = classe.levelId
    ? (levelsQuery.data?.find((l) => l.id === classe.levelId)?.label ?? "—")
    : "—";
  const roomLabel = classe.roomId
    ? (roomsQuery.data?.find((r) => r.id === classe.roomId)?.label ?? "—")
    : "—";

  const current = count?.currentCount ?? classe.headcount ?? 0;
  const capacity = count?.maxCapacity ?? classe.maxCapacity ?? null;
  const ratio = capacity ? Math.min(100, Math.round((current / capacity) * 100)) : 0;

  return (
    <div className="space-y-6">
      <Link href="/classes" className="text-sm text-indigo-600 hover:underline">
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
                  className={ratio >= 100 ? "h-full bg-red-500" : "h-full bg-indigo-500"}
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
            <p className="text-sm text-gray-700">
              {classe.headTeacherId ? `#${classe.headTeacherId}` : "Non assigné"}
            </p>
          </CardBody>
        </Card>
      </div>

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
                </tr>
              </THead>
              <TBody>
                {students.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-mono text-xs">{s.studentNumber}</TD>
                    <TD>
                      <Link href={`/students/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                        {s.firstName} {s.lastName}
                      </Link>
                    </TD>
                    <TD>{s.email ?? "—"}</TD>
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
