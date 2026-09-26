"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HeartPulse, Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
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
import { Switch } from "@/components/ui/switch";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ParentReminderButton } from "@/features/students/components/parent-reminder";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const OUTCOME_TONE: Record<VisitOutcome, "green" | "amber" | "red" | "gray"> = {
  RETURNED_TO_CLASS: "green", REST: "amber", SENT_HOME: "amber", REFERRED_HOSPITAL: "red", OTHER: "gray",
};

export default function HealthPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["sante:manage"]);
  // Suppression réservée à l'administration (backend: sante:delete, plus strict que sante:manage —
  // un rôle qui peut seulement enregistrer/modifier un passage ne peut pas le supprimer).
  const canDelete = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["sante:delete"]);

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

  const [studentId, setStudentId] = useState("");
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
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <HeartPulse className="h-6 w-6 text-brand-600" /> Santé / Infirmerie
          </h1>
          <p className="text-sm text-gray-500">Fiches santé (allergies, PAI, contacts d&apos;urgence) et passages à l&apos;infirmerie</p>
        </div>
        {canWrite && <Button onClick={() => setRecording(true)} leftSection={<Plus className="h-4 w-4" />}>Enregistrer un passage</Button>}
      </Reveal>

      <div className="max-w-md">
        <Field>
          <Label>Élève</Label>
          <SearchableSelect value={studentId} options={studentOptions} onChange={setStudentId} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucun élève" />
        </Field>
      </div>

      {sid && <HealthRecordCard studentId={sid} canWrite={canWrite} />}

      <Card>
        <CardBody>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Passages à l&apos;infirmerie {sid ? `— ${studentName.get(sid) ?? ""}` : "(tous)"}
          </h3>
          {visitsQuery.loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (visitsQuery.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Aucun passage enregistré.</p>
          ) : (
            <Table>
              <THead><tr><TH>Date</TH><TH>Élève</TH><TH>Motif</TH><TH className="hidden sm:table-cell">Soins</TH><TH className="hidden sm:table-cell">T°</TH><TH>Issue</TH><TH className="hidden sm:table-cell">Parent</TH><TH className="text-right">Actions</TH></tr></THead>
              <TBody>
                {(visitsQuery.data ?? []).map((v) => (
                  <TR key={v.id}>
                    <TD className="whitespace-nowrap text-sm">{v.visitDate}{v.visitTime ? ` ${v.visitTime.slice(0, 5)}` : ""}</TD>
                    {/* Élève archivé (parti) : le passage à l'infirmerie reste dans l'historique
                        médical, avec une mention explicite plutôt qu'un numéro brut (§retour comptable). */}
                    <TD className="font-medium text-gray-900">{studentName.get(v.studentId) ?? `Élève archivé (#${v.studentId})`}</TD>
                    <TD className="max-w-[200px] truncate text-sm text-gray-600" title={v.reason ?? ""}>{v.reason ?? "—"}</TD>
                    <TD className="hidden max-w-[200px] truncate text-sm text-gray-600 sm:table-cell" title={v.careGiven ?? ""}>{v.careGiven ?? "—"}</TD>
                    <TD className="hidden text-sm sm:table-cell">{v.temperature ? `${v.temperature}°` : "—"}</TD>
                    <TD><Badge tone={OUTCOME_TONE[v.outcome]}>{VISIT_OUTCOME_LABEL[v.outcome]}</Badge></TD>
                    <TD className="hidden sm:table-cell">{v.parentNotified ? <Badge tone="green">Prévenu</Badge> : <span className="text-gray-400">—</span>}</TD>
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
                        {canDelete && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(v)}>Suppr.</Button>}
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
  const [bloodGroup, setBloodGroup] = useState(record?.bloodGroup ?? "");
  const [allergies, setAllergies] = useState(record?.allergies ?? "");
  const [chronicConditions, setChronicConditions] = useState(record?.chronicConditions ?? "");
  const [medications, setMedications] = useState(record?.medications ?? "");
  const [pai, setPai] = useState(record?.pai ?? false);
  const [paiDetails, setPaiDetails] = useState(record?.paiDetails ?? "");
  const [dietaryRestrictions, setDietaryRestrictions] = useState(record?.dietaryRestrictions ?? "");
  const [doctorName, setDoctorName] = useState(record?.doctorName ?? "");
  const [doctorPhone, setDoctorPhone] = useState(record?.doctorPhone ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(record?.emergencyContactName ?? "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(record?.emergencyContactPhone ?? "");
  const [emergencyContactRelation, setEmergencyContactRelation] = useState(record?.emergencyContactRelation ?? "");
  const [insurance, setInsurance] = useState(record?.insurance ?? "");
  const [notes, setNotes] = useState(record?.notes ?? "");

  async function submit() {
    setSaving(true);
    try {
      await upsertHealthRecord(studentId, {
        bloodGroup, allergies, chronicConditions, medications, pai, paiDetails,
        dietaryRestrictions, doctorName, doctorPhone, emergencyContactName,
        emergencyContactPhone, emergencyContactRelation, insurance, notes,
      });
      notifySuccess("Fiche santé enregistrée"); onSaved();
    }
    catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  const hasAlert = (record?.allergies?.trim().length ?? 0) > 0 || record?.pai;

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            Fiche santé
            {hasAlert && <Badge tone="red">Allergie / PAI</Badge>}
          </h3>
        </div>
        <fieldset disabled={!canWrite} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field><Label>Groupe sanguin</Label><Input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} /></Field>
            <Field><Label>Assurance</Label><Input value={insurance} onChange={(e) => setInsurance(e.target.value)} /></Field>
            <div className="flex items-end gap-2 pb-1">
              <Switch checked={pai} onChange={setPai} ariaLabel="PAI" />
              <span className="text-sm text-gray-700">PAI (Projet d&apos;Accueil Individualisé)</span>
            </div>
          </div>
          <Field><Label>Allergies</Label><Textarea rows={2} placeholder="Allergènes, gravité, conduite à tenir…" value={allergies} onChange={(e) => setAllergies(e.target.value)} /></Field>
          <Field><Label>Détails du PAI</Label><Textarea rows={2} value={paiDetails} onChange={(e) => setPaiDetails(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field><Label>Maladies chroniques</Label><Textarea rows={2} value={chronicConditions} onChange={(e) => setChronicConditions(e.target.value)} /></Field>
            <Field><Label>Traitements en cours</Label><Textarea rows={2} value={medications} onChange={(e) => setMedications(e.target.value)} /></Field>
          </div>
          <Field><Label>Restrictions alimentaires</Label><Textarea rows={1} value={dietaryRestrictions} onChange={(e) => setDietaryRestrictions(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field><Label>Médecin traitant</Label><Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} /></Field>
            <PhoneInput label="Téléphone médecin" value={doctorPhone} onChange={setDoctorPhone} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field><Label>Contact d&apos;urgence</Label><Input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} /></Field>
            <PhoneInput label="Téléphone urgence" value={emergencyContactPhone} onChange={setEmergencyContactPhone} />
            <Field><Label>Lien (père, mère…)</Label><Input value={emergencyContactRelation} onChange={(e) => setEmergencyContactRelation(e.target.value)} /></Field>
          </div>
          <Field><Label>Notes</Label><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          {canWrite && (
            <div className="flex justify-end">
              <Button type="button" onClick={submit} loading={saving}>Enregistrer la fiche</Button>
            </div>
          )}
        </fieldset>
      </CardBody>
    </Card>
  );
}

// ── Passage à l'infirmerie ──────────────────────────────────────────────────────
const visitSchema = z.object({
  studentId: z.string().min(1, "Élève requis"),
  visitDate: z.string(),
  reason: z.string(),
  careGiven: z.string(),
  temperature: z.string(),
  outcome: z.string(),
});
type VisitFormValues = z.infer<typeof visitSchema>;

function VisitForm({ defaultStudentId, initial, studentOptions, onCancel, onDone }: {
  defaultStudentId: string; initial?: InfirmaryVisit | null; studentOptions: SearchableOption[]; onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<VisitFormValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      studentId: initial?.studentId ? String(initial.studentId) : defaultStudentId,
      visitDate: initial?.visitDate ?? "",
      reason: initial?.reason ?? "",
      careGiven: initial?.careGiven ?? "",
      temperature: initial?.temperature != null ? String(Number(initial.temperature)) : "",
      outcome: initial?.outcome ?? "RETURNED_TO_CLASS",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: VisitFormValues) {
    setLoading(true);
    try {
      const payload = {
        studentId: Number(values.studentId),
        visitDate: values.visitDate || null,
        reason: values.reason || null,
        careGiven: values.careGiven || null,
        temperature: values.temperature === "" ? null : Number(values.temperature),
        outcome: values.outcome as VisitOutcome,
      };
      if (initial) await updateVisit(initial.id, payload);
      else await recordVisit(payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Élève <span className="text-error-500">*</span></Label>
        <SearchableSelect value={v.studentId} options={studentOptions} onChange={(val) => setValue("studentId", val)} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucun élève" />
        {errors.studentId && <p className="text-xs text-error-600">{errors.studentId.message}</p>}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field><Label>Date</Label><DatePicker value={v.visitDate} clearable onChange={(val) => setValue("visitDate", val)} maxDate={new Date()} /></Field>
        <Field><Label>Température (°C)</Label><Input type="number" step={0.1} min={30} max={45} value={v.temperature} onChange={(e) => setValue("temperature", e.target.value)} /></Field>
      </div>
      <Field><Label>Motif <span className="text-error-500">*</span></Label><Textarea rows={2} value={v.reason} onChange={(e) => setValue("reason", e.target.value)} /></Field>
      <Field><Label>Soins prodigués</Label><Textarea rows={2} value={v.careGiven} onChange={(e) => setValue("careGiven", e.target.value)} /></Field>
      <Select value={v.outcome} onChange={(e) => setValue("outcome", e.target.value)}>
        {(Object.keys(VISIT_OUTCOME_LABEL) as VisitOutcome[]).map((o) => <option key={o} value={o}>{VISIT_OUTCOME_LABEL[o]}</option>)}
      </Select>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>{initial ? "Enregistrer les modifications" : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
