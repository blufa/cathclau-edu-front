"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, GraduationCap, School, Users } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { getDpeSchool } from "@/lib/api/dpe";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatCardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function DpeSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const tenantId = Number(params.id);
  const { data, loading, error } = useQuery(() => getDpeSchool(tenantId), [tenantId]);

  return (
    <div className="space-y-6">
      <Link href="/dpe/schools" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Retour aux écoles
      </Link>

      {error ? (
        <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
          Cette école n&apos;appartient pas à votre périmètre, ou n&apos;existe pas.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{loading ? "…" : data?.schoolName}</h1>
            {!loading && data && (
              <Badge tone={data.status === "ACTIVE" ? "green" : "gray"}>
                {data.status === "ACTIVE" ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>
          {!loading && data?.city && <p className="text-sm text-gray-500">{data.city}</p>}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard title="Élèves" value={data?.studentCount ?? 0} icon={GraduationCap} accent="teal" />
              <StatCard title="Enseignants" value={data?.teacherCount ?? 0} icon={Users} accent="emerald"
                hint={`${data?.activeTeacherCount ?? 0} actif(s)`} />
              <StatCard title="Classes (année courante)" value={data?.classCount ?? 0} icon={School} accent="sky" />
            </div>
          )}

          <Card>
            <CardBody className="text-sm text-gray-500">
              Statistiques de présence, de résultats et indicateurs de risque : à venir dans une
              prochaine étape (nécessitent une agrégation supplémentaire non encore construite).
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
