"use client";

import type { EmploiDuTemps, JourSemaine } from "@/lib/types/academics";

const DAYS: { key: JourSemaine; label: string }[] = [
  { key: "LUNDI", label: "Lundi" },
  { key: "MARDI", label: "Mardi" },
  { key: "MERCREDI", label: "Mercredi" },
  { key: "JEUDI", label: "Jeudi" },
  { key: "VENDREDI", label: "Vendredi" },
  { key: "SAMEDI", label: "Samedi" },
];

/** Grille hebdomadaire réutilisable (portail élève/parent/enseignant). Les libellés sont résolus
 *  par les fonctions optionnelles fournies ; à défaut on affiche l'identifiant. */
export function WeeklyTimetable({
  slots,
  subjectName,
  roomName,
  classLabel,
  teacherName,
  emptyText = "Aucun créneau d'emploi du temps.",
}: {
  slots: EmploiDuTemps[];
  subjectName?: (id: number) => string;
  roomName?: (id: number | null) => string | null | undefined;
  classLabel?: (id: number) => string;
  teacherName?: (id: number | null) => string | null | undefined;
  emptyText?: string;
}) {
  if (slots.length === 0) {
    return <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">{emptyText}</p>;
  }
  const byDay = new Map<JourSemaine, EmploiDuTemps[]>();
  for (const d of DAYS) byDay.set(d.key, []);
  for (const s of slots) byDay.get(s.day)?.push(s);
  for (const list of byDay.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {DAYS.map((d) => {
        const list = byDay.get(d.key) ?? [];
        return (
          <div key={d.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{d.label}</p>
            {list.length === 0 ? (
              <p className="text-xs text-slate-300">—</p>
            ) : (
              <ul className="space-y-2">
                {list.map((s) => {
                  const room = roomName?.(s.roomId);
                  const teacher = teacherName?.(s.teacherId);
                  return (
                    <li key={s.id} className="rounded-lg bg-brand-50/70 p-2 text-xs">
                      <p className="font-semibold text-brand-800">{s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}</p>
                      <p className="font-medium text-slate-800">{subjectName ? subjectName(s.subjectId) : `Matière #${s.subjectId}`}</p>
                      {classLabel && <p className="text-slate-500">{classLabel(s.schoolClassId)}</p>}
                      {teacher && <p className="text-slate-500">{teacher}</p>}
                      {room && <p className="text-slate-400">Salle : {room}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
