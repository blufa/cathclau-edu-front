"use client";

import { useState } from "react";
import { Select, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
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
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const VARIABLES = ["{{nom_eleve}}", "{{montant}}", "{{moyenne}}", "{{classe}}", "{{date}}"];

export default function TemplatesPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const q = useQuery(() => (tenantId ? listTemplates(tenantId) : Promise.resolve([])), [tenantId]);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  if (!tenantId) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  function remove(t: MessageTemplate) {
    confirmAction({ title: "Supprimer le modèle", message: "Supprimer ce modèle ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteTemplate(t.id); notifySuccess("Supprimé"); q.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Modèles de message</h1>
          <p className="text-sm text-slate-500">Standardisez vos notifications par motif et canal</p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau modèle</Button>}
      </Reveal>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Motif</TH><TH>Canal</TH><TH>Sujet</TH><TH>Aperçu</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-slate-400">Aucun modèle.</TD></TR>}
            {(q.data ?? []).map((t) => (
              <TR key={t.id}>
                <TD><Badge tone="indigo">{REASON_LABEL[t.reason]}</Badge></TD>
                <TD>{CHANNEL_LABEL[t.channel]}</TD>
                <TD className="text-slate-700">{t.subject ?? "—"}</TD>
                <TD className="max-w-[280px] truncate text-slate-500">{t.body}</TD>
                <TD className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Modifier</Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(t)}>Suppr.</Button>
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
  const form = useForm({
    mode: "controlled",
    initialValues: {
      reason: (initial?.reason ?? "GENERAL") as CommunicationReason,
      channel: (initial?.channel ?? "SMS") as CommunicationChannel,
      subject: initial?.subject ?? "",
      body: initial?.body ?? "",
    },
    validate: { body: (v) => (v.trim() ? null : "Corps requis") },
  });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = { tenantId, reason: values.reason, channel: values.channel, subject: values.subject || null, body: values.body };
      if (initial) await updateTemplate(initial.id, payload);
      else await createTemplate(payload);
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Motif" data={(Object.keys(REASON_LABEL) as CommunicationReason[]).map((r) => ({ value: r, label: REASON_LABEL[r] }))} {...form.getInputProps("reason")} />
          <Select label="Canal" data={(Object.keys(CHANNEL_LABEL) as CommunicationChannel[]).map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))} {...form.getInputProps("channel")} />
        </div>
        <TextInput label="Sujet" {...form.getInputProps("subject")} />
        <Textarea label="Corps du message" autosize minRows={4} withAsterisk {...form.getInputProps("body")} />
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((v) => (
            <button key={v} type="button" onClick={() => form.setFieldValue("body", `${form.values.body}${v}`)}
              className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:bg-brand-50 hover:text-brand-700">{v}</button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Enregistrer</Button>
        </div>
      </Stack>
    </form>
  );
}
