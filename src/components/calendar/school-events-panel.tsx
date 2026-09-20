"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { createSchoolEvent, deleteSchoolEvent, listSchoolEvents } from "@/lib/api/academics";
import type { SchoolEvent, SchoolEventInput } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const EMPTY: SchoolEventInput = { label: "", startDate: "", endDate: "", startTime: "", endTime: "", reason: "" };

/**
 * Événements école (kermesse, match, entraînement...) décidés par le fondateur/la direction : les
 * élèves ne suivent pas cours sur cette période, mais les enseignants dont un créneau tombe dedans
 * restent payés sur ces heures — aucune saisie côté paie n'est nécessaire, c'est automatique.
 */
export function SchoolEventsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listSchoolEvents, []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SchoolEventInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openCreate() { setForm(EMPTY); setOpen(true); }

  async function submit() {
    if (!form.label.trim() || !form.startDate || !form.endDate) {
      notifyError(new Error("Intitulé et dates requis."));
      return;
    }
    setSaving(true);
    try {
      await createSchoolEvent({
        ...form,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        reason: form.reason || null,
      });
      notifySuccess("Événement créé.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function remove(e: SchoolEvent) {
    confirmAction({
      title: "Supprimer l'événement", message: `Supprimer « ${e.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteSchoolEvent(e.id); notifySuccess("Événement supprimé."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-500">
            Kermesse, match, entraînement… : les élèves ne suivent pas cours, mais les enseignants concernés
            restent payés sur ces heures (rien à faire côté paie, c&apos;est automatique).
          </p>
          {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Nouvel événement</Button>}
        </div>
        {q.loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Aucun événement école.</p>
        ) : (
          <Table>
            <THead>
              <TR><TH>Intitulé</TH><TH>Dates</TH><TH>Horaires</TH><TH>Motif</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
            </THead>
            <TBody>
              {items.map((e) => (
                <TR key={e.id}>
                  <TD className="font-medium text-gray-900">{e.label}</TD>
                  <TD>{e.startDate}{e.endDate !== e.startDate ? ` → ${e.endDate}` : ""}</TD>
                  <TD className="text-sm text-gray-600">{e.startTime && e.endTime ? `${e.startTime} – ${e.endTime}` : "Journée entière"}</TD>
                  <TD className="text-sm text-gray-500">{e.reason ?? "—"}</TD>
                  {canWrite && (
                    <TD className="text-right">
                      <button onClick={() => remove(e)} aria-label="Supprimer" className="rounded-lg p-1.5 text-gray-500 hover:bg-error-50 hover:text-error-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvel événement école">
        <div className="space-y-4">
          <Field>
            <Label>Intitulé <span className="text-error-500">*</span></Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex. Kermesse annuelle" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field>
              <Label>Date de début <span className="text-error-500">*</span></Label>
              <DatePicker value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
            </Field>
            <Field>
              <Label>Date de fin <span className="text-error-500">*</span></Label>
              <DatePicker value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field>
              <Label>Heure de début (optionnel)</Label>
              <Input type="time" value={form.startTime ?? ""} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </Field>
            <Field>
              <Label>Heure de fin (optionnel)</Label>
              <Input type="time" value={form.endTime ?? ""} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-gray-400">Laisser les heures vides si l&apos;événement couvre toute la journée.</p>
          <Field>
            <Label>Motif (optionnel)</Label>
            <Textarea rows={2} value={form.reason ?? ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Détails pour l'équipe pédagogique" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Créer"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
