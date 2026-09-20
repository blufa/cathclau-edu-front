"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
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
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ParentReminderButton } from "@/features/students/components/parent-reminder";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<DisciplineStatus, "amber" | "green" | "gray"> = { REPORTED: "amber", RESOLVED: "green", DISMISSED: "gray" };
const SEV_TONE: Record<DisciplineSeverity, "gray" | "amber" | "red"> = { MINOR: "gray", MODERATE: "amber", SERIOUS: "red" };

export default function DisciplinePage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER") || hasAnyPermission(user, ["discipline:manage"]);
  // Suppression réservée à l'administration (backend: discipline:delete, plus strict que
  // discipline:manage — secrétariat/enseignant peuvent signaler/résoudre mais pas supprimer).
  const canDelete = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["discipline:delete"]);
  // Résoudre/classer un signalement relève des rôles administratifs — un enseignant peut modifier
  // sa saisie mais pas trancher lui-même l'issue de l'incident qu'il a signalé.
  const canResolve = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER") || hasAnyPermission(user, ["discipline:manage"]);

  const [status, setStatus] = useState<DisciplineStatus | "">("");
  const [studentFilter, setStudentFilter] = useState("");
  const q = useQuery(
    () => listIncidents({ studentId: studentFilter ? Number(studentFilter) : undefined, status: status || undefined }),
    [status, studentFilter],
  );
  const studentsQuery = useCachedQuery(tenantId ? `students-all-v2:${tenantId}` : null, () => searchStudents({ size: 1000 }).then((p) => p.content), [tenantId]);
  const studentName = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [studentsQuery.data],
  );
  const studentOptions: SearchableOption[] = useMemo(
    () => (studentsQuery.data ?? []).map((s) => {
      const label = `${s.firstName} ${s.lastName} (${s.studentNumber})`;
      return { value: String(s.id), trigger: label, label, searchText: label };
    }),
    [studentsQuery.data],
  );
  const studentFilterOptions: SearchableOption[] = useMemo(
    () => [{ value: "", trigger: "Tous les élèves", label: "Tous les élèves", searchText: "tous" }, ...studentOptions],
    [studentOptions],
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Discipline</h1>
          <p className="text-sm text-gray-500">Incidents et sanctions disciplinaires des élèves</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Signaler un incident</Button>}
      </Reveal>

      <div className="flex flex-wrap items-center gap-3">
        <SearchableSelect value={studentFilter} options={studentFilterOptions} onChange={setStudentFilter} triggerClassName="min-w-[260px] justify-between px-3" noResultsLabel="Aucun élève" />
        <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as DisciplineStatus | "")}>
          <option value="">Tous les statuts</option>
          {(Object.keys(DISCIPLINE_STATUS_LABEL) as DisciplineStatus[]).map((s) => <option key={s} value={s}>{DISCIPLINE_STATUS_LABEL[s]}</option>)}
        </Select>
      </div>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Élève</TH><TH>Date</TH><TH className="hidden sm:table-cell">Type</TH><TH>Gravité</TH><TH className="hidden sm:table-cell">Mesure</TH><TH>Statut</TH><TH className="hidden sm:table-cell">Parent</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucun incident.</TD></TR>}
            {(q.data ?? []).map((i) => (
              <TR key={i.id}>
                <TD className="font-medium text-gray-900">{studentName.get(i.studentId) ?? `#${i.studentId}`}</TD>
                <TD>{i.incidentDate}</TD>
                <TD className="hidden sm:table-cell">{CATEGORY_LABEL[i.category]}</TD>
                <TD><Badge tone={SEV_TONE[i.severity]}>{SEVERITY_LABEL[i.severity]}</Badge></TD>
                <TD className="hidden text-sm text-gray-600 sm:table-cell">
                  {i.measure ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium text-gray-700">{MEASURE_LABEL[i.measure]}</span>
                      {i.measureKind && i.measureKind !== "NONE" && <Badge tone={i.measureKind === "SANCTION" ? "red" : "amber"}>{MEASURE_KIND_LABEL[i.measureKind]}</Badge>}
                      {i.exclusionDays ? <span className="text-xs text-gray-400">{i.exclusionDays} j</span> : null}
                      {i.suspension && i.suspension !== "NONE" && <span className="text-xs text-gray-400">({SUSPENSION_LABEL[i.suspension]})</span>}
                    </div>
                  ) : (i.sanction ?? "—")}
                </TD>
                <TD><Badge tone={STATUS_TONE[i.status]}>{DISCIPLINE_STATUS_LABEL[i.status]}</Badge></TD>
                <TD className="hidden sm:table-cell">{i.parentNotified ? <Badge tone="green">Notifié</Badge> : <span className="text-gray-400">—</span>}</TD>
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
                    {canResolve && i.status === "REPORTED" && <Button size="sm" variant="ghost" onClick={() => act(resolveIncident(i.id))}>Résoudre</Button>}
                    {canResolve && i.status === "REPORTED" && <Button size="sm" variant="ghost" onClick={() => act(dismissIncident(i.id))}>Classer</Button>}
                    {canDelete && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(i)}>Suppr.</Button>}
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

const incidentSchema = z.object({
  studentId: z.string().min(1, "Élève requis"),
  incidentDate: z.string(),
  category: z.string(),
  severity: z.string(),
  description: z.string().trim().min(1, "Description requise"),
  sanction: z.string(),
  measureKind: z.string(),
  measure: z.string(),
  suspension: z.string(),
  exclusionDays: z.string(),
  decisionBody: z.string(),
});
type IncidentFormValues = z.infer<typeof incidentSchema>;

function IncidentForm({ initial, studentOptions, onCancel, onCreated }: {
  initial?: DisciplineIncident | null; studentOptions: SearchableOption[]; onCancel: () => void; onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      studentId: initial?.studentId ? String(initial.studentId) : "",
      incidentDate: initial?.incidentDate ?? "",
      category: initial?.category ?? "BEHAVIOR",
      severity: initial?.severity ?? "MINOR",
      description: initial?.description ?? "",
      sanction: initial?.sanction ?? "",
      measureKind: initial?.measureKind ?? "NONE",
      measure: initial?.measure ?? "",
      suspension: initial?.suspension ?? "NONE",
      exclusionDays: initial?.exclusionDays != null ? String(initial.exclusionDays) : "",
      decisionBody: initial?.decisionBody ?? "TEACHER",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: IncidentFormValues) {
    setLoading(true);
    try {
      const payload = {
        studentId: Number(values.studentId),
        incidentDate: values.incidentDate || null,
        category: values.category as DisciplineCategory,
        severity: values.severity as DisciplineSeverity,
        description: values.description,
        sanction: values.sanction || null,
        measureKind: values.measureKind as MeasureKind,
        measure: (values.measure || null) as DisciplineMeasure | null,
        suspension: values.measureKind === "SANCTION" ? (values.suspension as Suspension) : null,
        exclusionDays: values.measure === "EXCLUSION_TEMPORAIRE" && values.exclusionDays !== "" ? Number(values.exclusionDays) : null,
        decisionBody: values.measureKind === "NONE" ? null : (values.decisionBody as DecisionBody),
      };
      if (initial) await updateIncident(initial.id, payload);
      else await createIncident(payload);
      onCreated();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  const measureOptions = v.measureKind === "PUNITION" ? PUNITION_MEASURES
    : v.measureKind === "SANCTION" ? SANCTION_MEASURES : [];

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Élève <span className="text-error-500">*</span></Label>
        <SearchableSelect value={v.studentId} options={studentOptions} onChange={(val) => setValue("studentId", val)} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucun élève" />
        {errors.studentId && <p className="text-xs text-error-600">{errors.studentId.message}</p>}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field><Label>Date</Label><DatePicker value={v.incidentDate} clearable onChange={(val) => setValue("incidentDate", val)} maxDate={new Date()} /></Field>
        <Field>
          <Label>Gravité</Label>
          <Select value={v.severity} onChange={(e) => setValue("severity", e.target.value)}>
            {(Object.keys(SEVERITY_LABEL) as DisciplineSeverity[]).map((s) => (<option key={s} value={s}>{SEVERITY_LABEL[s]}</option>))}
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Type</Label>
        <Select value={v.category} onChange={(e) => setValue("category", e.target.value)}>
          {(Object.keys(CATEGORY_LABEL) as DisciplineCategory[]).map((c) => (<option key={c} value={c}>{CATEGORY_LABEL[c]}</option>))}
        </Select>
      </Field>
      <Field>
        <Label>Description <span className="text-error-500">*</span></Label>
        <Textarea rows={3} value={v.description} onChange={(e) => setValue("description", e.target.value)} />
        {errors.description && <p className="text-xs text-error-600">{errors.description.message}</p>}
      </Field>

      <div className="rounded-xl border border-gray-200 p-3">
        <p className="mb-2 text-sm font-semibold text-gray-700">Mesure (règlement intérieur)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field>
            <Label>Nature</Label>
            <Select value={v.measureKind} onChange={(e) => { setValue("measureKind", e.target.value); setValue("measure", ""); }}>
              {(Object.keys(MEASURE_KIND_LABEL) as MeasureKind[]).map((k) => (<option key={k} value={k}>{MEASURE_KIND_LABEL[k]}</option>))}
            </Select>
          </Field>
          {v.measureKind !== "NONE" && (
            <Field>
              <Label>Mesure</Label>
              <Select value={v.measure} onChange={(e) => setValue("measure", e.target.value)}>
                <option value="">Choisir</option>
                {measureOptions.map((m) => (<option key={m} value={m}>{MEASURE_LABEL[m]}</option>))}
              </Select>
            </Field>
          )}
        </div>
        {v.measure === "EXCLUSION_TEMPORAIRE" && (
          <Field>
            <Label>Durée d&apos;exclusion (jours)</Label>
            <Input type="number" min={1} className="mt-2 w-48" value={v.exclusionDays} onChange={(e) => setValue("exclusionDays", e.target.value)} />
          </Field>
        )}
        {v.measureKind === "SANCTION" && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field>
              <Label>Sursis</Label>
              <Select value={v.suspension} onChange={(e) => setValue("suspension", e.target.value)}>
                {(Object.keys(SUSPENSION_LABEL) as Suspension[]).map((s) => (<option key={s} value={s}>{SUSPENSION_LABEL[s]}</option>))}
              </Select>
            </Field>
            <Field>
              <Label>Instance</Label>
              <Select value={v.decisionBody} onChange={(e) => setValue("decisionBody", e.target.value)}>
                {(Object.keys(DECISION_BODY_LABEL) as DecisionBody[]).map((d) => (<option key={d} value={d}>{DECISION_BODY_LABEL[d]}</option>))}
              </Select>
            </Field>
          </div>
        )}
        {v.measureKind === "SANCTION" && (
          <p className="mt-1 text-xs text-gray-400">Une sanction est un acte administratif susceptible de recours.</p>
        )}
      </div>

      <Field>
        <Label>Détail / sanction (optionnel)</Label>
        <Textarea rows={2} value={v.sanction} onChange={(e) => setValue("sanction", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Signaler"}</Button>
      </div>
    </form>
  );
}
