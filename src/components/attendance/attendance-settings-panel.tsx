"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import {
  addRecessWindow,
  deleteRecessWindow,
  getAttendanceSettings,
  listRecessWindows,
  updateAttendanceSettings,
} from "@/lib/api/attendance";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

/** Réglages du calcul des heures enseignant : marge de transition entre deux séances consécutives
 * dans des salles différentes, et fenêtres de récréation (temps défini par l'école, non imputable
 * à l'enseignant sur son heure d'arrivée). */
export function AttendanceSettingsPanel({ canWrite }: { canWrite: boolean }) {
  const settingsQuery = useQuery(getAttendanceSettings, []);
  const windowsQuery = useQuery(listRecessWindows, []);
  const [margin, setMargin] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [adding, setAdding] = useState(false);

  const effectiveMargin = margin ?? settingsQuery.data?.transitionMarginMinutes ?? 5;
  const windows = windowsQuery.data ?? [];

  async function saveMargin() {
    setSaving(true);
    try {
      await updateAttendanceSettings(effectiveMargin);
      notifySuccess("Marge de transition enregistrée.");
      settingsQuery.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddWindow() {
    if (!startTime || !endTime) return;
    setAdding(true);
    try {
      await addRecessWindow(label, startTime, endTime);
      setLabel(""); setStartTime(""); setEndTime("");
      notifySuccess("Fenêtre de récréation ajoutée.");
      windowsQuery.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setAdding(false);
    }
  }

  function handleDeleteWindow(id: number) {
    confirmAction({
      title: "Supprimer la fenêtre de récréation",
      message: "Cette fenêtre ne sera plus déduite du retard des enseignants dont une séance commence à cette heure.",
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteRecessWindow(id);
          notifySuccess("Fenêtre supprimée.");
          windowsQuery.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  if (settingsQuery.loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6">
        <p className="mb-4 text-xs text-gray-400">
          Temps de trajet toléré entre deux séances consécutives d&apos;un même enseignant dans des
          salles différentes, avant de compter un retard sur la seconde séance.
        </p>
        <Field>
          <Label>Marge de transition (minutes)</Label>
          <Input type="number" min={0} max={60} disabled={!canWrite} value={effectiveMargin}
            onChange={(e) => setMargin(Number(e.target.value) || 0)} />
        </Field>
        {canWrite && (
          <div className="mt-4 flex justify-end">
            <Button onClick={saveMargin} loading={saving}>Enregistrer</Button>
          </div>
        )}
      </div>

      <div className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6">
        <p className="mb-4 text-xs text-gray-400">
          Fenêtres de récréation quotidiennes (ex. 10h00–10h15) : si le début d&apos;une séance tombe
          dans cette fenêtre, l&apos;enseignant n&apos;est attendu qu&apos;à la fin de la récréation —
          ce temps est considéré réalisé.
        </p>
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Début</TH><TH>Fin</TH>{canWrite && <TH className="text-right">Actions</TH>}</tr></THead>
          <TBody>
            {windowsQuery.loading && (
              <TR><TD colSpan={4} className="py-6 text-center"><Spinner /></TD></TR>
            )}
            {!windowsQuery.loading && windows.length === 0 && (
              <TR><TD colSpan={4} className="py-6 text-center text-gray-400">Aucune fenêtre de récréation.</TD></TR>
            )}
            {windows.map((w) => (
              <TR key={w.id}>
                <TD>{w.label || "—"}</TD>
                <TD>{w.startTime}</TD>
                <TD>{w.endTime}</TD>
                {canWrite && (
                  <TD className="text-right">
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDeleteWindow(w.id)}>
                      Suppr.
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>

        {canWrite && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
            <Field>
              <Label>Libellé</Label>
              <Input placeholder="Récréation matin" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Field>
              <Label>Début</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field>
              <Label>Fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
            <Button onClick={handleAddWindow} loading={adding} disabled={!startTime || !endTime}>
              Ajouter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
