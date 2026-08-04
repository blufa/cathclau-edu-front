"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notifyError, notifySuccess } from "@/lib/feedback";

export function EnrollTab() {
  const devicesQuery = useQuery(listDevices, []);
  const { teachers, students, name } = useDirectory();
  const [deviceFilter, setDeviceFilter] = useState("");
  const q = useQuery(() => listEnrollments(deviceFilter ? Number(deviceFilter) : undefined), [deviceFilter]);
  const [enrolling, setEnrolling] = useState(false);
  const deviceName = useMemo(() => new Map((devicesQuery.data ?? []).map((d) => [d.id, d.name])), [devicesQuery.data]);
  const deviceOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", trigger: "Tous les appareils", label: "Tous les appareils", searchText: "tous" },
      ...(devicesQuery.data ?? []).map((d) => ({ value: String(d.id), trigger: d.name, label: d.name, searchText: d.name })),
    ],
    [devicesQuery.data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchableSelect value={deviceFilter} options={deviceOptions} onChange={setDeviceFilter} triggerClassName="min-w-[200px] justify-between px-3" />
        <Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setEnrolling(true)}>Enrôler une personne</Button>
      </div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Personne</TH><TH>Appareil</TH><TH>Modalité</TH><TH>User ID</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucun enrôlement.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="font-medium text-gray-900">{name.get(`${e.subjectType}-${e.subjectId}`) ?? `${SUBJECT_TYPE_LABEL[e.subjectType]} #${e.subjectId}`}</TD>
                <TD>{deviceName.get(e.deviceId) ?? `#${e.deviceId}`}</TD>
                <TD>{BIOMETRIC_TYPE_LABEL[e.biometricType]}</TD>
                <TD className="font-mono text-xs">{e.externalUserId}</TD>
                <TD className="text-right"><Button size="sm" variant="ghost" className="text-error-600" onClick={() => deleteEnrollment(e.id).then(() => q.refetch()).catch(notifyError)}>Retirer</Button></TD>
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

const schema = z.object({
  deviceId: z.string().min(1, "Requis"),
  subjectType: z.string(),
  subjectId: z.string().min(1, "Requis"),
  biometricType: z.string(),
  externalUserId: z.string().trim().min(1, "Requis"),
});
type FormValues = z.infer<typeof schema>;

function EnrollForm({ devices, teachers, students, onCancel, onDone }: {
  devices: BiometricDevice[];
  teachers: { id: number; firstName: string; lastName: string }[];
  students: { id: number; firstName: string; lastName: string; studentNumber: string }[];
  onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { deviceId: "", subjectType: "STUDENT", subjectId: "", biometricType: "FINGERPRINT", externalUserId: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  const subjectOptions: SearchableOption[] = useMemo(() => {
    const src = v.subjectType === "TEACHER"
      ? teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))
      : students.map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.studentNumber})` }));
    return src.map((o) => ({ value: o.value, trigger: o.label, label: o.label, searchText: o.label }));
  }, [v.subjectType, teachers, students]);

  async function submit(values: FormValues) {
    setLoading(true);
    try {
      await enrollUser({ deviceId: Number(values.deviceId), subjectType: values.subjectType as BiometricSubjectType, subjectId: Number(values.subjectId), biometricType: values.biometricType as BiometricType, externalUserId: values.externalUserId });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Appareil <span className="text-error-500">*</span></Label>
        <Select value={v.deviceId} onChange={(e) => setValue("deviceId", e.target.value)}>
          <option value="">— Choisir —</option>
          {devices.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
        </Select>
        {errors.deviceId && <p className="text-xs text-error-600">{errors.deviceId.message}</p>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Type</Label>
          <Select value={v.subjectType} onChange={(e) => { setValue("subjectType", e.target.value); setValue("subjectId", ""); }}>
            <option value="STUDENT">Élève</option>
            <option value="TEACHER">Enseignant</option>
          </Select>
        </Field>
        <Field>
          <Label>Modalité</Label>
          <Select value={v.biometricType} onChange={(e) => setValue("biometricType", e.target.value)}>
            <option value="FINGERPRINT">Empreinte</option>
            <option value="FACE">Visage</option>
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Personne <span className="text-error-500">*</span></Label>
        <SearchableSelect value={v.subjectId} options={subjectOptions} onChange={(val) => setValue("subjectId", val)} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucune personne" />
        {errors.subjectId && <p className="text-xs text-error-600">{errors.subjectId.message}</p>}
      </Field>
      <Field>
        <Label>User ID appareil <span className="text-error-500">*</span></Label>
        <Input placeholder="Identifiant interne sur l'appareil (ex. 1024)" value={v.externalUserId} onChange={(e) => setValue("externalUserId", e.target.value)} aria-invalid={!!errors.externalUserId} />
        {errors.externalUserId && <p className="text-xs text-error-600">{errors.externalUserId.message}</p>}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Enrôler</Button>
      </div>
    </form>
  );
}
