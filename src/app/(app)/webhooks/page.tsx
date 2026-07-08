"use client";

import { useState } from "react";
import { MultiSelect, Stack, Switch, Tabs, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { History, Plus, Webhook } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
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
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<WebhookDeliveryStatus, "amber" | "green" | "red"> = { PENDING: "amber", SENT: "green", FAILED: "red" };

export default function WebhooksPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const allowed = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  if (!tenantId || !allowed) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé aux administrateurs de l&apos;établissement.</div>;
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Webhooks</h1>
        <p className="text-sm text-slate-500">Notifiez des systèmes tiers des événements de l&apos;école</p>
      </Reveal>
      <Tabs defaultValue="endpoints" color="teal" variant="pills" radius="md">
        <Tabs.List>
          <Tabs.Tab value="endpoints" leftSection={<Webhook className="h-4 w-4" />}>Endpoints</Tabs.Tab>
          <Tabs.Tab value="events" leftSection={<History className="h-4 w-4" />}>Journal d&apos;événements</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="endpoints" pt="lg"><EndpointsTab tenantId={tenantId} /></Tabs.Panel>
        <Tabs.Panel value="events" pt="lg"><EventsTab tenantId={tenantId} /></Tabs.Panel>
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
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-slate-400">Aucun endpoint.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="max-w-[280px] truncate font-mono text-xs text-slate-700">{e.url}</TD>
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
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(e)}>Suppr.</Button>
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

function EndpointForm({ tenantId, initial, onCancel, onSaved }: {
  tenantId: number; initial: WebhookEndpoint | null; onCancel: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      url: initial?.url ?? "",
      secret: initial?.secret ?? "",
      events: (initial?.events ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      active: initial?.active ?? true,
    },
    validate: {
      url: (v) => (/^https?:\/\/.+/.test(v) ? null : "URL invalide"),
      events: (v) => (v.length > 0 ? null : "Sélectionnez au moins un événement"),
    },
  });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const events = values.events.join(",");
      if (initial) await updateEndpoint(initial.id, { url: values.url, secret: values.secret, events, active: values.active });
      else await createEndpoint({ tenantId, url: values.url, secret: values.secret, events });
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="URL" placeholder="https://exemple.com/webhook" withAsterisk {...form.getInputProps("url")} />
        <TextInput label="Secret (signature HMAC)" {...form.getInputProps("secret")} />
        <MultiSelect label="Événements souscrits" withAsterisk
          data={(Object.keys(WEBHOOK_EVENT_TYPE_LABEL) as WebhookEventType[]).map((t) => ({ value: t, label: WEBHOOK_EVENT_TYPE_LABEL[t] }))}
          {...form.getInputProps("events")} />
        {initial && <Switch label="Actif" color="teal" checked={form.values.active} onChange={(e) => form.setFieldValue("active", e.currentTarget.checked)} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Enregistrer</Button>
        </div>
      </Stack>
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
            {(q.data ?? []).length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-slate-400">Aucun événement.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="text-slate-500">{e.createdAt?.slice(0, 16).replace("T", " ") ?? "—"}</TD>
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
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Type</span><div className="font-medium text-slate-900">{WEBHOOK_EVENT_TYPE_LABEL[detail.eventType] ?? detail.eventType}</div></div>
              <div><span className="text-slate-500">Statut</span><div><Badge tone={STATUS_TONE[detail.status]}>{WEBHOOK_STATUS_LABEL[detail.status]}</Badge></div></div>
              <div><span className="text-slate-500">Tentatives</span><div className="font-medium text-slate-900">{detail.attemptCount ?? 0}</div></div>
              <div><span className="text-slate-500">Prochaine tentative</span><div className="font-medium text-slate-900">{detail.nextAttemptAt?.slice(0, 16).replace("T", " ") ?? "—"}</div></div>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">Payload</p>
              <pre className="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{detail.payload ?? "—"}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
