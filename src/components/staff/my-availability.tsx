"use client";

import { useMemo } from "react";
import { useQuery } from "@/hooks/use-query";
import { getMyTeacher, getTeacherSchedule } from "@/lib/api/staff";
import { listAcademicYears, listClasses, listSubjects } from "@/lib/api/academics";
import { TeacherAvailabilitySection } from "@/components/staff/teacher-availability";
import { Spinner } from "@/components/ui/spinner";

const DAYS: [string, string][] = [
  ["LUNDI", "Lundi"], ["MARDI", "Mardi"], ["MERCREDI", "Mercredi"],
  ["JEUDI", "Jeudi"], ["VENDREDI", "Vendredi"], ["SAMEDI", "Samedi"],
];
const hhmm = (t: string) => t?.slice(0, 5) ?? "";

/**
 * Espace enseignant : l'enseignant connecté voit ses créneaux déjà occupés (emploi du temps) et
 * saisit ses disponibilités. L'ajout d'une plage qui chevauche une disponibilité existante est refusé
 * côté serveur ; les créneaux occupés sont affichés pour éviter de proposer une heure déjà prise.
 */
export function MyAvailabilityManager() {
  const meQ = useQuery(getMyTeacher, []);
  const me = meQ.data;
  const scheduleQ = useQuery(() => (me ? getTeacherSchedule(me.id) : Promise.resolve([])), [me?.id]);
  const subjectsQ = useQuery(listSubjects, []);
  const subjectLabel = useMemo(
    () => new Map((subjectsQ.data ?? []).map((s) => [s.id, s.label])),
    [subjectsQ.data],
  );
  const yearsQ = useQuery(listAcademicYears, []);
  const currentYearId = (yearsQ.data ?? []).find((y) => y.current)?.id ?? (yearsQ.data ?? [])[0]?.id ?? null;
  const classesQ = useQuery(() => (currentYearId ? listClasses(currentYearId) : Promise.resolve([])), [currentYearId]);
  const classLabel = useMemo(
    () => new Map((classesQ.data ?? []).map((c) => [c.id, c.label])),
    [classesQ.data],
  );

  if (meQ.loading) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (!me) return <p className="text-sm text-slate-500">Aucun profil enseignant lié à votre compte.</p>;

  const occupied = scheduleQ.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Créneaux occupés (déjà planifiés)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DAYS.map(([key, label]) => {
            const slots = occupied.filter((s) => s.day === key).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <div key={key} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <p className="mb-1 text-xs font-semibold uppercase text-amber-700">{label}</p>
                {slots.length === 0 ? (
                  <p className="text-xs text-slate-300">— libre</p>
                ) : (
                  <ul className="space-y-1">
                    {slots.map((s) => (
                      <li key={s.id} className="text-sm text-slate-700">
                        <span className="font-medium">{hhmm(s.startTime)}–{hhmm(s.endTime)}</span>
                        {" · "}{s.subjectId != null ? (subjectLabel.get(s.subjectId) ?? "Cours") : (s.label ?? "Heure creuse")}
                        {" · "}
                        <span className="text-amber-700">{classLabel.get(s.classId) ?? `Classe #${s.classId}`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Mes disponibilités</p>
        <TeacherAvailabilitySection teacherId={me.id} canWrite />
      </div>
    </div>
  );
}
