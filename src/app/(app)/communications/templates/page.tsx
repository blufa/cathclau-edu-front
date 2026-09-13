"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "@/lib/api/communication";
import {
  CHANNEL_LABEL,
  REASON_LABEL,
  type CommunicationChannel,
  type CommunicationReason,
  type MessageTemplate,
} from "@/lib/types/communication";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { smsSegmentInfo } from "@/lib/format";

// Variables réellement substituées à l'envoi, par motif (voir CommunicationEventListener côté
// backend) — {{ecole}} est toujours disponible, quel que soit le motif.
const VARIABLES_BY_REASON: Record<CommunicationReason, string[]> = {
  ABSENCE: ["{{nom_eleve}}", "{{classe}}", "{{date}}", "{{ecole}}"],
  LATE: ["{{nom_eleve}}", "{{classe}}", "{{date}}", "{{ecole}}"],
  RESULT: ["{{nom_eleve}}", "{{periode}}", "{{ecole}}"],
  PAYMENT_DUE: ["{{montant}}", "{{date}}", "{{reference}}", "{{ecole}}"],
  GENERAL: ["{{nom_eleve}}", "{{montant}}", "{{canal}}", "{{reference}}", "{{reste_a_payer}}", "{{ecole}}"],
  EXAM: ["{{classe}}", "{{evaluation}}", "{{date}}", "{{ecole}}"],
  MEETING: ["{{ecole}}"],
  SALARY_PAID: ["{{nom}}", "{{montant}}", "{{periode}}", "{{ecole}}"],
};

export default function TemplatesPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["modele:manage"]);

  const q = useQuery(() => (tenantId ? listTemplates(tenantId) : Promise.resolve([])), [tenantId]);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  function remove(t: MessageTemplate) {
    confirmAction({ title: "Supprimer le modèle", message: "Supprimer ce modèle ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteTemplate(t.id); notifySuccess("Supprimé"); q.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Modèles de message</h1>
          <p className="text-sm text-gray-500">Standardisez vos notifications par motif et canal</p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau modèle</Button>}
      </Reveal>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Motif</TH><TH>Canal</TH><TH>Sujet</TH><TH>Aperçu</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucun modèle.</TD></TR>}
            {(q.data ?? []).map((t) => (
              <TR key={t.id}>
                <TD><Badge tone="indigo">{REASON_LABEL[t.reason]}</Badge></TD>
                <TD>{CHANNEL_LABEL[t.channel]}</TD>
                <TD className="text-gray-700">{t.subject ?? "—"}</TD>
                <TD className="max-w-[280px] truncate text-gray-500">{t.body}</TD>
                <TD className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Modifier</Button>
                      <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(t)}>Suppr.</Button>
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier le modèle" : "Nouveau modèle"}>
        <TemplateForm tenantId={tenantId} initial={editing}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); notifySuccess("Modèle enregistré"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

function TemplateForm({ tenantId, initial, onCancel, onSaved }: {
  tenantId: number; initial: MessageTemplate | null; onCancel: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<CommunicationReason>(initial?.reason ?? "GENERAL");
  const [channel, setChannel] = useState<CommunicationChannel>(initial?.channel ?? "SMS");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  async function submit() {
    if (!body.trim()) { notifyError("Corps requis"); return; }
    setLoading(true);
    try {
      const payload = { tenantId, reason, channel, subject: subject || null, body };
      if (initial) await updateTemplate(initial.id, payload);
      else await createTemplate(payload);
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Motif</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value as CommunicationReason)}>
            {(Object.keys(REASON_LABEL) as CommunicationReason[]).map((r) => (<option key={r} value={r}>{REASON_LABEL[r]}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Canal</Label>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel)}>
            {(Object.keys(CHANNEL_LABEL) as CommunicationChannel[]).map((c) => (<option key={c} value={c}>{CHANNEL_LABEL[c]}</option>))}
          </Select>
        </Field>
      </div>
      <Field><Label>Sujet</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field>
        <Label>Corps du message <span className="text-error-500">*</span></Label>
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {channel === "SMS" && (() => {
        const info = smsSegmentInfo(body);
        return (
          <p className={`text-xs ${info.segments > 1 ? "text-warning-600" : "text-gray-400"}`}>
            {info.length} caractère{info.length > 1 ? "s" : ""} — {info.unicode ? "avec accents (70/SMS)" : "sans accent (160/SMS)"}
            {info.segments > 1 && ` — sera envoyé en ${info.segments} SMS (facturés séparément)`}
          </p>
        );
      })()}
      <div className="flex flex-wrap gap-1.5">
        {VARIABLES_BY_REASON[reason].map((v) => (
          <button key={v} type="button" onClick={() => setBody((b) => `${b}${v}`)}
            className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-600 hover:bg-brand-50 hover:text-brand-700">{v}</button>
        ))}
      </div>
      <p className="text-xs text-gray-400">Variables disponibles pour ce motif — cliquez pour l&apos;insérer.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Enregistrer</Button>
      </div>
    </div>
  );
}
