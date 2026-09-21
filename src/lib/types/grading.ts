/** Grading contracts mirrored from the backend grading module. */

export type AssessmentType = "QUIZ" | "HOMEWORK" | "EXAM" | "FINAL";

export const ASSESSMENT_TYPE_LABEL: Record<AssessmentType, string> = {
  QUIZ: "Interrogation",
  HOMEWORK: "Devoir",
  EXAM: "Composition",
  FINAL: "Examen",
};

export interface Assessment {
  id: number;
  tenantId: number | null;
  classId: number;
  subjectId: number;
  teacherId: number | null;
  periodId: number;
  type: AssessmentType;
  assessmentTypeId?: number | null;
  label: string;
  date: string | null;
  coefficient: string;
  maxScore: string;
}

export interface AssessmentInput {
  classId: number;
  subjectId: number;
  teacherId?: number | null;
  periodId: number;
  type: AssessmentType;
  /** Paramètre de notation configuré (type d'évaluation créé dans Notes → Paramètres) ; optionnel. */
  assessmentTypeId?: number | null;
  label: string;
  date?: string | null;
  coefficient: number;
  maxScore: number;
}

export interface Grade {
  id: number;
  assessmentId: number;
  studentId: number;
  value: string;
  validated: boolean | null;
  enteredAt: string | null;
}

// ── Exams ───────────────────────────────────────────────────────────────────
export type ExamType = "MOCK" | "SEMESTER" | "ANNUAL" | "NATIONAL";
export type ExamStatus = "PLANNED" | "ONGOING" | "COMPLETED";

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  MOCK: "Blanc",
  SEMESTER: "Semestriel",
  ANNUAL: "Annuel",
  NATIONAL: "National",
};
export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  PLANNED: "Planifié",
  ONGOING: "En cours",
  COMPLETED: "Terminé",
};

export interface Exam {
  id: number;
  tenantId: number | null;
  classId: number;
  periodId: number;
  type: ExamType;
  label: string;
  scheduledDate: string | null;
  convocationUrl: string | null;
  status: ExamStatus;
}

export interface ExamInput {
  classId: number;
  periodId: number;
  type: ExamType;
  label: string;
  scheduledDate?: string | null;
}

// ── Report cards (bulletins) ────────────────────────────────────────────────
export type ReportCardStatus = "DRAFT" | "GENERATED" | "PUBLISHED";

export const REPORT_CARD_STATUS_LABEL: Record<ReportCardStatus, string> = {
  DRAFT: "Brouillon",
  GENERATED: "Généré",
  PUBLISHED: "Publié",
};

export interface ReportCard {
  id: number;
  studentId: number;
  classId: number;
  periodId: number;
  overallAverage: string | null;
  classAverage: string | null;
  highestAverage: string | null;
  lowestAverage: string | null;
  rank: number | null;
  classSize: number | null;
  honor: string | null;
  decision: string | null;
  comment: string | null;
  pdfFile: string | null;
  status: ReportCardStatus;
  generatedAt: string | null;
  distinction?: Distinction | null;
}

export type Distinction =
  | "NONE" | "ENCOURAGEMENTS" | "COMPLIMENTS" | "TABLEAU_HONNEUR" | "FELICITATIONS" | "MISE_EN_GARDE";

export const DISTINCTION_LABEL: Record<Distinction, string> = {
  NONE: "—",
  ENCOURAGEMENTS: "Encouragements",
  COMPLIMENTS: "Compliments",
  TABLEAU_HONNEUR: "Tableau d'honneur",
  FELICITATIONS: "Félicitations",
  MISE_EN_GARDE: "Mise en garde",
};

export interface ReportCardLine {
  id: number;
  reportCardId: number;
  subjectId: number;
  subjectAverage: string | null;
  coefficient: string | null;
  weightedAverage: string | null;
  /** Moyenne de cours (interrogations/devoirs) — secondaire uniquement, null au primaire. */
  coursAverage?: string | null;
  /** Moyenne de composition — secondaire uniquement, null au primaire. */
  compoAverage?: string | null;
  subjectRank: number | null;
  comment: string | null;
  teacherName: string | null;
}

// ── Bulletin annuel (agrégation des 2 semestres, calculé à la volée) ────────
export interface AnnualReportCardLine {
  subjectId: number;
  coefficient: string | null;
  s1Cours: string | null;
  s1Compo: string | null;
  s1Average: string | null;
  s2Cours: string | null;
  s2Compo: string | null;
  s2Average: string | null;
  annualAverage: string | null;
}

export interface AnnualReportCard {
  studentId: number;
  classId: number;
  academicYearId: number;
  s1PeriodId: number | null;
  s2PeriodId: number | null;
  lines: AnnualReportCardLine[];
  s1Average: string | null;
  s2Average: string | null;
  overallAverage: string | null;
  rank: number | null;
  classSize: number | null;
  honor: string | null;
  decision: string | null;
}

// ── Grading scale (barème mentions/décisions) ────────────────────────────────
export type CycleGroup = "PRIMAIRE" | "SECONDAIRE";

export const CYCLE_GROUP_LABEL: Record<CycleGroup, string> = {
  PRIMAIRE: "Primaire",
  SECONDAIRE: "Secondaire",
};

export interface GradingScale {
  id: number | null;
  tenantId: number | null;
  cycleGroup: CycleGroup;
  passThreshold: string;
  passableMin: string;
  assezBienMin: string;
  bienMin: string;
  tresBienMin: string;
  felicitationsMin: string;
  complimentsMin: string;
  distinctionNoFailingThreshold: string;
}

export interface GradingScaleInput {
  passThreshold: number;
  passableMin: number;
  assezBienMin: number;
  bienMin: number;
  tresBienMin: number;
  felicitationsMin: number;
  complimentsMin: number;
  distinctionNoFailingThreshold: number;
}

// ── Eliminatory rules (notes éliminatoires par matière) ──────────────────────
export interface EliminatoryRule {
  id: number;
  tenantId: number | null;
  subjectId: number;
  threshold: string;
  decisionLabel: string | null;
  active: boolean;
}

export interface EliminatoryRuleInput {
  subjectId: number;
  threshold: number;
  decisionLabel?: string | null;
  active?: boolean | null;
}

// ── Decision rules (moteur de règles de passage/redoublement) ────────────────
export type DecisionConditionType =
  | "OVERALL_AT_LEAST" | "OVERALL_BELOW" | "SUBJECT_BELOW" | "SUBJECTS_BELOW_COUNT";

export const DECISION_CONDITION_LABEL: Record<DecisionConditionType, string> = {
  OVERALL_AT_LEAST: "Moyenne générale ≥ seuil",
  OVERALL_BELOW: "Moyenne générale < seuil",
  SUBJECT_BELOW: "Note d'une matière < seuil",
  SUBJECTS_BELOW_COUNT: "Nombre de matières < seuil",
};

export interface DecisionRule {
  id: number;
  tenantId: number | null;
  name: string;
  conditionType: DecisionConditionType;
  threshold: string | null;
  subjectId: number | null;
  minCount: number | null;
  decision: string;
  priority: number;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
}

export interface DecisionRuleInput {
  name: string;
  conditionType: DecisionConditionType;
  threshold?: number | null;
  subjectId?: number | null;
  minCount?: number | null;
  decision: string;
  priority?: number | null;
  active?: boolean | null;
  validFrom?: string | null;
  validTo?: string | null;
}

// ── Assessment type configs (types d'évaluation configurables) ───────────────
export interface AssessmentTypeConfig {
  id: number;
  tenantId: number | null;
  code: string;
  label: string;
  defaultCoefficient: string | null;
  weight: string | null;
  color: string | null;
  active: boolean;
}

export interface AssessmentTypeConfigInput {
  code: string;
  label: string;
  defaultCoefficient?: number | null;
  weight?: number | null;
  color?: string | null;
  active?: boolean | null;
}

// ── Assessment session settings (durées de séance par type) ──────────────────
export interface AssessmentSessionSettings {
  id: number | null;
  tenantId: number | null;
  quizMinutes: number | null;
  homeworkMinutes: number | null;
  examMinutes: number | null;
  finalMinutes: number | null;
}

export interface AssessmentSessionSettingsInput {
  quizMinutes: number;
  homeworkMinutes: number;
  examMinutes: number;
  finalMinutes: number;
}

// ── Validation workflow (validation multi-niveaux des bulletins) ─────────────
export type WorkflowStage =
  | "DRAFT" | "SUBMITTED" | "DEPARTMENT_APPROVED" | "STUDIES_APPROVED"
  | "PRINCIPAL_APPROVED" | "PUBLISHED" | "LOCKED";

export const WORKFLOW_STAGE_LABEL: Record<WorkflowStage, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  DEPARTMENT_APPROVED: "Validé responsable pédagogique",
  STUDIES_APPROVED: "Validé direction des études",
  PRINCIPAL_APPROVED: "Validé proviseur",
  PUBLISHED: "Publié",
  LOCKED: "Verrouillé",
};

export interface ValidationWorkflow {
  id: number;
  tenantId: number | null;
  classId: number;
  periodId: number;
  currentStage: WorkflowStage;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ValidationStep {
  id: number;
  tenantId: number | null;
  workflowId: number;
  stage: WorkflowStage;
  action: string;
  actorId: number | null;
  comment: string | null;
  actedAt: string | null;
}

// ── Grade simulation (simulation des bulletins) ──────────────────────────────
export interface StudentSimulation {
  studentId: number;
  studentName: string | null;
  overallAverage: string | null;
  rank: number | null;
  gradedSubjects: number;
  missingSubjects: number[];
  hasNoGrades: boolean;
}

export interface SimulationReport {
  classId: number;
  periodId: number;
  studentCount: number;
  students: StudentSimulation[];
}

// ── Grade history ────────────────────────────────────────────────────────────
export interface GradeHistory {
  id: number;
  gradeId: number;
  oldValue: string | null;
  newValue: string | null;
  changedBy: number | null;
  changedAt: string | null;
  reason: string | null;
}

