"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createDevice, deleteDevice, listDevices, syncDevice, testDeviceConnection, updateDevice,
} from "@/lib/api/biometric";
import {
  DEVICE_STATUS_LABEL, DEVICE_TYPE_LABEL, PROTOCOL_LABEL,
  type BiometricDevice, type BiometricDeviceType, type BiometricProtocol, type DeviceStatus,
} from "@/lib/types/biometric";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<DeviceStatus, "green" | "red" | "gray"> = { CONNECTED: "green", DISCONNECTED: "red", UNKNOWN: "gray" };

export function DevicesTab() {
  const q = useQuery(listDevices, []);
  const [editing, setEditing] = useState<BiometricDevice | null>(null);
  const [creating, setCreating] = useState(false);

  function act(p: Promise<unknown>, msg: string) { p.then(() => { notifySuccess(msg); q.refetch(); }).catch(notifyError); }
  function remove(d: BiometricDevice) {
    confirmAction({ title: "Supprimer l'appareil", message: d.name, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteDevice(d.id); notifySuccess("Supprimé"); q.refetch(); } catch (e) { notifyError(e); } } });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Ajouter un appareil</Button></div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Nom</TH><TH>Type</TH><TH>Adresse</TH><TH>Protocole</TH><TH>État</TH><TH>Dernière sync</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-gray-400">Aucun appareil.</TD></TR>}
            {(q.data ?? []).map((d) => (
              <TR key={d.id}>
                <TD className="font-medium text-gray-900">{d.name}{d.location ? <span className="block text-xs text-gray-400">{d.location}</span> : null}</TD>
                <TD>{DEVICE_TYPE_LABEL[d.deviceType]}</TD>
                <TD className="font-mono text-xs text-gray-600">{d.ipAddress ? `${d.ipAddress}:${d.port ?? ""}` : "—"}</TD>
                <TD>{PROTOCOL_LABEL[d.protocol]}</TD>
                <TD><Badge tone={STATUS_TONE[d.status]}>{DEVICE_STATUS_LABEL[d.status]}</Badge></TD>
                <TD className="text-xs text-gray-500">{d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString("fr-FR") : "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => act(testDeviceConnection(d.id), "Test effectué")}>Tester</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(syncDevice(d.id), "Synchronisé")}>Sync</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>Modifier</Button>
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(d)}>Suppr.</Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier l'appareil" : "Nouvel appareil"}>
        <DeviceForm initial={editing} onCancel={() => { setCreating(false); setEditing(null); }}
          onDone={() => { setCreating(false); setEditing(null); notifySuccess("Enregistré"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "Requis"),
  deviceType: z.string(),
  ipAddress: z.string(),
  port: z.string(),
  protocol: z.string(),
  location: z.string(),
  realtimeSync: z.boolean(),
  syncIntervalMinutes: z.string(),
  temperatureCheck: z.boolean(),
  temperatureThreshold: z.string(),
});
type FormValues = z.infer<typeof schema>;

function DeviceForm({ initial, onCancel, onDone }: { initial: BiometricDevice | null; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "", deviceType: initial?.deviceType ?? "FINGERPRINT",
      ipAddress: initial?.ipAddress ?? "", port: initial?.port != null ? String(initial.port) : "4370",
      protocol: initial?.protocol ?? "PUSH", location: initial?.location ?? "",
      realtimeSync: initial?.realtimeSync ?? false, syncIntervalMinutes: initial?.syncIntervalMinutes != null ? String(initial.syncIntervalMinutes) : "5",
      temperatureCheck: initial?.temperatureCheck ?? false, temperatureThreshold: initial?.temperatureThreshold != null ? String(initial.temperatureThreshold) : "37.5",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: FormValues) {
    setLoading(true);
    try {
      const payload = {
        name: values.name, deviceType: values.deviceType as BiometricDeviceType, ipAddress: values.ipAddress || null,
        port: values.port === "" ? null : Number(values.port), protocol: values.protocol as BiometricProtocol, location: values.location || null,
        realtimeSync: values.realtimeSync, syncIntervalMinutes: Number(values.syncIntervalMinutes) || 5,
        temperatureCheck: values.temperatureCheck, temperatureThreshold: values.temperatureThreshold === "" ? null : Number(values.temperatureThreshold),
      };
      if (initial) await updateDevice(initial.id, payload); else await createDevice(payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Nom <span className="text-error-500">*</span></Label>
        <Input placeholder="Ex. Entrée principale" value={v.name} onChange={(e) => setValue("name", e.target.value)} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-error-600">{errors.name.message}</p>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Type</Label>
          <Select value={v.deviceType} onChange={(e) => setValue("deviceType", e.target.value)}>
            {(Object.keys(DEVICE_TYPE_LABEL) as BiometricDeviceType[]).map((t) => (<option key={t} value={t}>{DEVICE_TYPE_LABEL[t]}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Protocole</Label>
          <Select value={v.protocol} onChange={(e) => setValue("protocol", e.target.value)}>
            {(Object.keys(PROTOCOL_LABEL) as BiometricProtocol[]).map((p) => (<option key={p} value={p}>{PROTOCOL_LABEL[p]}</option>))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Adresse IP</Label>
          <Input placeholder="192.168.1.50" value={v.ipAddress} onChange={(e) => setValue("ipAddress", e.target.value)} />
        </Field>
        <Field>
          <Label>Port</Label>
          <Input type="number" min={0} value={v.port} onChange={(e) => setValue("port", e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Emplacement</Label>
        <Input placeholder="Bâtiment A" value={v.location} onChange={(e) => setValue("location", e.target.value)} />
      </Field>
      <div className="flex items-center gap-3">
        <Switch checked={v.realtimeSync} onChange={(checked) => setValue("realtimeSync", checked)} ariaLabel="Synchronisation temps réel" />
        <span className="text-sm text-gray-700">Synchronisation temps réel</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Intervalle sync (min)</Label>
          <Input type="number" min={1} value={v.syncIntervalMinutes} onChange={(e) => setValue("syncIntervalMinutes", e.target.value)} />
        </Field>
        <Field>
          <Label>Seuil température (°C)</Label>
          <Input type="number" min={0} step={0.1} value={v.temperatureThreshold} onChange={(e) => setValue("temperatureThreshold", e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={v.temperatureCheck} onChange={(checked) => setValue("temperatureCheck", checked)} ariaLabel="Contrôle de température" />
        <span className="text-sm text-gray-700">Contrôle de température</span>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Enregistrer</Button>
      </div>
    </form>
  );
}
