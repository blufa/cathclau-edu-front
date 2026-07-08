export type DisciplineCategory =
  | "BEHAVIOR" | "UNJUSTIFIED_ABSENCE" | "LATENESS" | "VIOLENCE" | "CHEATING" | "DAMAGE" | "OTHER";
export type DisciplineSeverity = "MINOR" | "MODERATE" | "SERIOUS";
export type DisciplineStatus = "REPORTED" | "RESOLVED" | "DISMISSED";

export const CATEGORY_LABEL: Record<DisciplineCategory, string> = {
  BEHAVIOR: "Comportement",
  UNJUSTIFIED_ABSENCE: "Absence injustifiée",
  LATENESS: "Retards",
  VIOLENCE: "Violence",
  CHEATING: "Tricherie",
  DAMAGE: "Dégradation",
  OTHER: "Autre",
};

export const SEVERITY_LABEL: Record<DisciplineSeverity, string> = {
  MINOR: "Légère",
  MODERATE: "Moyenne",
  SERIOUS: "Grave",
};

export const DISCIPLINE_STATUS_LABEL: Record<DisciplineStatus, string> = {
  REPORTED: "Signalé",
  RESOLVED: "Résolu",
  DISMISSED: "Classé",
};

export type MeasureKind = "NONE" | "PUNITION" | "SANCTION";
export type DisciplineMeasure =
  | "OBSERVATION" | "CONVOCATION_FAMILLE" | "EXCUSES" | "DEVOIR_SUPPLEMENTAIRE" | "RETENUE" | "TRAVAUX_INTERET" | "EXCLUSION_COURS"
  | "AVERTISSEMENT_ORAL" | "AVERTISSEMENT_ECRIT" | "EXCLUSION_INCLUSION" | "BLAME" | "MESURE_RESPONSABILISATION" | "EXCLUSION_TEMPORAIRE" | "EXCLUSION_DEFINITIVE" | "AUTRE";
export type Suspension = "NONE" | "PARTIAL" | "TOTAL";
export type DecisionBody = "TEACHER" | "HEAD" | "DISCIPLINE_COUNCIL" | "EDUCATIONAL_COMMITTEE";

export const MEASURE_KIND_LABEL: Record<MeasureKind, string> = { NONE: "—", PUNITION: "Punition", SANCTION: "Sanction" };

/** Mesures regroupées par nature (punitions scolaires / sanctions disciplinaires). */
export const PUNITION_MEASURES: DisciplineMeasure[] = ["OBSERVATION", "CONVOCATION_FAMILLE", "EXCUSES", "DEVOIR_SUPPLEMENTAIRE", "RETENUE", "TRAVAUX_INTERET", "EXCLUSION_COURS"];
export const SANCTION_MEASURES: DisciplineMeasure[] = ["AVERTISSEMENT_ORAL", "AVERTISSEMENT_ECRIT", "EXCLUSION_INCLUSION", "BLAME", "MESURE_RESPONSABILISATION", "EXCLUSION_TEMPORAIRE", "EXCLUSION_DEFINITIVE", "AUTRE"];

export const MEASURE_LABEL: Record<DisciplineMeasure, string> = {
  OBSERVATION: "Observation (carnet)",
  CONVOCATION_FAMILLE: "Convocation des familles",
  EXCUSES: "Excuses orales/écrites",
  DEVOIR_SUPPLEMENTAIRE: "Devoir supplémentaire",
  RETENUE: "Retenue (mercredi/samedi)",
  TRAVAUX_INTERET: "Travaux d'intérêt collectif",
  EXCLUSION_COURS: "Exclusion d'un cours",
  AVERTISSEMENT_ORAL: "Avertissement oral",
  AVERTISSEMENT_ECRIT: "Avertissement écrit",
  EXCLUSION_INCLUSION: "Exclusion-inclusion",
  BLAME: "Blâme",
  MESURE_RESPONSABILISATION: "Mesure de responsabilisation",
  EXCLUSION_TEMPORAIRE: "Exclusion temporaire",
  EXCLUSION_DEFINITIVE: "Exclusion définitive",
  AUTRE: "Autre",
};

export const SUSPENSION_LABEL: Record<Suspension, string> = { NONE: "Sans sursis", PARTIAL: "Sursis partiel", TOTAL: "Sursis total" };
export const DECISION_BODY_LABEL: Record<DecisionBody, string> = {
  TEACHER: "Enseignant / personnel",
  HEAD: "Chef d'établissement",
  DISCIPLINE_COUNCIL: "Conseil de discipline",
  EDUCATIONAL_COMMITTEE: "Commission éducative",
};

export interface DisciplineIncident {
  id: number;
  studentId: number;
  classId: number | null;
  incidentDate: string;
  category: DisciplineCategory;
  severity: DisciplineSeverity;
  description: string;
  sanction: string | null;
  reportedBy: number | null;
  status: DisciplineStatus;
  parentNotified: boolean;
  createdAt: string | null;
  measureKind?: MeasureKind | null;
  measure?: DisciplineMeasure | null;
  suspension?: Suspension | null;
  exclusionDays?: number | null;
  decisionBody?: DecisionBody | null;
}

export interface DisciplineInput {
  studentId: number;
  classId?: number | null;
  incidentDate?: string | null;
  category: DisciplineCategory;
  severity: DisciplineSeverity;
  description: string;
  sanction?: string | null;
  measureKind?: MeasureKind | null;
  measure?: DisciplineMeasure | null;
  suspension?: Suspension | null;
  exclusionDays?: number | null;
  decisionBody?: DecisionBody | null;
}
