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

/** Bandes horaires par défaut de la grille — un point de repère visuel, pas une contrainte : l'heure
 * réelle de chaque séance reste entièrement libre dans sa cellule. Largeur de bande paramétrable par
 * l'appelant (voir {@link TimetableGridProps.slotBandMinutes}, ex. 2h au secondaire, 1h ailleurs) ;
 * une matière qui dure plus longtemps qu'une bande (ex. 8h-10h sur une grille en bandes d'1h) fusionne
 * visuellement les bandes concernées (voir {@link spanCount}) au lieu d'être coupée à la première
 * heure. Ces bornes 08h-18h conviennent à la plupart des écoles, mais une école de garderie/primaire
 * peut avoir des horaires différents (ex. dès 07h) — {@link buildSlots} étend automatiquement les
 * bandes pour couvrir tout créneau réellement enregistré en dehors de cette plage par défaut, pour ne
 * jamais masquer une séance dans la grille. */
const DEFAULT_SLOT_START = "08:00";
const DEFAULT_SLOT_END = "18:00";
const DEFAULT_SLOT_BAND_MINUTES = 60;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, min));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}
function slotLabel(start: string, end: string): string {
  return `${start.replace(":", "h")}–${end.replace(":", "h")}`;
}

/** Construit les bandes de la grille : la plage par défaut (08h-18h par bandes de `bandMinutes`),
 * étendue avant et/ou après si des créneaux réellement enregistrés (`slots`) débordent de cette plage. */
function buildSlots(slots: EmploiDuTemps[], bandMinutes: number): { start: string; end: string; label: string }[] {
  let rangeStart = timeToMinutes(DEFAULT_SLOT_START);
  let rangeEnd = timeToMinutes(DEFAULT_SLOT_END);
  for (const s of slots) {
    rangeStart = Math.min(rangeStart, timeToMinutes(s.startTime.slice(0, 5)));
    rangeEnd = Math.max(rangeEnd, timeToMinutes(s.endTime.slice(0, 5)));
  }
  // Aligne sur des bandes rondes pour rester lisible (ex. début à 6h50 → bande à partir de 6h).
  rangeStart = Math.floor(rangeStart / bandMinutes) * bandMinutes;
  rangeEnd = Math.ceil(rangeEnd / bandMinutes) * bandMinutes;

  const bands: { start: string; end: string; label: string }[] = [];
  for (let t = rangeStart; t < rangeEnd; t += bandMinutes) {
    const start = minutesToTime(t);
    const end = minutesToTime(t + bandMinutes);
    bands.push({ start, end, label: slotLabel(start, end) });
  }
  return bands;
}

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
  teacherName,
  slotBandMinutes,
  onChanged,
}: {
  classId: number;
  slots: EmploiDuTemps[];
  classSubjects: ClasseMatiere[];
  subjects: Matiere[];
  /** Nom de l'enseignant par identifiant — concaténé au libellé de chaque option du menu déroulant. */
  teacherName?: Map<number, string>;
  /** Largeur des bandes horaires en minutes (ex. 120 pour le secondaire, 60 ailleurs) — repli sur 1h. */
  slotBandMinutes?: number;
  onChanged: () => void;
}) {
  const subjectLabel = useMemo(() => new Map(subjects.map((s) => [s.id, s.label])), [subjects]);
  const fixedSlots = useMemo(
    () => buildSlots(slots, slotBandMinutes ?? DEFAULT_SLOT_BAND_MINUTES),
    [slots, slotBandMinutes],
  );

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
      return [...byTeacher.entries()].map(([teacherId, code]) => {
        const name = teacherName?.get(teacherId);
        return {
          value: `${cs.subjectId}:${teacherId}`,
          label: name ? `${label} (${code}) — ${name}` : `${label} (${code})`,
        };
      });
    });
  }, [classSubjects, codesBySubject, subjectLabel, teacherName]);

  // Un créneau fixe (ex. 08h–09h) peut contenir une séance plus courte OU commencer une séance plus
  // longue (matière sur plusieurs heures) : on rattache l'entrée dont l'heure de début tombe dans la
  // fenêtre du créneau.
  function entryFor(day: JourSemaine, slot: { start: string; end: string }): EmploiDuTemps | undefined {
    return slots.find((s) => {
      const start = s.startTime.slice(0, 5);
      return s.day === day && start >= slot.start && start < slot.end;
    });
  }

  // Nombre de bandes d'1h consécutives couvertes par une séance à partir de l'index `fromIndex`
  // (ex. une matière 08h-10h sur une grille en bandes d'1h couvre 2 bandes : 08h-09h et 09h-10h).
  function spanCount(entry: EmploiDuTemps, fromIndex: number): number {
    const end = entry.endTime.slice(0, 5);
    let count = 0;
    for (let j = fromIndex; j < fixedSlots.length && fixedSlots[j].start < end; j++) count++;
    return Math.max(1, count);
  }

  // Pointeur par jour : index de la prochaine bande à afficher (les bandes déjà couvertes par une
  // séance fusionnée au-dessus, via rowSpan, ne doivent pas produire de <td> dans cette ligne).
  const dayCursor = new Map<JourSemaine, number>(DAYS.map((d) => [d.key, 0]));

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
          {fixedSlots.map((slot, rowIndex) => (
            <tr key={slot.start} className="border-t border-gray-100">
              <td className="whitespace-nowrap px-3 py-2 align-top text-xs font-semibold text-gray-600">{slot.label}</td>
              {DAYS.map((d) => {
                const cursor = dayCursor.get(d.key) ?? 0;
                if (cursor > rowIndex) return null; // couvert par le rowSpan d'une séance au-dessus
                const existing = entryFor(d.key, slot);
                const span = existing ? spanCount(existing, rowIndex) : 1;
                dayCursor.set(d.key, rowIndex + span);
                return (
                  <td key={d.key} rowSpan={span} className="px-1.5 py-1.5 align-top">
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
