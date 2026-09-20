import type { BadgeKind, CardTemplate } from "@/lib/types/student-card";

/** Couleurs de repli par type de badge — garantissent que élève/enseignant/personnel restent
 * visuellement distincts même avant toute personnalisation (Paramètres → Modèles de badge). */
const DEFAULT_BADGE_COLORS: Record<BadgeKind, { primaryColor: string; secondaryColor: string }> = {
  STUDENT: { primaryColor: "#14b8a6", secondaryColor: "#0f766e" }, // teal
  TEACHER: { primaryColor: "#059669", secondaryColor: "#065f46" }, // emerald
  STAFF: { primaryColor: "#7c3aed", secondaryColor: "#5b21b6" }, // violet
};

/** Résout les couleurs à appliquer sur un badge : celles du modèle par défaut du type demandé si un
 * modèle actif existe, sinon la couleur de repli distincte de ce type. */
export function resolveBadgeColors(templates: CardTemplate[] | null | undefined, kind: BadgeKind): { primaryColor: string; secondaryColor: string } {
  const active = (templates ?? []).find((t) => t.badgeKind === kind && t.isDefault && t.active !== false);
  if (active?.primaryColor && active?.secondaryColor) {
    return { primaryColor: active.primaryColor, secondaryColor: active.secondaryColor };
  }
  return DEFAULT_BADGE_COLORS[kind];
}
