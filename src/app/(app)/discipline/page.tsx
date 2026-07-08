"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { searchStudents } from "@/lib/api/students";
import {
  createIncident,
  updateIncident,
  deleteIncident,
  dismissIncident,
  listIncidents,
  markIncidentNotified,
  resolveIncident,
} from "@/lib/api/discipline";
import {
  CATEGORY_LABEL,
  DECISION_BODY_LABEL,
  DISCIPLINE_STATUS_LABEL,
  MEASURE_KIND_LABEL,
  MEASURE_LABEL,
  PUNITION_MEASURES,
  SANCTION_MEASURES,
  SEVERITY_LABEL,
  SUSPENSION_LABEL,
  type DecisionBody,
  type DisciplineCategory,
  type DisciplineIncident,
  type DisciplineMeasure,
  type DisciplineSeverity,
  type DisciplineStatus,
  type MeasureKind,
  type Suspension,
} from "@/lib/types/discipline";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ParentReminderButton } from "@/components/students/parent-reminder";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<DisciplineStatus, "amber" | "green" | "gray"> = { REPORTED: "amber", RESOLVED: "green", DISMISSED: "gray" };
const SEV_TONE: Record<DisciplineSeverity, "gray" | "amber" | "red"> = { MINOR: "gray", MODERATE: "amber", SERIOUS: "red" };

export default function DisciplinePage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER");

  const [status, setStatus] = useState<DisciplineStatus | "">("");
  const [studentFilter, setStudentFilter] = useState<string | null>(null);
  const q = useQuery(
    () => listIncidents({ studentId: studentFilter ? Number(studentFilter) : undefined, status: status || undefined }),
    [status, studentFilter],
  );
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);
  const studentName = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [studentsQuery.data],
  );
  const studentOptions = useMemo(
    () => (studentsQuery.data ?? []).map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.studentNumber})` })),
    [studentsQuery.data],
  );

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DisciplineIncident | null>(null);

  function act(p: Promise<unknown>) { p.then(() => { notifySuccess("Mis à jour"); q.refetch(); }).catch(notifyError); }
  function remove(i: DisciplineIncident) {
    confirmAction({
      title: "Supprimer l'incident", message: "Confirmer la suppression ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteIncident(i.id); notifySuccess("Supprimé"); q.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Discipline</h1>
          <p className="text-sm text-slate-500">Incidents et sanctions disciplinaires des élèves</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Signaler un incident</Button>}
      </Reveal>

      <div className="flex flex-wrap items-center gap-3">
        <MantineSelect className="min-w-[260px]" placeholder="Filtrer par élève" data={studentOptions}
          value={studentFilter} onChange={setStudentFilter} searchable clearable nothingFoundMessage="Aucun élève" />
        <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as DisciplineStatus | "")}>
          <option value="">Tous les statuts</option>
          {(Object.keys(DISCIPLINE_STATUS_LABEL) as DisciplineStatus[]).map((s) => <option key={s} value={s}>{DISCIPLINE_STATUS_LABEL[s]}</option>)}
        </Select>
      </div>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Élève</TH><TH>Date</TH><TH>Type</TH><TH>Gravité</TH><TH>Mesure</TH><TH>Statut</TH><TH>Parent</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={8} className="py-10 text-center text-slate-400">Aucun incident.</TD></TR>}
            {(q.data ?? []).map((i) => (
              <TR key={i.id}>
                <TD className="font-medium text-slate-900">{studentName.get(i.studentId) ?? `#${i.studentId}`}</TD>
                <TD>{i.incidentDate}</TD>
                <TD>{CATEGORY_LABEL[i.category]}</TD>
                <TD><Badge tone={SEV_TONE[i.severity]}>{SEVERITY_LABEL[i.severity]}</Badge></TD>
                <TD className="text-sm text-slate-600">
                  {i.measure ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium text-slate-700">{MEASURE_LABEL[i.measure]}</span>
                      {i.measureKind && i.measureKind !== "NONE" && <Badge tone={i.measureKind === "SANCTION" ? "red" : "amber"}>{MEASURE_KIND_LABEL[i.measureKind]}</Badge>}
                      {i.exclusionDays ? <span className="text-xs text-slate-400">{i.exclusionDays} j</span> : null}
                      {i.suspension && i.suspension !== "NONE" && <span className="text-xs text-slate-400">({SUSPENSION_LABEL[i.suspension]})</span>}
                    </div>
                  ) : (i.sanction ?? "—")}
                </TD>
                <TD><Badge tone={STATUS_TONE[i.status]}>{DISCIPLINE_STATUS_LABEL[i.status]}</Badge></TD>
                <TD>{i.parentNotified ? <Badge tone="green">Notifié</Badge> : <span className="text-slate-400">—</span>}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {canWrite && !i.parentNotified && (
                      <ParentReminderButton studentId={i.studentId} reason="GENERAL" size="sm" variant="ghost"
                        label="Prévenir parent"
                        subject="Incident disciplinaire"
                        defaultMessage={`Bonjour, nous vous informons d'un incident disciplinaire (${CATEGORY_LABEL[i.category]}) concernant votre enfant le ${i.incidentDate}. ${i.sanction ? `Sanction : ${i.sanction}.` : ""} Merci de prendre contact avec l'établissement.`} />
                    )}
                    {canWrite && !i.parentNotified && <Button size="sm" variant="ghost" onClick={() => act(markIncidentNotified(i.id))}>✓ notifié</Button>}
                    {canWrite && i.status === "REPORTED" && <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>Modifier</Button>}
                    {canWrite && i.status === "REPORTED" && <Button size="sm" variant="ghost" onClick={() => act(resolveIncident(i.id))}>Résoudre</Button>}
                    {canWrite && i.status === "REPORTED" && <Button size="sm" variant="ghost" onClick={() => act(dismissIncident(i.id))}>Classer</Button>}
                    {hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(i)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier l'incident" : "Signaler un incident"}>
        <IncidentForm initial={editing} studentOptions={studentOptions} onCancel={() => { setCreating(false); setEditing(null); }}
          onCreated={() => { setCreating(false); setEditing(null); notifySuccess(editing ? "Incident mis à jour" : "Incident signalé"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

function IncidentForm({ initial, studentOptions, onCancel, onCreated }: {
  initial?: DisciplineIncident | null; studentOptions: { value: string; label: string }[]; onCancel: () => void; onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      studentId: initial?.studentId ? String(initial.studentId) : "",
      incidentDate: initial?.incidentDate ?? "",
      category: (initial?.category ?? "BEHAVIOR") as DisciplineCategory,
      severity: (initial?.severity ?? "MINOR") as DisciplineSeverity,
      description: initial?.description ?? "",
      sanction: initial?.sanction ?? "",
      measureKind: (initial?.measureKind ?? "NONE") as MeasureKind,
      measure: (initial?.measure ?? "") as DisciplineMeasure | "",
      suspension: (initial?.suspension ?? "NONE") as Suspension,
      exclusionDays: (initial?.exclusionDays ?? "") as number | string,
      decisionBody: (initial?.decisionBody ?? "TEACHER") as DecisionBody,
    },
    validate: { studentId: (v) => (v ? null : "Élève requis"), description: (v) => (v ? null : "Description requise") },
  });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = {
        studentId: Number(values.studentId),
        incidentDate: values.incidentDate || null,
        category: values.category,
        severity: values.severity,
        description: values.description,
        sanction: values.sanction || null,
        measureKind: values.measureKind,
        measure: values.measure || null,
        suspension: values.measureKind === "SANCTION" ? values.suspension : null,
        exclusionDays: values.measure === "EXCLUSION_TEMPORAIRE" && values.exclusionDays !== "" ? Number(values.exclusionDays) : null,
        decisionBody: values.measureKind === "NONE" ? null : values.decisionBody,
      };
      if (initial) await updateIncident(initial.id, payload);
      else await createIncident(payload);
      onCreated();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  const measureOptions = form.values.measureKind === "PUNITION" ? PUNITION_MEASURES
    : form.values.measureKind === "SANCTION" ? SANCTION_MEASURES : [];

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <MantineSelect label="Élève" withAsterisk searchable data={studentOptions} {...form.getInputProps("studentId")} />
        <div className="grid grid-cols-2 gap-3">
          <DatePickerInput label="Date" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("incidentDate")} />
          <MantineSelect label="Gravité" allowDeselect={false}
            data={(Object.keys(SEVERITY_LABEL) as DisciplineSeverity[]).map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))}
            {...form.getInputProps("severity")} />
        </div>
        <MantineSelect label="Type" allowDeselect={false}
          data={(Object.keys(CATEGORY_LABEL) as DisciplineCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          {...form.getInputProps("category")} />
        <Textarea label="Description" withAsterisk autosize minRows={3} {...form.getInputProps("description")} />

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Mesure (règlement intérieur)</p>
          <div className="grid grid-cols-2 gap-3">
            <MantineSelect label="Nature" allowDeselect={false}
              data={(Object.keys(MEASURE_KIND_LABEL) as MeasureKind[]).map((k) => ({ value: k, label: MEASURE_KIND_LABEL[k] }))}
              value={form.values.measureKind}
              onChange={(v) => { form.setFieldValue("measureKind", (v ?? "NONE") as MeasureKind); form.setFieldValue("measure", ""); }} />
            {form.values.measureKind !== "NONE" && (
              <MantineSelect label="Mesure" clearable placeholder="Choisir"
                data={measureOptions.map((m) => ({ value: m, label: MEASURE_LABEL[m] }))}
                value={form.values.measure || null}
                onChange={(v) => form.setFieldValue("measure", (v ?? "") as DisciplineMeasure | "")} />
            )}
          </div>
          {form.values.measure === "EXCLUSION_TEMPORAIRE" && (
            <NumberInput label="Durée d'exclusion (jours)" className="mt-2 w-48" min={1} {...form.getInputProps("exclusionDays")} />
          )}
          {form.values.measureKind === "SANCTION" && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <MantineSelect label="Sursis" allowDeselect={false}
                data={(Object.keys(SUSPENSION_LABEL) as Suspension[]).map((s) => ({ value: s, label: SUSPENSION_LABEL[s] }))}
                {...form.getInputProps("suspension")} />
              <MantineSelect label="Instance" allowDeselect={false}
                data={(Object.keys(DECISION_BODY_LABEL) as DecisionBody[]).map((d) => ({ value: d, label: DECISION_BODY_LABEL[d] }))}
                {...form.getInputProps("decisionBody")} />
            </div>
          )}
          {form.values.measureKind === "SANCTION" && (
            <p className="mt-1 text-xs text-slate-400">Une sanction est un acte administratif susceptible de recours.</p>
          )}
        </div>

        <Textarea label="Détail / sanction (optionnel)" autosize minRows={2} {...form.getInputProps("sanction")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Signaler"}</Button>
        </div>
      </Stack>
    </form>
  );
}
