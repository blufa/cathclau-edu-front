"use client";

import { useEffect } from "react";
import { Modal as MantineModal } from "@mantine/core";
import { Download, ExternalLink, Printer } from "lucide-react";

function isPdf(url: string): boolean {
  // Les object URLs (blob:) que l'on crée ici sont toujours des PDF servis par le backend.
  return url.startsWith("blob:") || /\.pdf(\?|$)/i.test(url) || /\/raw\/upload\//.test(url);
}
function isImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$)/i.test(url) || /\/image\/upload\//.test(url);
}

/** Ouvre le document dans un nouvel onglet et tente de lancer l'impression. */
function printDocument(url: string) {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    window.location.assign(url);
    return;
  }
  // L'impression auto est bloquée pour un PDF cross-origin (Cloudinary) : la visionneuse PDF du
  // navigateur expose le bouton imprimer. On tente quand même pour les documents de même origine.
  try {
    win.addEventListener("load", () => win.print());
  } catch {
    /* cross-origin : l'utilisateur imprime depuis la visionneuse */
  }
}

/** In-app preview of an uploaded file (image or PDF) in a large modal, with open/print/download. */
export function FilePreview({
  url,
  title,
  open,
  onClose,
}: {
  url: string | null;
  title?: string;
  open: boolean;
  onClose: () => void;
}) {
  // Libère l'object URL (blob:) précédent quand l'URL change ou au démontage (évite les fuites mémoire).
  useEffect(() => {
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [url]);

  // Le PDF est prioritaire : Cloudinary peut servir un PDF sous /image/upload/ avec une URL .pdf.
  const pdf = url != null && isPdf(url);
  const image = url != null && !pdf && isImage(url);
  return (
    <MantineModal opened={open} onClose={onClose} title={title ?? "Aperçu"} centered size="xl" radius="lg">
      {!url ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucun fichier.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-end gap-3 text-sm">
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <ExternalLink className="h-4 w-4" /> Ouvrir
            </a>
            <button type="button" onClick={() => printDocument(url)} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <Printer className="h-4 w-4" /> Imprimer
            </button>
            <a href={url} download className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <Download className="h-4 w-4" /> Télécharger
            </a>
          </div>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title ?? "aperçu"} className="max-h-[72vh] w-full rounded-xl object-contain" />
          ) : pdf ? (
            <iframe src={url} title={title ?? "PDF"} className="h-[72vh] w-full rounded-xl border border-slate-200" />
          ) : (
            <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Aperçu non disponible pour ce type de fichier. Utilisez « Ouvrir » ou « Télécharger ».
            </div>
          )}
        </div>
      )}
    </MantineModal>
  );
}
