"use client";

import Link from "next/link";
import { ClipboardPen, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getMyTeacher, getTeacherClasses, getTeacherSchedule } from "@/lib/api/staff";
import { getClass, getClassStudents } from "@/lib/api/academics";
import type { ClassStudent } from "@/lib/types/academics";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";

interface ClassBlock {
  id: number;
  label: string;
  students: ClassStudent[];
}

export default function MyClassesPage() {
  const { user } = useAuth();
  const isTeacher = hasRole(user, "TEACHER", "SCHOOL_ADMIN", "DIRECTOR");

  const q = useQuery(async (): Promise<ClassBlock[]> => {
    const me = await getMyTeacher();
    const [headClasses, schedule] = await Promise.all([getTeacherClasses(me.id), getTeacherSchedule(me.id)]);
    // All taught classes: head classes + classes appearing in the timetable.
    const labelById = new Map<number, string>();
    headClasses.forEach((c) => labelById.set(c.id, c.label));
    const ids = new Set<number>([...headClasses.map((c) => c.id), ...schedule.map((s) => s.classId)]);

    const blocks: ClassBlock[] = [];
    for (const id of ids) {
      let label = labelById.get(id);
      if (!label) {
        try { label = (await getClass(id)).label; } catch { label = `Classe #${id}`; }
      }
      let students: ClassStudent[] = [];
      try { students = await getClassStudents(id); } catch { students = []; }
      blocks.push({ id, label, students });
    }
    return blocks.sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  if (!isTeacher) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Espace réservé aux enseignants.</div>;
  }

  const blocks = q.data ?? [];
  const totalStudents = blocks.reduce((s, b) => s + b.students.length, 0);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mes classes & élèves</h1>
        <p className="text-sm text-slate-500">Tous les élèves des classes que vous enseignez.</p>
      </Reveal>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : q.error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Profil enseignant introuvable pour votre compte.</div>
      ) : blocks.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">Aucune classe ne vous est affectée.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Badge tone="indigo">{blocks.length} classe(s)</Badge>
            <Badge tone="green">{totalStudents} élève(s)</Badge>
          </div>

          {blocks.map((b) => (
            <Card key={b.id}>
              <CardBody>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <GraduationCap className="h-4 w-4 text-brand-600" /> {b.label}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-slate-500"><Users className="h-3.5 w-3.5" /> {b.students.length}</span>
                    <Button component={Link} href={`/grading?class=${b.id}`} size="sm" variant="outline" leftSection={<ClipboardPen className="h-4 w-4" />}>
                      Saisir les notes
                    </Button>
                  </div>
                </div>
                {b.students.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucun élève inscrit (validé) dans cette classe.</p>
                ) : (
                  <Table>
                    <THead><tr><TH>Élève</TH><TH>Matricule</TH><TH>Email</TH></tr></THead>
                    <TBody>
                      {b.students.map((s) => (
                        <TR key={s.id}>
                          <TD className="font-medium text-slate-900">
                            <Link href={`/students/detail?id=${s.id}`} className="hover:text-brand-700 hover:underline">{s.firstName} {s.lastName}</Link>
                          </TD>
                          <TD className="font-mono text-xs text-slate-600">{s.studentNumber}</TD>
                          <TD className="text-slate-500">{s.email ?? "—"}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
