"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import {
  assignClassSubject,
  listClassSubjects,
  listSubjects,
  removeClassSubject,
  setClassHeadTeacher,
} from "@/lib/api/academics";
import type { ClasseMatiere } from "@/lib/types/academics";
import { listTeachers } from "@/lib/api/staff";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label, Field } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

type Row = { subjectId: string; teacherId: string; coefficient: string; specialty: boolean };
const EMPTY_ROW: Row = { subjectId: "", teacherId: "", coefficient: "", specialty: false };

export function ClassSubjectsSection({
  classId, canWrite, headTeacherId, onHeadTeacherChange,
}: {
  classId: number;
  canWrite: boolean;
  headTeacherId: number | null;
  onHeadTeacherChange: () => void;
}) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const q = useQuery(() => listClassSubjects(classId), [classId]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const [assigning, setAssigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<Row[]>([EMPTY_ROW]);

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const subjectLabel = useMemo(() => new Map(subjects.map((s) => [s.id, s.label])), [subjects]);
  const teacherName = useMemo(
    () => new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`])),
    [teachers],
  );

  const subjectOptions: SearchableOption[] = useMemo(
    () => subjects.map((s) => ({ value: String(s.id), trigger: s.label, label: s.label, searchText: s.label })),
    [subjects],
  );
  const teacherOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", trigger: "— Non assigné —", label: "— Non assigné —", searchText: "non assigné" },
      ...teachers.map((t) => {
        const name = `${t.firstName} ${t.lastName}`;
        return { value: String(t.id), trigger: name, label: name, searchText: name };
      }),
    ],
    [teachers],
  );

  function updateRow<K extends keyof Row>(idx: number, key: K, value: Row[K]) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }
  function addRow() { setRows((prev) => [...prev, EMPTY_ROW]); }
  function removeRow(idx: number) { setRows((prev) => prev.filter((_, i) => i !== idx)); }
  function openModal() { setRows([EMPTY_ROW]); setAssigning(true); }

  async function submitBatch() {
    const valid = rows.filter((r) => r.subjectId);
    if (valid.length === 0) { notifyError("Ajoutez au moins une matière."); return; }
    setSubmitting(true);
    try {
      for (const r of valid) {
        await assignClassSubject(classId, Number(r.subjectId), r.teacherId ? Number(r.teacherId) : undefined,
          r.coefficient ? Number(r.coefficient) : undefined, undefined, r.specialty);
      }
      notifySuccess(`${valid.length} matière(s) affectée(s)`);
      setAssigning(false);
      setRows([EMPTY_ROW]);
      q.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleRemove(id: number) {
    confirmAction({
      title: "Retirer la matière",
      message: "Retirer cette matière de la classe ?",
      confirmLabel: "Retirer",
      danger: true,
      onConfirm: async () => {
        try { await removeClassSubject(classId, id); notifySuccess("Matière retirée"); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  async function assignTeacher(subjectId: number, teacherId: string) {
    try {
      // Upsert côté backend : met à jour l'enseignant de la matière déjà affectée (pas de doublon).
      await assignClassSubject(classId, subjectId, teacherId ? Number(teacherId) : undefined);
      notifySuccess(teacherId ? "Enseignant affecté" : "Enseignant retiré");
      q.refetch();
    } catch (err) {
      notifyError(err);
    }
  }

  async function toggleSpecialty(a: ClasseMatiere, specialty: boolean) {
    try {
      // Le coefficient/enseignant/code sont renvoyés tels quels : seule la spécialité change ici.
      await assignClassSubject(classId, a.subjectId, a.teacherId ?? undefined,
        a.coefficient != null ? Number(a.coefficient) : undefined, a.code ?? undefined, specialty);
      notifySuccess(specialty ? "Marquée matière de spécialité" : "Retirée des matières de spécialité");
      q.refetch();
    } catch (err) {
      notifyError(err);
    }
  }

  async function designate(teacherId: number | null) {
    try {
      await setClassHeadTeacher(classId, teacherId);
      notifySuccess(teacherId ? "Professeur principal désigné" : "Professeur principal retiré");
      onHeadTeacherChange();
    } catch (err) { notifyError(err); }
  }

  const assignments = q.data ?? [];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Matières & enseignants</CardTitle>
        {canWrite && <Button size="sm" onClick={openModal}>Affecter des matières</Button>}
      </CardHeader>
      <CardBody className="p-0">
        {q.loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Matière</TH>
                <TH>Coef.</TH>
                <TH>Spécialité</TH>
                <TH>Enseignant</TH>
                <TH>Prof. principal</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {assignments.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-gray-400">Aucune matière affectée.</TD>
                </TR>
              )}
              {assignments.map((a) => {
                const isHead = a.teacherId != null && a.teacherId === headTeacherId;
                return (
                  <TR key={a.id}>
                    <TD className="font-medium">{subjectLabel.get(a.subjectId) ?? `#${a.subjectId}`}</TD>
                    <TD>
                      {canWrite ? (
                        <CoefficientCell
                          key={`${a.id}:${a.coefficient ?? ""}`}
                          assignment={a} classId={classId} onSaved={() => q.refetch()}
                        />
                      ) : (
                        a.coefficient ?? "—"
                      )}
                    </TD>
                    <TD>
                      <Checkbox
                        checked={a.specialty}
                        disabled={!canWrite}
                        onChange={(e) => toggleSpecialty(a, e.target.checked)}
                      />
                    </TD>
                    <TD>
                      {canWrite ? (
                        <SearchableSelect
                          value={a.teacherId ? String(a.teacherId) : ""}
                          options={teacherOptions}
                          onChange={(v) => assignTeacher(a.subjectId, v)}
                          triggerClassName="w-[220px] justify-between px-3"
                        />
                      ) : a.teacherId ? (
                        teacherName.get(a.teacherId) ?? `#${a.teacherId}`
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>
                      {a.teacherId == null ? (
                        <span className="text-gray-300">—</span>
                      ) : isHead ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-700">
                          <Star className="h-3 w-3 fill-warning-500 text-warning-500" /> Principal
                        </span>
                      ) : canWrite ? (
                        <Button size="sm" variant="ghost" onClick={() => designate(a.teacherId!)}>Désigner</Button>
                      ) : null}
                    </TD>
                    <TD className="text-right">
                      {canWrite && (
                        <div className="flex justify-end gap-2">
                          {isHead && (
                            <Button size="sm" variant="ghost" onClick={() => designate(null)}>Retirer principal</Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleRemove(a.id)}>
                            Retirer
                          </Button>
                        </div>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </CardBody>

      <Modal open={assigning} onClose={() => setAssigning(false)} title="Affecter des matières & enseignants">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Ajoutez plusieurs matières d&apos;un coup, chacune avec son enseignant. Le professeur principal se
            désigne ensuite depuis le tableau.
          </p>
          {rows.map((row, idx) => (
            <div key={idx} className="flex flex-nowrap items-end gap-2">
              <Field>
                {idx === 0 && <Label>Matière</Label>}
                <SearchableSelect value={row.subjectId} options={subjectOptions} onChange={(v) => updateRow(idx, "subjectId", v)} triggerClassName="w-full justify-between px-3" />
              </Field>
              <Field>
                {idx === 0 && <Label>Enseignant</Label>}
                <SearchableSelect value={row.teacherId} options={teacherOptions} onChange={(v) => updateRow(idx, "teacherId", v)} triggerClassName="w-full justify-between px-3" />
              </Field>
              <Field>
                {idx === 0 && <Label>Coef.</Label>}
                <Input
                  type="number" min={0} step={0.5} placeholder="1" className="w-20"
                  value={row.coefficient}
                  onChange={(e) => updateRow(idx, "coefficient", e.target.value)}
                />
              </Field>
              <Field>
                {idx === 0 && <Label>Spécialité</Label>}
                <div className="flex h-10 items-center">
                  <Checkbox checked={row.specialty} onChange={(e) => updateRow(idx, "specialty", e.target.checked)} />
                </div>
              </Field>
              <Button type="button" variant="ghost" className="text-error-600" disabled={rows.length === 1} onClick={() => removeRow(idx)}>✕</Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={addRow}>
            + Ajouter une matière
          </Button>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAssigning(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={submitBatch} loading={submitting}>Affecter</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/**
 * Coefficient éditable pour une matière déjà affectée à la classe — jusqu'ici, une fois la matière
 * affectée (modale "Affecter des matières"), il n'existait aucun moyen d'ajouter ou corriger son
 * coefficient sans la retirer puis la réaffecter. Très utile au lycée : une matière de spécialité a
 * souvent un coefficient différent selon la série, alors qu'elle garde le même coefficient générique
 * dans les autres séries/classes du collège.
 */
function CoefficientCell({
  assignment, classId, onSaved,
}: {
  assignment: ClasseMatiere;
  classId: number;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(assignment.coefficient ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = value.trim();
    if (trimmed === (assignment.coefficient ?? "")) return;
    setSaving(true);
    try {
      // Le coefficient est le seul champ modifié ici : on renvoie explicitement l'enseignant et le
      // code déjà affectés, sans quoi le backend (upsert) les effacerait (voir assignClassSubject).
      await assignClassSubject(
        classId, assignment.subjectId,
        assignment.teacherId ?? undefined,
        trimmed === "" ? undefined : Number(trimmed),
        assignment.code ?? undefined,
      );
      notifySuccess("Coefficient enregistré");
      onSaved();
    } catch (err) {
      notifyError(err);
      setValue(assignment.coefficient ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Input
      type="number" min={0} step={0.5} placeholder="1" className="w-16"
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
    />
  );
}
