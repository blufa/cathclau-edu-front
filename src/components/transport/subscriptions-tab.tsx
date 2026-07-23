"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { searchStudents } from "@/lib/api/students";
import { cancelSubscription, deleteSubscription, listRoutes, listStops, listSubscriptions, subscribe } from "@/lib/api/transport";
import { DIRECTION_LABEL, SUB_STATUS_LABEL, type TransportDirection, type TransportRoute } from "@/lib/types/transport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

export function SubscriptionsTab() {
  const routesQuery = useQuery(listRoutes, []);
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);
  const studentName = useMemo(() => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])), [studentsQuery.data]);
  const routeName = useMemo(() => new Map((routesQuery.data ?? []).map((r) => [r.id, r.name])), [routesQuery.data]);
  const [routeFilter, setRouteFilter] = useState<string>("");
  const q = useQuery(() => listSubscriptions({ routeId: routeFilter ? Number(routeFilter) : undefined }), [routeFilter]);
  const [subscribing, setSubscribing] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-[240px]" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
          <option value="">Toutes les lignes</option>
          {(routesQuery.data ?? []).map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
        </Select>
        <Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setSubscribing(true)}>Abonner un élève</Button>
      </div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Élève</TH><TH>Ligne</TH><TH>Sens</TH><TH>Frais/mois</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-gray-400">Aucun abonnement.</TD></TR>}
            {(q.data ?? []).map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-gray-900">{studentName.get(s.studentId) ?? `#${s.studentId}`}</TD>
                <TD>{routeName.get(s.routeId) ?? `#${s.routeId}`}</TD>
                <TD>{DIRECTION_LABEL[s.direction]}</TD>
                <TD>{s.monthlyFee != null ? formatGNF(s.monthlyFee) : "—"}</TD>
                <TD><Badge tone={s.status === "ACTIVE" ? "green" : "gray"}>{SUB_STATUS_LABEL[s.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {s.status === "ACTIVE" && <Button size="sm" variant="ghost" onClick={() => cancelSubscription(s.id).then(() => { notifySuccess("Résilié"); q.refetch(); }).catch(notifyError)}>Résilier</Button>}
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => deleteSubscription(s.id).then(() => q.refetch()).catch(notifyError)}>Suppr.</Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Modal open={subscribing} onClose={() => setSubscribing(false)} title="Abonner un élève au transport">
        <SubscribeForm routes={routesQuery.data ?? []} students={studentsQuery.data ?? []}
          onCancel={() => setSubscribing(false)} onDone={() => { setSubscribing(false); notifySuccess("Abonné"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

const subscribeSchema = z.object({
  routeId: z.string().min(1, "Requis"),
  stopId: z.string(),
  studentId: z.string().min(1, "Requis"),
  direction: z.string(),
  monthlyFee: z.union([z.number(), z.literal("")]),
});
type SubscribeFormValues = z.infer<typeof subscribeSchema>;

function SubscribeForm({ routes, students, onCancel, onDone }: {
  routes: TransportRoute[];
  students: { id: number; firstName: string; lastName: string; studentNumber: string }[];
  onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<SubscribeFormValues>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: { routeId: "", stopId: "", studentId: "", direction: "BOTH", monthlyFee: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();
  const stopsQuery = useQuery(() => (v.routeId ? listStops(Number(v.routeId)) : Promise.resolve([])), [v.routeId]);

  function onRoute(value: string) {
    setValue("routeId", value);
    setValue("stopId", "");
    const r = routes.find((x) => String(x.id) === value);
    if (r?.monthlyFee != null) setValue("monthlyFee", Number(r.monthlyFee));
  }

  const studentOptions: SearchableOption[] = useMemo(
    () => students.map((s) => {
      const label = `${s.firstName} ${s.lastName} (${s.studentNumber})`;
      return { value: String(s.id), trigger: label, label, searchText: label };
    }),
    [students],
  );

  async function submit(values: SubscribeFormValues) {
    setLoading(true);
    try {
      await subscribe({
        routeId: Number(values.routeId), stopId: values.stopId ? Number(values.stopId) : null,
        studentId: Number(values.studentId), direction: values.direction as TransportDirection,
        monthlyFee: values.monthlyFee === "" ? null : Number(values.monthlyFee),
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Ligne <span className="text-error-500">*</span></Label>
        <Select value={v.routeId} onChange={(e) => onRoute(e.target.value)}>
          <option value="">— Choisir —</option>
          {routes.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
        </Select>
        {errors.routeId && <p className="text-xs text-error-600">{errors.routeId.message}</p>}
      </Field>
      <Field>
        <Label>Arrêt (optionnel)</Label>
        <Select value={v.stopId} onChange={(e) => setValue("stopId", e.target.value)}>
          <option value="">— Aucun —</option>
          {(stopsQuery.data ?? []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
      </Field>
      <Field>
        <Label>Élève <span className="text-error-500">*</span></Label>
        <SearchableSelect value={v.studentId} options={studentOptions} onChange={(val) => setValue("studentId", val)} triggerClassName="w-full justify-between px-3" />
        {errors.studentId && <p className="text-xs text-error-600">{errors.studentId.message}</p>}
      </Field>
      <Field>
        <Label>Sens</Label>
        <Select value={v.direction} onChange={(e) => setValue("direction", e.target.value)}>
          {(Object.keys(DIRECTION_LABEL) as TransportDirection[]).map((d) => (<option key={d} value={d}>{DIRECTION_LABEL[d]}</option>))}
        </Select>
      </Field>
      <Field>
        <Label>Frais mensuels (GNF)</Label>
        <Input type="number" min={0} value={v.monthlyFee} onChange={(e) => setValue("monthlyFee", e.target.value === "" ? "" : Number(e.target.value))} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Abonner</Button>
      </div>
    </form>
  );
}
