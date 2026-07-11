"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { HeartPulse, Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { searchStudents } from "@/lib/api/students";
import {
  deleteVisit,
  getHealthRecord,
  listVisits,
  notifyVisitParent,
  recordVisit,
  updateVisit,
  upsertHealthRecord,
} from "@/lib/api/health";
import { VISIT_OUTCOME_LABEL, type HealthRecord, type InfirmaryVisit, type VisitOutcome } from "@/lib/types/health";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ParentReminderButton } from "@/components/students/parent-reminder";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const OUTCOME_TONE: Record<VisitOutcome, "green" | "amber" | "red" | "gray"> = {
  RETURNED_TO_CLASS: "green", REST: "amber", SENT_HOME: "amber", REFERRED_HOSPITAL: "red", OTHER: "gray",
};

export default function HealthPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY");

  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);
  const studentName = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [studentsQuery.data],
  );
  const studentOptions = useMemo(
    () => (studentsQuery.data ?? []).map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.studentNumber})` })),
    [studentsQuery.data],
  );

  const [studentId, setStudentId] = useState<string | null>(null);
  const sid = studentId ? Number(studentId) : null;

  const visitsQuery = useQuery(() => listVisits(sid ?? undefined), [studentId]);
  const [recording, setRecording] = useState(false);
  const [editingVisit, setEditingVisit] = useState<InfirmaryVisit | null>(null);

  function notify(v: InfirmaryVisit) {
    notifyVisitParent(v.id).then(() => { notifySuccess("Parent marqué prévenu"); visitsQuery.refetch(); }).catch(notifyError);
  }
  function remove(v: InfirmaryVisit) {
    confirmAction({
      title: "Supprimer le passage", message: "Confirmer la suppression ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteVisit(v.id); notifySuccess("Supprimé"); visitsQuery.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <HeartPulse className="h-6 w-6 text-brand-600" /> Santé / Infirmerie
          </h1>
          <p className="text-sm text-slate-500">Fiches santé (allergies, PAI, contacts d&apos;urgence) et passages à l&apos;infirmerie</p>
        </div>
        {canWrite && <Button onClick={() => setRecording(true)} leftSection={<Plus className="h-4 w-4" />}>Enregistrer un passage</Button>}
      </Reveal>

      <div className="max-w-md">
        <MantineSelect
          label="Élève" placeholder="Rechercher un élève pour sa fiche santé" searchable clearable
          data={studentOptions} value={studentId} onChange={setStudentId}
        />
      </div>

      {sid && <HealthRecordCard studentId={sid} canWrite={canWrite} />}

      <Card>
        <CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Passages à l&apos;infirmerie {sid ? `— ${studentName.get(sid) ?? ""}` : "(tous)"}
          </h3>
          {visitsQuery.loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (visitsQuery.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucun passage enregistré.</p>
          ) : (
            <Table>
              <THead><tr><TH>Date</TH><TH>Élève</TH><TH>Motif</TH><TH>Soins</TH><TH>T°</TH><TH>Issue</TH><TH>Parent</TH><TH className="text-right">Actions</TH></tr></THead>
              <TBody>
                {(visitsQuery.data ?? []).map((v) => (
                  <TR key={v.id}>
                    <TD className="whitespace-nowrap text-sm">{v.visitDate}{v.visitTime ? ` ${v.visitTime.slice(0, 5)}` : ""}</TD>
                    <TD className="font-medium text-slate-900">{studentName.get(v.studentId) ?? `#${v.studentId}`}</TD>
                    <TD className="max-w-[200px] truncate text-sm text-slate-600" title={v.reason ?? ""}>{v.reason ?? "—"}</TD>
                    <TD className="max-w-[200px] truncate text-sm text-slate-600" title={v.careGiven ?? ""}>{v.careGiven ?? "—"}</TD>
                    <TD className="text-sm">{v.temperature ? `${v.temperature}°` : "—"}</TD>
                    <TD><Badge tone={OUTCOME_TONE[v.outcome]}>{VISIT_OUTCOME_LABEL[v.outcome]}</Badge></TD>
                    <TD>{v.parentNotified ? <Badge tone="green">Prévenu</Badge> : <span className="text-slate-400">—</span>}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        {canWrite && !v.parentNotified && (
                          <ParentReminderButton
                            studentId={v.studentId} reason="GENERAL" subject="Passage à l'infirmerie" label="Prévenir parent"
                            defaultMessage={`Bonjour, votre enfant a été pris en charge à l'infirmerie le ${v.visitDate}${v.reason ? ` (motif : ${v.reason})` : ""}. ${VISIT_OUTCOME_LABEL[v.outcome]}.`}
                            size="sm" variant="ghost"
                          />
                        )}
                        {canWrite && !v.parentNotified && <Button size="sm" variant="ghost" onClick={() => notify(v)}>Marquer prévenu</Button>}
                        {canWrite && <Button size="sm" variant="ghost" onClick={() => setEditingVisit(v)}>Modifier</Button>}
                        {canWrite && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(v)}>Suppr.</Button>}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={recording || !!editingVisit} onClose={() => { setRecording(false); setEditingVisit(null); }} title={editingVisit ? "Modifier le passage" : "Enregistrer un passage à l'infirmerie"}>
        <VisitForm defaultStudentId={studentId} initial={editingVisit} studentOptions={studentOptions}
          onCancel={() => { setRecording(false); setEditingVisit(null); }}
          onDone={() => { setRecording(false); setEditingVisit(null); notifySuccess(editingVisit ? "Passage mis à jour" : "Passage enregistré"); visitsQuery.refetch(); }} />
      </Modal>
    </div>
  );
}

// ── Fiche santé ────────────────────────────────────────────────────────────────
function HealthRecordCard({ studentId, canWrite }: { studentId: number; canWrite: boolean }) {
  const q = useQuery(() => getHealthRecord(studentId), [studentId]);
  return q.loading ? (
    <Card><CardBody><div className="flex justify-center py-6"><Spinner /></div></CardBody></Card>
  ) : (
    <HealthRecordForm studentId={studentId} record={q.data ?? null} canWrite={canWrite} onSaved={() => q.refetch()} />
  );
}

function HealthRecordForm({ studentId, record, canWrite, onSaved }: {
  studentId: number; record: HealthRecord | null; canWrite: boolean; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      bloodGroup: record?.bloodGroup ?? "",
      allergies: record?.allergies ?? "",
      chronicConditions: record?.chronicConditions ?? "",
      medications: record?.medications ?? "",
      pai: record?.pai ?? false,
      paiDetails: record?.paiDetails ?? "",
      dietaryRestrictions: record?.dietaryRestrictions ?? "",
      doctorName: record?.doctorName ?? "",
      doctorPhone: record?.doctorPhone ?? "",
      emergencyContactName: record?.emergencyContactName ?? "",
      emergencyContactPhone: record?.emergencyContactPhone ?? "",
      emergencyContactRelation: record?.emergencyContactRelation ?? "",
      insurance: record?.insurance ?? "",
      notes: record?.notes ?? "",
    },
  });

  async function submit(values: typeof form.values) {
    setSaving(true);
    try { await upsertHealthRecord(studentId, values); notifySuccess("Fiche santé enregistrée"); onSaved(); }
    catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  const hasAlert = (record?.allergies?.trim().length ?? 0) > 0 || record?.pai;

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            Fiche santé
            {hasAlert && <Badge tone="red">Allergie / PAI</Badge>}
          </h3>
        </div>
        <form onSubmit={form.onSubmit(submit)}>
          <fieldset disabled={!canWrite} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextInput label="Groupe sanguin" {...form.getInputProps("bloodGroup")} />
              <TextInput label="Assurance" {...form.getInputProps("insurance")} />
              <div className="flex items-end pb-1">
                <Switch label="PAI (Projet d'Accueil Individualisé)" {...form.getInputProps("pai", { type: "checkbox" })} />
              </div>
            </div>
            <Textarea label="Allergies" autosize minRows={2} placeholder="Allergènes, gravité, conduite à tenir…" {...form.getInputProps("allergies")} />
            <Textarea label="Détails du PAI" autosize minRows={2} {...form.getInputProps("paiDetails")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Textarea label="Maladies chroniques" autosize minRows={2} {...form.getInputProps("chronicConditions")} />
              <Textarea label="Traitements en cours" autosize minRows={2} {...form.getInputProps("medications")} />
            </div>
            <Textarea label="Restrictions alimentaires" autosize minRows={1} {...form.getInputProps("dietaryRestrictions")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Médecin traitant" {...form.getInputProps("doctorName")} />
              <PhoneInput label="Téléphone médecin" {...form.getInputProps("doctorPhone")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextInput label="Contact d'urgence" {...form.getInputProps("emergencyContactName")} />
              <PhoneInput label="Téléphone urgence" {...form.getInputProps("emergencyContactPhone")} />
              <TextInput label="Lien (père, mère…)" {...form.getInputProps("emergencyContactRelation")} />
            </div>
            <Textarea label="Notes" autosize minRows={1} {...form.getInputProps("notes")} />
            {canWrite && (
              <div className="flex justify-end">
                <Button type="submit" loading={saving}>Enregistrer la fiche</Button>
              </div>
            )}
          </fieldset>
        </form>
      </CardBody>
    </Card>
  );
}

// ── Passage à l'infirmerie ──────────────────────────────────────────────────────
function VisitForm({ defaultStudentId, initial, studentOptions, onCancel, onDone }: {
  defaultStudentId: string | null; initial?: InfirmaryVisit | null; studentOptions: { value: string; label: string }[]; onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      studentId: initial?.studentId ? String(initial.studentId) : (defaultStudentId ?? ""),
      visitDate: initial?.visitDate ?? "",
      reason: initial?.reason ?? "",
      careGiven: initial?.careGiven ?? "",
      temperature: (initial?.temperature != null ? Number(initial.temperature) : "") as number | string,
      outcome: (initial?.outcome ?? "RETURNED_TO_CLASS") as VisitOutcome,
    },
    validate: { studentId: (v) => (v ? null : "Élève requis") },
  });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = {
        studentId: Number(values.studentId),
        visitDate: values.visitDate || null,
        reason: values.reason || null,
        careGiven: values.careGiven || null,
        temperature: values.temperature === "" ? null : Number(values.temperature),
        outcome: values.outcome,
      };
      if (initial) await updateVisit(initial.id, payload);
      else await recordVisit(payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <MantineSelect label="Élève" withAsterisk searchable data={studentOptions} {...form.getInputProps("studentId")} />
        <div className="grid grid-cols-2 gap-3">
          <DatePickerInput label="Date" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("visitDate")} />
          <NumberInput label="Température (°C)" decimalScale={1} step={0.1} min={30} max={45} {...form.getInputProps("temperature")} />
        </div>
        <Textarea label="Motif" withAsterisk autosize minRows={2} {...form.getInputProps("reason")} />
        <Textarea label="Soins prodigués" autosize minRows={2} {...form.getInputProps("careGiven")} />
        <Select value={form.values.outcome} onChange={(e) => form.setFieldValue("outcome", e.target.value as VisitOutcome)}>
          {(Object.keys(VISIT_OUTCOME_LABEL) as VisitOutcome[]).map((o) => <option key={o} value={o}>{VISIT_OUTCOME_LABEL[o]}</option>)}
        </Select>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>{initial ? "Enregistrer les modifications" : "Enregistrer"}</Button>
        </div>
      </Stack>
    </form>
  );
}
