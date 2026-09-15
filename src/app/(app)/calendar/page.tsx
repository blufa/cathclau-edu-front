"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears } from "@/lib/api/academics";
import { createEvent, updateEvent, deleteEvent, listEvents } from "@/lib/api/calendar";
import { EVENT_TYPE_LABEL, EVENT_TYPE_TONE, type AcademicEvent, type AcademicEventType } from "@/lib/types/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export default function CalendarPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "RESPONSABLE_PEDAGOGIQUE");
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = yearsQuery.data ?? [];
  const cy = years.find((y) => y.current) ?? years[0];
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYear = yearId ?? cy?.id ?? null;
  const q = useQuery(() => (effectiveYear ? listEvents(effectiveYear) : Promise.resolve([])), [effectiveYear]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AcademicEvent | null>(null);

  function remove(e: AcademicEvent) {
    confirmAction({ title: "Supprimer l'événement", message: e.title, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteEvent(e.id); notifySuccess("Supprimé"); q.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Calendrier académique</h1>
          <p className="text-sm text-gray-500">Jours fériés, vacances, compositions, réunions et échéances</p>
        </div>
        {canWrite && effectiveYear && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvel événement</Button>}
      </Reveal>

      <Field>
        <Label>Année scolaire</Label>
        <Select className="max-w-[260px]" value={effectiveYear ?? ""} onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}>
          {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
        </Select>
      </Field>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Date(s)</TH><TH>Type</TH><TH>Intitulé</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-gray-400">Aucun événement pour cette année.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap">{e.startDate}{e.endDate ? ` → ${e.endDate}` : ""}</TD>
                <TD><Badge tone={EVENT_TYPE_TONE[e.eventType]}>{EVENT_TYPE_LABEL[e.eventType]}</Badge></TD>
                <TD className="font-medium text-gray-900">{e.title}{e.description ? <span className="block text-xs text-gray-400">{e.description}</span> : null}</TD>
                <TD className="text-right">{canWrite && (
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Modifier</Button>
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(e)}>Suppr.</Button>
                  </div>
                )}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier l'événement" : "Nouvel événement"}>
        {(effectiveYear || editing) && (
          <EventForm yearId={editing?.academicYearId ?? effectiveYear ?? 0} initial={editing}
            onCancel={() => { setCreating(false); setEditing(null); }}
            onDone={() => { setCreating(false); setEditing(null); notifySuccess(editing ? "Mis à jour" : "Créé"); q.refetch(); }} />
        )}
      </Modal>
    </div>
  );
}

function EventForm({ yearId, initial, onCancel, onDone }: { yearId: number; initial?: AcademicEvent | null; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [eventType, setEventType] = useState<AcademicEventType>(initial?.eventType ?? "HOLIDAY");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  async function submit() {
    if (!title.trim() || !startDate) { notifyError("Intitulé et date de début requis"); return; }
    setLoading(true);
    try {
      const payload = {
        academicYearId: yearId, title, eventType,
        startDate, endDate: endDate || null, description: description || null,
      };
      if (initial) await updateEvent(initial.id, payload);
      else await createEvent(payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <Field>
        <Label>Intitulé <span className="text-error-500">*</span></Label>
        <Input placeholder="Ex. Composition du 1er trimestre" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field>
        <Label>Type</Label>
        <Select value={eventType} onChange={(e) => setEventType(e.target.value as AcademicEventType)}>
          {(Object.keys(EVENT_TYPE_LABEL) as AcademicEventType[]).map((t) => (<option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field><Label>Date de début <span className="text-error-500">*</span></Label><DatePicker value={startDate} clearable onChange={setStartDate} /></Field>
        <Field><Label>Date de fin</Label><DatePicker value={endDate} clearable onChange={setEndDate} /></Field>
      </div>
      <Field><Label>Description (optionnel)</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </div>
  );
}
