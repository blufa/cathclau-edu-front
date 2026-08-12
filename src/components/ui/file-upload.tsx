"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Upload, X } from "lucide-react";
import { uploadFile } from "@/lib/api/upload";
import { notifyError } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { PhotoCaptureModal } from "@/components/ui/photo-capture-modal";

interface FileUploadProps {
  label?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  /** "image" shows a thumbnail preview; "document" shows a file link. */
  variant?: "image" | "document";
  accept?: string;
  className?: string;
  /** Affiche un bouton « Prendre une photo » (webcam, caméra du téléphone, ou appareil externe branché). */
  allowCapture?: boolean;
}

/** Uploads a file to Cloudinary and returns its URL via onChange. */
export function FileUpload({ label, value, onChange, folder, variant = "image", accept, className, allowCapture }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    try {
      const url = await uploadFile(file, folder);
      onChange(url);
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <div className="flex items-center gap-3">
        {value && variant === "image" && (
          <span className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="aperçu" className="h-16 w-16 rounded-xl border border-slate-200 object-cover" />
            <button type="button" onClick={() => onChange(null)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        {value && variant === "document" && (
          <a href={value} target="_blank" rel="noreferrer" className="text-sm text-brand-700 underline">Voir le fichier</a>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {value ? "Remplacer" : "Téléverser"}
        </button>
        {allowCapture && variant === "image" && (
          <button
            type="button"
            onClick={() => setCapturing(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
          >
            <Camera className="h-4 w-4" />
            Prendre une photo
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept ?? (variant === "image" ? "image/*" : undefined)}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {allowCapture && variant === "image" && capturing && (
        <PhotoCaptureModal open={capturing} onClose={() => setCapturing(false)} onCapture={(file) => handleFile(file)} />
      )}
    </div>
  );
}
