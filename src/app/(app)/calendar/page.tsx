"use client";

import { useState } from "react";
import { Select, Stack, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears } from "@/lib/api/academics";
import { createEvent, updateEvent, deleteEvent, listEvents } from "@/lib/api/calendar";
import { EVENT_TYPE_LABEL, EVENT_TYPE_TONE, type AcademicEvent, type AcademicEventType } from "@/lib/types/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export default function CalendarPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY");
  const yearsQuery = useQuery(listAcademicYears, []);
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Calendrier académique</h1>
          <p className="text-sm text-slate-500">Jours fériés, vacances, compositions, réunions et échéances</p>
        </div>
        {canWrite && effectiveYear && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvel événement</Button>}
      </Reveal>

      <Select className="max-w-[260px]" label="Année scolaire"
        data={years.map((y) => ({ value: String(y.id), label: y.label + (y.current ? " (courante)" : "") }))}
        value={effectiveYear != null ? String(effectiveYear) : null}
        onChange={(v) => setYearId(v ? Number(v) : null)} />

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Date(s)</TH><TH>Type</TH><TH>Intitulé</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-slate-400">Aucun événement pour cette année.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap">{e.startDate}{e.endDate ? ` → ${e.endDate}` : ""}</TD>
                <TD><Badge tone={EVENT_TYPE_TONE[e.eventType]}>{EVENT_TYPE_LABEL[e.eventType]}</Badge></TD>
                <TD className="font-medium text-slate-900">{e.title}{e.description ? <span className="block text-xs text-slate-400">{e.description}</span> : null}</TD>
                <TD className="text-right">{canWrite && (
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Modifier</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(e)}>Suppr.</Button>
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
  const form = useForm({
    mode: "controlled",
    initialValues: {
      title: initial?.title ?? "",
      eventType: (initial?.eventType ?? "HOLIDAY") as AcademicEventType,
      startDate: initial?.startDate ?? "",
      endDate: initial?.endDate ?? "",
      description: initial?.description ?? "",
    },
    validate: { title: (v) => (v ? null : "Requis"), startDate: (v) => (v ? null : "Requise") },
  });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = {
        academicYearId: yearId, title: values.title, eventType: values.eventType,
        startDate: values.startDate, endDate: values.endDate || null, description: values.description || null,
      };
      if (initial) await updateEvent(initial.id, payload);
      else await createEvent(payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Intitulé" withAsterisk placeholder="Ex. Composition du 1er trimestre" {...form.getInputProps("title")} />
        <Select label="Type" allowDeselect={false}
          data={(Object.keys(EVENT_TYPE_LABEL) as AcademicEventType[]).map((t) => ({ value: t, label: EVENT_TYPE_LABEL[t] }))}
          {...form.getInputProps("eventType")} />
        <div className="grid grid-cols-2 gap-3">
          <DatePickerInput label="Date de début" withAsterisk valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("startDate")} />
          <DatePickerInput label="Date de fin" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("endDate")} />
        </div>
        <Textarea label="Description (optionnel)" autosize minRows={2} {...form.getInputProps("description")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
        </div>
      </Stack>
    </form>
  );
}
