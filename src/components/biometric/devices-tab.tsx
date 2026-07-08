"use client";

import { useState } from "react";
import { NumberInput, Select, Stack, Switch, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
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
            {(q.data ?? []).length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-slate-400">Aucun appareil.</TD></TR>}
            {(q.data ?? []).map((d) => (
              <TR key={d.id}>
                <TD className="font-medium text-slate-900">{d.name}{d.location ? <span className="block text-xs text-slate-400">{d.location}</span> : null}</TD>
                <TD>{DEVICE_TYPE_LABEL[d.deviceType]}</TD>
                <TD className="font-mono text-xs text-slate-600">{d.ipAddress ? `${d.ipAddress}:${d.port ?? ""}` : "—"}</TD>
                <TD>{PROTOCOL_LABEL[d.protocol]}</TD>
                <TD><Badge tone={STATUS_TONE[d.status]}>{DEVICE_STATUS_LABEL[d.status]}</Badge></TD>
                <TD className="text-xs text-slate-500">{d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString("fr-FR") : "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => act(testDeviceConnection(d.id), "Test effectué")}>Tester</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(syncDevice(d.id), "Synchronisé")}>Sync</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>Modifier</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(d)}>Suppr.</Button>
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

function DeviceForm({ initial, onCancel, onDone }: { initial: BiometricDevice | null; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      name: initial?.name ?? "", deviceType: (initial?.deviceType ?? "FINGERPRINT") as BiometricDeviceType,
      ipAddress: initial?.ipAddress ?? "", port: (initial?.port ?? 4370) as number | string,
      protocol: (initial?.protocol ?? "PUSH") as BiometricProtocol, location: initial?.location ?? "",
      realtimeSync: initial?.realtimeSync ?? false, syncIntervalMinutes: (initial?.syncIntervalMinutes ?? 5) as number | string,
      temperatureCheck: initial?.temperatureCheck ?? false, temperatureThreshold: (initial?.temperatureThreshold ?? 37.5) as number | string,
    },
    validate: { name: (v) => (v ? null : "Requis") },
  });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = {
        name: values.name, deviceType: values.deviceType, ipAddress: values.ipAddress || null,
        port: values.port === "" ? null : Number(values.port), protocol: values.protocol, location: values.location || null,
        realtimeSync: values.realtimeSync, syncIntervalMinutes: Number(values.syncIntervalMinutes) || 5,
        temperatureCheck: values.temperatureCheck, temperatureThreshold: values.temperatureThreshold === "" ? null : Number(values.temperatureThreshold),
      };
      if (initial) await updateDevice(initial.id, payload); else await createDevice(payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Nom" withAsterisk placeholder="Ex. Entrée principale" {...form.getInputProps("name")} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" allowDeselect={false} data={(Object.keys(DEVICE_TYPE_LABEL) as BiometricDeviceType[]).map((t) => ({ value: t, label: DEVICE_TYPE_LABEL[t] }))} {...form.getInputProps("deviceType")} />
          <Select label="Protocole" allowDeselect={false} data={(Object.keys(PROTOCOL_LABEL) as BiometricProtocol[]).map((p) => ({ value: p, label: PROTOCOL_LABEL[p] }))} {...form.getInputProps("protocol")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Adresse IP" placeholder="192.168.1.50" {...form.getInputProps("ipAddress")} />
          <NumberInput label="Port" min={0} {...form.getInputProps("port")} />
        </div>
        <TextInput label="Emplacement" placeholder="Bâtiment A" {...form.getInputProps("location")} />
        <Switch label="Synchronisation temps réel" {...form.getInputProps("realtimeSync", { type: "checkbox" })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Intervalle sync (min)" min={1} {...form.getInputProps("syncIntervalMinutes")} />
          <NumberInput label="Seuil température (°C)" min={0} step={0.1} {...form.getInputProps("temperatureThreshold")} />
        </div>
        <Switch label="Contrôle de température" {...form.getInputProps("temperatureCheck", { type: "checkbox" })} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Enregistrer</Button>
        </div>
      </Stack>
    </form>
  );
}
