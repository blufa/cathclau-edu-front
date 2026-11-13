"use client";

import Link from "next/link";
import { CalendarClock, ClipboardPen, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getMyTeacher, getTeacherClasses, getTeacherSchedule } from "@/lib/api/staff";
import { getClass, getClassStudents } from "@/lib/api/academics";
import { getStudentParents } from "@/lib/api/parents";
import type { ClassStudent } from "@/lib/types/academics";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";

interface RosterStudent extends ClassStudent {
  /** Parent/tuteur principal (§retour utilisateur : les élèves ont souvent pas d'email, le nom du
   * parent est plus utile ici) — le tuteur marqué primaryGuardian, sinon le premier parent lié, "—"
   * si aucun parent n'est encore renseigné pour cet élève. */
  parentName: string;
}

interface ClassBlock {
  id: number;
  label: string;
  students: RosterStudent[];
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
      let baseStudents: ClassStudent[] = [];
      try { baseStudents = await getClassStudents(id); } catch { baseStudents = []; }
      const students: RosterStudent[] = await Promise.all(baseStudents.map(async (s) => {
        let parentName = "—";
        try {
          const parents = await getStudentParents(s.id);
          const primary = parents.find((p) => p.primaryGuardian) ?? parents[0];
          if (primary) parentName = `${primary.firstName} ${primary.lastName}`;
        } catch { /* aucun parent lié ou erreur réseau : repli "—", pas bloquant pour le reste de la liste */ }
        return { ...s, parentName };
      }));
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
                    {/* §retour utilisateur : "les prof doit les voir sur leur portail pour saisir
                        les notes" — même accès direct que les évaluations normales ci-dessus. */}
                    <Button component={Link} href={`/grading/monthly?class=${b.id}`} size="sm" variant="outline" leftSection={<CalendarClock className="h-4 w-4" />}>
                      Évaluations mensuelles
                    </Button>
                  </div>
                </div>
                {b.students.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucun élève inscrit (validé) dans cette classe.</p>
                ) : (
                  <Table>
                    {/* Pas de matricule ici (§retour utilisateur) : le matricule n'a sa place que sur la
                        saisie anonyme des notes (GradeGrid, grading/page.tsx) — partout ailleurs, y
                        compris cette liste de classe, l'enseignant identifie ses élèves par leur nom. */}
                    <THead><tr><TH>Élève</TH><TH>Parent</TH></tr></THead>
                    <TBody>
                      {b.students.map((s) => (
                        <TR key={s.id}>
                          <TD className="font-medium text-slate-900">
                            <Link href={`/students/detail?id=${s.id}`} className="hover:text-brand-700 hover:underline">{s.firstName} {s.lastName}</Link>
                          </TD>
                          <TD className="text-slate-500">{s.parentName}</TD>
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
