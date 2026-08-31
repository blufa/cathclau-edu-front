"use client";

import Link from "next/link";
import { useQuery } from "@/hooks/use-query";
import { listDpeSchools } from "@/lib/api/dpe";
import { Card, CardBody } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function DpeSchoolsPage() {
  const { data, loading, error } = useQuery(() => listDpeSchools(), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Écoles du périmètre</h1>
        <p className="text-sm text-gray-500">Écoles partenaires rattachées à votre préfecture ou commune.</p>
      </div>

      {error ? (
        <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
          Impossible de charger la liste des écoles.
        </div>
      ) : (
        <Card>
          <CardBody>
            {loading ? (
              <CardSkeleton />
            ) : (
              <Table>
                <THead>
                  <TR><TH>École</TH><TH>Ville</TH><TH>Statut</TH><TH>Élèves</TH><TH>Enseignants</TH><TH>Classes</TH></TR>
                </THead>
                <TBody>
                  {(data ?? []).map((s) => (
                    <TR key={s.tenantId}>
                      <TD className="font-medium">
                        <Link href={`/dpe/schools/${s.tenantId}`} className="text-brand-600 hover:underline">
                          {s.schoolName}
                        </Link>
                      </TD>
                      <TD>{s.city ?? "—"}</TD>
                      <TD><Badge tone={s.status === "ACTIVE" ? "green" : "gray"}>{s.status === "ACTIVE" ? "Active" : "Inactive"}</Badge></TD>
                      <TD>{s.studentCount}</TD>
                      <TD>{s.teacherCount} <span className="text-xs text-gray-400">({s.activeTeacherCount} actifs)</span></TD>
                      <TD>{s.classCount}</TD>
                    </TR>
                  ))}
                  {!loading && (data ?? []).length === 0 && (
                    <TR><TD colSpan={6} className="text-gray-400">Aucune école rattachée à votre périmètre pour le moment.</TD></TR>
                  )}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
