"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label, Field, Textarea, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { useQuery } from "@/hooks/use-query";
import { createSubject, deleteSubject, listSubjects, updateSubject } from "@/lib/api/academics";
import type { Matiere, SchoolCycle } from "@/lib/types/academics";
import { SCHOOL_CYCLE_LABEL } from "@/lib/types/academics";
import { ApiError } from "@/lib/api/errors";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { SUBJECT_CATALOG } from "@/lib/academics-subjects";
import { SubjectCatalogPicker } from "@/components/referentials/subject-catalog";
import { BulkAssignSubjectsModal } from "@/components/referentials/bulk-assign-subjects-modal";

// Ordre d'affichage des sections par cycle (§retour utilisateur : "afficher les matières par
// niveau") — "Sans niveau" en dernier, pour les matières créées avant cette fonctionnalité.
const CYCLE_ORDER: SchoolCycle[] = ["GARDERIE", "MATERNELLE", "PRIMAIRE", "COLLEGE", "LYCEE", "SUPERIEUR"];

const subjectSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis"),
  syllabus: z.string(),
  coefficient: z.number().min(0, "Le coefficient ne peut pas être négatif"),
  cycle: z.string(),
});
type SubjectFormValues = z.infer<typeof subjectSchema>;

function SubjectForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Matiere;
  onSubmit: (label: string, coefficient: number, syllabus: string | undefined, cycle: SchoolCycle | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      label: initial?.label ?? "",
      syllabus: initial?.syllabus ?? "",
      coefficient: initial?.coefficient ? Number(initial.coefficient) : 1,
      cycle: initial?.cycle ?? "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: SubjectFormValues) {
    setSubmitting(true);
    try {
      await onSubmit(values.label, values.coefficient, values.syllabus || undefined, (values.cycle || null) as SchoolCycle | null);
    } catch (err) {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fieldErrors)) setError(field as keyof SubjectFormValues, { message });
      }
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        <p className="text-xs text-gray-400">Choisissez une matière proposée ou saisissez la vôtre</p>
        <Combobox value={v.label} onChange={(val) => setValue("label", val)} options={SUBJECT_CATALOG} placeholder="Mathématiques" />
        {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Niveau</Label>
          <p className="text-xs text-gray-400">Pour n&apos;afficher cette matière qu&apos;aux classes de ce niveau.</p>
          <Select value={v.cycle} onChange={(e) => setValue("cycle", e.target.value)}>
            <option value="">— Tous niveaux —</option>
            {CYCLE_ORDER.map((c) => (<option key={c} value={c}>{SCHOOL_CYCLE_LABEL[c]}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Coefficient</Label>
          <p className="text-xs text-gray-400">Coefficient par défaut pour ce niveau (modifiable par classe ensuite).</p>
          <Input type="number" min={0} step={0.5} value={v.coefficient}
            onChange={(e) => setValue("coefficient", Number(e.target.value))} />
          {errors.coefficient && <p className="text-xs text-error-600">{errors.coefficient.message}</p>}
        </Field>
      </div>
      <Field>
        <Label>Programme</Label>
        <Textarea rows={2} value={v.syllabus} onChange={(e) => setValue("syllabus", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button type="submit" loading={submitting}>Enregistrer</Button>
      </div>
    </form>
  );
}

export function SubjectsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listSubjects, []);
  const [creating, setCreating] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [editing, setEditing] = useState<Matiere | null>(null);
  const subjects = useMemo(() => q.data ?? [], [q.data]);

  // Groupées par niveau (§retour utilisateur) — "Sans niveau" à part, pour les matières créées
  // avant cette fonctionnalité ou volontairement laissées communes à tous les niveaux.
  const groups = useMemo(() => {
    const byCycle = new Map<SchoolCycle | "NONE", Matiere[]>();
    for (const m of subjects) {
      const key = m.cycle ?? "NONE";
      if (!byCycle.has(key)) byCycle.set(key, []);
      byCycle.get(key)!.push(m);
    }
    const ordered: { key: SchoolCycle | "NONE"; label: string; subjects: Matiere[] }[] = [];
    for (const c of CYCLE_ORDER) {
      if (byCycle.has(c)) ordered.push({ key: c, label: SCHOOL_CYCLE_LABEL[c], subjects: byCycle.get(c)! });
    }
    if (byCycle.has("NONE")) ordered.push({ key: "NONE", label: "Sans niveau (tous niveaux)", subjects: byCycle.get("NONE")! });
    return ordered;
  }, [subjects]);

  async function handleCreate(label: string, coefficient: number, syllabus: string | undefined, cycle: SchoolCycle | null) {
    await createSubject(label, coefficient, syllabus, cycle);
    setCreating(false);
    notifySuccess("Matière créée");
    q.refetch();
  }
  async function handleUpdate(label: string, coefficient: number, syllabus: string | undefined, cycle: SchoolCycle | null) {
    if (!editing) return;
    await updateSubject(editing.id, label, coefficient, syllabus, cycle);
    setEditing(null);
    notifySuccess("Matière mise à jour");
    q.refetch();
  }
  function handleDelete(subject: Matiere) {
    confirmAction({
      title: "Supprimer la matière",
      message: `Supprimer la matière ${subject.label} ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteSubject(subject.id);
          notifySuccess("Matière supprimée");
          q.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setAssisting(true)}>Catalogue</Button>
          <Button variant="secondary" onClick={() => setBulkAssigning(true)}>Affecter aux classes</Button>
          <Button onClick={() => setCreating(true)}>Nouvelle matière</Button>
        </div>
      )}
      {subjects.length === 0 && (
        <p className="py-8 text-center text-gray-400">Aucune matière.</p>
      )}
      {groups.map((g) => (
        <div key={g.key} className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">{g.label}</h3>
          <Table>
            <THead>
              <tr>
                <TH>Libellé</TH>
                <TH>Coefficient</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {g.subjects.map((m) => (
                <TR key={m.id}>
                  <TD className="font-medium">{m.label}</TD>
                  <TD>{m.coefficient}</TD>
                  <TD className="text-right">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>Modifier</Button>
                        <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(m)}>Suppr.</Button>
                      </div>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ))}

      <Modal open={assisting} onClose={() => setAssisting(false)} title="Catalogue des matières">
        {assisting && (
          <SubjectCatalogPicker
            existing={subjects}
            onDone={() => {
              setAssisting(false);
              q.refetch();
            }}
            onCancel={() => setAssisting(false)}
          />
        )}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle matière">
        {creating && <SubjectForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la matière">
        {editing && <SubjectForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>
      <BulkAssignSubjectsModal open={bulkAssigning} onClose={() => setBulkAssigning(false)} subjects={subjects} />
    </div>
  );
}
