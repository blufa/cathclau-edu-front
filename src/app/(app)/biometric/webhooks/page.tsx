"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { History, Plus, Webhook } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  activateEndpoint,
  createEndpoint,
  deactivateEndpoint,
  deleteEndpoint,
  listEndpointsByTenant,
  listEvents,
  replayEvent,
  updateEndpoint,
} from "@/lib/api/webhook";
import {
  WEBHOOK_EVENT_TYPE_LABEL,
  WEBHOOK_STATUS_LABEL,
  type WebhookDeliveryStatus,
  type WebhookEndpoint,
  type WebhookEvent,
  type WebhookEventType,
} from "@/lib/types/webhook";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Field, Input, Label } from "@/components/ui/input";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<WebhookDeliveryStatus, "amber" | "green" | "red"> = { PENDING: "amber", SENT: "green", FAILED: "red" };

export default function WebhooksPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const allowed = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["webhook:manage"]);

  if (!tenantId || !allowed) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux administrateurs de l&apos;établissement.</div>;
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Webhooks</h1>
        <p className="text-sm text-gray-500">Notifiez des systèmes tiers des événements de l&apos;école</p>
      </Reveal>
      <Tabs defaultValue="endpoints">
        <TabsList>
          <TabsTrigger value="endpoints" icon={Webhook}>Endpoints</TabsTrigger>
          <TabsTrigger value="events" icon={History}>Journal d&apos;événements</TabsTrigger>
        </TabsList>
        <TabsPanel value="endpoints"><EndpointsTab tenantId={tenantId} /></TabsPanel>
        <TabsPanel value="events"><EventsTab tenantId={tenantId} /></TabsPanel>
      </Tabs>
    </div>
  );
}

function EndpointsTab({ tenantId }: { tenantId: number }) {
  const q = useQuery(() => listEndpointsByTenant(tenantId), [tenantId]);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggle(e: WebhookEndpoint) {
    try { await (e.active ? deactivateEndpoint(e.id) : activateEndpoint(e.id)); notifySuccess("Statut mis à jour"); q.refetch(); }
    catch (err) { notifyError(err); }
  }
  function remove(e: WebhookEndpoint) {
    confirmAction({ title: "Supprimer l'endpoint", message: e.url, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteEndpoint(e.id); notifySuccess("Supprimé"); q.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvel endpoint</Button></div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>URL</TH><TH>Événements</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-gray-400">Aucun endpoint.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="max-w-[280px] truncate font-mono text-xs text-gray-700">{e.url}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {(e.events ?? "").split(",").filter(Boolean).map((ev) => (
                      <Badge key={ev} tone="indigo">{WEBHOOK_EVENT_TYPE_LABEL[ev.trim() as WebhookEventType] ?? ev}</Badge>
                    ))}
                  </div>
                </TD>
                <TD><Badge tone={e.active ? "green" : "gray"}>{e.active ? "Actif" : "Inactif"}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle(e)}>{e.active ? "Désactiver" : "Activer"}</Button>
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(e)}>Suppr.</Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier l'endpoint" : "Nouvel endpoint"}>
        <EndpointForm tenantId={tenantId} initial={editing}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); notifySuccess("Endpoint enregistré"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

const schema = z.object({
  url: z.string().trim().regex(/^https?:\/\/.+/, "URL invalide"),
  secret: z.string(),
  events: z.array(z.string()).min(1, "Sélectionnez au moins un événement"),
  active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function EndpointForm({ tenantId, initial, onCancel, onSaved }: {
  tenantId: number; initial: WebhookEndpoint | null; onCancel: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      url: initial?.url ?? "",
      secret: initial?.secret ?? "",
      events: (initial?.events ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      active: initial?.active ?? true,
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  function toggleEvent(t: string) {
    setValue("events", v.events.includes(t) ? v.events.filter((e) => e !== t) : [...v.events, t]);
  }

  async function submit(values: FormValues) {
    setLoading(true);
    try {
      const events = values.events.join(",");
      if (initial) await updateEndpoint(initial.id, { url: values.url, secret: values.secret, events, active: values.active });
      else await createEndpoint({ tenantId, url: values.url, secret: values.secret, events });
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>URL <span className="text-error-500">*</span></Label>
        <Input placeholder="https://exemple.com/webhook" value={v.url} onChange={(e) => setValue("url", e.target.value)} aria-invalid={!!errors.url} />
        {errors.url && <p className="text-xs text-error-600">{errors.url.message}</p>}
      </Field>
      <Field>
        <Label>Secret (signature HMAC)</Label>
        <Input value={v.secret} onChange={(e) => setValue("secret", e.target.value)} />
      </Field>
      <Field>
        <Label>Événements souscrits <span className="text-error-500">*</span></Label>
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {(Object.keys(WEBHOOK_EVENT_TYPE_LABEL) as WebhookEventType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={v.events.includes(t)} onChange={() => toggleEvent(t)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
              {WEBHOOK_EVENT_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
        {errors.events && <p className="text-xs text-error-600">{errors.events.message}</p>}
      </Field>
      {initial && (
        <div className="flex items-center gap-3">
          <Switch checked={v.active} onChange={(checked) => setValue("active", checked)} ariaLabel="Actif" />
          <span className="text-sm text-gray-700">Actif</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Enregistrer</Button>
      </div>
    </form>
  );
}

function EventsTab({ tenantId }: { tenantId: number }) {
  const endpointsQuery = useQuery(() => listEndpointsByTenant(tenantId), [tenantId]);
  const [status, setStatus] = useState<WebhookDeliveryStatus | "">("");
  const [endpointId, setEndpointId] = useState<string>("");
  const q = useQuery(
    () => listEvents({ status: status || undefined, endpointId: endpointId ? Number(endpointId) : undefined }),
    [status, endpointId],
  );
  const [detail, setDetail] = useState<WebhookEvent | null>(null);

  async function replay(e: WebhookEvent) {
    try { await replayEvent(e.id); notifySuccess("Événement reprogrammé"); q.refetch(); } catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select className="max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value as WebhookDeliveryStatus | "")}>
          <option value="">Tous les statuts</option>
          {(Object.keys(WEBHOOK_STATUS_LABEL) as WebhookDeliveryStatus[]).map((s) => (<option key={s} value={s}>{WEBHOOK_STATUS_LABEL[s]}</option>))}
        </Select>
        <Select className="max-w-[280px]" value={endpointId} onChange={(e) => setEndpointId(e.target.value)}>
          <option value="">Tous les endpoints</option>
          {(endpointsQuery.data ?? []).map((e) => (<option key={e.id} value={e.id}>{e.url}</option>))}
        </Select>
      </div>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Date</TH><TH>Type</TH><TH>Statut</TH><TH>Tentatives</TH><TH>Code</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-gray-400">Aucun événement.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="text-gray-500">{e.createdAt?.slice(0, 16).replace("T", " ") ?? "—"}</TD>
                <TD>{WEBHOOK_EVENT_TYPE_LABEL[e.eventType] ?? e.eventType}</TD>
                <TD><Badge tone={STATUS_TONE[e.status]}>{WEBHOOK_STATUS_LABEL[e.status]}</Badge></TD>
                <TD>{e.attemptCount ?? 0}</TD>
                <TD>{e.responseCode ?? "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(e)}>Détail</Button>
                    {e.status !== "SENT" && <Button size="sm" variant="ghost" onClick={() => replay(e)}>Rejouer</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Détail de l'événement">
        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Type</span><div className="font-medium text-gray-900">{WEBHOOK_EVENT_TYPE_LABEL[detail.eventType] ?? detail.eventType}</div></div>
              <div><span className="text-gray-500">Statut</span><div><Badge tone={STATUS_TONE[detail.status]}>{WEBHOOK_STATUS_LABEL[detail.status]}</Badge></div></div>
              <div><span className="text-gray-500">Tentatives</span><div className="font-medium text-gray-900">{detail.attemptCount ?? 0}</div></div>
              <div><span className="text-gray-500">Prochaine tentative</span><div className="font-medium text-gray-900">{detail.nextAttemptAt?.slice(0, 16).replace("T", " ") ?? "—"}</div></div>
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-500">Payload</p>
              <pre className="max-h-72 overflow-auto rounded-xl bg-gray-900 p-3 text-xs text-gray-100">{detail.payload ?? "—"}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
