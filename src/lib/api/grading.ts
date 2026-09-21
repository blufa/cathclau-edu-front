import { api } from "@/lib/api/client";
import type {
  Assessment,
  AssessmentInput,
  AssessmentSessionSettings,
  AssessmentSessionSettingsInput,
  AssessmentTypeConfig,
  AssessmentTypeConfigInput,
  AnnualReportCard,
  CycleGroup,
  DecisionRule,
  DecisionRuleInput,
  EliminatoryRule,
  EliminatoryRuleInput,
  Exam,
  ExamInput,
  Grade,
  GradeHistory,
  GradingScale,
  GradingScaleInput,
  ReportCard,
  ReportCardLine,
  SimulationReport,
  ValidationStep,
  ValidationWorkflow,
  WorkflowStage,
} from "@/lib/types/grading";

// ── Assessments ──────────────────────────────────────────────────────────
export function listAssessmentsByClass(classId: number): Promise<Assessment[]> {
  return api.get<Assessment[]>(`/grading/assessments/class/${classId}`);
}

export function createAssessment(input: AssessmentInput): Promise<Assessment> {
  return api.post<Assessment>("/grading/assessments", input);
}

export function updateAssessment(id: number, input: AssessmentInput): Promise<Assessment> {
  return api.put<Assessment>(`/grading/assessments/${id}`, input);
}

export function deleteAssessment(id: number): Promise<void> {
  return api.delete<void>(`/grading/assessments/${id}`);
}

// ── Grades ───────────────────────────────────────────────────────────────
export function getAssessmentGrades(assessmentId: number): Promise<Grade[]> {
  return api.get<Grade[]>(`/grading/grades/assessment/${assessmentId}`);
}

export function enterBulkGrades(
  assessmentId: number,
  grades: { studentId: number; value: number }[],
): Promise<Grade[]> {
  return api.post<Grade[]>(`/grading/assessments/${assessmentId}/grades/bulk`, { grades });
}

export function validateAllGrades(assessmentId: number): Promise<Grade[]> {
  return api.patch<Grade[]>(`/grading/assessments/${assessmentId}/grades/validate`);
}

/** Unlocks a single validated grade so it can be corrected (SCHOOL_ADMIN/DIRECTOR only). */
export function unlockGrade(id: number): Promise<Grade> {
  return api.put<Grade>(`/grading/grades/${id}/unlock`);
}

// ── Exams ────────────────────────────────────────────────────────────────
export function listExamsByClass(classId: number): Promise<Exam[]> {
  return api.get<Exam[]>(`/grading/exams/class/${classId}`);
}

export function createExam(input: ExamInput): Promise<Exam> {
  return api.post<Exam>("/grading/exams", input);
}

export function startExam(id: number): Promise<Exam> {
  return api.put<Exam>(`/grading/exams/${id}/start`);
}

export function completeExam(id: number): Promise<Exam> {
  return api.put<Exam>(`/grading/exams/${id}/complete`);
}

export function deleteExam(id: number): Promise<void> {
  return api.delete<void>(`/grading/exams/${id}`);
}

// ── Surveillance des examens (composition : surveillants par salle) ─────────────
export interface ExamSupervision {
  id: number; tenantId: number; examId: number; roomId: number; teacherId: number;
}
export function listExamSupervisions(examId: number): Promise<ExamSupervision[]> {
  return api.get<ExamSupervision[]>(`/grading/exams/${examId}/supervisions`);
}
export function assignExamSupervisor(examId: number, roomId: number, teacherId: number): Promise<ExamSupervision> {
  return api.post<ExamSupervision>(`/grading/exams/${examId}/supervisions`, { roomId, teacherId });
}
export function removeExamSupervision(examId: number, supervisionId: number): Promise<void> {
  return api.delete<void>(`/grading/exams/${examId}/supervisions/${supervisionId}`);
}

/** Returns { url } when ready, or { status: "GENERATING" } (HTTP 202) while generating. */
export function getExamConvocation(id: number): Promise<{ url?: string; status?: string }> {
  return api.get<{ url?: string; status?: string }>(`/grading/exams/${id}/convocation`);
}

/** Flux PDF de la convocation servi par le backend (object URL local) — indépendant de Cloudinary. */
export function getExamConvocationObjectUrl(id: number): Promise<string> {
  return api.blobUrl(`/grading/exams/${id}/convocation/download`);
}

// ── Report cards (bulletins) ──────────────────────────────────────────────
export function generateReportCardsBulk(classId: number, periodId: number): Promise<ReportCard[]> {
  return api.post<ReportCard[]>("/grading/report-cards/generate-bulk", { classId, periodId });
}

export function listReportCards(classId: number, periodId: number): Promise<ReportCard[]> {
  return api.get<ReportCard[]>("/grading/report-cards", { query: { classId, periodId } });
}

export function getReportCardLines(id: number): Promise<ReportCardLine[]> {
  return api.get<ReportCardLine[]>(`/grading/report-cards/${id}/lines`);
}

export function publishReportCard(id: number): Promise<ReportCard> {
  return api.patch<ReportCard>(`/grading/report-cards/${id}/publish`);
}

/** Ajuste l'appréciation du conseil de classe (override du calcul automatique). */
export function setReportCardDistinction(id: number, distinction: import("@/lib/types/grading").Distinction): Promise<ReportCard> {
  return api.patch<ReportCard>(`/grading/report-cards/${id}/distinction`, undefined, { query: { distinction } });
}

export function getReportCardPdf(id: number): Promise<{ url?: string; status?: string }> {
  return api.get<{ url?: string; status?: string }>(`/grading/report-cards/${id}/pdf`);
}

/** Flux PDF du bulletin servi par le backend (object URL local) — indépendant de Cloudinary. */
export function getReportCardPdfObjectUrl(id: number): Promise<string> {
  return api.blobUrl(`/grading/report-cards/${id}/pdf/download`);
}

/** All report cards of a student across every period — the multi-year school record (livret). */
export function getStudentReportCards(studentId: number): Promise<ReportCard[]> {
  return api.get<ReportCard[]>(`/students/${studentId}/report-cards`);
}

/** All grades of a student, optionally filtered by period. */
export function getStudentGrades(studentId: number, periodId?: number): Promise<Grade[]> {
  return api.get<Grade[]>(`/students/${studentId}/grades`, { query: { periodId } });
}

/** Une ligne de la feuille de notes : un élève de la classe avec sa note saisie (ou vide). */
export interface GradeSheetRow {
  studentId: number;
  studentNumber: string | null;
  fullName: string;
  gradeId: number | null;
  value: string | null;
  validated: boolean | null;
}

/** Feuille de notes d'une évaluation : tous les élèves de la classe avec leur note saisie. */
export function getGradeSheet(assessmentId: number): Promise<GradeSheetRow[]> {
  return api.get<GradeSheetRow[]>(`/grading/assessments/${assessmentId}/grade-sheet`);
}

export function listAssessmentsByPeriod(periodId: number): Promise<Assessment[]> {
  return api.get<Assessment[]>(`/grading/assessments/period/${periodId}`);
}

export function listExamsByPeriod(periodId: number): Promise<Exam[]> {
  return api.get<Exam[]>(`/grading/exams/period/${periodId}`);
}

// ── Grades: validation & history ─────────────────────────────────────────────
export function validateGrade(id: number): Promise<Grade> {
  return api.put<Grade>(`/grading/grades/${id}/validate`);
}

export function getGradeHistory(id: number): Promise<GradeHistory[]> {
  return api.get<GradeHistory[]>(`/grading/grades/${id}/history`);
}

export function getStudentGradesById(studentId: number, periodId?: number): Promise<Grade[]> {
  return api.get<Grade[]>(`/grading/grades/student/${studentId}`, { query: { periodId } });
}

// ── Report cards (par classe / élève & période) ──────────────────────────────
export function getReportCardsByClassPeriod(classId: number, periodId: number): Promise<ReportCard[]> {
  return api.get<ReportCard[]>(`/grading/report-cards/class/${classId}/period/${periodId}`);
}

export function getReportCardByStudentPeriod(studentId: number, periodId: number): Promise<ReportCard> {
  return api.get<ReportCard>(`/grading/report-cards/student/${studentId}/period/${periodId}`);
}

/** Centralisateur de classe (PDF) : une ligne par élève, colonnes Cours/Composition par matière. */
export function getClassCentralizerPdfObjectUrl(classId: number, periodId: number): Promise<string> {
  return api.blobUrl(`/grading/report-cards/class/${classId}/period/${periodId}/centralisateur/download`);
}

/** Fiche de notes vierge (PDF) à imprimer et donner à l'enseignant : liste des élèves de la classe. */
export function getAssessmentPlanPdfObjectUrl(classId: number, subjectId: number, academicYearId: number): Promise<string> {
  return api.blobUrl(`/grading/assessments/plan/pdf`, { query: { classId, subjectId, academicYearId } });
}

/** PDF téléchargeable d'UNE évaluation précise (ex. l'épreuve orale d'octobre), notes déjà saisies incluses. */
export function getAssessmentGradeSheetPdfObjectUrl(assessmentId: number): Promise<string> {
  return api.blobUrl(`/grading/assessments/${assessmentId}/pdf`);
}

// ── Bulletin annuel (agrégation des 2 semestres) ─────────────────────────────
export function getAnnualReportCards(classId: number, academicYearId: number): Promise<AnnualReportCard[]> {
  return api.get<AnnualReportCard[]>("/grading/report-cards/annual", { query: { classId, academicYearId } });
}

export function getAnnualReportCard(studentId: number, classId: number, academicYearId: number): Promise<AnnualReportCard> {
  return api.get<AnnualReportCard>(`/grading/report-cards/annual/${studentId}`, { query: { classId, academicYearId } });
}

export function getAnnualReportCardPdfObjectUrl(studentId: number, classId: number, academicYearId: number): Promise<string> {
  return api.blobUrl(`/grading/report-cards/annual/${studentId}/pdf/download`, { query: { classId, academicYearId } });
}

// ── Grading scale (barème, un par groupe de cycle primaire/secondaire) ──────
export function getGradingScale(cycleGroup: CycleGroup): Promise<GradingScale> {
  return api.get<GradingScale>("/grading/scale", { query: { cycleGroup } });
}

export function updateGradingScale(cycleGroup: CycleGroup, input: GradingScaleInput): Promise<GradingScale> {
  return api.put<GradingScale>("/grading/scale", input, { query: { cycleGroup } });
}

// ── Assessment session settings (durées de séance) ───────────────────────────
export function getAssessmentSessionSettings(): Promise<AssessmentSessionSettings> {
  return api.get<AssessmentSessionSettings>("/grading/assessment-session-settings");
}

export function updateAssessmentSessionSettings(
  input: AssessmentSessionSettingsInput,
): Promise<AssessmentSessionSettings> {
  return api.put<AssessmentSessionSettings>("/grading/assessment-session-settings", input);
}

// ── Eliminatory rules (notes éliminatoires) ──────────────────────────────────
export function listEliminatoryRules(): Promise<EliminatoryRule[]> {
  return api.get<EliminatoryRule[]>("/grading/eliminatory-rules");
}
export function createEliminatoryRule(input: EliminatoryRuleInput): Promise<EliminatoryRule> {
  return api.post<EliminatoryRule>("/grading/eliminatory-rules", input);
}
export function updateEliminatoryRule(id: number, input: EliminatoryRuleInput): Promise<EliminatoryRule> {
  return api.put<EliminatoryRule>(`/grading/eliminatory-rules/${id}`, input);
}
export function deleteEliminatoryRule(id: number): Promise<void> {
  return api.delete<void>(`/grading/eliminatory-rules/${id}`);
}

// ── Decision rules (règles de passage/redoublement) ──────────────────────────
export function listDecisionRules(): Promise<DecisionRule[]> {
  return api.get<DecisionRule[]>("/grading/decision-rules");
}
export function createDecisionRule(input: DecisionRuleInput): Promise<DecisionRule> {
  return api.post<DecisionRule>("/grading/decision-rules", input);
}
export function updateDecisionRule(id: number, input: DecisionRuleInput): Promise<DecisionRule> {
  return api.put<DecisionRule>(`/grading/decision-rules/${id}`, input);
}
export function deleteDecisionRule(id: number): Promise<void> {
  return api.delete<void>(`/grading/decision-rules/${id}`);
}

// ── Assessment type configs (types d'évaluation configurables) ───────────────
export function listAssessmentTypes(): Promise<AssessmentTypeConfig[]> {
  return api.get<AssessmentTypeConfig[]>("/grading/assessment-types");
}
export function getAssessmentType(id: number): Promise<AssessmentTypeConfig> {
  return api.get<AssessmentTypeConfig>(`/grading/assessment-types/${id}`);
}
export function createAssessmentType(input: AssessmentTypeConfigInput): Promise<AssessmentTypeConfig> {
  return api.post<AssessmentTypeConfig>("/grading/assessment-types", input);
}
export function updateAssessmentType(id: number, input: AssessmentTypeConfigInput): Promise<AssessmentTypeConfig> {
  return api.put<AssessmentTypeConfig>(`/grading/assessment-types/${id}`, input);
}
export function deleteAssessmentType(id: number): Promise<void> {
  return api.delete<void>(`/grading/assessment-types/${id}`);
}

// ── Validation workflow (validation multi-niveaux des bulletins) ─────────────
export function getValidationWorkflow(classId: number, periodId: number): Promise<ValidationWorkflow> {
  return api.get<ValidationWorkflow>("/grading/validation-workflows", { query: { classId, periodId } });
}
export function advanceValidationWorkflow(id: number, comment?: string): Promise<ValidationWorkflow> {
  return api.post<ValidationWorkflow>(`/grading/validation-workflows/${id}/advance`, { comment });
}
export function rejectValidationWorkflow(
  id: number,
  targetStage: WorkflowStage,
  comment?: string,
): Promise<ValidationWorkflow> {
  return api.post<ValidationWorkflow>(`/grading/validation-workflows/${id}/reject`, { targetStage, comment });
}
export function getValidationWorkflowHistory(id: number): Promise<ValidationStep[]> {
  return api.get<ValidationStep[]>(`/grading/validation-workflows/${id}/history`);
}

// ── Grade simulation (bulletins à blanc) ─────────────────────────────────────
export function simulateGrades(classId: number, periodId: number): Promise<SimulationReport> {
  return api.get<SimulationReport>("/grading/simulation", { query: { classId, periodId } });
}

/** Palmarès / tableau d'honneur d'une classe (PDF, élèves classés par rang) — object URL local. */
export function getClassHonorRollPdfObjectUrl(classId: number, periodId: number): Promise<string> {
  return api.blobUrl(`/grading/report-cards/class/${classId}/period/${periodId}/palmares/download`);
}

/** Relevé de notes d'une matière (classe + période) : chaque évaluation + moyenne calculée. */
export interface ReleveAssessment {
  id: number;
  label: string | null;
  type: string | null;
  date: string | null;
  maxScore: string | null;
  coefficient: string | null;
}
export interface ReleveRow {
  studentId: number;
  studentNumber: string | null;
  fullName: string;
  notes: Record<string, string | null>;
  average: string | null;
}
export interface SubjectGradeReport {
  tenantId: number | null;
  classId: number;
  subjectId: number;
  periodId: number;
  className: string | null;
  subjectName: string | null;
  periodLabel: string | null;
  schoolYear: string | null;
  assessments: ReleveAssessment[];
  rows: ReleveRow[];
}

export function getSubjectGradeReport(classId: number, subjectId: number, periodId: number): Promise<SubjectGradeReport> {
  return api.get<SubjectGradeReport>(`/grading/classes/${classId}/subjects/${subjectId}/periods/${periodId}/releve`);
}

/** Relevé de notes d'une matière (PDF) — object URL local. `month` (1-12) limite au relevé de ce mois. */
export function getSubjectGradeReportPdfObjectUrl(classId: number, subjectId: number, periodId: number, month?: number): Promise<string> {
  return api.blobUrl(`/grading/classes/${classId}/subjects/${subjectId}/periods/${periodId}/releve/download`, { query: { month } });
}
