"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { useBranding } from "@/providers/branding-provider";
import { Button } from "@/components/ui/button";
import { printNode } from "@/lib/print-node";

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

/** Couleurs du drapeau national, utilisées en bande d'accent sur les deux faces de la carte. */
const GUINEA_RED = "#CE1126";
const GUINEA_YELLOW = "#FCD116";
const GUINEA_GREEN = "#009460";

/** Fine bande tricolore (recto/verso) — touche officielle inspirée des cartes d'identité nationales. */
function TricolorBar() {
  return (
    <div className="flex h-[5px] w-full" aria-hidden>
      <div className="flex-1" style={{ backgroundColor: GUINEA_RED }} />
      <div className="flex-1" style={{ backgroundColor: GUINEA_YELLOW }} />
      <div className="flex-1" style={{ backgroundColor: GUINEA_GREEN }} />
    </div>
  );
}

/**
 * Carte d'identité / badge officiel (format carte, portrait) réutilisable pour élèves, enseignants et
 * personnel — recto (photo, identité, QR) + verso officiel (armoiries de la Guinée en filigrane,
 * devise nationale, devise et slogan de l'école). Impression isolée des deux faces, l'une après
 * l'autre, indépendante de la modale qui l'affiche.
 */
export function IdBadge({ kind, fullName, subtitle, photoUrl, fields, qrData, footerNote, printable = true }: IdBadgeProps) {
  const branding = useBranding().branding;
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  const badgeRef = useRef<HTMLDivElement>(null);

  // Le badge est affiché dans une modale (portail) : y appliquer visibility/position:fixed pour une
  // impression « isolée » est fragile (containing block imprévisible selon les navigateurs, page vide
  // constatée). On imprime plutôt via une iframe dédiée qui clone le recto ET le verso — indépendant
  // de la structure de la modale. Le dialogue d'impression permet aussi d'« Enregistrer en PDF ».
  function print() {
    if (badgeRef.current) printNode(badgeRef.current);
  }

  return (
    <div className="space-y-3">
      <div ref={badgeRef}>
        <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 print:hidden">Recto</p>
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

          <TricolorBar />
        </div>

        {/* Saut de page à l'impression : le verso sort sur une deuxième page/carte. */}
        <div className="print:break-after-page" />

        <p className="mb-1 mt-4 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 print:hidden">Verso</p>
        <BadgeBack schoolMotto={branding?.motto} schoolSlogan={branding?.slogan} schoolName={branding?.schoolName} />
      </div>

      {printable && (
        <div className="flex justify-center print:hidden">
          <Button variant="secondary" size="sm" onClick={print}>
            <Printer className="mr-1.5 h-4 w-4" /> Imprimer / Télécharger en PDF
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Verso officiel : armoiries de la République de Guinée en filigrane, devise nationale, puis la
 * devise et le slogan propres à l'établissement (renseignables dans Paramètres).
 */
function BadgeBack({
  schoolMotto,
  schoolSlogan,
  schoolName,
}: {
  schoolMotto?: string | null;
  schoolSlogan?: string | null;
  schoolName?: string | null;
}) {
  return (
    <div className="badge-printable mx-auto w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      <TricolorBar />
      <div className="relative flex min-h-[260px] flex-col items-center justify-center gap-2 px-6 py-8 text-center">
        {/* Armoiries en filigrane : derrière le texte, faible opacité. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/Coat_of_Arms_of_Guinea.svg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 opacity-[0.08]"
        />
        <div className="relative space-y-1">
          <p className="text-sm font-extrabold uppercase tracking-wide text-slate-900">République de Guinée</p>
          <p className="text-[11px] italic text-slate-500">Travail — Justice — Solidarité</p>
        </div>

        <div className="relative my-3 h-px w-20 bg-slate-200" />

        <div className="relative space-y-1">
          <p className="text-sm font-bold text-slate-900">{schoolName ?? "Établissement"}</p>
          {schoolMotto && <p className="text-xs italic text-slate-600">« {schoolMotto} »</p>}
          {schoolSlogan && <p className="text-xs text-brand-700">{schoolSlogan}</p>}
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-center">
        <p className="text-[10px] leading-snug text-slate-400">
          Ce document reste la propriété de l&apos;établissement — en cas de perte, le signaler immédiatement.
        </p>
      </div>
      <TricolorBar />
    </div>
  );
}
