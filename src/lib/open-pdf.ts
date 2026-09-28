import { isDesktop } from "@/lib/offline/desktop-runtime";
import { usePdfPreviewStore } from "@/lib/store/pdf-preview-store";

/**
 * Ouvre un PDF (déjà généré, URL objet/blob ou distante) — jamais `window.open(url, "_blank")` sur
 * desktop (Tauri) : ça ne crée pas une vraie fenêtre séparée, ça remplace toute la fenêtre de l'appli
 * par le PDF, sans bouton retour. Sur desktop, affiche une modale d'aperçu globale (fermable) à la
 * place ; sur web, comportement inchangé (vrai nouvel onglet du navigateur).
 */
export function openPdfInApp(url: string, title?: string) {
  if (isDesktop()) {
    usePdfPreviewStore.getState().show(url, title);
    return;
  }
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) window.location.assign(url);
}
