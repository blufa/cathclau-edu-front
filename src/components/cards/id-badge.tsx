"use client";

import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { useBranding } from "@/providers/branding-provider";
import { Button } from "@/components/ui/button";

export interface IdBadgeField {
  label: string;
  value: string;
  mono?: boolean;
}

export interface IdBadgeProps {
  /** Kind of badge, shown under the school name (ex. « Carte scolaire », « Badge enseignant »). */
  kind: string;
  /** Person's full name (shown prominently). */
  fullName: string;
  /** Secondary line (ex. classe, fonction). */
  subtitle?: string | null;
  photoUrl?: string | null;
  fields: IdBadgeField[];
  /** Content encoded in the QR code (signed verify string for students, identifier otherwise). */
  qrData?: string | null;
  /** Small note under the QR (ex. « Vérifiable par scan »). */
  footerNote?: string;
  /** Show the print button (default true). */
  printable?: boolean;
}

/**
 * Carte d'identité / badge officiel (format carte, portrait) réutilisable pour élèves, enseignants et
 * personnel — en-tête aux couleurs de l'école, photo, nom en évidence, informations, QR code réel et
 * impression isolée. Inspiré des modèles professionnels (school ID badge).
 */
export function IdBadge({ kind, fullName, subtitle, photoUrl, fields, qrData, footerNote, printable = true }: IdBadgeProps) {
  const branding = useBranding().branding;
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

  function print() {
    document.body.classList.add("print-badge-only");
    window.print();
    // Retiré après le cycle d'impression (le dialogue est synchrone dans la plupart des navigateurs).
    setTimeout(() => document.body.classList.remove("print-badge-only"), 300);
  }

  return (
    <div className="space-y-3">
      <div className="badge-printable mx-auto w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        {/* En-tête aux couleurs de l'école */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-brand-600 to-brand-500 p-3.5 text-white">
          {branding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt="logo" className="h-10 w-10 rounded-lg bg-white/20 object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-lg font-bold">
              {(branding?.schoolName ?? "E")[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">{branding?.schoolName ?? "Établissement"}</p>
            <p className="text-[11px] uppercase tracking-wide text-white/80">{kind}</p>
          </div>
        </div>

        {/* Photo + identité */}
        <div className="flex gap-3 p-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="photo" className="h-28 w-24 shrink-0 rounded-lg border border-slate-200 object-cover" />
          ) : (
            <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-tight text-slate-900">{fullName}</p>
            {subtitle && <p className="truncate text-sm text-brand-700">{subtitle}</p>}
            <div className="mt-2 space-y-1 text-xs">
              {fields.map((f) => (
                <div key={f.label} className="flex justify-between gap-2">
                  <span className="text-slate-400">{f.label}</span>
                  <span className={f.mono ? "font-mono text-slate-800" : "font-medium text-slate-800"}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QR + pied */}
        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <div className="rounded-lg bg-white p-1.5 ring-1 ring-slate-200">
            {qrData ? (
              <QRCodeSVG value={qrData} size={64} level="M" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center text-[10px] text-slate-400">—</div>
            )}
          </div>
          <p className="text-[11px] leading-snug text-slate-500">
            {footerNote ?? "Présenter ce badge à l'entrée de l'établissement."}
          </p>
        </div>
      </div>

      {printable && (
        <div className="flex justify-center print:hidden">
          <Button variant="secondary" size="sm" onClick={print}>
            <Printer className="mr-1.5 h-4 w-4" /> Imprimer
          </Button>
        </div>
      )}
    </div>
  );
}
