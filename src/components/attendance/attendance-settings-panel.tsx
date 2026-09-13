"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import {
  addRecessWindow,
  deleteRecessWindow,
  getAttendanceSettings,
  listRecessWindows,
  updateAttendanceSettings,
  updateEmployeeAttendanceHours,
  updateStudentAttendanceMargin,
} from "@/lib/api/attendance";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

/** Réglages du calcul de présence/heures : marge de tolérance générale avant de compter un retard
 * (élève, enseignant, personnel), et fenêtres de récréation (temps défini par l'école, non imputable
 * à l'enseignant sur son heure d'arrivée). */
export function AttendanceSettingsPanel({ canWrite }: { canWrite: boolean }) {
  const settingsQuery = useQuery(getAttendanceSettings, []);
  const windowsQuery = useQuery(listRecessWindows, []);
  const [margin, setMargin] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [studentMargin, setStudentMargin] = useState<number | null>(null);
  const [savingStudentMargin, setSavingStudentMargin] = useState(false);
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [adding, setAdding] = useState(false);
  const [employeeCheckIn, setEmployeeCheckIn] = useState<string | null>(null);
  const [employeeCheckOut, setEmployeeCheckOut] = useState<string | null>(null);
  const [savingHours, setSavingHours] = useState(false);

  // Pas de tolérance tant que l'école ne l'a pas explicitement configurée — 0 par défaut, jamais une
  // valeur non nulle silencieuse (demande explicite de la direction des études).
  const effectiveMargin = margin ?? settingsQuery.data?.transitionMarginMinutes ?? 0;
  const effectiveStudentMargin = studentMargin ?? settingsQuery.data?.studentTransitionMarginMinutes ?? 0;
  const windows = windowsQuery.data ?? [];
  const effectiveCheckIn = employeeCheckIn ?? settingsQuery.data?.employeeCheckInTime?.slice(0, 5) ?? "08:00";
  const effectiveCheckOut = employeeCheckOut ?? settingsQuery.data?.employeeCheckOutTime?.slice(0, 5) ?? "17:00";

  async function saveMargin() {
    setSaving(true);
    try {
      await updateAttendanceSettings(effectiveMargin);
      notifySuccess("Marge de tolérance enseignants/personnel enregistrée.");
      settingsQuery.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  async function saveStudentMargin() {
    setSavingStudentMargin(true);
    try {
      await updateStudentAttendanceMargin(effectiveStudentMargin);
      notifySuccess("Marge de tolérance élèves enregistrée.");
      settingsQuery.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingStudentMargin(false);
    }
  }

  async function saveEmployeeHours() {
    setSavingHours(true);
    try {
      await updateEmployeeAttendanceHours(effectiveCheckIn, effectiveCheckOut);
      notifySuccess("Horaire du personnel enregistré.");
      settingsQuery.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingHours(false);
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
          Délai de tolérance avant de compter un retard, à l&apos;entrée d&apos;un enseignant ou d&apos;un
          membre du personnel (quel que soit le cours ou la salle) — 0 minute tant que non configuré,
          aucune tolérance appliquée par défaut. Marge distincte de celle des élèves, ci-dessous.
        </p>
        <Field>
          <Label>Marge de tolérance enseignants / personnel (minutes)</Label>
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
          Délai de tolérance avant de compter un retard à l&apos;entrée d&apos;un élève — réglable
          indépendamment de la marge enseignants/personnel ci-dessus. 0 minute tant que non configuré.
        </p>
        <Field>
          <Label>Marge de tolérance élèves (minutes)</Label>
          <Input type="number" min={0} max={60} disabled={!canWrite} value={effectiveStudentMargin}
            onChange={(e) => setStudentMargin(Number(e.target.value) || 0)} />
        </Field>
        {canWrite && (
          <div className="mt-4 flex justify-end">
            <Button onClick={saveStudentMargin} loading={savingStudentMargin}>Enregistrer</Button>
          </div>
        )}
      </div>

      <div className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6">
        <p className="mb-4 text-xs text-gray-400">
          Horaire de référence du personnel non-enseignant (administratif, direction, soutien) — un
          seul horaire pour tout le personnel, pas de créneau de cours par individu comme les
          enseignants. Sert à calculer retard et départ anticipé au pointage.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <Label>Heure d&apos;entrée</Label>
            <Input type="time" disabled={!canWrite} value={effectiveCheckIn} onChange={(e) => setEmployeeCheckIn(e.target.value)} />
          </Field>
          <Field>
            <Label>Heure de sortie</Label>
            <Input type="time" disabled={!canWrite} value={effectiveCheckOut} onChange={(e) => setEmployeeCheckOut(e.target.value)} />
          </Field>
        </div>
        {canWrite && (
          <div className="mt-4 flex justify-end">
            <Button onClick={saveEmployeeHours} loading={savingHours}>Enregistrer</Button>
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
