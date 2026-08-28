"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/hooks/use-query";
import { createLevel, deleteLevel, listLevels, updateLevel } from "@/lib/api/academics";
import { SCHOOL_CYCLE_LABEL, type Niveau, type SchoolCycle } from "@/lib/types/academics";
import { ApiError } from "@/lib/api/errors";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { LevelCatalogPicker } from "@/components/referentials/level-catalog";

const levelSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis"),
  sortOrder: z.union([z.number(), z.literal("")]),
  cycle: z.string(),
});
type LevelFormValues = z.infer<typeof levelSchema>;

function LevelForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Niveau;
  onSubmit: (label: string, sortOrder: number, cycle: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<LevelFormValues>({
    resolver: zodResolver(levelSchema),
    defaultValues: { label: initial?.label ?? "", sortOrder: initial?.sortOrder ?? 0, cycle: initial?.cycle ?? "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: LevelFormValues) {
    setSubmitting(true);
    try {
      await onSubmit(values.label, values.sortOrder === "" ? 0 : Number(values.sortOrder), values.cycle);
    } catch (err) {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fieldErrors)) setError(field as keyof LevelFormValues, { message });
      }
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        <Input placeholder="6ème" value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
        {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
      </Field>
      <Field>
        <Label>Ordre</Label>
        <Input type="number" min={0} value={v.sortOrder} onChange={(e) => setValue("sortOrder", e.target.value === "" ? "" : Number(e.target.value))} />
      </Field>
      <Field>
        <Label>Cycle</Label>
        <Select value={v.cycle} onChange={(e) => setValue("cycle", e.target.value)}>
          <option value="">(non renseigné)</option>
          {(Object.keys(SCHOOL_CYCLE_LABEL) as SchoolCycle[]).map((c) => (
            <option key={c} value={c}>{SCHOOL_CYCLE_LABEL[c]}</option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-gray-400">Maternelle/Primaire déclenchent le badge de retrait obligatoire à la sortie d&apos;un élève.</p>
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button type="submit" loading={submitting}>Enregistrer</Button>
      </div>
    </form>
  );
}

export function LevelsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listLevels, []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Niveau | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const levels = (q.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleCreate(label: string, sortOrder: number, cycle: string) {
    await createLevel(label, sortOrder, cycle);
    setCreating(false);
    notifySuccess("Niveau créé");
    q.refetch();
  }
  async function handleUpdate(label: string, sortOrder: number, cycle: string) {
    if (!editing) return;
    await updateLevel(editing.id, label, sortOrder, cycle);
    setEditing(null);
    notifySuccess("Niveau mis à jour");
    q.refetch();
  }
  function handleDelete(level: Niveau) {
    confirmAction({
      title: "Supprimer le niveau",
      message: `Supprimer le niveau ${level.label} ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteLevel(level.id);
          notifySuccess("Niveau supprimé");
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
          <Button variant="secondary" onClick={() => setCatalogOpen(true)}>Catalogue</Button>
          <Button onClick={() => setCreating(true)}>Nouveau niveau</Button>
        </div>
      )}
      <Table>
        <THead>
          <tr>
            <TH>Ordre</TH>
            <TH>Libellé</TH>
            <TH>Cycle</TH>
            <TH className="text-right">Actions</TH>
          </tr>
        </THead>
        <TBody>
          {levels.length === 0 && (
            <TR>
              <TD colSpan={4} className="py-8 text-center text-gray-400">
                Aucun niveau.
              </TD>
            </TR>
          )}
          {levels.map((l) => (
            <TR key={l.id}>
              <TD>{l.sortOrder}</TD>
              <TD className="font-medium">{l.label}</TD>
              <TD className="text-gray-500">{l.cycle ? SCHOOL_CYCLE_LABEL[l.cycle] : "—"}</TD>
              <TD className="text-right">
                {canWrite && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Modifier</Button>
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(l)}>Suppr.</Button>
                  </div>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau niveau">
        {creating && <LevelForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier le niveau">
        {editing && <LevelForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>

      <Modal open={catalogOpen} onClose={() => setCatalogOpen(false)} title="Catalogue des niveaux">
        {catalogOpen && (
          <LevelCatalogPicker
            existing={levels}
            onDone={() => {
              setCatalogOpen(false);
              q.refetch();
            }}
            onCancel={() => setCatalogOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
