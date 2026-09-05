"use client";

import { useMemo, useState } from "react";
import { Clock, LogIn, LogOut } from "lucide-react";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { searchEnrollments } from "@/lib/api/enrollments";
import { searchStudents } from "@/lib/api/students";
import type { Enrollment } from "@/lib/types/student";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";

export default function EnrollmentMovementsPage() {
  const { user } = useAuth();
  const allowed = hasRole(user, "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["inscription:read"]);

  const yearsQuery = useQuery(() => listAcademicYears(), []);
  const years = useMemo(() => [...(yearsQuery.data ?? [])].sort((a, b) => (b.label ?? "").localeCompare(a.label ?? "")), [yearsQuery.data]);
  const current = years.find((y) => y.current) ?? years[0];
  const [yearId, setYearId] = useState<string>("");
  const effectiveYear = yearId || (current ? String(current.id) : "");

  const enrollmentsQuery = useQuery(
    () => (effectiveYear ? searchEnrollments({ academicYearId: Number(effectiveYear) }) : Promise.resolve([])),
    [effectiveYear],
  );
  const classesQuery = useQuery(() => (effectiveYear ? listClasses(Number(effectiveYear)) : Promise.resolve([])), [effectiveYear]);
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);

  const classLabel = useMemo(() => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])), [classesQuery.data]);
  const studentLabel = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [s.id, { name: `${s.firstName} ${s.lastName}`, num: s.studentNumber }])),
    [studentsQuery.data],
  );

  if (!allowed) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé à l&apos;administration de l&apos;établissement.</div>;
  }

  const all = enrollmentsQuery.data ?? [];
  const byDate = (a: Enrollment, b: Enrollment) => (a.enrolledAt ?? "").localeCompare(b.enrolledAt ?? "") || a.id - b.id;
  const waiting = all.filter((e) => e.status === "PENDING").sort(byDate);
  const arrivals = all.filter((e) => e.status === "VALIDATED").sort(byDate);
  const departures = all.filter((e) => e.status === "CANCELLED").sort(byDate);

  // Waitlist position per class (order of arrival among pending).
  const positionByClass = new Map<number, number>();
  const sName = (id: number) => studentLabel.get(id)?.name ?? `Élève #${id}`;
  const sNum = (id: number) => studentLabel.get(id)?.num ?? "—";
  const cName = (id: number) => classLabel.get(id) ?? `Classe #${id}`;

  const loading = enrollmentsQuery.loading || studentsQuery.loading;

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mouvements & liste d&apos;attente</h1>
          <p className="text-sm text-slate-500">Suivi des arrivées, départs et des élèves en attente de place.</p>
        </div>
        <Select className="max-w-[220px]" value={effectiveYear} onChange={(e) => setYearId(e.target.value)}>
          {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>)}
        </Select>
      </Reveal>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Tabs defaultValue="waiting">
          <TabsList>
            <TabsTrigger value="waiting" icon={Clock}>Liste d&apos;attente ({waiting.length})</TabsTrigger>
            <TabsTrigger value="arrivals" icon={LogIn}>Arrivées ({arrivals.length})</TabsTrigger>
            <TabsTrigger value="departures" icon={LogOut}>Départs ({departures.length})</TabsTrigger>
          </TabsList>

          <TabsPanel value="waiting">
            <Table>
              <THead><tr><TH>Position</TH><TH>Élève</TH><TH>Matricule</TH><TH>Classe demandée</TH><TH>Type</TH></tr></THead>
              <TBody>
                {waiting.length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-slate-400">Aucun élève en attente.</TD></TR>}
                {waiting.map((e) => {
                  const pos = (positionByClass.get(e.classId) ?? 0) + 1;
                  positionByClass.set(e.classId, pos);
                  return (
                    <TR key={e.id}>
                      <TD><Badge tone="amber">#{pos}</Badge></TD>
                      <TD className="font-medium text-slate-900">{sName(e.studentId)}</TD>
                      <TD className="font-mono text-xs text-slate-600">{sNum(e.studentId)}</TD>
                      <TD>{cName(e.classId)}</TD>
                      <TD className="text-slate-500">{e.type === "RE_ENROLLMENT" ? "Réinscription" : "Inscription"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TabsPanel>

          <TabsPanel value="arrivals">
            <Table>
              <THead><tr><TH>Élève</TH><TH>Matricule</TH><TH>Classe</TH><TH>Type</TH><TH>Date</TH></tr></THead>
              <TBody>
                {arrivals.length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-slate-400">Aucune arrivée.</TD></TR>}
                {arrivals.map((e) => (
                  <TR key={e.id}>
                    <TD className="font-medium text-slate-900">{sName(e.studentId)}</TD>
                    <TD className="font-mono text-xs text-slate-600">{sNum(e.studentId)}</TD>
                    <TD>{cName(e.classId)}</TD>
                    <TD>{e.type === "RE_ENROLLMENT" ? <Badge tone="indigo">Réinscription</Badge> : <Badge tone="green">Nouvelle</Badge>}</TD>
                    <TD className="text-slate-500">{e.enrolledAt?.slice(0, 10) ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TabsPanel>

          <TabsPanel value="departures">
            <Table>
              <THead><tr><TH>Élève</TH><TH>Matricule</TH><TH>Classe</TH><TH>Date</TH></tr></THead>
              <TBody>
                {departures.length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-slate-400">Aucun départ.</TD></TR>}
                {departures.map((e) => (
                  <TR key={e.id}>
                    <TD className="font-medium text-slate-900">{sName(e.studentId)}</TD>
                    <TD className="font-mono text-xs text-slate-600">{sNum(e.studentId)}</TD>
                    <TD>{cName(e.classId)}</TD>
                    <TD className="text-slate-500">{e.enrolledAt?.slice(0, 10) ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TabsPanel>
        </Tabs>
      )}
    </div>
  );
}
