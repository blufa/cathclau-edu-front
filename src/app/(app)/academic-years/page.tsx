"use client";

import { useState } from "react";
import { Button, Group, Select, NumberInput, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
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
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
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

function YearForm({ onSubmit, onCancel }: { onSubmit: (input: CreateAcademicYearInput) => Promise<void>; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    mode: "uncontrolled",
    // Pré-rempli avec l'année scolaire courante (ex. « 2026 - 2027 »), dérivée de la date de début.
    initialValues: { label: schoolYearLabel(new Date().getFullYear()), startDate: "", endDate: "" },
    validate: { label: (v) => (v.trim() ? null : "Libellé requis") },
  });

  async function submit(values: { label: string; startDate: string; endDate: string }) {
    setSubmitting(true);
    try {
      await onSubmit({ label: values.label, startDate: values.startDate || null, endDate: values.endDate || null });
    } catch (err) {
      if (err instanceof ApiError) form.setErrors(err.fieldErrors);
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Libellé" withAsterisk placeholder="2026 - 2027" {...form.getInputProps("label")} key={form.key("label")} />
        <Group grow>
          <DatePickerInput
            label="Début"
            valueFormat="DD/MM/YYYY"
            clearable
            {...form.getInputProps("startDate")}
            key={form.key("startDate")}
            onChange={(val) => {
              form.setFieldValue("startDate", val ?? "");
              const yr = val ? new Date(val).getFullYear() : NaN;
              if (!Number.isNaN(yr)) form.setFieldValue("label", schoolYearLabel(yr));
            }}
          />
          <DatePickerInput label="Fin" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("endDate")} key={form.key("endDate")} />
        </Group>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" loading={submitting}>
            Créer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function PeriodForm({ onSubmit, onCancel }: { onSubmit: (input: CreatePeriodInput) => Promise<void>; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      label: "",
      cycle: "PRIMAIRE" as SchoolCycle,
      type: "TRIMESTRE" as TypePeriode,
      sortOrder: 1 as number | string,
      startDate: "",
      endDate: "",
    },
    validate: { label: (v) => (v.trim() ? null : "Libellé requis") },
  });

  async function submit(values: { label: string; cycle: SchoolCycle; type: TypePeriode; sortOrder: number | string; startDate: string; endDate: string }) {
    setSubmitting(true);
    try {
      await onSubmit({
        label: values.label,
        cycle: values.cycle,
        type: values.type,
        sortOrder: Number(values.sortOrder),
        startDate: values.startDate || null,
        endDate: values.endDate || null,
      });
    } catch (err) {
      if (err instanceof ApiError) form.setErrors(err.fieldErrors);
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Libellé" withAsterisk placeholder="1er trimestre" {...form.getInputProps("label")} key={form.key("label")} />
        <Select
          label="Cycle"
          description="Primaire = trimestres ; collège/lycée/supérieur = semestres."
          data={[
            { value: "PRIMAIRE", label: "Primaire" },
            { value: "COLLEGE", label: "Collège" },
            { value: "LYCEE", label: "Lycée" },
            { value: "SUPERIEUR", label: "Supérieur" },
          ]}
          {...form.getInputProps("cycle")}
          key={form.key("cycle")}
          onChange={(value) => {
            const c = (value ?? "") as SchoolCycle;
            form.setFieldValue("cycle", c);
            form.setFieldValue("type", c === "PRIMAIRE" ? "TRIMESTRE" : "SEMESTRE");
          }}
        />
        <Group grow>
          <Select
            label="Type"
            data={[
              { value: "TRIMESTRE", label: "Trimestre" },
              { value: "SEMESTRE", label: "Semestre" },
            ]}
            {...form.getInputProps("type")}
            key={form.key("type")}
          />
          <NumberInput label="Ordre" min={1} allowDecimal={false} {...form.getInputProps("sortOrder")} key={form.key("sortOrder")} />
        </Group>
        <Group grow>
          <DatePickerInput label="Début" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("startDate")} key={form.key("startDate")} />
          <DatePickerInput label="Fin" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("endDate")} key={form.key("endDate")} />
        </Group>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" loading={submitting}>
            Créer
          </Button>
        </Group>
      </Stack>
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
        <p className="px-4 pt-3 text-xs text-slate-400">Jours fériés, vacances et événements de l&apos;année (annotent l&apos;emploi du temps).</p>
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
                  <TD className="text-right">{canWrite && <Button size="sm" variant="subtle" color="red" onClick={() => remove(e)}>Suppr.</Button>}</TD>
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

function EventForm({ yearId, onCancel, onDone }: { yearId: number; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: { title: "", eventType: "HOLIDAY" as AcademicEventType, startDate: "", endDate: "", description: "" },
    validate: { title: (v) => (v ? null : "Requis"), startDate: (v) => (v ? null : "Requis") },
  });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      await createEvent({
        academicYearId: yearId, title: values.title, eventType: values.eventType,
        startDate: values.startDate, endDate: values.endDate || null, description: values.description || null,
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Titre" withAsterisk {...form.getInputProps("title")} />
        <Select label="Type" allowDeselect={false}
          data={(Object.keys(EVENT_TYPE_LABEL) as AcademicEventType[]).map((t) => ({ value: t, label: EVENT_TYPE_LABEL[t] }))}
          {...form.getInputProps("eventType")} />
        <Group grow>
          <DatePickerInput label="Début" withAsterisk valueFormat="DD/MM/YYYY" {...form.getInputProps("startDate")} />
          <DatePickerInput label="Fin" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("endDate")} />
        </Group>
        <Textarea label="Description" autosize minRows={2} {...form.getInputProps("description")} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Ajouter</Button>
        </Group>
      </Stack>
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
          <Title order={2}>Années scolaires</Title>
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
                  <button className="text-indigo-600 hover:underline" onClick={() => setSelected(y)}>
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
                    <Group justify="flex-end" gap="xs">
                      {!y.current && y.status !== "ARCHIVEE" && (
                        <Button size="sm" variant="ghost" onClick={() => handleSetCurrent(y)}>
                          Définir courante
                        </Button>
                      )}
                      {y.status === "PLANIFIEE" && (
                        <Button size="sm" variant="ghost" className="text-green-700" onClick={() => handleStatus(y, "EN_COURS", "Démarrer")}>
                          Démarrer
                        </Button>
                      )}
                      {y.status === "EN_COURS" && (
                        <Button size="sm" variant="ghost" onClick={() => handleStatus(y, "CLOTUREE", "Clôturer")}>
                          Clôturer
                        </Button>
                      )}
                      {y.status === "CLOTUREE" && (
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleStatus(y, "ARCHIVEE", "Archiver")}>
                          Archiver
                        </Button>
                      )}
                    </Group>
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
