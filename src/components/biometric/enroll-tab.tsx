"use client";

import { useMemo, useState } from "react";
import { Select, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { deleteEnrollment, enrollUser, listDevices, listEnrollments } from "@/lib/api/biometric";
import {
  BIOMETRIC_TYPE_LABEL, SUBJECT_TYPE_LABEL,
  type BiometricDevice, type BiometricSubjectType, type BiometricType,
} from "@/lib/types/biometric";
import { useDirectory } from "@/components/biometric/use-directory";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notifyError, notifySuccess } from "@/lib/feedback";

export function EnrollTab() {
  const devicesQuery = useQuery(listDevices, []);
  const { teachers, students, name } = useDirectory();
  const [deviceFilter, setDeviceFilter] = useState<string | null>(null);
  const q = useQuery(() => listEnrollments(deviceFilter ? Number(deviceFilter) : undefined), [deviceFilter]);
  const [enrolling, setEnrolling] = useState(false);
  const deviceName = useMemo(() => new Map((devicesQuery.data ?? []).map((d) => [d.id, d.name])), [devicesQuery.data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-[240px]" placeholder="Tous les appareils" clearable
          data={(devicesQuery.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))}
          value={deviceFilter} onChange={setDeviceFilter} />
        <Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setEnrolling(true)}>Enrôler une personne</Button>
      </div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Personne</TH><TH>Appareil</TH><TH>Modalité</TH><TH>User ID</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-slate-400">Aucun enrôlement.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="font-medium text-slate-900">{name.get(`${e.subjectType}-${e.subjectId}`) ?? `${SUBJECT_TYPE_LABEL[e.subjectType]} #${e.subjectId}`}</TD>
                <TD>{deviceName.get(e.deviceId) ?? `#${e.deviceId}`}</TD>
                <TD>{BIOMETRIC_TYPE_LABEL[e.biometricType]}</TD>
                <TD className="font-mono text-xs">{e.externalUserId}</TD>
                <TD className="text-right"><Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteEnrollment(e.id).then(() => q.refetch()).catch(notifyError)}>Retirer</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Modal open={enrolling} onClose={() => setEnrolling(false)} title="Enrôler une personne">
        <EnrollForm devices={devicesQuery.data ?? []} teachers={teachers} students={students}
          onCancel={() => setEnrolling(false)} onDone={() => { setEnrolling(false); notifySuccess("Enrôlé"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

function EnrollForm({ devices, teachers, students, onCancel, onDone }: {
  devices: BiometricDevice[];
  teachers: { id: number; firstName: string; lastName: string }[];
  students: { id: number; firstName: string; lastName: string; studentNumber: string }[];
  onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: { deviceId: "", subjectType: "STUDENT" as BiometricSubjectType, subjectId: "", biometricType: "FINGERPRINT" as BiometricType, externalUserId: "" },
    validate: { deviceId: (v) => (v ? null : "Requis"), subjectId: (v) => (v ? null : "Requis"), externalUserId: (v) => (v ? null : "Requis") },
  });
  const subjectData = form.values.subjectType === "TEACHER"
    ? teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))
    : students.map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.studentNumber})` }));

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      await enrollUser({ deviceId: Number(values.deviceId), subjectType: values.subjectType, subjectId: Number(values.subjectId), biometricType: values.biometricType, externalUserId: values.externalUserId });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <Select label="Appareil" withAsterisk data={devices.map((d) => ({ value: String(d.id), label: d.name }))} {...form.getInputProps("deviceId")} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" allowDeselect={false} data={[{ value: "STUDENT", label: "Élève" }, { value: "TEACHER", label: "Enseignant" }]}
            value={form.values.subjectType} onChange={(v) => { form.setFieldValue("subjectType", (v ?? "STUDENT") as BiometricSubjectType); form.setFieldValue("subjectId", ""); }} />
          <Select label="Modalité" allowDeselect={false} data={[{ value: "FINGERPRINT", label: "Empreinte" }, { value: "FACE", label: "Visage" }]} {...form.getInputProps("biometricType")} />
        </div>
        <Select label="Personne" withAsterisk searchable data={subjectData} {...form.getInputProps("subjectId")} />
        <TextInput label="User ID appareil" withAsterisk placeholder="Identifiant interne sur l'appareil (ex. 1024)" {...form.getInputProps("externalUserId")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Enrôler</Button>
        </div>
      </Stack>
    </form>
  );
}
