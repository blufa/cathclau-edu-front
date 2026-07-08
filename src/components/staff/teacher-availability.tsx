"use client";

import { useState } from "react";
import { Select } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { Trash2 } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { addTeacherAvailability, deleteTeacherAvailability, getTeacherAvailability } from "@/lib/api/staff";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";

const DAYS: { value: string; label: string }[] = [
  { value: "LUNDI", label: "Lundi" },
  { value: "MARDI", label: "Mardi" },
  { value: "MERCREDI", label: "Mercredi" },
  { value: "JEUDI", label: "Jeudi" },
  { value: "VENDREDI", label: "Vendredi" },
  { value: "SAMEDI", label: "Samedi" },
];
const hhmm = (t: string) => t?.slice(0, 5) ?? "";

/**
 * Éditeur des disponibilités d'un enseignant (jour + plage horaire). Ces plages alimentent
 * l'emploi du temps : on n'y planifie un cours que dans une plage disponible.
 */
export function TeacherAvailabilitySection({ teacherId, canWrite }: { teacherId: number; canWrite: boolean }) {
  const q = useQuery(() => getTeacherAvailability(teacherId), [teacherId]);
  const [day, setDay] = useState("LUNDI");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("12:00");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!start || !end || end <= start) { notifyError("Plage horaire invalide."); return; }
    setSaving(true);
    try {
      await addTeacherAvailability(teacherId, { day, startTime: start, endTime: end });
      notifySuccess("Disponibilité ajoutée");
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }
  async function remove(id: number) {
    try { await deleteTeacherAvailability(id); notifySuccess("Disponibilité supprimée"); q.refetch(); }
    catch (err) { notifyError(err); }
  }

  const byDay = DAYS.map((d) => ({ ...d, slots: (q.data ?? []).filter((s) => s.day === d.value) }));

  return (
    <div className="space-y-4">
      {q.loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byDay.map((d) => (
            <div key={d.value} className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{d.label}</p>
              {d.slots.length === 0 ? (
                <p className="text-xs text-slate-300">—</p>
              ) : (
                <ul className="space-y-1">
                  {d.slots.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-sm text-slate-700">
                      <span>{hhmm(s.startTime)} – {hhmm(s.endTime)}</span>
                      {canWrite && (
                        <button type="button" onClick={() => remove(s.id)} className="text-red-500 hover:text-red-700" aria-label="Supprimer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-end">
          <Select label="Jour" className="sm:w-40" data={DAYS} value={day} onChange={(value) => setDay(value ?? "")} />
          <TimeInput label="Début" value={start} onChange={(e) => setStart(e.currentTarget.value)} />
          <TimeInput label="Fin" value={end} onChange={(e) => setEnd(e.currentTarget.value)} />
          <Button onClick={add} loading={saving}>Ajouter</Button>
        </div>
      )}
    </div>
  );
}
