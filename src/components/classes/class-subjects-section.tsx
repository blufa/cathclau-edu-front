"use client";

import { useMemo, useState } from "react";
import { Button, Group, NativeSelect, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@/hooks/use-query";
import { assignClassSubject, listClassSubjects, listSubjects, removeClassSubject } from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export function ClassSubjectsSection({ classId, canWrite }: { classId: number; canWrite: boolean }) {
  const q = useQuery(() => listClassSubjects(classId), [classId]);
  const subjectsQuery = useQuery(listSubjects, []);
  const teachersQuery = useQuery(listTeachers, []);
  const [assigning, setAssigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const subjectLabel = useMemo(() => new Map(subjects.map((s) => [s.id, s.label])), [subjects]);
  const teacherName = useMemo(
    () => new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`])),
    [teachers],
  );

  const form = useForm({
    mode: "uncontrolled",
    initialValues: { subjectId: "", teacherId: "" },
    validate: { subjectId: (v) => (v ? null : "Matière requise") },
  });

  async function handleAssign(values: { subjectId: string; teacherId: string }) {
    setSubmitting(true);
    try {
      await assignClassSubject(classId, Number(values.subjectId), values.teacherId ? Number(values.teacherId) : undefined);
      notifySuccess("Matière affectée");
      setAssigning(false);
      form.reset();
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
        try {
          await removeClassSubject(classId, id);
          notifySuccess("Matière retirée");
          q.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  const assignments = q.data ?? [];
  const teacherData = [
    { value: "", label: "— Non assigné —" },
    ...teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` })),
  ];
  const subjectData = [
    { value: "", label: "— Sélectionner —" },
    ...subjects.map((s) => ({ value: String(s.id), label: s.label })),
  ];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Matières & enseignants</CardTitle>
        {canWrite && (
          <Button size="sm" onClick={() => setAssigning(true)}>
            Affecter une matière
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
                <TH>Matière</TH>
                <TH>Enseignant</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {assignments.length === 0 && (
                <TR>
                  <TD colSpan={3} className="py-8 text-center text-gray-400">
                    Aucune matière affectée.
                  </TD>
                </TR>
              )}
              {assignments.map((a) => (
                <TR key={a.id}>
                  <TD className="font-medium">{subjectLabel.get(a.subjectId) ?? `#${a.subjectId}`}</TD>
                  <TD>{a.teacherId ? (teacherName.get(a.teacherId) ?? `#${a.teacherId}`) : "—"}</TD>
                  <TD className="text-right">
                    {canWrite && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleRemove(a.id)}>
                        Retirer
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>

      <Modal open={assigning} onClose={() => setAssigning(false)} title="Affecter une matière">
        <form onSubmit={form.onSubmit(handleAssign)}>
          <Stack gap="md">
            <NativeSelect label="Matière" withAsterisk data={subjectData} {...form.getInputProps("subjectId")} key={form.key("subjectId")} />
            <NativeSelect label="Enseignant" data={teacherData} {...form.getInputProps("teacherId")} key={form.key("teacherId")} />
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => setAssigning(false)} disabled={submitting}>
                Annuler
              </Button>
              <Button type="submit" loading={submitting}>
                Affecter
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
}
