"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label, Field, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { useQuery } from "@/hooks/use-query";
import { createSubject, deleteSubject, listSubjects, updateSubject } from "@/lib/api/academics";
import type { Matiere } from "@/lib/types/academics";
import { ApiError } from "@/lib/api/errors";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { SUBJECT_CATALOG } from "@/lib/academics-subjects";
import { SubjectCatalogPicker } from "@/components/referentials/subject-catalog";

const subjectSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis"),
  syllabus: z.string(),
});
type SubjectFormValues = z.infer<typeof subjectSchema>;

function SubjectForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Matiere;
  onSubmit: (label: string, coefficient: number, syllabus?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { label: initial?.label ?? "", syllabus: initial?.syllabus ?? "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: SubjectFormValues) {
    setSubmitting(true);
    try {
      // Le coefficient n'est plus saisi à la matière : il se définit à l'affectation en classe et à
      // l'évaluation. On conserve la valeur existante (ou 1 par défaut) pour ne rien casser côté API.
      const coefficient = initial?.coefficient ? Number(initial.coefficient) : 1;
      await onSubmit(values.label, coefficient, values.syllabus || undefined);
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
      <Field>
        <Label>Programme</Label>
        <Textarea rows={2} value={v.syllabus} onChange={(e) => setValue("syllabus", e.target.value)} />
      </Field>
      <p className="text-xs text-gray-400">
        Le coefficient se définit lors de l&apos;affectation de la matière à une classe, et par évaluation.
      </p>
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
  const [editing, setEditing] = useState<Matiere | null>(null);
  const subjects = q.data ?? [];

  async function handleCreate(label: string, coefficient: number, syllabus?: string) {
    await createSubject(label, coefficient, syllabus);
    setCreating(false);
    notifySuccess("Matière créée");
    q.refetch();
  }
  async function handleUpdate(label: string, coefficient: number, syllabus?: string) {
    if (!editing) return;
    await updateSubject(editing.id, label, coefficient, syllabus);
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
          <Button onClick={() => setCreating(true)}>Nouvelle matière</Button>
        </div>
      )}
      <Table>
        <THead>
          <tr>
            <TH>Libellé</TH>
            <TH className="text-right">Actions</TH>
          </tr>
        </THead>
        <TBody>
          {subjects.length === 0 && (
            <TR>
              <TD colSpan={2} className="py-8 text-center text-gray-400">
                Aucune matière.
              </TD>
            </TR>
          )}
          {subjects.map((m) => (
            <TR key={m.id}>
              <TD className="font-medium">{m.label}</TD>
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
    </div>
  );
}
