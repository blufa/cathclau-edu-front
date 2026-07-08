/**
 * Catalogue des matières enseignées dans le système guinéen, groupées par cycle (Primaire, Collège,
 * Lycée). Utilisé pour l'ajout groupé (cases à cocher par cycle) et comme suggestions (liste
 * déroulante) dans le formulaire de matière, tout en laissant la saisie libre.
 */
export const SUBJECT_CATALOG_BY_CYCLE: { cycle: string; subjects: string[] }[] = [
  {
    cycle: "Primaire",
    subjects: [
      "Lecture",
      "Écriture",
      "Français",
      "Grammaire",
      "Conjugaison",
      "Orthographe",
      "Vocabulaire",
      "Expression écrite",
      "Calcul",
      "Mathématiques",
      "Étude du milieu",
      "Histoire",
      "Géographie",
      "Éducation Civique et Morale",
      "Éducation Physique et Sportive",
      "Dessin",
      "Chant",
      "Éducation Islamique",
      "Arabe",
    ],
  },
  {
    cycle: "Collège",
    subjects: [
      "Français",
      "Anglais",
      "Mathématiques",
      "Physique",
      "Chimie",
      "Sciences de la Vie et de la Terre",
      "Histoire",
      "Géographie",
      "Éducation Civique et Morale",
      "Éducation Physique et Sportive",
      "Arts plastiques",
      "Informatique",
      "Arabe",
      "Éducation Islamique",
    ],
  },
  {
    cycle: "Lycée",
    subjects: [
      "Français",
      "Anglais",
      "Philosophie",
      "Mathématiques",
      "Physique",
      "Chimie",
      "Sciences de la Vie et de la Terre",
      "Histoire",
      "Géographie",
      "Économie",
      "Éducation Civique et Morale",
      "Éducation Physique et Sportive",
      "Informatique",
      "Espagnol",
      "Allemand",
      "Arabe",
      "Éducation Islamique",
      "Comptabilité",
    ],
  },
];

/** Liste plate et dédoublonnée des matières (pour les suggestions de l'autocomplétion). */
export const SUBJECT_CATALOG: string[] = [
  ...new Set(SUBJECT_CATALOG_BY_CYCLE.flatMap((g) => g.subjects)),
];

/** Normalise un libellé (sans accents, minuscules) pour comparer matières/cycles. */
export function normalizeLabel(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Matières du programme d'un cycle donné (« Primaire », « Collège », « Lycée »…). Utilisé pour
 * pré-affecter automatiquement les matières standard aux classes créées. Vide si cycle inconnu.
 */
export function subjectsForCycle(cycleName: string | null | undefined): string[] {
  if (!cycleName) return [];
  const norm = normalizeLabel(cycleName);
  return SUBJECT_CATALOG_BY_CYCLE.find((g) => normalizeLabel(g.cycle) === norm)?.subjects ?? [];
}
