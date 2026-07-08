"use client";

import { useMemo, useState } from "react";
import { Button, Group, NumberInput, Select, Stack } from "@mantine/core";
import { Star } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  assignClassSubject,
  listClassSubjects,
  listSubjects,
  removeClassSubject,
  setClassHeadTeacher,
} from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

type Row = { subjectId: string; teacherId: string; coefficient: string };
const EMPTY_ROW: Row = { subjectId: "", teacherId: "", coefficient: "" };

export function ClassSubjectsSection({
  classId, canWrite, headTeacherId, onHeadTeacherChange,
}: {
  classId: number;
  canWrite: boolean;
  headTeacherId: number | null;
  onHeadTeacherChange: () => void;
}) {
  const q = useQuery(() => listClassSubjects(classId), [classId]);
  const subjectsQuery = useQuery(listSubjects, []);
  const teachersQuery = useQuery(listTeachers, []);
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

  const subjectData = subjects.map((s) => ({ value: String(s.id), label: s.label }));
  const teacherData = [
    { value: "", label: "— Non assigné —" },
    ...teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` })),
  ];

  function updateRow(idx: number, key: keyof Row, value: string) {
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
          r.coefficient ? Number(r.coefficient) : undefined);
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
                <TH>Enseignant</TH>
                <TH>Prof. principal</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {assignments.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-8 text-center text-gray-400">Aucune matière affectée.</TD>
                </TR>
              )}
              {assignments.map((a) => {
                const isHead = a.teacherId != null && a.teacherId === headTeacherId;
                return (
                  <TR key={a.id}>
                    <TD className="font-medium">{subjectLabel.get(a.subjectId) ?? `#${a.subjectId}`}</TD>
                    <TD>{a.coefficient ?? "—"}</TD>
                    <TD>
                      {canWrite ? (
                        <Select
                          placeholder="Choisir un enseignant"
                          data={teacherData}
                          value={a.teacherId ? String(a.teacherId) : ""}
                          onChange={(val) => assignTeacher(a.subjectId, val ?? "")}
                          searchable
                          size="xs"
                          w={220}
                          comboboxProps={{ withinPortal: true }}
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
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Principal
                        </span>
                      ) : canWrite ? (
                        <Button size="sm" variant="ghost" onClick={() => designate(a.teacherId!)}>Désigner</Button>
                      ) : null}
                    </TD>
                    <TD className="text-right">
                      {canWrite && (
                        <Group gap="xs" justify="flex-end">
                          {isHead && (
                            <Button size="sm" variant="ghost" onClick={() => designate(null)}>Retirer principal</Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleRemove(a.id)}>
                            Retirer
                          </Button>
                        </Group>
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
        <Stack gap="sm">
          <p className="text-xs text-gray-500">
            Ajoutez plusieurs matières d&apos;un coup, chacune avec son enseignant. Le professeur principal se
            désigne ensuite depuis le tableau.
          </p>
          {rows.map((row, idx) => (
            <Group key={idx} align="flex-end" wrap="nowrap">
              <Select label={idx === 0 ? "Matière" : undefined} placeholder="Matière" searchable style={{ flex: 1 }}
                data={subjectData} value={row.subjectId} onChange={(v) => updateRow(idx, "subjectId", v ?? "")} />
              <Select label={idx === 0 ? "Enseignant" : undefined} placeholder="Enseignant" searchable style={{ flex: 1 }}
                data={teacherData} value={row.teacherId} onChange={(v) => updateRow(idx, "teacherId", v ?? "")} />
              <NumberInput label={idx === 0 ? "Coef." : undefined} placeholder="1" min={0} step={0.5} w={80}
                value={row.coefficient === "" ? "" : Number(row.coefficient)}
                onChange={(v) => updateRow(idx, "coefficient", v === "" || v == null ? "" : String(v))} />
              <Button variant="subtle" color="red" disabled={rows.length === 1}
                onClick={() => removeRow(idx)} style={{ flexGrow: 0 }}>✕</Button>
            </Group>
          ))}
          <Button variant="light" size="sm" onClick={addRow} style={{ alignSelf: "flex-start" }}>
            + Ajouter une matière
          </Button>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setAssigning(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={submitBatch} loading={submitting}>Affecter</Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
