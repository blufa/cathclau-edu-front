"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { getStudentParents } from "@/lib/api/parents";
import { openWhatsApp } from "@/lib/whatsapp";
import { canUseWebShare, downloadFile, shareFileOnly } from "@/lib/share";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/feedback";

/**
 * Envoie la facture/le reçu au parent via WhatsApp, en un seul clic — jamais le lien brut de
 * stockage (Cloudinary) dans le message (§retour comptable : "je veux que tu partages juste ça
 * [...], pas le lien cloudinary").
 * - Sur téléphone (partage natif disponible) : joint le VRAI fichier PDF — WhatsApp l'affiche comme
 *   une pièce jointe nommée (ex. "PNM-REC-2026-36CAF2.pdf"). Le sélecteur natif impose alors de
 *   choisir soi-même WhatsApp puis le bon contact (pas de pré-remplissage possible, contrairement
 *   à `wa.me`).
 * - Sur desktop (pas de partage de fichier natif — aucune API WhatsApp Desktop ne permet de joindre
 *   un fichier depuis une page web/app) : télécharge le vrai PDF localement ET ouvre la conversation
 *   WhatsApp du parent avec un texte propre, SANS lien — au comptable de joindre le fichier déjà
 *   téléchargé (toast explicite, pour qu'il ne pense pas que le reçu n'a pas été transmis).
 */
export function WhatsAppInvoiceButton({ studentId, buildShare }: {
  studentId: number;
  /** Construit l'URL du PDF, le nom de fichier à afficher (sans extension) et le texte du message
   * (sans le lien, déjà porté par le fichier/`url`) une fois le PDF récupéré. */
  buildShare: () => Promise<{ url?: string; fileName: string; text: string }>;
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
      const { url, fileName, text } = await buildShare();
      if (!url) {
        notifyError("PDF non disponible pour le moment — réessayez dans un instant.");
        return;
      }
      if (canUseWebShare()) {
        // shareFileOnly (jamais shareFile) : ne doit jamais retomber sur un partage de simple lien,
        // qui exposerait le lien Cloudinary brut — exactement ce qu'il faut éviter ici.
        const shared = await shareFileOnly(url, fileName, text);
        if (shared) return;
      }
      await downloadFile(url, `${fileName}.pdf`);
      notifySuccess(`PDF téléchargé (${fileName}.pdf) — joignez-le dans la conversation WhatsApp qui vient de s'ouvrir.`);
      openWhatsApp(target.phone, text);
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
