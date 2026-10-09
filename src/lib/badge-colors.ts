import type { BadgeKind, CardOrientation, CardTemplate } from "@/lib/types/student-card";

/** Couleurs de repli par type de badge — reproduisent exactement la maquette fournie par l'école
 * (badge-élève-diallo.png / "Badges scolaires professionnels.pdf" : bleu/bordeaux/vert sarcelle)
 * tant qu'aucun modèle personnalisé n'a été créé (Paramètres → Modèles de badge). */
const DEFAULT_BADGE_COLORS: Record<BadgeKind, { primaryColor: string; secondaryColor: string }> = {
  STUDENT: { primaryColor: "#1E3A8A", secondaryColor: "#2563EB" }, // bleu (maquette élève)
  TEACHER: { primaryColor: "#7C1D2E", secondaryColor: "#9F2742" }, // bordeaux (maquette enseignant)
  STAFF: { primaryColor: "#0F5C4F", secondaryColor: "#14706B" }, // vert sarcelle foncé (maquette personnel)
};

/** Résout les couleurs ET l'orientation à appliquer sur un badge : celles du modèle par défaut du type
 * demandé si un modèle actif existe, sinon la couleur de repli distincte de ce type et l'orientation
 * PORTRAIT (maquette fournie par l'école, voir IdBadgePortrait). */
export function resolveBadgeColors(
  templates: CardTemplate[] | null | undefined, kind: BadgeKind,
): { primaryColor: string; secondaryColor: string; orientation: CardOrientation } {
  const active = (templates ?? []).find((t) => t.badgeKind === kind && t.isDefault && t.active !== false);
  if (active?.primaryColor && active?.secondaryColor) {
    return { primaryColor: active.primaryColor, secondaryColor: active.secondaryColor, orientation: active.orientation ?? "PORTRAIT" };
  }
  return { ...DEFAULT_BADGE_COLORS[kind], orientation: "PORTRAIT" };
}
