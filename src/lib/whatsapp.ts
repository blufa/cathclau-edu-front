/**
 * Ouvre directement une conversation WhatsApp avec un numéro donné (pas besoin que ce numéro soit
 * enregistré dans les contacts du téléphone), message pré-rempli — utilisé pour partager une facture/
 * un reçu directement au parent, sans dépendre d'une intégration WhatsApp Business côté serveur
 * (canal WHATSAPP du module communication pas encore configuré en production).
 */
export function openWhatsApp(phoneE164: string, message: string): void {
  const digits = phoneE164.replace(/[^\d]/g, "");
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
