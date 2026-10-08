"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { searchStudents } from "@/lib/api/students";
import { cancelSubscription, deleteSubscription, getTransportPaidMonthsCount, listRoutes, listStops, listSubscriptions, subscribe } from "@/lib/api/transport";
import { DIRECTION_LABEL, SUB_STATUS_LABEL, type TransportDirection, type TransportRoute, type TransportSubscription } from "@/lib/types/transport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { notifyError, notifySuccess } from "@/lib/feedback";

export function SubscriptionsTab() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const routesQuery = useQuery(listRoutes, []);
  const studentsQuery = useCachedQuery(tenantId ? `students-all-v2:${tenantId}` : null, () => searchStudents({ size: 1000 }).then((p) => p.content), [tenantId]);
  const studentName = useMemo(() => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])), [studentsQuery.data]);
  const routeName = useMemo(() => new Map((routesQuery.data ?? []).map((r) => [r.id, r.name])), [routesQuery.data]);
  const [routeFilter, setRouteFilter] = useState<string>("");
  const q = useQuery(() => listSubscriptions({ routeId: routeFilter ? Number(routeFilter) : undefined }), [routeFilter]);
  // Un élève archivé (parti) n'a plus d'abonnement transport à gérer activement (§retour comptable).
  const subscriptions = (q.data ?? []).filter((s) => studentName.has(s.studentId));
  const [subscribing, setSubscribing] = useState(false);

  // Nombre de mois réellement réglés par élève (§retour comptable : "trier par transport", précisé
  // en "le nombre de mois payé") — colonne triable via DataTable, remplace la liste simple d'avant.
  const paidMonthsQuery = useCachedQuery("transport-paid-months-count", () => getTransportPaidMonthsCount(), []);
  const paidMonthsByStudentId = useMemo(
    () => new Map(Object.entries(paidMonthsQuery.data ?? {}).map(([id, count]) => [Number(id), count])),
    [paidMonthsQuery.data],
  );

  const columns: Column<TransportSubscription>[] = [
    {
      key: "student", header: "Élève", sortable: true,
      accessor: (s) => studentName.get(s.studentId) ?? "",
      render: (s) => <span className="font-medium text-gray-900">{studentName.get(s.studentId)}</span>,
    },
    {
      key: "route", header: "Ligne", sortable: true,
      accessor: (s) => routeName.get(s.routeId) ?? "",
      render: (s) => routeName.get(s.routeId) ?? `#${s.routeId}`,
    },
    { key: "direction", header: "Sens", render: (s) => DIRECTION_LABEL[s.direction] },
    {
      key: "status", header: "Statut", sortable: true,
      accessor: (s) => SUB_STATUS_LABEL[s.status],
      render: (s) => <Badge tone={s.status === "ACTIVE" ? "green" : "gray"}>{SUB_STATUS_LABEL[s.status]}</Badge>,
    },
    {
      key: "paidMonths", header: "Mois payés", sortable: true,
      accessor: (s) => paidMonthsByStudentId.get(s.studentId) ?? 0,
      render: (s) => {
        const months = paidMonthsByStudentId.get(s.studentId) ?? 0;
        return <Badge tone={months > 0 ? "blue" : "amber"}>{months} mois</Badge>;
      },
    },
    {
      key: "actions", header: "Actions", align: "right",
      render: (s) => (
        <div className="flex justify-end gap-1">
          {s.status === "ACTIVE" && <Button size="sm" variant="ghost" onClick={() => cancelSubscription(s.id).then(() => { notifySuccess("Résilié"); q.refetch(); }).catch(notifyError)}>Résilier</Button>}
          <Button size="sm" variant="ghost" className="text-error-600" onClick={() => deleteSubscription(s.id).then(() => q.refetch()).catch(notifyError)}>Suppr.</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchableSelect
          triggerClassName="max-w-[240px] justify-between px-3"
          value={routeFilter}
          onChange={setRouteFilter}
          options={[
            { value: "", trigger: "Toutes les lignes", label: "Toutes les lignes", searchText: "" },
            ...(routesQuery.data ?? []).map((r): SearchableOption => ({ value: String(r.id), trigger: r.name, label: r.name, searchText: r.name })),
          ]}
        />
        <Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setSubscribing(true)}>Abonner un élève</Button>
      </div>
      <DataTable
        columns={columns}
        rows={subscriptions}
        loading={q.loading}
        getRowKey={(s) => s.id}
        emptyLabel="Aucun abonnement."
        searchable
        searchPlaceholder="Rechercher un élève (nom, prénom)…"
      />
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
    defaultValues: { routeId: "", stopId: "", studentId: "", direction: "BOTH" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();
  const stopsQuery = useQuery(() => (v.routeId ? listStops(Number(v.routeId)) : Promise.resolve([])), [v.routeId]);

  function onRoute(value: string) {
    setValue("routeId", value);
    setValue("stopId", "");
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
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Ligne <span className="text-error-500">*</span></Label>
        <SearchableSelect
          value={v.routeId}
          onChange={onRoute}
          triggerClassName="w-full justify-between px-3"
          options={[
            { value: "", trigger: "— Choisir —", label: "— Choisir —", searchText: "" },
            ...routes.map((r): SearchableOption => ({ value: String(r.id), trigger: r.name, label: r.name, searchText: r.name })),
          ]}
        />
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
      <p className="rounded-lg bg-brand-50/60 px-3 py-2 text-xs text-brand-800">
        La facturation transport se génère automatiquement depuis le frais Transport de la classe de
        l&apos;élève (configuré dans Frais scolaires) — aucun montant à saisir ici.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Abonner</Button>
      </div>
    </form>
  );
}
