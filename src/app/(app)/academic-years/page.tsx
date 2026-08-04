"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  changeAcademicYearStatus,
  closePeriod,
  createAcademicYear,
  createPeriod,
  listAcademicYears,
  listPeriods,
  setCurrentAcademicYear,
} from "@/lib/api/academics";
import type {
  AnneeScolaire,
  CreateAcademicYearInput,
  CreatePeriodInput,
  StatutAnneeScolaire,
  TypePeriode,
  SchoolCycle,
} from "@/lib/types/academics";
import { createEvent, deleteEvent, listEvents } from "@/lib/api/calendar";
import {
  EVENT_TYPE_LABEL,
  EVENT_TYPE_TONE,
  type AcademicEvent,
  type AcademicEventType,
} from "@/lib/types/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<StatutAnneeScolaire, "gray" | "green" | "amber" | "blue"> = {
  PLANIFIEE: "gray",
  EN_COURS: "green",
  CLOTUREE: "amber",
  ARCHIVEE: "blue",
};
const STATUS_LABEL: Record<StatutAnneeScolaire, string> = {
  PLANIFIEE: "Planifiée",
  EN_COURS: "En cours",
  CLOTUREE: "Clôturée",
  ARCHIVEE: "Archivée",
};

/** Libellé d'année scolaire au format « 2026 - 2027 » à partir de l'année de début. */
function schoolYearLabel(year: number): string {
  return `${year} - ${year + 1}`;
}

const yearSchema = z.object({ label: z.string().trim().min(1, "Libellé requis"), startDate: z.string(), endDate: z.string() });
type YearFormValues = z.infer<typeof yearSchema>;

function YearForm({ onSubmit, onCancel }: { onSubmit: (input: CreateAcademicYearInput) => Promise<void>; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<YearFormValues>({
    resolver: zodResolver(yearSchema),
    // Pré-rempli avec l'année scolaire courante (ex. « 2026 - 2027 »), dérivée de la date de début.
    defaultValues: { label: schoolYearLabel(new Date().getFullYear()), startDate: "", endDate: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: YearFormValues) {
    setSubmitting(true);
    try {
      await onSubmit({ label: values.label, startDate: values.startDate || null, endDate: values.endDate || null });
    } catch (err) {
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        <Input placeholder="2026 - 2027" value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
        {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Début</Label>
          <DatePicker value={v.startDate} clearable onChange={(val) => {
            setValue("startDate", val);
            const yr = val ? new Date(val).getFullYear() : NaN;
            if (!Number.isNaN(yr)) setValue("label", schoolYearLabel(yr));
          }} />
        </Field>
        <Field>
          <Label>Fin</Label>
          <DatePicker value={v.endDate} clearable onChange={(val) => setValue("endDate", val)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button type="submit" loading={submitting}>Créer</Button>
      </div>
    </form>
  );
}

const periodSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis"),
  cycle: z.string(),
  type: z.string(),
  sortOrder: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});
type PeriodFormValues = z.infer<typeof periodSchema>;

function PeriodForm({ onSubmit, onCancel }: { onSubmit: (input: CreatePeriodInput) => Promise<void>; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<PeriodFormValues>({
    resolver: zodResolver(periodSchema),
    defaultValues: { label: "", cycle: "PRIMAIRE", type: "TRIMESTRE", sortOrder: "1", startDate: "", endDate: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: PeriodFormValues) {
    setSubmitting(true);
    try {
      await onSubmit({
        label: values.label,
        cycle: values.cycle as SchoolCycle,
        type: values.type as TypePeriode,
        sortOrder: Number(values.sortOrder),
        startDate: values.startDate || null,
        endDate: values.endDate || null,
      });
    } catch (err) {
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        <Input placeholder="1er trimestre" value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
        {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
      </Field>
      <Field>
        <Label>Cycle</Label>
        <p className="text-xs text-gray-400">Primaire = trimestres ; secondaire/supérieur = semestres.</p>
        <Select value={v.cycle} onChange={(e) => {
          const c = e.target.value as SchoolCycle;
          setValue("cycle", c);
          setValue("type", c === "PRIMAIRE" ? "TRIMESTRE" : "SEMESTRE");
        }}>
          <option value="PRIMAIRE">Primaire</option>
          <option value="COLLEGE">Secondaire</option>
          <option value="SUPERIEUR">Supérieur</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Type</Label>
          <Select value={v.type} onChange={(e) => setValue("type", e.target.value)}>
            <option value="TRIMESTRE">Trimestre</option>
            <option value="SEMESTRE">Semestre</option>
          </Select>
        </Field>
        <Field>
          <Label>Ordre</Label>
          <Input type="number" min={1} value={v.sortOrder} onChange={(e) => setValue("sortOrder", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Début</Label>
          <DatePicker value={v.startDate} clearable onChange={(val) => setValue("startDate", val)} />
        </Field>
        <Field>
          <Label>Fin</Label>
          <DatePicker value={v.endDate} clearable onChange={(val) => setValue("endDate", val)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button type="submit" loading={submitting}>Créer</Button>
      </div>
    </form>
  );
}

function CalendarSection({ year, canWrite }: { year: AnneeScolaire; canWrite: boolean }) {
  const q = useQuery(() => listEvents(year.id), [year.id]);
  const [creating, setCreating] = useState(false);
  const events = (q.data ?? []).slice().sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));

  function remove(e: AcademicEvent) {
    confirmAction({
      title: "Supprimer l'événement", message: `Supprimer « ${e.title} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteEvent(e.id); notifySuccess("Événement supprimé"); q.refetch(); } catch (err) { notifyError(err); } },
    });
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Calendrier — {year.label}</CardTitle>
        {canWrite && <Button size="sm" onClick={() => setCreating(true)}>Nouvel événement</Button>}
      </CardHeader>
      <CardBody className="p-0">
        <p className="px-4 pt-3 text-xs text-gray-400">Jours fériés, vacances et événements de l&apos;année (annotent l&apos;emploi du temps).</p>
        {q.loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <Table>
            <THead><tr><TH>Type</TH><TH>Titre</TH><TH>Début</TH><TH>Fin</TH><TH className="text-right">Actions</TH></tr></THead>
            <TBody>
              {events.length === 0 && <TR><TD colSpan={5} className="py-8 text-center text-gray-400">Aucun événement.</TD></TR>}
              {events.map((e) => (
                <TR key={e.id}>
                  <TD><Badge tone={EVENT_TYPE_TONE[e.eventType]}>{EVENT_TYPE_LABEL[e.eventType]}</Badge></TD>
                  <TD className="font-medium">{e.title}</TD>
                  <TD>{e.startDate}</TD>
                  <TD>{e.endDate ?? "—"}</TD>
                  <TD className="text-right">{canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(e)}>Suppr.</Button>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel événement">
        <EventForm yearId={year.id} onCancel={() => setCreating(false)}
          onDone={() => { setCreating(false); notifySuccess("Événement ajouté"); q.refetch(); }} />
      </Modal>
    </Card>
  );
}

const eventSchema = z.object({
  title: z.string().trim().min(1, "Requis"),
  eventType: z.string(),
  startDate: z.string().min(1, "Requis"),
  endDate: z.string(),
  description: z.string(),
});
type EventFormValues = z.infer<typeof eventSchema>;

function EventForm({ yearId, onCancel, onDone }: { yearId: number; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: "", eventType: "HOLIDAY", startDate: "", endDate: "", description: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: EventFormValues) {
    setLoading(true);
    try {
      await createEvent({
        academicYearId: yearId, title: values.title, eventType: values.eventType as AcademicEventType,
        startDate: values.startDate, endDate: values.endDate || null, description: values.description || null,
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Titre <span className="text-error-500">*</span></Label>
        <Input value={v.title} onChange={(e) => setValue("title", e.target.value)} aria-invalid={!!errors.title} />
        {errors.title && <p className="text-xs text-error-600">{errors.title.message}</p>}
      </Field>
      <Field>
        <Label>Type</Label>
        <Select value={v.eventType} onChange={(e) => setValue("eventType", e.target.value)}>
          {(Object.keys(EVENT_TYPE_LABEL) as AcademicEventType[]).map((t) => (<option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Début <span className="text-error-500">*</span></Label>
          <DatePicker value={v.startDate} onChange={(val) => setValue("startDate", val)} />
          {errors.startDate && <p className="text-xs text-error-600">{errors.startDate.message}</p>}
        </Field>
        <Field>
          <Label>Fin</Label>
          <DatePicker value={v.endDate} clearable onChange={(val) => setValue("endDate", val)} />
        </Field>
      </div>
      <Field>
        <Label>Description</Label>
        <Textarea rows={2} value={v.description} onChange={(e) => setValue("description", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Ajouter</Button>
      </div>
    </form>
  );
}

function PeriodsSection({ year, canWrite }: { year: AnneeScolaire; canWrite: boolean }) {
  const q = useQuery(() => listPeriods(year.id), [year.id]);
  const [creating, setCreating] = useState(false);
  const periods = (q.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleCreate(input: CreatePeriodInput) {
    await createPeriod(year.id, input);
    setCreating(false);
    notifySuccess("Période créée");
    q.refetch();
  }
  function handleClose(periodId: number) {
    confirmAction({
      title: "Clôturer la période",
      message: "Clôturer fige les notes et déclenche la génération des bulletins. Continuer ?",
      confirmLabel: "Clôturer",
      onConfirm: async () => {
        try {
          await closePeriod(periodId);
          notifySuccess("Période clôturée");
          q.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Périodes — {year.label}</CardTitle>
        {canWrite && (
          <Button size="sm" onClick={() => setCreating(true)}>
            Nouvelle période
          </Button>
        )}
      </CardHeader>
      <CardBody className="p-0">
        {q.loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Ordre</TH>
                <TH>Libellé</TH>
                <TH>Type</TH>
                <TH>État</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {periods.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-8 text-center text-gray-400">
                    Aucune période.
                  </TD>
                </TR>
              )}
              {periods.map((p) => (
                <TR key={p.id}>
                  <TD>{p.sortOrder}</TD>
                  <TD className="font-medium">{p.label}</TD>
                  <TD>{p.type === "SEMESTRE" ? "Semestre" : "Trimestre"}</TD>
                  <TD>
                    <Badge tone={p.closed ? "amber" : "green"}>{p.closed ? "Clôturée" : "Ouverte"}</Badge>
                  </TD>
                  <TD className="text-right">
                    {canWrite && !p.closed && (
                      <Button size="sm" variant="ghost" onClick={() => handleClose(p.id)}>
                        Clôturer
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle période">
        {creating && <PeriodForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
    </Card>
  );
}

export default function AcademicYearsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");
  const q = useQuery(listAcademicYears, []);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<AnneeScolaire | null>(null);

  const years = (q.data ?? []).slice().sort((a, b) => b.label.localeCompare(a.label));

  async function handleCreate(input: CreateAcademicYearInput) {
    await createAcademicYear(input);
    setCreating(false);
    notifySuccess("Année créée");
    q.refetch();
  }
  async function handleSetCurrent(year: AnneeScolaire) {
    try {
      await setCurrentAcademicYear(year.id);
      notifySuccess(`${year.label} définie comme courante`);
      q.refetch();
    } catch (err) {
      notifyError(err);
    }
  }
  function handleStatus(year: AnneeScolaire, status: StatutAnneeScolaire, label: string) {
    confirmAction({
      title: `${label} l'année`,
      message: `${label} l'année ${year.label} ?`,
      confirmLabel: label,
      danger: status === "ARCHIVEE",
      onConfirm: async () => {
        try {
          await changeAcademicYearStatus(year.id, status);
          notifySuccess("Statut mis à jour");
          q.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Années scolaires</h1>
          <p className="text-sm text-gray-500">Calendrier scolaire, statut et périodes</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)}>Nouvelle année</Button>}
      </div>

      {q.loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Année</TH>
              <TH>Période</TH>
              <TH>Statut</TH>
              <TH>Courante</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {years.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-10 text-center text-gray-400">
                  Aucune année scolaire.
                </TD>
              </TR>
            )}
            {years.map((y) => (
              <TR key={y.id}>
                <TD className="font-medium">
                  <button className="text-brand-600 hover:underline" onClick={() => setSelected(y)}>
                    {y.label}
                  </button>
                </TD>
                <TD>
                  {y.startDate ?? "—"} → {y.endDate ?? "—"}
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[y.status]}>{STATUS_LABEL[y.status]}</Badge>
                </TD>
                <TD>{y.current ? <Badge tone="indigo">Courante</Badge> : "—"}</TD>
                <TD className="text-right">
                  {canWrite && (
                    <div className="inline-flex justify-end gap-1">
                      {!y.current && y.status !== "ARCHIVEE" && (
                        <Button size="sm" variant="ghost" onClick={() => handleSetCurrent(y)}>
                          Définir courante
                        </Button>
                      )}
                      {y.status === "PLANIFIEE" && (
                        <Button size="sm" variant="ghost" className="text-success-700" onClick={() => handleStatus(y, "EN_COURS", "Démarrer")}>
                          Démarrer
                        </Button>
                      )}
                      {y.status === "EN_COURS" && (
                        <Button size="sm" variant="ghost" onClick={() => handleStatus(y, "CLOTUREE", "Clôturer")}>
                          Clôturer
                        </Button>
                      )}
                      {y.status === "CLOTUREE" && (
                        <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleStatus(y, "ARCHIVEE", "Archiver")}>
                          Archiver
                        </Button>
                      )}
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {selected && <PeriodsSection year={selected} canWrite={canWrite} />}
      {selected && <CalendarSection year={selected} canWrite={canWrite} />}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle année scolaire">
        {creating && <YearForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
    </div>
  );
}
