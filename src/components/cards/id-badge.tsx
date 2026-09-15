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
  /** Couleurs du modèle (CardTemplate) pour ce type de badge — remplacent le dégradé de marque par
   * défaut quand fournies, pour que élève/enseignant/personnel restent visuellement distincts. */
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

/** Couleurs du drapeau national, utilisées en bande d'accent en bas de la carte. */
const GUINEA_RED = "#CE1126";
const GUINEA_YELLOW = "#FCD116";
const GUINEA_GREEN = "#009460";

/** Taille réelle d'un badge à lanière (carte CR80 tenue en portrait) — 53,98 × 85,6 mm, appliquée aussi
 * bien à l'écran qu'à l'impression pour que l'aperçu corresponde exactement au badge imprimé/plastifié.
 * Recto seul désormais (plus de verso) : une hauteur minimale généreuse plutôt qu'un simple `h-` fixe,
 * pour laisser respirer le bloc « officiel » + QR ajoutés en bas de carte. */
const CARD_SCREEN_CLASS = "w-[227px] min-h-[400px] print:w-[53.98mm] print:min-h-[85.6mm]";

/** Fine bande tricolore en bas de carte — touche officielle inspirée des cartes d'identité nationales. */
function TricolorBar() {
  return (
    <div className="flex h-[4px] w-full" aria-hidden>
      <div className="flex-1" style={{ backgroundColor: GUINEA_RED }} />
      <div className="flex-1" style={{ backgroundColor: GUINEA_YELLOW }} />
      <div className="flex-1" style={{ backgroundColor: GUINEA_GREEN }} />
    </div>
  );
}

/** Petit onglet décoratif en haut de la carte (façon porte-badge à lanière). */
function LanyardTab() {
  return (
    <div className="flex items-center justify-center gap-1 bg-white py-1 print:py-0.5" aria-hidden>
      <span className="h-[3px] w-5 rounded-full bg-gray-200 print:w-3" />
      <span className="h-[5px] w-[5px] rounded-full bg-gray-400 print:h-[3px] print:w-[3px]" />
      <span className="h-[3px] w-5 rounded-full bg-gray-200 print:w-3" />
    </div>
  );
}

/**
 * Vague décorative, une seule couche : un unique tracé SVG (coordonnées fixes dans son `viewBox`, donc
 * un résultat prévisible quelle que soit la largeur réelle de la carte). `flip` retourne la vague
 * (utilisée en bas de carte, en miroir de celle du haut). `color` (hex) pilote la teinte quand un modèle
 * personnalisé est fourni ; à défaut, replis sur la couleur de marque du tenant.
 */
function Wave({ flip = false, color }: { flip?: boolean; color?: string | null }) {
  return (
    <svg viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden
      style={color ? { color } : undefined}
      className={`block h-4 w-full text-brand-500 print:h-2 ${flip ? "rotate-180" : ""}`}>
      <path d="M0,8 Q100,24 200,8 L200,0 L0,0 Z" fill="currentColor" />
    </svg>
  );
}

/** Ligne « libellé : valeur » alignée. */
function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1 text-[10.5px] print:text-[6.5px]">
      <span className="w-[64px] shrink-0 text-slate-500 print:w-[46px]">{label}</span>
      <span className="text-slate-300">:</span>
      <span className={mono ? "truncate font-mono text-slate-800" : "truncate font-medium text-slate-800"}>{value}</span>
    </div>
  );
}

/**
 * Carte d'identité / badge officiel (format badge à lanière, portrait) réutilisable pour élèves,
 * enseignants et personnel — reproduit la maquette fournie (bandeau coloré, photo ronde en chevauchement
 * sur une vague), **recto seul** : identité + champs, puis un bloc officiel compact (devise nationale,
 * armoiries en filigrane, hiérarchie IRE/DPE/DSSEE, devise et slogan de l'école) et le QR de vérification
 * en bas de carte — tout ce qui figurait auparavant au verso est désormais regroupé ici.
 */
export function IdBadge({
  kind, fullName, subtitle, photoUrl, fields, qrData, footerNote, printable = true,
  primaryColor, secondaryColor,
}: IdBadgeProps) {
  const branding = useBranding().branding;
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  const badgeRef = useRef<HTMLDivElement>(null);

  const headerStyle = primaryColor && secondaryColor
    ? { backgroundImage: `linear-gradient(to right, ${secondaryColor}, ${primaryColor})` }
    : undefined;
  const accentColor = primaryColor ?? null;

  // Le badge est affiché dans une modale (portail) : y appliquer visibility/position:fixed pour une
  // impression « isolée » est fragile (containing block imprévisible selon les navigateurs, page vide
  // constatée). On imprime plutôt via une iframe dédiée qui clone la carte — indépendant de la structure
  // de la modale. Le dialogue d'impression permet aussi d'« Enregistrer en PDF ».
  function print() {
    if (badgeRef.current) printNode(badgeRef.current);
  }

  return (
    <div className="space-y-3">
      <div ref={badgeRef}>
        {/* `min-h` (pas `h` seul) : une hauteur figée + `overflow-hidden` écraserait/rognerait la
            dernière ligne dès que le rendu d'impression du texte prend quelques pixels de plus que
            prévu (variable selon navigateur/moteur d'impression). */}
        <div className={`badge-printable mx-auto flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg print:rounded-none print:border-0 print:shadow-none ${CARD_SCREEN_CLASS}`}>
          <LanyardTab />

          {/* En-tête aux couleurs du badge (modèle personnalisé, ou couleur de marque de l'école par
              défaut) */}
          <div className="bg-gradient-to-r from-brand-700 to-brand-500 px-3 pb-1.5 pt-2 print:px-2 print:pb-1 print:pt-1" style={headerStyle}>
            <div className="flex items-center gap-2 print:gap-1">
              {branding?.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo} alt="logo" className="h-7 w-7 shrink-0 rounded-full bg-white/90 object-cover p-0.5 print:h-4 print:w-4" />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white print:h-4 print:w-4 print:text-[7px]">
                  {(branding?.schoolName ?? "E")[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[11px] font-extrabold uppercase leading-tight text-white print:text-[7.5px]">
                  {branding?.schoolName ?? "Établissement"}
                </p>
                {branding?.slogan && (
                  <p className="truncate text-[8.5px] text-white/80 print:text-[5.5px]">{branding.slogan}</p>
                )}
              </div>
            </div>
            <p className="mt-1 truncate text-center text-[8px] font-semibold uppercase tracking-widest text-white/90 print:mt-0.5 print:text-[5px]">
              {kind}
            </p>
          </div>

          {/* Vague de transition — la photo (ci-dessous) chevauche cette vague. */}
          <Wave color={accentColor} />

          {/* Photo en chevauchement, centrée — agrandie pour rester lisible sur le badge imprimé. */}
          <div className="relative z-10 -mt-7 flex justify-center print:-mt-4">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="photo" className="h-20 w-20 rounded-full border-[3px] border-white bg-white object-cover shadow-md print:h-11 print:w-11 print:border-2" />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-white bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-md print:h-11 print:w-11 print:border-2 print:text-[9px]"
                style={headerStyle}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Identité + informations */}
          <div className="px-3.5 pb-1 pt-1.5 print:px-2 print:pb-0.5 print:pt-1">
            <p className="truncate text-center text-[13px] font-bold leading-tight text-slate-900 print:text-[8px]">{fullName}</p>
            {subtitle && (
              <p className="truncate text-center text-[10px] print:text-[6px]" style={accentColor ? { color: accentColor } : undefined}>
                {subtitle}
              </p>
            )}
            <div className="mt-2 space-y-1 print:mt-1 print:space-y-0.5">
              {fields.map((f) => (
                <FieldRow key={f.label} label={f.label} value={f.value} mono={f.mono} />
              ))}
            </div>
          </div>

          {/* Bloc officiel compact — reprend ce qui figurait auparavant au verso : devise nationale,
              armoiries en filigrane, identité/devise/slogan de l'école, hiérarchie administrative. */}
          <div className="relative mt-1 px-3 pb-1 print:mt-0.5 print:px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/Coat_of_Arms_of_Guinea.svg"
              alt=""
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] print:h-10 print:w-10"
            />
            <p className="relative text-center text-[7px] font-bold uppercase tracking-widest text-slate-400 print:text-[4.5px]">
              République de Guinée — Travail-Justice-Solidarité
            </p>
            {(branding?.motto) && (
              <p className="relative text-center text-[8px] italic text-slate-500 print:text-[5px]">« {branding.motto} »</p>
            )}
            <div className="relative mt-1 space-y-0.5 print:mt-0.5">
              {branding?.ire && <FieldRow label="IRE" value={branding.ire} />}
              {branding?.dpeLabel && <FieldRow label="DPE/DCE" value={branding.dpeLabel} />}
              {branding?.sousPrefectureLabel && <FieldRow label="DSSEE" value={branding.sousPrefectureLabel} />}
            </div>
          </div>

          {/* QR de vérification + signature, en chevauchement sur la vague du bas. */}
          <div className="relative">
            <Wave flip color={accentColor} />
            <div className="relative z-10 -mt-3 flex items-end justify-between gap-2 px-3 pb-2 print:-mt-1.5 print:px-2 print:pb-1">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-sm print:h-12 print:w-12">
                {qrData ? (
                  <QRCodeSVG value={qrData} size={64} level="M" marginSize={2} className="h-full w-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">—</div>
                )}
              </div>
              <p className="flex-1 text-right text-[8px] italic leading-snug text-slate-500 print:text-[5px]">
                {footerNote ?? "Présenter ce badge à l'entrée de l'établissement."}
              </p>
            </div>
          </div>

          <TricolorBar />
        </div>
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
