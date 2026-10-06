"use client";

import { useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Download, ExternalLink, Printer, Share2 } from "lucide-react";
import { canUseWebShare, shareFile } from "@/lib/share";
import { stageFilePrintRoot } from "@/lib/print-node";
import { isDesktop } from "@/lib/offline/desktop-runtime";

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
  autoPrint,
}: {
  url: string | null;
  title?: string;
  open: boolean;
  onClose: () => void;
  /** Déclenche l'impression automatiquement dès que le PDF est chargé (web uniquement) — utilisé par
   * "Imprimer tous les reçus" (§retour comptable) : un seul clic doit lancer l'impression directement,
   * sans que l'utilisateur ait en plus à cliquer sur "Imprimer" dans cet aperçu. */
  autoPrint?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const autoPrinted = useRef(false);

  // Libère l'object URL (blob:) précédent quand l'URL change ou au démontage (évite les fuites mémoire).
  useEffect(() => {
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [url]);

  // Le PDF est prioritaire : Cloudinary peut servir un PDF sous /image/upload/ avec une URL .pdf.
  const pdf = url != null && isPdf(url);
  const image = url != null && !pdf && isImage(url);

  // Retour terrain (§retour comptable) : sur le WEB, window.print() sur le document principal avec
  // le PDF caché en arrière-plan rogne le reçu (une iframe PDF ne "reflow" jamais au-delà de sa boîte
  // visible à l'écran — contrairement à du HTML). La technique fiable sur le web pour un PDF, c'est
  // d'imprimer l'iframe VISIBLE elle-même (iframe.contentWindow.print(), géré dans handlePrint
  // ci-dessous) — donc on ne pose stageFilePrintRoot pour un PDF que sur desktop (Tauri), où
  // iframe.contentWindow.print() ne déclenche rien (voir sa doc). Les images continuent d'utiliser
  // stageFilePrintRoot partout : pas d'iframe en jeu, jamais eu ce problème.
  useEffect(() => {
    if (!open || !url) return;
    if (image) return stageFilePrintRoot(url, "image");
    if (pdf && isDesktop()) return stageFilePrintRoot(url, "pdf");
  }, [open, pdf, image, url]);

  // Focus natif sur l'iframe dès l'affichage (web uniquement) : pour que Ctrl+P — qui déclenche
  // nativement l'impression du cadre ayant le focus, sans JS dédié à l'écoute de cette touche — cible
  // la visionneuse PDF plutôt que la page de l'appli.
  useEffect(() => {
    if (!open || !pdf || isDesktop()) return;
    const t = setTimeout(() => iframeRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [open, pdf, url]);

  function handlePrint() {
    if (pdf && !isDesktop() && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
      return;
    }
    window.print();
  }

  // Réinitialise le drapeau à chaque nouvelle URL (un même FilePreview peut être réutilisé pour
  // plusieurs impressions successives, ex. rouvrir "Imprimer tous les reçus" une seconde fois).
  useEffect(() => { autoPrinted.current = false; }, [url]);

  function handleIframeLoad() {
    if (!autoPrint || autoPrinted.current || isDesktop()) return;
    autoPrinted.current = true;
    handlePrint();
  }
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
            <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
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
            <iframe ref={iframeRef} src={url} title={title ?? "PDF"} onLoad={handleIframeLoad} className="h-[72vh] w-full rounded-xl border border-slate-200" />
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
