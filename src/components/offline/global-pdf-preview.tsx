"use client";

import { FilePreview } from "@/components/ui/file-preview";
import { usePdfPreviewStore } from "@/lib/store/pdf-preview-store";

/** Modale d'aperçu PDF globale, montée une fois dans AppShell — voir `openPdfInApp()`. */
export function GlobalPdfPreview() {
  const { url, title, open, close } = usePdfPreviewStore();
  return <FilePreview url={url} title={title} open={open} onClose={close} />;
}
