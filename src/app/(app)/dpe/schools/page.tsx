"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@/hooks/use-query";
import { listDpeSchools } from "@/lib/api/dpe";
import { DpePrefectureBanner } from "@/components/platform/dpe-prefecture-banner";
import { Card, CardBody } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

export default function DpeSchoolsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}>
      <DpeSchoolsContent />
    </Suspense>
  );
}

function DpeSchoolsContent() {
  const searchParams = useSearchParams();
  const prefectureId = searchParams.get("prefectureId") ? Number(searchParams.get("prefectureId")) : undefined;
  const { data, loading, error } = useQuery(() => listDpeSchools(prefectureId), [prefectureId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Écoles du périmètre</h1>
        <p className="text-sm text-gray-500">Écoles partenaires rattachées à votre préfecture ou commune.</p>
      </div>

      <DpePrefectureBanner />

      {error ? (
        <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
          Impossible de charger la liste des écoles. Choisissez une préfecture/commune ci-dessus.
        </div>
      ) : (
        <Card>
          <CardBody>
            {loading ? (
              <CardSkeleton />
            ) : (
              <Table>
                <THead>
                  <TR><TH>École</TH><TH className="hidden sm:table-cell">Ville</TH><TH>Statut</TH><TH>Élèves</TH><TH>Enseignants</TH><TH className="hidden sm:table-cell">Classes</TH></TR>
                </THead>
                <TBody>
                  {(data ?? []).map((s) => (
                    <TR key={s.tenantId}>
                      <TD className="font-medium">
                        <Link href={`/dpe/schools/${s.tenantId}${prefectureId ? `?prefectureId=${prefectureId}` : ""}`} className="text-brand-600 hover:underline">
                          {s.schoolName}
                        </Link>
                      </TD>
                      <TD className="hidden sm:table-cell">{s.city ?? "—"}</TD>
                      <TD><Badge tone={s.status === "ACTIVE" ? "green" : "gray"}>{s.status === "ACTIVE" ? "Active" : "Inactive"}</Badge></TD>
                      <TD>{s.studentCount}</TD>
                      <TD>{s.teacherCount} <span className="text-xs text-gray-400">({s.activeTeacherCount} actifs)</span></TD>
                      <TD className="hidden sm:table-cell">{s.classCount}</TD>
                    </TR>
                  ))}
                  {!loading && (data ?? []).length === 0 && (
                    <TR><TD colSpan={100} className="text-gray-400">Aucune école rattachée à votre périmètre pour le moment.</TD></TR>
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
