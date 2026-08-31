"use client";

import Link from "next/link";
import { Building2, GraduationCap, School, Users } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { getDpeDashboard } from "@/lib/api/dpe";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatCardSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function DpeDashboardPage() {
  const { data, loading, error } = useQuery(() => getDpeDashboard(), []);

  if (error) {
    return (
      <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
        Impossible de charger le tableau de bord. Vérifiez qu&apos;un compte DPE/DCE vous a bien été
        affecté à une préfecture ou une commune.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tableau de bord DPE / DCE</h1>
        <p className="text-sm text-gray-500">
          Vue de supervision en lecture seule des écoles partenaires de votre périmètre.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Écoles partenaires" value={data?.schoolCount ?? 0} icon={Building2} accent="indigo" />
          <StatCard title="Élèves suivis" value={data?.studentCount ?? 0} icon={GraduationCap} accent="teal" />
          <StatCard title="Enseignants" value={data?.teacherCount ?? 0} icon={Users} accent="emerald" />
          <StatCard title="Classes (année courante)" value={data?.classCount ?? 0} icon={School} accent="sky"
            hint={`Ratio élèves/enseignant : ${data?.studentTeacherRatio ?? "0"} (indicatif)`} />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Écoles du périmètre</CardTitle></CardHeader>
        <CardBody>
          {loading ? (
            <CardSkeleton />
          ) : (
            <Table>
              <THead>
                <TR><TH>École</TH><TH>Ville</TH><TH>Statut</TH><TH>Élèves</TH><TH>Enseignants</TH><TH>Classes</TH></TR>
              </THead>
              <TBody>
                {(data?.schools ?? []).map((s) => (
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
                {!loading && (data?.schools ?? []).length === 0 && (
                  <TR><TD colSpan={6} className="text-gray-400">Aucune école rattachée à votre périmètre pour le moment.</TD></TR>
                )}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
