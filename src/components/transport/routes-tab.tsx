"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { addStop, createRoute, deleteRoute, deleteStop, listRoutes, listStops, updateRoute } from "@/lib/api/transport";
import type { TransportRoute } from "@/lib/types/transport";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
            {(q.data ?? []).length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-gray-400">Aucune ligne.</TD></TR>}
            {(q.data ?? []).map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-gray-900">{r.name}</TD>
                <TD className="font-mono text-xs">{r.vehicleRegistration ?? "—"}</TD>
                <TD>{r.driverName ?? "—"}{r.driverPhone ? <span className="block text-xs text-gray-400">{r.driverPhone}</span> : null}</TD>
                <TD>{r.capacity ?? "—"}</TD>
                <TD>{r.monthlyFee != null ? formatGNF(r.monthlyFee) : "—"}</TD>
                <TD>{r.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setStopsFor(r)}>Arrêts</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Modifier</Button>
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(r)}>Suppr.</Button>
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

const routeSchema = z.object({
  name: z.string().trim().min(1, "Requis"),
  description: z.string(),
  vehicleRegistration: z.string(),
  driverName: z.string(),
  driverPhone: z.string(),
  capacity: z.union([z.number(), z.literal("")]),
  monthlyFee: z.union([z.number(), z.literal("")]),
  active: z.boolean(),
});
type RouteFormValues = z.infer<typeof routeSchema>;

function RouteForm({ initial, onCancel, onDone }: { initial: TransportRoute | null; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      name: initial?.name ?? "", description: initial?.description ?? "",
      vehicleRegistration: initial?.vehicleRegistration ?? "", driverName: initial?.driverName ?? "", driverPhone: initial?.driverPhone ?? "",
      capacity: initial?.capacity ?? "", monthlyFee: initial?.monthlyFee ?? "",
      active: initial?.active ?? true,
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: RouteFormValues) {
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
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Nom de la ligne <span className="text-error-500">*</span></Label>
        <Input placeholder="Ex. Ligne Nord" value={v.name} onChange={(e) => setValue("name", e.target.value)} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-error-600">{errors.name.message}</p>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Immatriculation</Label>
          <Input placeholder="RC-1234-A" value={v.vehicleRegistration} onChange={(e) => setValue("vehicleRegistration", e.target.value)} />
        </Field>
        <Field>
          <Label>Capacité</Label>
          <Input type="number" min={0} value={v.capacity} onChange={(e) => setValue("capacity", e.target.value === "" ? "" : Number(e.target.value))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Chauffeur</Label>
          <Input value={v.driverName} onChange={(e) => setValue("driverName", e.target.value)} />
        </Field>
        <PhoneInput label="Téléphone chauffeur" value={v.driverPhone} onChange={(val) => setValue("driverPhone", val)} />
      </div>
      <Field>
        <Label>Frais mensuels (GNF)</Label>
        <Input type="number" min={0} value={v.monthlyFee} onChange={(e) => setValue("monthlyFee", e.target.value === "" ? "" : Number(e.target.value))} />
      </Field>
      <Field>
        <Label>Description / itinéraire</Label>
        <Textarea rows={2} value={v.description} onChange={(e) => setValue("description", e.target.value)} />
      </Field>
      <div className="flex items-center gap-3">
        <Switch checked={v.active} onChange={(checked) => setValue("active", checked)} ariaLabel="Ligne active" />
        <span className="text-sm text-gray-700">Ligne active</span>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Enregistrer</Button>
      </div>
    </form>
  );
}

const stopSchema = z.object({
  name: z.string().trim().min(1, "Requis"),
  pickupTime: z.string(),
  dropTime: z.string(),
  sequence: z.union([z.number(), z.literal("")]),
});
type StopFormValues = z.infer<typeof stopSchema>;

function StopsPanel({ route }: { route: TransportRoute }) {
  const q = useQuery(() => listStops(route.id), [route.id]);
  const { handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<StopFormValues>({
    resolver: zodResolver(stopSchema),
    defaultValues: { name: "", pickupTime: "", dropTime: "", sequence: 10 },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();
  const [adding, setAdding] = useState(false);
  async function add(values: StopFormValues) {
    setAdding(true);
    try {
      await addStop(route.id, { name: values.name, pickupTime: values.pickupTime || null, dropTime: values.dropTime || null, sequence: values.sequence === "" ? 10 : Number(values.sequence) });
      reset();
      q.refetch();
    } catch (err) { notifyError(err); } finally { setAdding(false); }
  }
  return (
    <div className="space-y-4">
      {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Arrêt</TH><TH>Ramassage</TH><TH>Dépose</TH><TH /></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-gray-400">Aucun arrêt.</TD></TR>}
            {(q.data ?? []).map((s) => (
              <TR key={s.id}>
                <TD className="font-medium">{s.name}</TD>
                <TD>{s.pickupTime ?? "—"}</TD>
                <TD>{s.dropTime ?? "—"}</TD>
                <TD className="text-right"><Button size="sm" variant="ghost" className="text-error-600" onClick={() => deleteStop(s.id).then(() => q.refetch()).catch(notifyError)}>Suppr.</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <form onSubmit={handleSubmit(add)} className="rounded-xl border border-gray-200 p-3">
        <p className="mb-2 text-sm font-semibold text-gray-700">Ajouter un arrêt</p>
        <div className="space-y-3">
          <Field>
            <Label>Nom <span className="text-error-500">*</span></Label>
            <Input value={v.name} onChange={(e) => setValue("name", e.target.value)} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-error-600">{errors.name.message}</p>}
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field>
              <Label>Ramassage</Label>
              <Input type="time" value={v.pickupTime} onChange={(e) => setValue("pickupTime", e.target.value)} />
            </Field>
            <Field>
              <Label>Dépose</Label>
              <Input type="time" value={v.dropTime} onChange={(e) => setValue("dropTime", e.target.value)} />
            </Field>
            <Field>
              <Label>Ordre</Label>
              <Input type="number" min={0} value={v.sequence} onChange={(e) => setValue("sequence", e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
          </div>
          <div className="flex justify-end"><Button type="submit" size="sm" loading={adding}>Ajouter</Button></div>
        </div>
      </form>
    </div>
  );
}
