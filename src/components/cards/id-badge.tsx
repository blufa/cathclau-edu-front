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

/** Taille réelle d'un badge à lanière (carte CR80 tenue en portrait, comme sur le modèle fourni) —
 * 53,98 × 85,6 mm, appliquée aussi bien à l'écran qu'à l'impression pour que l'aperçu corresponde
 * exactement à la taille du badge une fois imprimé/plastifié. `min-h` (pas seulement à l'impression) :
 * à l'écran, recto et verso sont affichés l'un sous l'autre (pas côte à côte comme à l'impression), donc
 * sans étirement flex pour les égaliser — sans hauteur minimale commune, celui des deux avec le moins de
 * contenu (ex. verso sans hiérarchie IRE/DPE renseignée) ressortait visiblement plus petit que l'autre. */
const CARD_SCREEN_CLASS = "w-[227px] min-h-[360px] print:w-[53.98mm] print:min-h-[85.6mm]";

/** Fine bande tricolore (recto/verso) — touche officielle inspirée des cartes d'identité nationales. */
function TricolorBar() {
  return (
    <div className="flex h-[4px] w-full" aria-hidden>
      <div className="flex-1" style={{ backgroundColor: GUINEA_RED }} />
      <div className="flex-1" style={{ backgroundColor: GUINEA_YELLOW }} />
      <div className="flex-1" style={{ backgroundColor: GUINEA_GREEN }} />
    </div>
  );
}

/** Petit onglet décoratif en haut de chaque face (façon porte-badge à lanière), repris du modèle fourni. */
function LanyardTab() {
  return (
    <div className="flex items-center justify-center gap-1 bg-white py-1 print:py-0.5" aria-hidden>
      <span className="h-[3px] w-5 rounded-full bg-brand-200 print:w-3" />
      <span className="h-[5px] w-[5px] rounded-full bg-brand-400 print:h-[3px] print:w-[3px]" />
      <span className="h-[3px] w-5 rounded-full bg-brand-200 print:w-3" />
    </div>
  );
}

/**
 * Vague décorative, une seule couche : un unique tracé SVG (coordonnées fixes dans son `viewBox`, donc
 * un résultat prévisible quelle que soit la largeur réelle de la carte — contrairement à un empilement
 * de formes CSS décalées, plus difficile à calibrer sans aperçu visuel). `flip` retourne la vague
 * (utilisée en bas de carte, en miroir de celle du haut).
 */
function Wave({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden
      className={`block h-4 w-full text-brand-500 print:h-2 ${flip ? "rotate-180" : ""}`}>
      <path d="M0,8 Q100,24 200,8 L200,0 L0,0 Z" fill="currentColor" />
    </svg>
  );
}

/** Ligne « libellé : valeur » alignée, réutilisée recto (identité) et verso (infos officielles). */
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
 * enseignants et personnel — reproduit la maquette fournie par l'établissement (bandeau coloré, photo
 * ronde en chevauchement sur une vague) : recto (photo, identité) +
 * verso officiel (QR de vérification, armoiries de la Guinée en filigrane, devise nationale, hiérarchie
 * IRE/DPE/DSSEE, devise et slogan de l'école). Impression isolée des deux faces, l'une après l'autre,
 * indépendante de la modale qui l'affiche.
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
      {/* À l'impression : recto et verso côte à côte sur une seule page (papier bristol à découper et
          plastifier), chacun à la taille réelle d'un badge à lanière (portrait, 53,98 × 85,6 mm) — à
          l'écran, l'aperçu est affiché à cette même taille réelle (voir CARD_SCREEN_CLASS). */}
      <div ref={badgeRef} className="print:flex print:flex-row print:gap-0">
        <div className="print:relative print:flex print:flex-col">
          <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 print:hidden">Recto</p>
          {/* `min-h` + `flex-1` (pas `h` seul) : une hauteur figée + `overflow-hidden` écrasait/rognait
              la dernière ligne dès que le rendu d'impression du texte prenait quelques pixels de plus
              que prévu (variable selon navigateur/moteur d'impression). `flex-1` sur le parent en
              `flex-col` fait en sorte que le recto s'étire à la même hauteur que le verso (côte à côte
              dans la rangée, `align-items: stretch` par défaut) — sans quoi le côté le plus court
              ressortait visiblement plus petit que l'autre. */}
          <div className={`badge-printable mx-auto flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg print:flex-1 print:rounded-none print:border-0 print:shadow-none ${CARD_SCREEN_CLASS}`}>
            <LanyardTab />

            {/* En-tête aux couleurs de l'école */}
            <div className="bg-gradient-to-r from-brand-700 to-brand-500 px-3 pb-1.5 pt-2 print:px-2 print:pb-1 print:pt-1">
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

            {/* Vague de transition — la photo (ci-dessous) chevauche cette vague comme sur le modèle. */}
            <Wave />

            {/* Photo en chevauchement, centrée */}
            <div className="relative z-10 -mt-6 flex justify-center print:-mt-3">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="photo" className="h-16 w-16 rounded-full border-[3px] border-white bg-white object-cover shadow-md print:h-9 print:w-9 print:border-2" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white shadow-md print:h-9 print:w-9 print:border-2 print:text-[8px]">
                  {initials}
                </div>
              )}
            </div>

            {/* Identité + informations */}
            <div className="flex-1 px-3.5 pb-3 pt-1.5 print:px-2 print:pb-1.5 print:pt-1">
              <p className="truncate text-center text-[13px] font-bold leading-tight text-slate-900 print:text-[8px]">{fullName}</p>
              {subtitle && <p className="truncate text-center text-[10px] text-brand-700 print:text-[6px]">{subtitle}</p>}
              <div className="mt-2 space-y-1 print:mt-1 print:space-y-0.5">
                {fields.map((f) => (
                  <FieldRow key={f.label} label={f.label} value={f.value} mono={f.mono} />
                ))}
              </div>
            </div>

            {/* Deuxième vague décorative en bas de carte, comme sur le modèle. */}
            <Wave flip />
            <TricolorBar />
          </div>
        </div>

        {/* Ligne de découpe entre recto et verso, visible uniquement à l'impression (papier bristol à
            découper puis plastifier) — recto et verso sortent côte à côte sur une seule page. */}
        {/* Pas de hauteur fixe : s'étire (align-items: stretch, par défaut) sur la hauteur réelle du
            recto/verso, quelle qu'elle soit une fois le contenu rendu. */}
        <div className="hidden print:block print:border-l print:border-dashed print:border-slate-300" aria-hidden />

        <div className="print:relative print:flex print:flex-col">
          <p className="mb-1 mt-4 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 print:mt-0 print:hidden">Verso</p>
          <BadgeBack
            schoolMotto={branding?.motto}
            schoolSlogan={branding?.slogan}
            schoolName={branding?.schoolName}
            ire={branding?.ire}
            dpeLabel={branding?.dpeLabel}
            sousPrefectureLabel={branding?.sousPrefectureLabel}
            qrData={qrData}
            footerNote={footerNote}
          />
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

/**
 * Verso officiel : QR de vérification (repris du modèle fourni, où le QR figure au verso plutôt qu'au
 * recto), hiérarchie administrative (IRE, DPE/DCE, DSSEE — renseignables dans Paramètres), armoiries de
 * la République de Guinée en filigrane, devise nationale, puis la devise et le slogan de l'établissement.
 */
function BadgeBack({
  schoolMotto,
  schoolSlogan,
  schoolName,
  ire,
  dpeLabel,
  sousPrefectureLabel,
  qrData,
  footerNote,
}: {
  schoolMotto?: string | null;
  schoolSlogan?: string | null;
  schoolName?: string | null;
  ire?: string | null;
  dpeLabel?: string | null;
  sousPrefectureLabel?: string | null;
  qrData?: string | null;
  footerNote?: string;
}) {
  return (
    <div className={`badge-printable mx-auto flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg print:flex-1 print:rounded-none print:border-0 print:shadow-none ${CARD_SCREEN_CLASS}`}>
      <LanyardTab />
      <TricolorBar />

      {/* Zone colorée en haut du verso, symétrique du recto — pas de bandeau noir. La devise nationale
          est collée juste sous le titre (dans la même zone), pas séparée par la vague. */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-500 px-2 pb-1 pt-2 text-center print:pb-0.5 print:pt-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-white print:text-[5.5px]">République de Guinée</p>
        <p className="text-[7.5px] italic text-white/85 print:text-[5px]">Travail — Justice — Solidarité</p>
      </div>
      <Wave />

      <div className="relative flex-1 px-3 pb-4 pt-2 print:px-2 print:pb-2 print:pt-1">
        {/* Armoiries en filigrane : derrière le texte, faible opacité. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/Coat_of_Arms_of_Guinea.svg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 opacity-[0.07] print:h-14 print:w-14"
        />

        {/* Identité de l'établissement — mise en avant (pas noyée dans les lignes d'infos ci-dessous) :
            nom en gras, devise de l'école entre guillemets, slogan en couleur de marque. */}
        {(schoolName || schoolMotto || schoolSlogan) && (
          <div className="relative space-y-0.5 text-center">
            {schoolName && <p className="text-[11px] font-bold text-slate-900 print:text-[7px]">{schoolName}</p>}
            {schoolMotto && <p className="text-[9px] italic text-slate-600 print:text-[5.5px]">« {schoolMotto} »</p>}
            {schoolSlogan && <p className="text-[9px] font-medium text-brand-700 print:text-[5.5px]">{schoolSlogan}</p>}
          </div>
        )}

        <div className="relative mt-2 space-y-0.5 print:mt-1">
          {ire && <FieldRow label="IRE" value={ire} />}
          {dpeLabel && <FieldRow label="DPE/DCE" value={dpeLabel} />}
          {sousPrefectureLabel && <FieldRow label="DSSEE" value={sousPrefectureLabel} />}
        </div>
      </div>

      {/* QR (vérification) + signature, en chevauchement sur la vague du bas — exactement comme sur le
          modèle fourni (QR en bas à gauche posé sur la vague, signature en bas à droite). */}
      <div className="relative">
        <Wave flip />
        {/* Chevauchement limité à la hauteur de la vague elle-même (h-4/print:h-2) — au-delà, la marge
            négative mordait sur le texte IRE/DPE-DCE/DSSEE juste au-dessus au lieu de ne recouvrir que
            la vague décorative. */}
        <div className="relative z-10 -mt-3 flex items-end justify-between gap-2 px-3 pb-2 print:-mt-1.5 print:px-2 print:pb-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-sm print:h-7 print:w-7">
            {qrData ? (
              // Le conteneur (pas le SVG) impose la taille : les attributs width/height bruts posés par
              // la prop `size` de QRCodeSVG ne rétrécissaient pas de façon fiable à l'impression.
              <QRCodeSVG value={qrData} size={44} level="M" marginSize={4} className="h-full w-full" />
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
  );
}
