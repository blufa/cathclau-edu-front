"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { useBranding } from "@/providers/branding-provider";
import { Button } from "@/components/ui/button";
import { printNode } from "@/lib/print-node";
import type { IdBadgeProps } from "./id-badge";

/** Taille imprimée en PORTRAIT (vertical) — largeur élargie par rapport au CR80 strict (53,98mm) à
 * la demande de l'école, pour mieux occuper la largeur de sa pochette plastique réelle (§17 cahier
 * des charges), 58mm au lieu de 57mm depuis que la planche n'a plus d'espace entre les cartes
 * (voir badge-sheet.tsx, print:gap-0) — cet espace libéré est repris par la largeur plutôt que perdu ;
 * hauteur inchangée (85,6mm). Valeur unique ici : à réajuster ici seulement si besoin.
 * HAUTEUR FIXE (pas min-height) + overflow-hidden à l'impression : une carte plastique réelle a une
 * taille physique fixe, un contenu qui déborderait (nom d'école sur 2 lignes + adresse/IRE/DPE complets
 * + 3 champs clé, le pire cas réaliste) serait de toute façon tronqué par la découpe physique — le
 * laisser pousser la carte au-delà de 85,6mm cassait le calcul "3 rangées tiennent sur une page A4"
 * de `badge-sheet.tsx` et faisait déborder la planche entière sur plusieurs pages. `print:min-h-0` est
 * CRITIQUE ici, pas cosmétique : sans lui, le `min-h-[476px]` de l'aperçu écran (jamais neutralisé à
 * l'impression avant ce correctif) reste actif y compris dans `@media print` et PLANCHE la hauteur
 * réelle à 476px (~126mm) quoi que dise `print:h-[85.6mm]` — `min-height` l'emporte toujours sur un
 * `height` plus petit en CSS. C'était la cause racine du débordement sur plusieurs pages (vérifié sur
 * l'impression réelle de l'école : cartes mesurées à ~126mm au lieu de 85,6mm). À l'écran, min-height
 * reste utilisé (aperçu non contraint, pas de réel risque de pagination). */
const CARD_SCREEN_CLASS =
  "w-[300px] min-h-[476px] print:w-[58mm] print:h-[85.6mm] print:min-h-0 print:overflow-hidden";

/** Libellé court du type de badge pour le bandeau de pied de carte (« Badge élève » → « ELEVE », sans
 * accent — certaines imprimantes/polices de badge rendent mal les majuscules accentuées). */
function shortKind(kind: string): string {
  const stripped = kind.replace(/^Badge\s+(de\s+)?/i, "").toUpperCase();
  return stripped.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Préfixes d'établissement courants abrégés pour laisser de la place au reste du nom sur l'en-tête
 * du badge (demande utilisateur) — seul le préfixe de tête est abrégé, jamais le reste du nom. */
const SCHOOL_NAME_ABBREVIATIONS: [RegExp, string][] = [
  [/^Groupe\s+Scolaire\s+/i, "G.S "],
  [/^Complexe\s+Scolaire\s+/i, "C.S "],
];

function abbreviateSchoolName(name: string): string {
  for (const [pattern, replacement] of SCHOOL_NAME_ABBREVIATIONS) {
    if (pattern.test(name)) return name.replace(pattern, replacement);
  }
  return name;
}

/**
 * Carte d'identité / badge officiel au format PORTRAIT CR80, reproduisant fidèlement la maquette
 * fournie par l'école (découpe/plastification sur papier bristol, voir "Badges scolaires
 * professionnels.pdf") : en-tête coloré arrondi avec fente de dragonne + logo + nom d'établissement,
 * grande photo chevauchant l'en-tête et le corps blanc, identité centrée, jusqu'à trois informations
 * clé (ex. Classe / Né le, ou Service / Fonction / Téléphone) côte à côte, encadré gris avec QR +
 * numéro d'identification + validité,
 * coordonnées de l'établissement, et bandeau coloré de pied de carte indiquant le type de badge.
 * Rendue par {@link IdBadge} quand le modèle résolu est en orientation PORTRAIT.
 */
export function IdBadgePortrait({
  kind, fullName, firstName, lastName, photoUrl, fields, qrData, idNumber, validUntil, academicYearLabel,
  printable = true, primaryColor, secondaryColor,
}: IdBadgeProps) {
  const branding = useBranding().branding;
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  const badgeRef = useRef<HTMLDivElement>(null);
  const accent = primaryColor ?? "#1E3A8A";
  const accent2 = secondaryColor ?? accent;
  const gradientStyle = { backgroundImage: `linear-gradient(135deg, ${accent}, ${accent2})` };
  const grayBoxStyle = { backgroundColor: "#F5F4F1" };

  // La maquette n'affiche que quelques informations clé côte à côte (ex. Classe/Né le, Statut/Matières,
  // Service/Fonction/Téléphone) — au-delà de 3, le reste n'est pas repris pour rester lisible sur une
  // carte de 54mm de large (voir buildBadgeSheet par type de badge pour la liste exacte transmise).
  const metaFields = fields.slice(0, 3);

  function print() {
    if (badgeRef.current) printNode(badgeRef.current);
  }

  return (
    <div className="space-y-3">
      <div ref={badgeRef}>
        <div
          className={`badge-printable relative mx-auto flex flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-xl print:rounded-[3mm] print:border print:shadow-none ${CARD_SCREEN_CLASS}`}
        >
          {/* En-tête coloré : fente de dragonne, logo, nom d'établissement + année scolaire. Le padding
              bas (pb-16) est la seule zone colorée que la photo est autorisée à chevaucher (sa marge
              négative ci-dessous est calée sur cette même valeur) — jamais la ligne logo/nom, pour ne
              pas la masquer. */}
          <div className="relative shrink-0 pb-16 pt-2 print:pb-[8.5mm] print:pt-[1mm]" style={gradientStyle}>
            <div className="mx-auto h-[10px] w-[64px] rounded-full bg-white/90 print:h-[1.4mm] print:w-[11mm]" />
            <div className="mt-3 flex items-center gap-2.5 px-4 print:mt-[0.6mm] print:gap-[0.9mm] print:px-[2.8mm]">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm print:h-[9mm] print:w-[9mm] print:rounded-[1.8mm]">
                {branding?.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logo} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[22px] font-extrabold print:text-[3mm]" style={{ color: accent }}>
                    {(branding?.schoolName ?? "É")[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {/* Pas de troncature avec points de suspension (demande utilisateur) : "Groupe
                    Scolaire"/"Complexe Scolaire" sont abrégés (G.S/C.S) pour gagner de la place ; le
                    reste du nom s'affiche en entier, quitte à passer sur 2 lignes en dernier recours —
                    la marge basse de l'en-tête (pb-16) n'est pas affectée, elle est calée sur
                    elle-même, pas sur la hauteur de ce bloc. */}
                <p className="line-clamp-2 text-[17px] font-bold leading-tight text-white print:text-[3.3mm]">
                  {branding?.schoolName ? abbreviateSchoolName(branding.schoolName) : "Établissement"}
                </p>
                {academicYearLabel && (
                  <p className="truncate text-[11px] leading-tight text-white/75 print:text-[2.1mm]">
                    Année scolaire {academicYearLabel}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Photo — chevauche volontairement le padding bas (coloré, vide) de l'en-tête et le corps
              blanc, jamais la ligne logo/nom (marge négative = pb-16 ci-dessus, pas plus). */}
          <div className="relative z-10 -mt-16 flex justify-center print:-mt-[8.5mm]">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl} alt="photo"
                className="h-[160px] w-[128px] rounded-2xl border-4 border-white bg-slate-100 object-cover shadow-lg print:h-[24mm] print:w-[19mm] print:rounded-[2.8mm] print:border-[0.6mm]"
              />
            ) : (
              <div className="flex h-[160px] w-[128px] items-center justify-center rounded-2xl border-4 border-white bg-slate-100 text-3xl font-semibold text-slate-400 shadow-lg print:h-[24mm] print:w-[19mm] print:rounded-[2.8mm] print:border-[0.6mm] print:text-[5mm]">
                {initials}
              </div>
            )}
          </div>

          {/* Identité, centrée. */}
          <div className="mt-2.5 px-3 text-center print:mt-[0.1mm] print:px-[1.5mm]">
            {firstName && <p className="truncate text-[13px] text-slate-600 print:text-[3.1mm]">{firstName}</p>}
            <p className="truncate text-[22px] font-extrabold leading-tight text-slate-900 print:text-[4.4mm]">
              {lastName ?? fullName}
            </p>
          </div>

          {/* Informations clé côte à côte (2, ex. Classe/Né le — ou 3, ex. Service/Fonction/Téléphone) —
              texte un cran plus petit à 3 champs pour rester lisible sur une carte de 54mm de large. */}
          {metaFields.length > 0 && (
            <div className={`mt-2.5 flex items-start justify-center px-3 print:mt-[0.15mm] print:px-[1.5mm] ${metaFields.length >= 3 ? "gap-2 print:gap-[1.2mm]" : "gap-4 print:gap-[2.5mm]"}`}>
              {metaFields.map((f, i) => (
                <div key={f.label} className="flex items-start">
                  {i > 0 && <div className="mt-0.5 mr-2 h-8 w-px shrink-0 bg-slate-200 print:mr-[1.2mm] print:h-[4.5mm]" />}
                  <div className="min-w-0 text-center">
                    <p className={`font-semibold uppercase tracking-wider text-slate-600 ${metaFields.length >= 3 ? "text-[7.5px] print:text-[2mm]" : "text-[9px] print:text-[2.2mm]"}`}>{f.label}</p>
                    <p className={`truncate font-bold text-slate-800 ${metaFields.length >= 3 ? "text-[11px] print:text-[2.6mm]" : "text-[13px] print:text-[2.9mm]"}`}>{f.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Encadré gris : QR de vérification + numéro d'identification + validité. */}
          <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-2xl px-2.5 py-2 print:mx-[1.5mm] print:mt-[0.3mm] print:gap-[1.5mm] print:rounded-[2.8mm] print:px-[1.5mm] print:py-[0.3mm]" style={grayBoxStyle}>
            {/* QR agrandi (9,5mm → 15mm imprimé, demande direction) : trop petit pour être scanné de
                façon fiable par un téléphone, surtout après plastification (reflets). */}
            <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 print:h-[15mm] print:w-[15mm] print:rounded-[1.8mm]">
              {qrData ? (
                <QRCodeSVG value={qrData} size={72} level="M" marginSize={0} className="h-full w-full" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[8px] text-slate-400">—</div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-[3px] print:space-y-[0.5mm]">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-600 print:text-[2mm]">N° d&apos;identification</p>
              <p className="truncate text-[13.5px] font-bold text-slate-800 print:text-[2.9mm]">{idNumber ?? "—"}</p>
              {validUntil && (
                <>
                  <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-600 print:text-[2mm]">Valide jusqu&apos;au</p>
                  <p className="truncate text-[12px] font-bold text-slate-800 print:text-[2.6mm]">{validUntil}</p>
                </>
              )}
            </div>
          </div>

          {/* Coordonnées de l'école (jamais celles d'un parent) + hiérarchie administrative. */}
          {(branding?.address || branding?.phone || branding?.phone2 || branding?.ire || branding?.dpeLabel || branding?.sousPrefectureLabel) && (
            <div className="mt-2.5 space-y-0.5 px-3 text-center print:mt-[0.3mm] print:space-y-0 print:px-[1.5mm]">
              {branding?.address && (
                <p className="truncate text-[10px] font-semibold text-slate-700 print:text-[2.4mm]">{branding.address}</p>
              )}
              {(branding?.phone || branding?.phone2) && (
                <p className="truncate text-[9px] text-slate-600 print:text-[2.2mm]">
                  {[branding?.phone, branding?.phone2].filter(Boolean).join(" / ")}
                </p>
              )}
              {(branding?.ire || branding?.dpeLabel || branding?.sousPrefectureLabel) && (
                <p className="truncate text-[7.5px] text-slate-600 print:text-[2mm]">
                  {[
                    branding?.ire && `IRE : ${branding.ire}`,
                    branding?.dpeLabel && `DPE/DCE : ${branding.dpeLabel}`,
                    branding?.sousPrefectureLabel && `DSSEE : ${branding.sousPrefectureLabel}`,
                  ].filter(Boolean).join("  ·  ")}
                </p>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Bandeau de pied de carte : type de badge. */}
          <div className="mt-2.5 flex items-center justify-between px-4 py-2.5 print:mt-[0.15mm] print:px-[2.8mm] print:py-[0.3mm]" style={gradientStyle}>
            <span className="text-[13px] font-bold uppercase tracking-[0.15em] text-white print:text-[2.6mm]">{shortKind(kind)}</span>
            <span className="h-2 w-2 rounded-full bg-white/60 print:h-[1.2mm] print:w-[1.2mm]" />
          </div>
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
