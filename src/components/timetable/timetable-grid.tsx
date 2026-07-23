"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createSchedule,
  deleteSchedule,
  getTeacherCodesForSubject,
  updateSchedule,
} from "@/lib/api/academics";
import { Select } from "@/components/ui/select";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import type { ClasseMatiere, CreateScheduleInput, EmploiDuTemps, JourSemaine, Matiere } from "@/lib/types/academics";

/** Plages horaires fixes de la grille (§2) : le Directeur des Études affecte un professeur (par
 * son code, ex. "CH1") à chacune. Ce sont des bornes par défaut — certaines matières ne durent
 * qu'1h : l'heure réelle de la séance reste modifiable dans chaque cellule. */
const FIXED_SLOTS: { start: string; end: string; label: string }[] = [
  { start: "08:00", end: "10:00", label: "08h–10h" },
  { start: "10:00", end: "12:00", label: "10h–12h" },
  { start: "12:00", end: "14:00", label: "12h–14h" },
  { start: "14:00", end: "16:00", label: "14h–16h" },
];

const DAYS: { key: JourSemaine; label: string }[] = [
  { key: "LUNDI", label: "Lundi" },
  { key: "MARDI", label: "Mardi" },
  { key: "MERCREDI", label: "Mercredi" },
  { key: "JEUDI", label: "Jeudi" },
  { key: "VENDREDI", label: "Vendredi" },
  { key: "SAMEDI", label: "Samedi" },
];

interface CellOption {
  value: string; // "<subjectId>:<teacherId>"
  label: string; // "Mathématiques (MA1)"
}

export function TimetableGrid({
  classId,
  slots,
  classSubjects,
  subjects,
  onChanged,
}: {
  classId: number;
  slots: EmploiDuTemps[];
  classSubjects: ClasseMatiere[];
  subjects: Matiere[];
  onChanged: () => void;
}) {
  const subjectLabel = useMemo(() => new Map(subjects.map((s) => [s.id, s.label])), [subjects]);

  // Codes enseignants connus pour chaque matière de la classe (ex. CH1, CH2) — permet de réaffecter
  // rapidement un autre professeur codé sur la même matière, pas seulement celui par défaut.
  const [codesBySubject, setCodesBySubject] = useState<Map<number, ClasseMatiere[]>>(new Map());
  useEffect(() => {
    let active = true;
    void (async () => {
      const entries = await Promise.all(
        classSubjects.map(async (cs) => [cs.subjectId, await getTeacherCodesForSubject(cs.subjectId)] as const),
      );
      if (active) setCodesBySubject(new Map(entries));
    })();
    return () => { active = false; };
  }, [classSubjects]);

  const options: CellOption[] = useMemo(() => {
    return classSubjects.flatMap((cs) => {
      const label = subjectLabel.get(cs.subjectId) ?? `Matière #${cs.subjectId}`;
      const codes = codesBySubject.get(cs.subjectId) ?? [];
      // Dédoublonne par enseignant (un même prof peut apparaître dans plusieurs classes).
      const byTeacher = new Map<number, string>();
      for (const c of codes) if (c.teacherId != null && c.code) byTeacher.set(c.teacherId, c.code);
      if (byTeacher.size === 0 && cs.teacherId != null) byTeacher.set(cs.teacherId, cs.code ?? "?");
      return [...byTeacher.entries()].map(([teacherId, code]) => ({
        value: `${cs.subjectId}:${teacherId}`,
        label: `${label} (${code})`,
      }));
    });
  }, [classSubjects, codesBySubject, subjectLabel]);

  // Un créneau fixe (ex. 08h–10h) peut contenir une séance plus courte (matières d'1h) : on
  // rattache l'entrée dont l'heure de début tombe dans la fenêtre du créneau, pas seulement celles
  // qui en couvrent exactement les 2h.
  function entryFor(day: JourSemaine, slot: { start: string; end: string }): EmploiDuTemps | undefined {
    return slots.find((s) => {
      const start = s.startTime.slice(0, 5);
      return s.day === day && start >= slot.start && start < slot.end;
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/80">
            <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Créneau
            </th>
            {DAYS.map((d) => (
              <th key={d.key} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FIXED_SLOTS.map((slot) => (
            <tr key={slot.start} className="border-t border-gray-100">
              <td className="whitespace-nowrap px-3 py-2 align-top text-xs font-semibold text-gray-600">{slot.label}</td>
              {DAYS.map((d) => {
                const existing = entryFor(d.key, slot);
                return (
                  <td key={d.key} className="px-1.5 py-1.5 align-top">
                    <GridCell
                      // Remonte avec un état frais quand l'entrée apparaît/disparaît (créée ailleurs,
                      // ex. génération automatique) — évite un effet de resynchronisation.
                      key={existing?.id ?? "empty"}
                      classId={classId}
                      day={d.key}
                      slot={slot}
                      existing={existing}
                      options={options}
                      onChanged={onChanged}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Une cellule de la grille : choix matière+code prof, puis heure réelle modifiable (une matière
 * d'1h n'occupe pas tout le créneau de 2h). */
function GridCell({
  classId,
  day,
  slot,
  existing,
  options,
  onChanged,
}: {
  classId: number;
  day: JourSemaine;
  slot: { start: string; end: string };
  existing: EmploiDuTemps | undefined;
  options: CellOption[];
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [selectValue, setSelectValue] = useState(existing ? `${existing.subjectId}:${existing.teacherId}` : "");
  const [start, setStart] = useState(existing?.startTime.slice(0, 5) ?? slot.start);
  const [end, setEnd] = useState(existing?.endTime.slice(0, 5) ?? slot.end);

  async function save(nextSelect: string, nextStart: string, nextEnd: string) {
    if (nextSelect && nextEnd <= nextStart) {
      notifyError("L'heure de fin doit être après le début.");
      return;
    }
    setSaving(true);
    try {
      if (!nextSelect) {
        if (existing) await deleteSchedule(existing.id);
      } else {
        const [subjectIdStr, teacherIdStr] = nextSelect.split(":");
        const payload: CreateScheduleInput = {
          schoolClassId: classId,
          subjectId: Number(subjectIdStr),
          teacherId: Number(teacherIdStr),
          roomId: existing?.roomId ?? null,
          day,
          startTime: nextStart,
          endTime: nextEnd,
        };
        if (existing) await updateSchedule(existing.id, payload);
        else await createSchedule(payload);
      }
      notifySuccess("Créneau mis à jour");
      onChanged();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  function onSelectChange(value: string) {
    setSelectValue(value);
    if (value) {
      // Nouvelle affectation : on repart des bornes du créneau (ajustables juste en dessous).
      setStart(slot.start);
      setEnd(slot.end);
      void save(value, slot.start, slot.end);
    } else {
      void save("", start, end);
    }
  }

  function onTimeBlur() {
    if (!selectValue) return;
    void save(selectValue, start, end);
  }

  return (
    <div className={cn("space-y-1", saving && "opacity-50")}>
      <Select className="text-xs" value={selectValue} disabled={saving} onChange={(e) => onSelectChange(e.target.value)}>
        <option value="">— Vide —</option>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
      {selectValue && (
        <div className="flex items-center gap-1">
          <input
            type="time"
            value={start}
            disabled={saving}
            onChange={(e) => setStart(e.target.value)}
            onBlur={onTimeBlur}
            className="w-full rounded border border-gray-200 px-1 py-0.5 text-[11px] text-gray-600 outline-none focus:border-brand-300"
          />
          <span className="text-[10px] text-gray-400">–</span>
          <input
            type="time"
            value={end}
            disabled={saving}
            onChange={(e) => setEnd(e.target.value)}
            onBlur={onTimeBlur}
            className="w-full rounded border border-gray-200 px-1 py-0.5 text-[11px] text-gray-600 outline-none focus:border-brand-300"
          />
        </div>
      )}
    </div>
  );
}
