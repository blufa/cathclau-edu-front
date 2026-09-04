"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createSchedule } from "@/lib/api/academics";
import type { ClasseMatiere, JourSemaine, Matiere, Salle } from "@/lib/types/academics";
import type { Teacher } from "@/lib/types/staff";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { notifyError, notifySuccess } from "@/lib/feedback";

const DAYS: { value: JourSemaine; label: string }[] = [
  { value: "LUNDI", label: "Lun" },
  { value: "MARDI", label: "Mar" },
  { value: "MERCREDI", label: "Mer" },
  { value: "JEUDI", label: "Jeu" },
  { value: "VENDREDI", label: "Ven" },
  { value: "SAMEDI", label: "Sam" },
];

type ScheduleMode = "single" | "repeated" | "sequence";

/** Ajoute des minutes à une heure "HH:mm", sans dépasser minuit. */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface SequenceRow { id: string; subjectId: string; durationMinutes: number; pauseMinutes: number; }
let rowSeq = 0;
function newRow(): SequenceRow {
  rowSeq += 1;
  return { id: `row-${rowSeq}`, subjectId: "", durationMinutes: 30, pauseMinutes: 0 };
}

/**
 * Crée un horaire fixe répété sur plusieurs jours en une seule soumission. Trois modes :
 * - **Créneau unique** : une matière, un créneau début/fin, librement choisi (aucune heure imposée).
 * - **Blocs répétés (même matière)** : une suite de créneaux courts identiques séparés par une pause
 *   (ex. garderie : 30 min + 10 min de pause), durées entièrement libres.
 * - **Plusieurs matières enchaînées (même enseignant)** : pour une monitrice qui enseigne plusieurs
 *   matières à la suite (ex. garderie/primaire) — chaque ligne choisit sa matière, sa durée et sa
 *   pause, le tout s'enchaîne à partir de l'heure de début.
 * La salle se pré-remplit avec la salle attitrée de la classe (toujours modifiable) : plus besoin de la
 * ressaisir alors qu'elle est déjà connue via la classe.
 */
export function FixedScheduleForm({
  classId, classRoomId, subjects, teachers, rooms, classSubjects, onDone, onCancel,
}: {
  classId: number;
  /** Salle attitrée de la classe (Classe.roomId), le cas échéant — sert à préremplir la salle. */
  classRoomId?: number | null;
  subjects: Matiere[];
  teachers: Teacher[];
  rooms: Salle[];
  classSubjects: ClasseMatiere[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<ScheduleMode>("single");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [roomId, setRoomId] = useState(classRoomId != null ? String(classRoomId) : "");
  const [roomTouched, setRoomTouched] = useState(false);
  const [days, setDays] = useState<Set<JourSemaine>>(new Set());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [blockMinutes, setBlockMinutes] = useState(30);
  const [breakMinutes, setBreakMinutes] = useState(10);
  const [sequenceRows, setSequenceRows] = useState<SequenceRow[]>([newRow(), newRow()]);
  const [submitting, setSubmitting] = useState(false);

  const teacherBySubject = useMemo(
    () => new Map(classSubjects.map((cm) => [String(cm.subjectId), cm.teacherId])),
    [classSubjects],
  );
  const subjectOptions: SearchableOption[] = useMemo(() => (classSubjects.length > 0
    ? classSubjects.map((cm) => {
      const label = subjects.find((s) => s.id === cm.subjectId)?.label ?? `Matière #${cm.subjectId}`;
      return { value: String(cm.subjectId), trigger: label, label, searchText: label };
    })
    : subjects.map((s) => ({ value: String(s.id), trigger: s.label, label: s.label, searchText: s.label }))),
  [classSubjects, subjects]);

  function onSubjectChange(sid: string) {
    setSubjectId(sid);
    const tid = teacherBySubject.get(sid);
    setTeacherId(tid != null ? String(tid) : "");
  }

  function toggleDay(d: JourSemaine) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  }

  function setRow(id: string, patch: Partial<SequenceRow>) {
    setSequenceRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() { setSequenceRows((prev) => [...prev, newRow()]); }
  function removeRow(id: string) { setSequenceRows((prev) => prev.filter((r) => r.id !== id)); }

  // Blocs à créer pour chaque jour sélectionné, chacun porteur de sa propre matière (unifie les 3
  // modes : "single" et "repeated" appliquent la même matière à tous leurs blocs, "sequence" varie la
  // matière par ligne).
  const blocks = useMemo(() => {
    if (!startTime) return [];
    if (mode === "single") {
      if (!endTime || !subjectId) return [];
      return [{ start: startTime, end: endTime, subjectId }];
    }
    if (mode === "repeated") {
      if (!endTime || !subjectId) return [];
      const result: { start: string; end: string; subjectId: string }[] = [];
      let cursor = startTime;
      let guard = 0;
      while (cursor < endTime && guard < 100) {
        const blockEnd = addMinutes(cursor, blockMinutes);
        if (blockEnd > endTime) break;
        result.push({ start: cursor, end: blockEnd, subjectId });
        cursor = addMinutes(blockEnd, breakMinutes);
        guard++;
      }
      return result;
    }
    // mode === "sequence" : enchaîne chaque ligne à la suite, chacune avec sa propre matière/durée/pause.
    const result: { start: string; end: string; subjectId: string }[] = [];
    let cursor = startTime;
    for (const row of sequenceRows) {
      if (!row.subjectId || !row.durationMinutes) continue;
      const end = addMinutes(cursor, row.durationMinutes);
      result.push({ start: cursor, end, subjectId: row.subjectId });
      cursor = addMinutes(end, row.pauseMinutes || 0);
    }
    return result;
  }, [mode, startTime, endTime, subjectId, blockMinutes, breakMinutes, sequenceRows]);

  async function submit() {
    if (mode !== "sequence" && !subjectId) { notifyError("Choisissez la matière."); return; }
    if (mode === "sequence" && sequenceRows.every((r) => !r.subjectId)) { notifyError("Ajoutez au moins une matière."); return; }
    if (days.size === 0) { notifyError("Choisissez au moins un jour."); return; }
    if (blocks.length === 0) { notifyError("Choisissez une plage horaire valide."); return; }
    setSubmitting(true);
    let created = 0;
    let skipped = 0;
    try {
      for (const day of days) {
        for (const b of blocks) {
          try {
            await createSchedule({
              schoolClassId: classId, subjectId: Number(b.subjectId),
              teacherId: teacherId ? Number(teacherId) : null,
              roomId: roomId ? Number(roomId) : null,
              day, startTime: b.start, endTime: b.end,
            });
            created++;
          } catch { skipped++; }
        }
      }
      notifySuccess(`${created} créneau(x) créé(s)${skipped ? `, ${skipped} ignoré(s) pour conflit` : ""}`);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field>
        <Label>Type d&apos;horaire</Label>
        <Select value={mode} onChange={(e) => setMode(e.target.value as ScheduleMode)}>
          <option value="single">Créneau unique</option>
          <option value="repeated">Blocs répétés (même matière) — ex. garderie</option>
          <option value="sequence">Plusieurs matières enchaînées (même enseignant) — ex. monitrice</option>
        </Select>
      </Field>

      {mode !== "sequence" && (
        <Field>
          <Label>Matière <span className="text-error-500">*</span></Label>
          <SearchableSelect value={subjectId} options={subjectOptions} onChange={onSubjectChange} triggerClassName="w-full justify-between px-3" />
        </Field>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Enseignant{mode === "sequence" ? " (monitrice)" : ""}</Label>
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— Non assigné —</option>
            {teachers.map((t) => (<option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Salle</Label>
          <Select value={roomId} onChange={(e) => { setRoomId(e.target.value); setRoomTouched(true); }}>
            <option value="">— Aucune —</option>
            {rooms.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
          </Select>
          {classRoomId != null && !roomTouched && (
            <p className="mt-1 text-xs text-gray-400">Salle attitrée de la classe, pré-remplie automatiquement.</p>
          )}
        </Field>
      </div>

      <Field>
        <Label>Jours <span className="text-error-500">*</span></Label>
        <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 p-2">
          {DAYS.map((d) => (
            <Checkbox key={d.value} label={d.label} checked={days.has(d.value)} onChange={() => toggleDay(d.value)} />
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Début <span className="text-error-500">*</span></Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        {mode !== "sequence" && (
          <Field>
            <Label>Fin <span className="text-error-500">*</span></Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        )}
      </div>

      {mode === "repeated" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-gray-200 p-3">
          <Field>
            <Label>Durée d&apos;un bloc (min)</Label>
            <Input type="number" min={5} value={blockMinutes} onChange={(e) => setBlockMinutes(Number(e.target.value) || 0)} />
          </Field>
          <Field>
            <Label>Pause entre blocs (min)</Label>
            <Input type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)} />
          </Field>
        </div>
      )}

      {mode === "sequence" && (
        <div className="space-y-2 rounded-xl border border-gray-200 p-3">
          <Label>Matières enchaînées, dans l&apos;ordre</Label>
          {sequenceRows.map((row, i) => (
            <div key={row.id} className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
              <div className="min-w-[160px] flex-1">
                <Select value={row.subjectId} onChange={(e) => setRow(row.id, { subjectId: e.target.value })}>
                  <option value="">Matière {i + 1}…</option>
                  {subjects.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </Select>
              </div>
              <div className="w-28">
                <Input
                  type="number" min={5} placeholder="Durée (min)"
                  value={row.durationMinutes}
                  onChange={(e) => setRow(row.id, { durationMinutes: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="w-28">
                <Input
                  type="number" min={0} placeholder="Pause (min)"
                  value={row.pauseMinutes}
                  onChange={(e) => setRow(row.id, { pauseMinutes: Number(e.target.value) || 0 })}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.id)} disabled={sequenceRows.length <= 1}>
                <Trash2 className="h-4 w-4 text-error-500" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" leftSection={<Plus className="h-4 w-4" />} onClick={addRow}>
            Ajouter une matière
          </Button>
          <p className="text-xs text-gray-400">
            Durée et pause libres pour chaque matière — l&apos;horaire s&apos;enchaîne automatiquement à
            partir de l&apos;heure de début.
          </p>
        </div>
      )}

      {mode === "repeated" && blocks.length > 0 && (
        <p className="text-xs text-gray-400">
          {blocks.length} bloc(s) par jour : {blocks.map((b) => `${b.start}-${b.end}`).join(", ")}
        </p>
      )}
      {mode === "sequence" && blocks.length > 0 && (
        <p className="text-xs text-gray-400">
          Séquence : {blocks.map((b) => `${subjects.find((s) => String(s.id) === b.subjectId)?.label ?? "?"} (${b.start}-${b.end})`).join(" → ")}
        </p>
      )}

      <p className="text-xs text-gray-400">
        {days.size} jour(s) × {blocks.length} créneau(x) = {days.size * blocks.length} créneau(x) au total. Les
        conflits éventuels (salle/enseignant/classe déjà occupés) sont ignorés individuellement.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button type="button" onClick={submit} loading={submitting}>Créer l&apos;horaire</Button>
      </div>
    </div>
  );
}
