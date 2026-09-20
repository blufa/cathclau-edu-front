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
  /** Kind of badge, shown as a coloured pill under the school name (ex. « Badge élève »). */
  kind: string;
  /** Person's full name — used for the QR payload, initials and print title ; also shown as a single
   * « Nom » row unless {@link firstName}/{@link lastName} are provided to split it in two rows. */
  fullName: string;
  /** Quand fournis (avec {@link lastName}), affiche « Nom » et « Prénom » sur deux lignes séparées,
   * comme sur la maquette fournie — sinon repli sur une seule ligne « Nom » avec {@link fullName}. */
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  /** Champs « libellé : valeur » affichés à côté de la photo (ex. Classe, Né le, Matières...) — chaque
   * type de badge (élève/enseignant/personnel) fournit sa propre liste, dans l'ordre voulu. */
  fields: IdBadgeField[];
  /** Content encoded in the QR code (signed verify string for students, identifier otherwise). */
  qrData?: string | null;
  /** Small note next to the QR (ex. « Vérifiable par scan »). */
  footerNote?: string;
  /** Numéro affiché sous la photo (ex. matricule/n° de carte) — comme sur la maquette fournie. */
  idNumber?: string | null;
  /** Année scolaire affichée en filet vertical sur le bord droit de la carte (ex. « 2026-2027 »). */
  academicYearLabel?: string | null;
  /** Show the print button (default true). */
  printable?: boolean;
  /** Couleurs du modèle (CardTemplate) pour ce type de badge — dégradé d'accent (bandeaux, pastille du
   * type de badge, teintes de fond) qui distingue élève (sarcelle)/enseignant (émeraude)/personnel
   * (violet) au premier coup d'œil, voir resolveBadgeColors. */
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

/** Taille réelle d'une carte CR80 tenue en PAYSAGE (horizontal) — 85,6 × 53,98 mm, appliquée aussi bien
 * à l'écran qu'à l'impression pour que l'aperçu corresponde exactement au badge imprimé/plastifié.
 * Reproduit la maquette fournie par l'école (logo + nom + slogan en en-tête, photo + informations au
 * centre, QR + hiérarchie administrative en pied de carte), avec une identité colorée par type de
 * badge. */
const CARD_SCREEN_CLASS = "w-[380px] min-h-[240px] print:w-[85.6mm] print:min-h-[53.98mm]";

/** Ajoute une transparence (alpha en hexadécimal 2 chiffres) à une couleur hex #RRGGBB — pour des
 * teintes de fond douces dérivées de la couleur d'accent, sans dépendance à une lib de couleurs. */
function withAlpha(hex: string, alpha: string): string | undefined {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : undefined;
}

/** Ligne « libellé : valeur » alignée — inspirée des cartes professionnelles : libellé discret (gris,
 * casse normale, poids régulier), valeur qui porte l'information (poids medium, jamais criée en gras
 * plein ni en majuscules). Largeur de libellé un peu généreuse pour ne jamais tronquer « Tél. » ni
 * « DPE/DCE ». */
function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[11.5px] leading-tight print:text-[6.5px]">
      <span className="w-16 shrink-0 text-slate-400 print:w-11">{label}</span>
      <span className={mono ? "truncate font-mono font-medium text-slate-700" : "truncate font-medium text-slate-700"}>{value}</span>
    </div>
  );
}

/**
 * Carte d'identité / badge officiel (format PAYSAGE), réutilisable pour élèves, enseignants et
 * personnel — reproduit la maquette fournie par l'école : logo + nom + slogan de l'établissement en
 * en-tête, type de badge en pastille colorée, photo + informations (identité, classe/fonction...) au
 * centre, année scolaire en filet vertical sur le bord droit, QR de vérification + hiérarchie
 * administrative (IRE/DPE-DCE) en pied de carte — avec une identité colorée distincte par type de badge.
 */
export function IdBadge({
  kind, fullName, firstName, lastName, photoUrl, fields, qrData, footerNote, idNumber, academicYearLabel,
  printable = true, primaryColor, secondaryColor,
}: IdBadgeProps) {
  const branding = useBranding().branding;
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  const badgeRef = useRef<HTMLDivElement>(null);
  const accent = primaryColor ?? "#14b8a6";
  const accent2 = secondaryColor ?? accent;
  const gradientStyle = { backgroundImage: `linear-gradient(90deg, ${accent}, ${accent2})` };
  const softTint = { backgroundColor: withAlpha(accent, "0d") ?? "#f8fafc" };
  const softerTint = { backgroundColor: withAlpha(accent, "14") ?? "#f1f5f9" };

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
        <div
          className={`badge-printable mx-auto flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl print:rounded-none print:border print:shadow-none ${CARD_SCREEN_CLASS}`}
        >
          {/* Bandeau d'accent — identité colorée du type de badge (élève/enseignant/personnel). */}
          <div className="h-[5px] w-full shrink-0 print:h-[2px]" style={gradientStyle} />

          <div className="flex flex-1">
            <div className="flex flex-1 flex-col px-3.5 pt-2.5 print:px-2 print:pt-1">
              {/* En-tête : logo + nom/slogan de l'établissement, type de badge en pastille colorée. */}
              <div className="flex items-start gap-2.5 print:gap-1.5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-sm print:h-7 print:w-7"
                  style={{ borderColor: accent }}
                >
                  {branding?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={branding.logo} alt="logo" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-[13px] font-extrabold print:text-[7px]" style={{ color: accent }}>
                      {(branding?.schoolName ?? "É")[0]}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-[13.5px] font-semibold leading-tight text-slate-800 print:text-[7.5px]">
                    {branding?.schoolName ?? "Établissement"}
                  </p>
                  {branding?.slogan && (
                    <p className="truncate text-[8.5px] italic leading-tight text-slate-400 print:text-[5px]">{branding.slogan}</p>
                  )}
                  <span
                    className="mt-1 inline-block rounded-full px-2 py-[1px] text-[9px] font-medium text-white print:mt-0.5 print:px-1 print:text-[5.5px]"
                    style={{ backgroundColor: accent }}
                  >
                    {kind}
                  </span>
                </div>
              </div>

              {/* Corps : photo + identité/informations, côte à côte. */}
              <div className="mt-2.5 flex flex-1 gap-3 print:mt-1.5 print:gap-2">
                <div className="flex shrink-0 flex-col items-center gap-1">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl} alt="photo"
                      className="h-24 w-24 rounded-xl border-[3px] bg-white object-cover shadow-md print:h-14 print:w-14 print:border-2"
                      style={{ borderColor: accent }}
                    />
                  ) : (
                    <div
                      className="flex h-24 w-24 items-center justify-center rounded-xl border-[3px] bg-slate-50 text-xl font-semibold shadow-md print:h-14 print:w-14 print:border-2 print:text-[10px]"
                      style={{ borderColor: accent, color: accent }}
                    >
                      {initials}
                    </div>
                  )}
                  {idNumber && (
                    <p className="max-w-[80px] truncate text-center font-mono text-[9px] text-slate-400 print:max-w-14 print:text-[5px]">{idNumber}</p>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1 pt-0.5 print:space-y-0.5">
                  {firstName && lastName ? (
                    <>
                      <FieldRow label="Nom" value={lastName} />
                      <FieldRow label="Prénom" value={firstName} />
                    </>
                  ) : (
                    <FieldRow label="Nom" value={fullName} />
                  )}
                  {fields.map((f) => (
                    <FieldRow key={f.label} label={f.label} value={f.value} mono={f.mono} />
                  ))}
                </div>
              </div>
            </div>

            {/* Année scolaire, en filet vertical sur le bord droit — comme sur la maquette fournie. */}
            {academicYearLabel && (
              <div className="flex w-5 shrink-0 items-center justify-center border-l border-slate-100 print:w-3" style={softTint}>
                <span
                  className="rotate-180 whitespace-nowrap text-[7.5px] font-medium tracking-wide [writing-mode:vertical-rl] print:text-[4.5px]"
                  style={{ color: accent }}
                >
                  {academicYearLabel}
                </span>
              </div>
            )}
          </div>

          {/* Pied de carte : QR de vérification (agrandi) + hiérarchie administrative (IRE/DPE-DCE). */}
          <div className="flex items-end justify-between gap-2.5 border-t border-slate-100 px-3.5 py-2 print:px-2 print:py-1" style={softerTint}>
            <div className="min-w-0 flex-1 space-y-0.5">
              {branding?.ire && <FieldRow label="IRE" value={branding.ire} />}
              {branding?.dpeLabel && <FieldRow label="DPE/DCE" value={branding.dpeLabel} />}
              {footerNote && (
                <p className="mt-0.5 truncate text-[7.5px] font-medium italic text-slate-400 print:text-[4.5px]">{footerNote}</p>
              )}
            </div>
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-white p-1.5 shadow-sm print:h-16 print:w-16 print:border"
              style={{ borderColor: accent }}
            >
              {qrData ? (
                <QRCodeSVG value={qrData} size={64} level="M" marginSize={0} className="h-full w-full" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[8px] text-slate-400">—</div>
              )}
            </div>
          </div>

          {/* Bandeau d'accent — miroir du bandeau supérieur, effet « carte officielle ». */}
          <div className="h-[5px] w-full shrink-0 print:h-[2px]" style={gradientStyle} />
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
