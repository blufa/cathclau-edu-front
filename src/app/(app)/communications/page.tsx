"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listUsers } from "@/lib/api/iam";
import {
  deleteCommunication,
  getCommunicationRecipients,
  listCommunicationsByTenant,
  listTemplates,
  markRecipientDelivered,
  markRecipientFailed,
  markRecipientRead,
  sendCommunication,
} from "@/lib/api/communication";
import {
  CHANNEL_LABEL,
  DELIVERY_STATUS_LABEL,
  REASON_LABEL,
  RECIPIENT_TYPE_LABEL,
  type Communication,
  type CommunicationChannel,
  type CommunicationReason,
  type DeliveryStatus,
  type RecipientType,
} from "@/lib/types/communication";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const DELIVERY_TONE: Record<DeliveryStatus, "amber" | "green" | "red"> = { PENDING: "amber", DELIVERED: "green", FAILED: "red" };

export default function CommunicationsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canSend = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER");

  const [channel, setChannel] = useState<CommunicationChannel | "">("");
  const q = useQuery(() => (tenantId ? listCommunicationsByTenant(tenantId) : Promise.resolve([])), [tenantId]);
  const [composing, setComposing] = useState(false);
  const [detail, setDetail] = useState<Communication | null>(null);

  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  const rows = (q.data ?? []).filter((c) => !channel || c.channel === channel);

  function remove(c: Communication) {
    confirmAction({ title: "Supprimer le message", message: "Supprimer cette communication ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteCommunication(c.id); notifySuccess("Supprimé"); q.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Communication</h1>
          <p className="text-sm text-gray-500">SMS, e-mail et WhatsApp aux familles et au personnel</p>
        </div>
        {canSend && <Button onClick={() => setComposing(true)} leftSection={<Send className="h-4 w-4" />}>Nouveau message</Button>}
      </Reveal>

      <Select className="max-w-[180px]" value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel | "")}>
        <option value="">Tous les canaux</option>
        {(Object.keys(CHANNEL_LABEL) as CommunicationChannel[]).map((c) => (<option key={c} value={c}>{CHANNEL_LABEL[c]}</option>))}
      </Select>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Date</TH><TH>Canal</TH><TH>Motif</TH><TH>Destinataires</TH><TH>Sujet</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-gray-400">Aucun message.</TD></TR>}
            {rows.map((c) => (
              <TR key={c.id}>
                <TD className="text-gray-500">{c.sentAt?.slice(0, 16).replace("T", " ") ?? "—"}</TD>
                <TD><Badge tone="indigo">{CHANNEL_LABEL[c.channel]}</Badge></TD>
                <TD>{REASON_LABEL[c.reason]}</TD>
                <TD>{RECIPIENT_TYPE_LABEL[c.recipientType]}</TD>
                <TD className="text-gray-700">{c.subject ?? "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(c)}>Détail</Button>
                    {canSend && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(c)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={composing} onClose={() => setComposing(false)} title="Nouveau message">
        <ComposeForm tenantId={tenantId} senderId={user?.userId ?? null}
          onCancel={() => setComposing(false)} onSent={() => { setComposing(false); notifySuccess("Message envoyé"); q.refetch(); }} />
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Détail de livraison">
        {detail && <DeliveryDetail communication={detail} canManage={canSend} />}
      </Modal>
    </div>
  );
}

function ComposeForm({ tenantId, senderId, onCancel, onSent }: {
  tenantId: number; senderId: number | null; onCancel: () => void; onSent: () => void;
}) {
  const usersQuery = useQuery(() => listUsers(0, 300).then((p) => p.content), []);
  const templatesQuery = useQuery(() => listTemplates(tenantId), []);
  const [loading, setLoading] = useState(false);

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const [channel, setChannel] = useState<CommunicationChannel>("SMS");
  const [recipientType, setRecipientType] = useState<RecipientType>("PARENT");
  const [reason, setReason] = useState<CommunicationReason>("GENERAL");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);

  function toggleRecipient(id: string) {
    setRecipientIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applyTemplate(id: string) {
    const t = (templatesQuery.data ?? []).find((x) => String(x.id) === id);
    if (!t) return;
    setChannel(t.channel); setReason(t.reason); setSubject(t.subject ?? ""); setContent(t.body);
  }

  async function submit() {
    if (!content.trim()) { notifyError("Message requis"); return; }
    if (recipientIds.length === 0) { notifyError("Sélectionnez au moins un destinataire"); return; }
    setLoading(true);
    try {
      await sendCommunication({
        tenantId, senderId, channel, recipientType,
        subject: subject || null, content, reason,
        recipientUserIds: recipientIds.map(Number),
      });
      onSent();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {(templatesQuery.data ?? []).length > 0 && (
        <Field>
          <Label>Modèle (optionnel)</Label>
          <Select onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— Aucun —</option>
            {(templatesQuery.data ?? []).map((t) => (<option key={t.id} value={t.id}>{REASON_LABEL[t.reason]} · {CHANNEL_LABEL[t.channel]}</option>))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Field>
          <Label>Canal</Label>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel)}>
            {(Object.keys(CHANNEL_LABEL) as CommunicationChannel[]).map((c) => (<option key={c} value={c}>{CHANNEL_LABEL[c]}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Type</Label>
          <Select value={recipientType} onChange={(e) => setRecipientType(e.target.value as RecipientType)}>
            {(Object.keys(RECIPIENT_TYPE_LABEL) as RecipientType[]).map((c) => (<option key={c} value={c}>{RECIPIENT_TYPE_LABEL[c]}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Motif</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value as CommunicationReason)}>
            {(Object.keys(REASON_LABEL) as CommunicationReason[]).map((c) => (<option key={c} value={c}>{REASON_LABEL[c]}</option>))}
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Destinataires <span className="text-error-500">*</span></Label>
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {users.length === 0 && <p className="px-1 py-2 text-sm text-gray-400">Aucun utilisateur.</p>}
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={recipientIds.includes(String(u.id))} onChange={() => toggleRecipient(String(u.id))}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
              {u.firstName} {u.lastName} ({u.email})
            </label>
          ))}
        </div>
      </Field>
      <Field><Label>Sujet</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field>
        <Label>Message <span className="text-error-500">*</span></Label>
        <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Envoyer</Button>
      </div>
    </div>
  );
}

function DeliveryDetail({ communication, canManage }: { communication: Communication; canManage: boolean }) {
  const q = useQuery(() => getCommunicationRecipients(communication.id), [communication.id]);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function act(id: number, fn: (id: number) => Promise<unknown>, label: string) {
    setBusyId(id);
    try { await fn(id); notifySuccess(label); q.refetch(); }
    catch (err) { notifyError(err); } finally { setBusyId(null); }
  }

  if (q.loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const recipients = q.data ?? [];
  const delivered = recipients.filter((r) => r.deliveryStatus === "DELIVERED").length;
  const readCount = recipients.filter((r) => r.read).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{communication.content}</p>
      {recipients.length > 0 && (
        <p className="text-xs text-gray-400">{recipients.length} destinataire(s) — {delivered} livré(s), {readCount} lu(s)</p>
      )}
      <Table>
        <THead><tr><TH>Destinataire</TH><TH>Statut</TH><TH>Lu</TH>{canManage && <TH className="text-right">Marquer</TH>}</tr></THead>
        <TBody>
          {recipients.length === 0 && <TR><TD colSpan={canManage ? 4 : 3} className="py-6 text-center text-gray-400">Aucun destinataire.</TD></TR>}
          {recipients.map((r) => (
            <TR key={r.id}>
              <TD>{r.destination ?? "—"}</TD>
              <TD><Badge tone={DELIVERY_TONE[r.deliveryStatus]}>{DELIVERY_STATUS_LABEL[r.deliveryStatus]}</Badge></TD>
              <TD>{r.read ? "Oui" : "Non"}</TD>
              {canManage && (
                <TD className="text-right">
                  <div className="inline-flex gap-1">
                    {r.deliveryStatus === "PENDING" && (
                      <>
                        <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => act(r.id, markRecipientDelivered, "Marqué comme livré")}>Livré</Button>
                        <Button size="sm" variant="ghost" className="text-error-600" loading={busyId === r.id} onClick={() => act(r.id, markRecipientFailed, "Marqué en échec")}>Échec</Button>
                      </>
                    )}
                    {!r.read && (
                      <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => act(r.id, markRecipientRead, "Marqué comme lu")}>Lu</Button>
                    )}
                  </div>
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
