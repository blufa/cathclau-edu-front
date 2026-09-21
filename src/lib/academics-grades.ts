/**
 * Catalogue des grades (classes) par cycle, avec les deux nomenclatures (guinéenne et française).
 * Ici, les clés (maternelle, primaire, secondaire…) désignent le cycle d'enseignement ; chaque grade
 * listé (PS, 7ème, Terminale…) correspond à un niveau précis ; la « classe » = un grade + une section
 * (ex. « 7ème A »). Partagé entre le formulaire de classe et l'assistant. Les clés « college »/« lycee »
 * sont conservées pour les écoles qui ont créé ces niveaux séparément.
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

/**
 * Code canonique du grade (miroir de l'enum backend `Grade`) pour chaque libellé affiché du
 * catalogue ci-dessus — nécessaire pour persister le grade précis d'une classe (voir `class-form.tsx`)
 * plutôt que de le laisser uniquement dans le libellé texte de la classe. Le champ Grade côté
 * `Classe` n'existe plus sur `Niveau` depuis la réforme du catalogue de référentiels (réduit à
 * Maternelle/Primaire/Secondaire) : la précision fine vit désormais ici.
 */
export const GRADE_CODE_BY_LABEL: Record<string, string> = {
  "PS": "PETITE_SECTION",
  "MS": "MOYENNE_SECTION",
  "GS": "GRANDE_SECTION",
  "CP1": "CP1",
  "CP2": "CP2",
  "CE1": "CE1",
  "CE2": "CE2",
  "CM1": "CM1",
  "CM2": "CM2",
  "6ème": "SIXIEME",
  "5ème": "CINQUIEME",
  "4ème": "QUATRIEME",
  "3ème": "TROISIEME",
  "7ème": "SEPTIEME",
  "8ème": "HUITIEME",
  "9ème": "NEUVIEME",
  "10ème": "DIXIEME",
  "2nde": "SECONDE",
  "1ère": "PREMIERE",
  "11ème": "ONZIEME",
  "12ème": "DOUZIEME",
  "Terminale": "TERMINALE",
};

/** Table inverse (code backend → libellé affiché), pour retrouver le libellé d'un grade déjà persisté. */
export const GRADE_LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(GRADE_CODE_BY_LABEL).map(([label, code]) => [code, label]),
);

/** Résout le libellé saisi/choisi dans le formulaire vers le code `Grade` backend canonique, ou
 * `null` si le libellé ne correspond à aucune entrée connue du catalogue (nomenclature maison —
 * dégradation gracieuse : la classe reste créable, seulement sans grade exploitable finement). */
export function resolveGradeCode(label: string | null | undefined): string | null {
  if (!label) return null;
  return GRADE_CODE_BY_LABEL[label.trim()] ?? null;
}

/** Progression plate de tous les grades (maternelle → terminale), dans l'ordre canonique — miroir de
 * l'enum backend `Grade`. Utilisé pour suggérer le grade suivant lors d'une réinscription. */
export const GRADE_PROGRESSION: string[] = [
  "PS", "MS", "GS",
  "CP1", "CP2", "CE1", "CE2", "CM1", "CM2",
  "6ème", "7ème", "5ème", "8ème", "4ème", "9ème", "3ème", "10ème",
  "2nde", "11ème", "1ère", "12ème", "Terminale",
];

/** Rang de progression d'un grade affiché (par libellé), ou -1 si non reconnu. */
export function gradeProgressionRank(grade: string | null | undefined): number {
  if (!grade) return -1;
  return GRADE_PROGRESSION.indexOf(grade.trim());
}
