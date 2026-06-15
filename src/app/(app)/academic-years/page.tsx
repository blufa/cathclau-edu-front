"use client";

import { useState } from "react";
import { Button, Group, NativeSelect, NumberInput, Stack, TextInput, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
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
} from "@/lib/types/academics";
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

function YearForm({ onSubmit, onCancel }: { onSubmit: (input: CreateAcademicYearInput) => Promise<void>; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { label: "", startDate: "", endDate: "" },
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
        <TextInput label="Libellé" withAsterisk placeholder="2025-2026" {...form.getInputProps("label")} key={form.key("label")} />
        <Group grow>
          <DateInput label="Début" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("startDate")} key={form.key("startDate")} />
          <DateInput label="Fin" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("endDate")} key={form.key("endDate")} />
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
      type: "TRIMESTRE" as TypePeriode,
      sortOrder: 1 as number | string,
      startDate: "",
      endDate: "",
    },
    validate: { label: (v) => (v.trim() ? null : "Libellé requis") },
  });

  async function submit(values: { label: string; type: TypePeriode; sortOrder: number | string; startDate: string; endDate: string }) {
    setSubmitting(true);
    try {
      await onSubmit({
        label: values.label,
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
        <Group grow>
          <NativeSelect
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
          <DateInput label="Début" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("startDate")} key={form.key("startDate")} />
          <DateInput label="Fin" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("endDate")} key={form.key("endDate")} />
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

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle année scolaire">
        {creating && <YearForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
    </div>
  );
}
