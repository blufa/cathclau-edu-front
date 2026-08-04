"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { getStudentParents } from "@/lib/api/parents";
import { sendCommunication } from "@/lib/api/communication";
import { CHANNEL_LABEL, type CommunicationChannel, type CommunicationReason } from "@/lib/types/communication";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea, Label, Field } from "@/components/ui/input";
import { notifyError, notifySuccess } from "@/lib/feedback";

interface Props {
  studentId: number;
  reason: CommunicationReason;
  subject: string;
  defaultMessage: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
}

/** Reusable "remind the parent" action: pick a channel (Email/SMS/WhatsApp) + message, then send. */
export function ParentReminderButton({ studentId, reason, subject, defaultMessage, label = "Relancer", size = "sm", variant = "outline" }: Props) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<CommunicationChannel>("EMAIL");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function openModal() {
    setMessage(defaultMessage);
    setChannel("EMAIL");
    setOpen(true);
  }

  async function send() {
    const parents = await getStudentParents(studentId);
    // Destinataire par défaut : le responsable principal (« responsable 1 ») s'il est désigné ; sinon tous.
    const primary = parents.filter((p) => p.primaryGuardian);
    const targets = primary.length > 0 ? primary : parents;
    const recipientUserIds = targets.map((p) => p.userId).filter((u): u is number => u != null);
    if (recipientUserIds.length === 0) {
      notifyError("Aucun parent avec un compte — impossible d'envoyer la relance.");
      return;
    }
    if (!message.trim()) {
      notifyError("Saisissez le motif de la relance.");
      return;
    }
    setSending(true);
    try {
      await sendCommunication({ channel, recipientType: "PARENT", reason, subject, content: message.trim(), recipientUserIds });
      notifySuccess("Relance envoyée au(x) parent(s)");
      setOpen(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button size={size} variant={variant} onClick={openModal} leftSection={<Bell className="h-4 w-4" />}>{label}</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Relancer le(s) parent(s)">
        <div className="space-y-4">
          <Field>
            <Label>Canal de notification</Label>
            <p className="text-xs text-gray-400">Email disponible. SMS et WhatsApp nécessitent un fournisseur configuré.</p>
            <Select value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel)}>
              {(["EMAIL", "SMS", "WHATSAPP"] as CommunicationChannel[]).map((c) => (
                <option key={c} value={c}>{c === "EMAIL" ? CHANNEL_LABEL[c] : `${CHANNEL_LABEL[c]} (bientôt)`}</option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>Motif / message</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button loading={sending} onClick={send} leftSection={<Bell className="h-4 w-4" />}>Envoyer la relance</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
