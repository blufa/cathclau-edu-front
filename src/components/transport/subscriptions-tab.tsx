"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { searchStudents } from "@/lib/api/students";
import { cancelSubscription, deleteSubscription, listRoutes, listStops, listSubscriptions, subscribe } from "@/lib/api/transport";
import { DIRECTION_LABEL, SUB_STATUS_LABEL, type TransportDirection, type TransportRoute } from "@/lib/types/transport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

export function SubscriptionsTab() {
  const routesQuery = useQuery(listRoutes, []);
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);
  const studentName = useMemo(() => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])), [studentsQuery.data]);
  const routeName = useMemo(() => new Map((routesQuery.data ?? []).map((r) => [r.id, r.name])), [routesQuery.data]);
  const [routeFilter, setRouteFilter] = useState<string | null>(null);
  const q = useQuery(() => listSubscriptions({ routeId: routeFilter ? Number(routeFilter) : undefined }), [routeFilter]);
  const [subscribing, setSubscribing] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-[240px]" placeholder="Toutes les lignes" clearable
          data={(routesQuery.data ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
          value={routeFilter} onChange={setRouteFilter} />
        <Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setSubscribing(true)}>Abonner un élève</Button>
      </div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Élève</TH><TH>Ligne</TH><TH>Sens</TH><TH>Frais/mois</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-slate-400">Aucun abonnement.</TD></TR>}
            {(q.data ?? []).map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-slate-900">{studentName.get(s.studentId) ?? `#${s.studentId}`}</TD>
                <TD>{routeName.get(s.routeId) ?? `#${s.routeId}`}</TD>
                <TD>{DIRECTION_LABEL[s.direction]}</TD>
                <TD>{s.monthlyFee != null ? formatGNF(s.monthlyFee) : "—"}</TD>
                <TD><Badge tone={s.status === "ACTIVE" ? "green" : "gray"}>{SUB_STATUS_LABEL[s.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {s.status === "ACTIVE" && <Button size="sm" variant="ghost" onClick={() => cancelSubscription(s.id).then(() => { notifySuccess("Résilié"); q.refetch(); }).catch(notifyError)}>Résilier</Button>}
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteSubscription(s.id).then(() => q.refetch()).catch(notifyError)}>Suppr.</Button>
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

function SubscribeForm({ routes, students, onCancel, onDone }: {
  routes: TransportRoute[];
  students: { id: number; firstName: string; lastName: string; studentNumber: string }[];
  onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: { routeId: "", stopId: "", studentId: "", direction: "BOTH" as TransportDirection, monthlyFee: "" as number | string },
    validate: { routeId: (v) => (v ? null : "Requis"), studentId: (v) => (v ? null : "Requis") },
  });
  const stopsQuery = useQuery(() => (form.values.routeId ? listStops(Number(form.values.routeId)) : Promise.resolve([])), [form.values.routeId]);

  function onRoute(value: string | null) {
    form.setFieldValue("routeId", value ?? "");
    form.setFieldValue("stopId", "");
    const r = routes.find((x) => String(x.id) === value);
    if (r?.monthlyFee != null) form.setFieldValue("monthlyFee", r.monthlyFee);
  }

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      await subscribe({
        routeId: Number(values.routeId), stopId: values.stopId ? Number(values.stopId) : null,
        studentId: Number(values.studentId), direction: values.direction,
        monthlyFee: values.monthlyFee === "" ? null : Number(values.monthlyFee),
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <Select label="Ligne" withAsterisk data={routes.map((r) => ({ value: String(r.id), label: r.name }))} value={form.values.routeId || null} onChange={onRoute} />
        <Select label="Arrêt" clearable placeholder="Optionnel" data={(stopsQuery.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
          value={form.values.stopId || null} onChange={(v) => form.setFieldValue("stopId", v ?? "")} />
        <Select label="Élève" withAsterisk searchable data={students.map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.studentNumber})` }))} {...form.getInputProps("studentId")} />
        <Select label="Sens" allowDeselect={false} data={(Object.keys(DIRECTION_LABEL) as TransportDirection[]).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))} {...form.getInputProps("direction")} />
        <NumberInput label="Frais mensuels (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("monthlyFee")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Abonner</Button>
        </div>
      </Stack>
    </form>
  );
}
