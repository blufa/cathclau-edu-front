/**
 * Catalogue des grades (classes) par niveau/cycle, avec les deux nomenclatures (guinéenne et
 * française). Le « niveau » = le cycle (Maternelle, Primaire, Secondaire, Supérieur) ; la « classe »
 * = un grade + une section (ex. « 7ème A »). Partagé entre le formulaire de classe et l'assistant.
 * Les clés « college »/« lycee » sont conservées pour les écoles qui ont créé ces niveaux séparément.
 */
/**
 * Grades groupés par sous-cycle (utile pour l'affichage à sous-titres : Collège / Lycée).
 * Le niveau « Secondaire » couvre à la fois le collège et le lycée.
 */
export const GRADE_GROUPS: Record<string, { group: string; grades: string[] }[]> = {
  maternelle: [{ group: "Maternelle", grades: ["PS", "MS", "GS"] }],
  primaire: [{ group: "Primaire", grades: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"] }],
  secondaire: [
    { group: "Collège", grades: ["6ème", "5ème", "4ème", "3ème", "7ème", "8ème", "9ème", "10ème"] },
    { group: "Lycée", grades: ["2nde", "1ère", "11ème", "12ème", "Terminale"] },
  ],
  college: [{ group: "Collège", grades: ["6ème", "5ème", "4ème", "3ème", "7ème", "8ème", "9ème", "10ème"] }],
  lycee: [{ group: "Lycée", grades: ["2nde", "1ère", "11ème", "12ème", "Terminale"] }],
  superieur: [{ group: "Supérieur", grades: ["L1", "L2", "L3", "M1", "M2"] }],
};

/** Grades à plat par cycle (dérivé de {@link GRADE_GROUPS}) — pour les suggestions du formulaire. */
export const GRADE_CATALOG: Record<string, string[]> = Object.fromEntries(
  Object.entries(GRADE_GROUPS).map(([key, groups]) => [key, groups.flatMap((g) => g.grades)]),
);

/** Lettres de section proposées (une école peut avoir plusieurs classes par grade). */
export const SECTIONS = ["A", "B", "C", "D", "E", "F"];

/**
 * Séries (options) du lycée en Guinée. Le code court entre dans le libellé de la classe
 * (ex. « Terminale SM A »). Liste volontairement isolée ici : elle évoluera avec le système.
 */
export const SERIES: { code: string; name: string }[] = [
  { code: "SM", name: "Sciences Mathématiques" },
  { code: "SS", name: "Sciences Sociales" },
  { code: "SE", name: "Sciences Expérimentales" },
];

/** Grades de lycée concernés par les séries (les autres cycles n'en ont pas). */
export const SERIES_GRADES = new Set(["11ème", "12ème", "Terminale", "1ère"]);

/** Un grade porte-t-il une série (option de lycée) ? */
export function gradeHasSeries(grade: string): boolean {
  return SERIES_GRADES.has(grade.trim());
}

/** Normalise un libellé de cycle (sans accents, minuscules) pour la recherche dans le catalogue. */
export function normalizeCycle(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Grades d'un cycle groupés par sous-cycle (Collège / Lycée…) pour un affichage à sous-titres. */
export function gradeGroupsForCycle(label: string | null | undefined): { group: string; grades: string[] }[] {
  if (!label) return [];
  return GRADE_GROUPS[normalizeCycle(label)] ?? [];
}

/** Grades prédéfinis d'un cycle donné (vide si le cycle n'est pas au catalogue). */
export function gradesForCycle(label: string | null | undefined): string[] {
  if (!label) return [];
  return GRADE_CATALOG[normalizeCycle(label)] ?? [];
}

/**
 * Compose le libellé d'une classe : « grade [série] [section] » (ex. « Terminale SM A », « 6ème B »).
 * Les parties vides sont ignorées.
 */
export function composeClassLabel(grade: string, section: string, series?: string): string {
  return [grade, series ?? "", section].map((p) => p.trim()).filter(Boolean).join(" ");
}
