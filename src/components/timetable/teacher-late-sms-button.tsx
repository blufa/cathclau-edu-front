"use client";

import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { sendCommunication } from "@/lib/api/communication";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea, Label, Field } from "@/components/ui/input";
import { notifyError, notifySuccess } from "@/lib/feedback";

interface Props {
  teacherName: string;
  phone: string | null;
  /** Bouton icône seule, sans libellé ni bordure — pour les cartes compactes de l'emploi du temps
   * (vue par classe), où chaque créneau affiche déjà le numéro à côté. */
  compact?: boolean;
}

/** Prévient par SMS un enseignant en retard/absent — depuis l'emploi du temps filtré par enseignant,
 * là où son numéro est déjà affiché, sans repasser par le module Communications. */
export function TeacherLateSmsButton({ teacherName, phone, compact }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function openModal() {
    setMessage(`Bonjour ${teacherName}, vous n'êtes pas encore arrivé(e) pour votre cours. Merci de nous contacter rapidement.`);
    setOpen(true);
  }

  async function send() {
    if (!phone) return;
    if (!message.trim()) {
      notifyError("Saisissez le message.");
      return;
    }
    setSending(true);
    try {
      await sendCommunication({
        tenantId: user?.tenantId ?? null,
        senderId: user?.userId ?? null,
        channel: "SMS", recipientType: "TEACHER", reason: "LATE",
        subject: "Retard", content: message.trim(),
        recipientUserIds: [], recipientDestinations: [phone],
      });
      notifySuccess("SMS envoyé à l'enseignant");
      setOpen(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setSending(false);
    }
  }

  if (!phone) return null;

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={openModal}
          aria-label="Prévenir par SMS (retard)"
          title="Prévenir par SMS (retard)"
          className="rounded p-0.5 text-gray-400 hover:bg-white hover:text-brand-700"
        >
          <MessageSquareWarning className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button size="sm" variant="outline" onClick={openModal} leftSection={<MessageSquareWarning className="h-4 w-4" />}>
          SMS retard
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Prévenir l'enseignant par SMS">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Envoyé au {phone}</p>
          <Field>
            <Label>Message</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button loading={sending} onClick={send} leftSection={<MessageSquareWarning className="h-4 w-4" />}>Envoyer le SMS</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
