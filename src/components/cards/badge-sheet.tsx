"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printBadgeSheet } from "@/lib/print-node";
import { IdBadgePortrait } from "./id-badge-portrait";
import type { IdBadgeProps } from "./id-badge";

const BADGES_PER_SHEET = 9;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Planche de badges (57 × 85,6 mm, portrait — légèrement élargi par rapport au CR80 strict de
 * 53,98mm pour mieux occuper la pochette plastique réelle de l'école, §17 cahier des charges) prête
 * pour impression sur papier photo/bristol — 9 par feuille A4 en grille 3×3, SANS marge de page ni
 * ligne de coupure à l'impression (demande explicite de l'école : le papier photo/bristol est
 * prédécoupé ou découpé à la main, un repère imprimé ne sert à rien et mange de la place) — repère en
 * pointillés visible seulement à l'écran, pendant la préparation. Au-delà de 9 badges, plusieurs
 * feuilles sont générées (saut de page entre chacune). Toujours en portrait, quelle que soit
 * l'orientation du modèle de chaque type de badge — une planche à découper mélangeant les orientations
 * n'aurait pas de sens physiquement.
 */
export function BadgeSheet({ badges, onPrinted }: { badges: IdBadgeProps[]; onPrinted?: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const pages = chunk(badges, BADGES_PER_SHEET);

  function print() {
    if (sheetRef.current) printBadgeSheet(sheetRef.current);
    onPrinted?.();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <Button onClick={print} leftSection={<Printer className="h-4 w-4" />}>
          Imprimer la planche ({badges.length} badge{badges.length > 1 ? "s" : ""})
        </Button>
      </div>

      <div ref={sheetRef} className="max-h-[70vh] space-y-6 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 print:max-h-none print:overflow-visible print:border-none print:bg-white print:p-0">
        {pages.map((pageBadges, pageIndex) => (
          <div
            key={pageIndex}
            style={pageIndex < pages.length - 1 ? { pageBreakAfter: "always" } : undefined}
            className="mx-auto w-fit bg-white p-4 print:w-auto print:p-0"
          >
            {/* Masquée à l'impression (print:hidden) — la plupart des navigateurs ajoutent par défaut
                leurs propres en-tête/pied de page (titre, date, numéro de page) lors de l'impression,
                qui grignotent 10-25mm de haut en bas EN PLUS de la marge @page définie dans
                printBadgeSheet — un budget déjà très serré pour faire tenir 3 rangées de cartes CR80
                sur une A4 ne survit pas à cette réservation si cette légende reste imprimée aussi.
                Reste visible à l'écran (utile pendant la préparation). */}
            <p className="mb-3 text-center text-[10px] uppercase tracking-wide text-slate-400 print:hidden">
              {pageBadges.length} badge{pageBadges.length > 1 ? "s" : ""} · 57 × 85,6 mm · Planche {pageIndex + 1}/{pages.length}
              {" · "}Imprimer à 100 % · sans marge · coins arrondis r = 3 mm
            </p>
            {/* Marges/espacements volontairement serrés en impression (voir printBadgeSheet, page sans
                marge désormais) — 3 rangées de cartes CR80 à hauteur RÉELLEMENT fixée à 85,6mm (voir
                IdBadgePortrait) tiennent très largement sur une page A4 complète. Aucune ligne de
                coupure à l'impression (print:border-transparent, demande explicite de l'école — papier
                photo/bristol prédécoupé) : le pointillé visible ci-dessous ne sert qu'à l'écran, pendant
                la préparation. */}
            <div className="grid grid-cols-3 gap-[4mm] print:gap-[1.5mm]">
              {pageBadges.map((props, i) => (
                <div key={i} className="rounded-[4mm] border border-dashed border-slate-300 p-[2mm] print:rounded-none print:border-transparent print:p-0">
                  <IdBadgePortrait {...props} printable={false} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
