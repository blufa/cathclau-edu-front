"use client";

import { useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Download, ExternalLink, Printer, Share2 } from "lucide-react";
import { canUseWebShare, shareFile } from "@/lib/share";
import { stageFilePrintRoot } from "@/lib/print-node";

function isPdf(url: string): boolean {
  // Les object URLs (blob:) que l'on crée ici sont toujours des PDF servis par le backend.
  return url.startsWith("blob:") || /\.pdf(\?|$)/i.test(url) || /\/raw\/upload\//.test(url);
}
function isImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$)/i.test(url) || /\/image\/upload\//.test(url);
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

  // Pose le contenu à imprimer DÈS que l'aperçu est affiché (pas seulement au clic sur
  // « Imprimer ») — sinon Ctrl+P, qui déclenche nativement window.print() sans passer par ce
  // composant, imprimerait la page de l'appli plutôt que le document (§retour comptable : le clic
  // "Imprimer" ne doit jamais ouvrir un nouvel onglet, et Ctrl+P doit marcher aussi). Voir
  // stageFilePrintRoot pour pourquoi ni window.open ni iframe.contentWindow.print() ne conviennent
  // (webview desktop Tauri).
  useEffect(() => {
    if (!open || !url || (!pdf && !image)) return;
    return stageFilePrintRoot(url, pdf ? "pdf" : "image");
  }, [open, pdf, image, url]);
  return (
    <Modal open={open} onClose={onClose} title={title ?? "Aperçu"} className="max-w-3xl">
      {!url ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucun fichier.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-end gap-3 text-sm">
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <ExternalLink className="h-4 w-4" /> Ouvrir
            </a>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <Printer className="h-4 w-4" /> Imprimer
            </button>
            <a href={url} download className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <Download className="h-4 w-4" /> Télécharger
            </a>
            {canUseWebShare() && (
              <button
                type="button"
                onClick={() => shareFile(url, title ?? "document")}
                className="inline-flex items-center gap-1 text-brand-700 hover:underline"
              >
                <Share2 className="h-4 w-4" /> Partager
              </button>
            )}
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
    </Modal>
  );
}
