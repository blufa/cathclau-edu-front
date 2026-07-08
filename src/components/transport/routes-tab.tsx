"use client";

import { useState } from "react";
import { NumberInput, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { addStop, createRoute, deleteRoute, deleteStop, listRoutes, listStops, updateRoute } from "@/lib/api/transport";
import type { TransportRoute } from "@/lib/types/transport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

export function RoutesTab() {
  const q = useQuery(listRoutes, []);
  const [editing, setEditing] = useState<TransportRoute | null>(null);
  const [creating, setCreating] = useState(false);
  const [stopsFor, setStopsFor] = useState<TransportRoute | null>(null);

  function remove(r: TransportRoute) {
    confirmAction({ title: "Supprimer la ligne", message: r.name, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteRoute(r.id); notifySuccess("Supprimée"); q.refetch(); } catch (e) { notifyError(e); } } });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Nouvelle ligne</Button></div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Ligne</TH><TH>Véhicule</TH><TH>Chauffeur</TH><TH>Capacité</TH><TH>Frais/mois</TH><TH>État</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-slate-400">Aucune ligne.</TD></TR>}
            {(q.data ?? []).map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-slate-900">{r.name}</TD>
                <TD className="font-mono text-xs">{r.vehicleRegistration ?? "—"}</TD>
                <TD>{r.driverName ?? "—"}{r.driverPhone ? <span className="block text-xs text-slate-400">{r.driverPhone}</span> : null}</TD>
                <TD>{r.capacity ?? "—"}</TD>
                <TD>{r.monthlyFee != null ? formatGNF(r.monthlyFee) : "—"}</TD>
                <TD>{r.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setStopsFor(r)}>Arrêts</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Modifier</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(r)}>Suppr.</Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier la ligne" : "Nouvelle ligne"}>
        <RouteForm initial={editing} onCancel={() => { setCreating(false); setEditing(null); }}
          onDone={() => { setCreating(false); setEditing(null); notifySuccess("Enregistrée"); q.refetch(); }} />
      </Modal>

      <Modal open={!!stopsFor} onClose={() => setStopsFor(null)} title={stopsFor ? `Arrêts — ${stopsFor.name}` : ""}>
        {stopsFor && <StopsPanel route={stopsFor} />}
      </Modal>
    </div>
  );
}

function RouteForm({ initial, onCancel, onDone }: { initial: TransportRoute | null; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      name: initial?.name ?? "", description: initial?.description ?? "",
      vehicleRegistration: initial?.vehicleRegistration ?? "", driverName: initial?.driverName ?? "", driverPhone: initial?.driverPhone ?? "",
      capacity: (initial?.capacity ?? "") as number | string, monthlyFee: (initial?.monthlyFee ?? "") as number | string,
      active: initial?.active ?? true,
    },
    validate: { name: (v) => (v ? null : "Requis") },
  });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = {
        name: values.name, description: values.description || null, vehicleRegistration: values.vehicleRegistration || null,
        driverName: values.driverName || null, driverPhone: values.driverPhone || null,
        capacity: values.capacity === "" ? null : Number(values.capacity), monthlyFee: values.monthlyFee === "" ? null : Number(values.monthlyFee),
        active: values.active,
      };
      if (initial) await updateRoute(initial.id, payload); else await createRoute(payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Nom de la ligne" withAsterisk placeholder="Ex. Ligne Nord" {...form.getInputProps("name")} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Immatriculation" placeholder="RC-1234-A" {...form.getInputProps("vehicleRegistration")} />
          <NumberInput label="Capacité" min={0} {...form.getInputProps("capacity")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Chauffeur" {...form.getInputProps("driverName")} />
          <TextInput label="Téléphone chauffeur" {...form.getInputProps("driverPhone")} />
        </div>
        <NumberInput label="Frais mensuels (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("monthlyFee")} />
        <Textarea label="Description / itinéraire" autosize minRows={2} {...form.getInputProps("description")} />
        <Switch label="Ligne active" {...form.getInputProps("active", { type: "checkbox" })} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Enregistrer</Button>
        </div>
      </Stack>
    </form>
  );
}

function StopsPanel({ route }: { route: TransportRoute }) {
  const q = useQuery(() => listStops(route.id), [route.id]);
  const form = useForm({ mode: "controlled", initialValues: { name: "", pickupTime: "", dropTime: "", sequence: 10 as number | string }, validate: { name: (v) => (v ? null : "Requis") } });
  const [adding, setAdding] = useState(false);
  async function add(values: typeof form.values) {
    setAdding(true);
    try {
      await addStop(route.id, { name: values.name, pickupTime: values.pickupTime || null, dropTime: values.dropTime || null, sequence: Number(values.sequence) || 10 });
      form.reset();
      q.refetch();
    } catch (err) { notifyError(err); } finally { setAdding(false); }
  }
  return (
    <div className="space-y-4">
      {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Arrêt</TH><TH>Ramassage</TH><TH>Dépose</TH><TH /></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-slate-400">Aucun arrêt.</TD></TR>}
            {(q.data ?? []).map((s) => (
              <TR key={s.id}>
                <TD className="font-medium">{s.name}</TD>
                <TD>{s.pickupTime ?? "—"}</TD>
                <TD>{s.dropTime ?? "—"}</TD>
                <TD className="text-right"><Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteStop(s.id).then(() => q.refetch()).catch(notifyError)}>Suppr.</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <form onSubmit={form.onSubmit(add)} className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-700">Ajouter un arrêt</p>
        <Stack gap="sm">
          <TextInput label="Nom" withAsterisk {...form.getInputProps("name")} />
          <div className="grid grid-cols-3 gap-2">
            <TimeInput label="Ramassage" {...form.getInputProps("pickupTime")} />
            <TimeInput label="Dépose" {...form.getInputProps("dropTime")} />
            <NumberInput label="Ordre" min={0} {...form.getInputProps("sequence")} />
          </div>
          <div className="flex justify-end"><Button type="submit" size="sm" loading={adding}>Ajouter</Button></div>
        </Stack>
      </form>
    </div>
  );
}
