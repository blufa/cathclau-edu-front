"use client";

import Link from "next/link";
import { CalendarClock, CalendarDays, ClipboardPen, GraduationCap, Percent } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useNetworkStore } from "@/lib/offline/network-store";
import { getMyTeacher, getTeacherClasses, getTeacherSchedule } from "@/lib/api/staff";
import { getClass, getClassStudents, getScheduleByTeacher, listRooms, listSubjects } from "@/lib/api/academics";
import { WeeklyTimetable } from "@/components/timetable/weekly-timetable";
import { getAssessmentGrades, listAssessmentsByClass } from "@/lib/api/grading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { MyAvailabilityManager } from "@/components/staff/my-availability";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_LABEL: Record<string, string> = {
  MONDAY: "Lundi", TUESDAY: "Mardi", WEDNESDAY: "Mercredi", THURSDAY: "Jeudi", FRIDAY: "Vendredi", SATURDAY: "Samedi", SUNDAY: "Dimanche",
};

interface Course { time: string; subject: string; classLabel: string; room: string }
interface ToGrade { id: number; label: string; classId: number; classLabel: string; subject: string; entered: number; size: number }
interface Data {
  classCount: number;
  studentTotal: number;
  today: string;
  courses: Course[];
  toGrade: ToGrade[];
  fillRate: number;
}

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const isTeacher = hasRole(user, "TEACHER", "SCHOOL_ADMIN", "DIRECTOR");

  const q = useQuery(async (): Promise<Data> => {
    const me = await getMyTeacher();
    const [schedule, headClasses, subjects, rooms] = await Promise.all([
      getTeacherSchedule(me.id), getTeacherClasses(me.id), listSubjects(), listRooms(),
    ]);
    const subjectLabel = new Map(subjects.map((s) => [s.id, s.label]));
    const roomLabel = new Map(rooms.map((r) => [r.id, r.label]));
    const labelById = new Map<number, string>(headClasses.map((c) => [c.id, c.label]));
    const classIds = [...new Set<number>([...headClasses.map((c) => c.id), ...schedule.map((s) => s.classId)])];
    for (const id of classIds) {
      if (!labelById.has(id)) {
        try { labelById.set(id, (await getClass(id)).label); } catch { labelById.set(id, `Classe #${id}`); }
      }
    }
    const cName = (id: number) => labelById.get(id) ?? `Classe #${id}`;

    // Today's courses.
    const todayName = DAYS[new Date().getDay()];
    const courses: Course[] = schedule
      .filter((s) => s.day === todayName)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((s) => ({
        time: `${s.startTime.slice(0, 5)} – ${s.endTime.slice(0, 5)}`,
        subject: s.subjectId != null ? (subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`) : (s.label ?? "Heure creuse"),
        classLabel: cName(s.classId),
        room: s.roomId ? (roomLabel.get(s.roomId) ?? `#${s.roomId}`) : "—",
      }));

    // Per class: students + assessments + grade-entry rate.
    let studentTotal = 0;
    let totalEntered = 0;
    let totalExpected = 0;
    const toGrade: ToGrade[] = [];
    for (const id of classIds) {
      const [students, assessments] = await Promise.all([getClassStudents(id), listAssessmentsByClass(id)]);
      studentTotal += students.length;
      for (const a of assessments) {
        const grades = await getAssessmentGrades(a.id);
        const entered = grades.filter((g) => g.value != null && g.value !== "").length;
        totalEntered += entered;
        totalExpected += students.length;
        if (entered < students.length) {
          toGrade.push({ id: a.id, label: a.label, classId: id, classLabel: cName(id), subject: subjectLabel.get(a.subjectId) ?? "—", entered, size: students.length });
        }
      }
    }
    const fillRate = totalExpected > 0 ? Math.round((totalEntered / totalExpected) * 100) : 100;

    return { classCount: classIds.length, studentTotal, today: todayName, courses, toGrade, fillRate };
  }, []);

  // Consultation hors-ligne (§Phase 2) : affiche le dernier emploi du temps connu pendant qu'un
  // rafraîchissement réseau tourne en tâche de fond — clé par utilisateur (userId), pas par teacherId
  // encore inconnu à ce stade, pour rester utilisable dès le montage même hors-ligne.
  const online = useNetworkStore((s) => s.online);
  const scheduleQ = useCachedQuery(
    user?.userId != null ? `teacher-schedule:${user.userId}` : null,
    async () => {
      const me = await getMyTeacher();
      const [slots, subjects, rooms] = await Promise.all([getScheduleByTeacher(me.id), listSubjects(), listRooms()]);
      const classLabels = new Map<number, string>();
      for (const id of [...new Set(slots.map((s) => s.schoolClassId))]) {
        try { classLabels.set(id, (await getClass(id)).label); } catch { classLabels.set(id, `Classe #${id}`); }
      }
      return { slots, subjects, rooms, classLabels };
    },
    [user?.userId],
  );

  if (!isTeacher) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Espace réservé aux enseignants.</div>;
  }

  const d = q.data;

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mon tableau de bord</h1>
        <p className="text-sm text-slate-500">Cours du jour, évaluations à corriger et taux de saisie des notes.</p>
      </Reveal>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : q.error || !d ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Profil enseignant introuvable pour votre compte.</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Mes classes" value={d.classCount} icon={GraduationCap} accent="teal" />
            <StatCard title="Mes élèves" value={d.studentTotal} icon={GraduationCap} accent="sky" />
            <StatCard title="Évaluations à corriger" value={d.toGrade.length} icon={ClipboardPen} accent="rose" />
            <StatCard title="Taux de saisie des notes" value={`${d.fillRate}%`} icon={Percent} accent="indigo" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarClock className="h-4 w-4 text-brand-600" /> Cours du jour · {DAY_LABEL[d.today] ?? d.today}
                </h2>
                {d.courses.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucun cours aujourd&apos;hui.</p>
                ) : (
                  <ul className="space-y-2">
                    {d.courses.map((c, i) => (
                      <li key={i} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                        <span className="font-mono text-xs text-slate-500">{c.time}</span>
                        <span className="font-medium text-slate-800">{c.subject}</span>
                        <span className="text-slate-500">{c.classLabel}</span>
                        <span className="text-xs text-slate-400">{c.room}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ClipboardPen className="h-4 w-4 text-brand-600" /> Évaluations à corriger
                </h2>
                {d.toGrade.length === 0 ? (
                  <p className="text-sm text-slate-400">Toutes les notes sont saisies. 🎉</p>
                ) : (
                  <Table>
                    <THead><tr><TH>Évaluation</TH><TH>Classe</TH><TH>Saisie</TH><TH></TH></tr></THead>
                    <TBody>
                      {d.toGrade.map((a) => (
                        <TR key={a.id}>
                          <TD className="font-medium text-slate-900">{a.label}<div className="text-xs text-slate-400">{a.subject}</div></TD>
                          <TD className="text-slate-500">{a.classLabel}</TD>
                          <TD><Badge tone={a.entered === 0 ? "red" : "amber"}>{a.entered}/{a.size}</Badge></TD>
                          <TD className="text-right">
                            <Button component={Link} href={`/grading?class=${a.classId}`} size="sm" variant="outline">Saisir</Button>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <CalendarDays className="h-4 w-4 text-brand-600" /> Mon emploi du temps
                {scheduleQ.fromCache && !online && (
                  <span className="rounded-full bg-warning-50 px-2 py-0.5 text-xs font-normal text-warning-700">
                    Données en cache — hors-ligne
                  </span>
                )}
              </h2>
              {scheduleQ.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
                <WeeklyTimetable
                  slots={scheduleQ.data?.slots ?? []}
                  subjectName={(id) => scheduleQ.data?.subjects.find((s) => s.id === id)?.label ?? `Matière #${id}`}
                  roomName={(id) => (id == null ? undefined : scheduleQ.data?.rooms.find((r) => r.id === id)?.label)}
                  classLabel={(id) => scheduleQ.data?.classLabels.get(id) ?? `Classe #${id}`}
                  emptyText="Aucun emploi du temps défini pour vos classes."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <CalendarClock className="h-4 w-4 text-brand-600" /> Mes disponibilités
              </h2>
              <MyAvailabilityManager />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
