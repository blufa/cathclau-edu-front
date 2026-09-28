import { create } from "zustand";

interface PdfPreviewState {
  url: string | null;
  title: string;
  open: boolean;
  show: (url: string, title?: string) => void;
  close: () => void;
}

/**
 * Aperçu PDF global (une seule modale montée dans AppShell, voir `<GlobalPdfPreview>`) — sert à
 * `openPdfInApp()` sur desktop (Tauri), où `window.open(url, "_blank")` ne crée jamais une vraie
 * fenêtre séparée : il remplace toute la fenêtre de l'appli par le PDF, sans bouton retour (le webview
 * Tauri n'a pas de chrome de navigateur). Une modale reste dans la page courante, toujours fermable.
 */
export const usePdfPreviewStore = create<PdfPreviewState>((set) => ({
  url: null,
  title: "",
  open: false,
  show: (url, title = "Aperçu") => set({ url, title, open: true }),
  close: () => set({ open: false }),
}));
