"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { getStudentParents } from "@/lib/api/parents";
import { openWhatsApp } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/lib/feedback";

/**
 * Envoie directement le lien de la facture/du reçu au parent via WhatsApp (un seul clic, pas de
 * sélection de canal ni de contact à chercher) — le canal WHATSAPP du module communication n'est pas
 * encore configuré en production, donc on ouvre directement `wa.me` avec le numéro du responsable
 * principal, plutôt que de passer par l'envoi serveur.
 */
export function WhatsAppInvoiceButton({ studentId, buildMessage }: {
  studentId: number;
  /** Construit le texte du message une fois le PDF récupéré (lien + contexte facture/reçu). */
  buildMessage: () => Promise<string>;
}) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const parents = await getStudentParents(studentId);
      const primary = parents.filter((p) => p.primaryGuardian && p.phone);
      const target = (primary.length > 0 ? primary : parents.filter((p) => p.phone))[0];
      if (!target?.phone) {
        notifyError("Aucun parent avec un numéro de téléphone connu.");
        return;
      }
      const message = await buildMessage();
      openWhatsApp(target.phone, message);
    } catch (err) {
      notifyError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" loading={sending} onClick={send} leftSection={<MessageCircle className="h-4 w-4" />}>
      WhatsApp
    </Button>
  );
}
