import { api } from "./client";

// ── 10.1 Académique ────────────────────────────────────────────────────────
export interface ClassAcademicRow {
  classId: number;
  className: string;
  studentCount: number;
  classAverage: string;
  highestAverage: string;
  lowestAverage: string;
  passRate: string;
}
export interface TopStudentRow {
  studentId: number;
  studentName: string;
  classId: number;
  className: string;
  overallAverage: string;
  rank: number | null;
}
export interface AcademicDashboard {
  periodId: number;
  studentCount: number;
  overallAverage: string;
  passRate: string;
  classes: ClassAcademicRow[];
  topStudents: TopStudentRow[];
}

export function getAcademicDashboard(periodId: number, top = 10): Promise<AcademicDashboard> {
  return api.get<AcademicDashboard>("/dashboard/academic", { query: { periodId, top } });
}

// ── 10.2 Financier ─────────────────────────────────────────────────────────
export interface FinanceDashboard {
  invoiced: string;
  collected: string;
  outstanding: string;
  recoveryRate: string;
  unpaidInvoices: number;
}

export function getFinanceDashboard(): Promise<FinanceDashboard> {
  return api.get<FinanceDashboard>("/dashboard/finance");
}

export interface ProjectionMonth {
  year: number;
  month: number;
  expectedInflow: string;
  expectedOutflow: string;
  net: string;
  cumulativeNet: string;
}
export interface CashflowProjection {
  outstandingReceivables: string;
  avgMonthlyCollection: string;
  recurringPayroll: string;
  /** Tendance des encaissements mensuels (régression linéaire simple, §6) : HAUSSE, BAISSE ou STABLE. */
  collectionTrend: "HAUSSE" | "BAISSE" | "STABLE";
  months: ProjectionMonth[];
}

export function getCashflowProjection(months = 6): Promise<CashflowProjection> {
  return api.get<CashflowProjection>("/dashboard/finance/projection", { query: { months } });
}

// ── 10.3 RH ────────────────────────────────────────────────────────────────
export interface TeacherHrRow {
  teacherId: number;
  teacherName: string;
  presentDays: number;
  absentDays: number;
  effectiveHours: number;
  attendanceRate: string;
}
export interface HrDashboard {
  year: number;
  month: number;
  teacherCount: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalEffectiveHours: number;
  teachers: TeacherHrRow[];
}

export function getHrDashboard(year: number, month: number): Promise<HrDashboard> {
  return api.get<HrDashboard>("/dashboard/hr", { query: { year, month } });
}

export interface TeacherPerformanceRow {
  teacherId: number;
  teacherName: string;
  performanceScore: string;
  completionRate: string;
  attendanceRate: string;
  punctualityRate: string;
  effectiveHours: number;
  lateMinutes: number;
}
export interface PerformanceDashboard {
  year: number;
  month: number;
  teacherCount: number;
  teachers: TeacherPerformanceRow[];
}

export function getTeacherPerformance(year: number, month: number): Promise<PerformanceDashboard> {
  return api.get<PerformanceDashboard>("/dashboard/hr/performance", { query: { year, month } });
}

// ── Vision Fondateur ───────────────────────────────────────────────────────
export interface ClassRecoveryRow {
  classId: number;
  className: string;
  invoiced: string;
  collected: string;
  outstanding: string;
  recoveryRate: string;
}
export interface PeriodRecoveryRow {
  periodLabel: string;
  invoiced: string;
  collected: string;
  outstanding: string;
  recoveryRate: string;
}
export interface TopDebtorRow {
  studentId: number;
  studentName: string;
  classId: number | null;
  className: string | null;
  outstanding: string;
}
export interface RecoveryView {
  overall: FinanceDashboard;
  byClass: ClassRecoveryRow[];
  byPeriod: PeriodRecoveryRow[];
  topDebtors: TopDebtorRow[];
}
export interface PayrollMassSummary {
  totalHourlyRateNormal: string;
  totalHourlyRateExam: string;
  teacherMonthlyPayroll: string;
  staffMonthlyPayroll: string;
  totalMonthlyPayroll: string;
  teacherCount: number;
  staffCount: number;
}
/**
 * Masse salariale RÉELLE : contrairement à PayrollMassSummary (part enseignants projetée depuis
 * l'emploi du temps), celle-ci se base sur les heures réellement réalisées (cahier de textes,
 * retards/départs anticipés déjà déduits) — avec le cumul des retards/départs anticipés de tous
 * les enseignants, pour repérer l'écart entre le théorique et le réel.
 */
export interface RealPayrollSummary {
  teacherMonthlyPayroll: string;
  staffMonthlyPayroll: string;
  totalMonthlyPayroll: string;
  totalLateMinutes: number;
  totalEarlyMinutes: number;
  totalRealizedMinutes: number;
}
/** Heures réalisées (cahier de textes) vs heures dues (emploi du temps) ce mois-ci, par enseignant. */
export interface TeacherHoursProgress {
  teacherId: number;
  teacherName: string;
  dueMinutes: number;
  realizedMinutes: number;
}
/** Estimation du salaire dû pour un mois donné, dans la projection sur l'année scolaire. */
export interface MonthProjection {
  year: number;
  month: number;
  teacherPayroll: string;
  staffPayroll: string;
  total: string;
}
/** Projection mois par mois (9 mois par défaut) de la masse salariale, jours ouvrés/fériés pris en compte. */
export interface SchoolYearProjection {
  months: MonthProjection[];
  totalTeachers: string;
  totalStaff: string;
  grandTotal: string;
}
export interface SubsidyStats {
  activeExemptionsCount: number;
  totalExemptions: number;
  partialExemptions: number;
  familyDiscountAmount: string;
  studentsFullySettledMonthlyFees: number;
  estimatedEarlyPaymentSavings: string;
}
export interface FounderAlert {
  level: "INFO" | "WARNING" | "CRITICAL";
  code: string;
  message: string;
}
export interface FounderYearComparison {
  compareAcademicYearId: number;
  invoicedDelta: string;
  collectedDelta: string;
  recoveryRateDelta: string;
}
/** Salaire d'un enseignant précis : son mois affiché + son estimation cumulée jusqu'à la fin de l'année. */
export interface TeacherSalary {
  teacherId: number;
  teacherName: string;
  monthlyPay: string;
  annualProjection: string;
}
export interface FounderDashboard {
  academicYearId: number;
  recovery: RecoveryView;
  payroll: PayrollMassSummary;
  realPayroll: RealPayrollSummary;
  teacherHours: TeacherHoursProgress[];
  payrollProjection: SchoolYearProjection;
  teacherSalaries: TeacherSalary[];
  subsidy: SubsidyStats;
  alerts: FounderAlert[];
  comparison: FounderYearComparison | null;
}

export function getFounderDashboard(
  academicYearId: number,
  /** monthsCount : impose la longueur de la projection de masse salariale (§payroll) — sinon dérivée
   * de la durée réelle restante de l'année scolaire jusqu'à sa date de fin. */
  options?: { year?: number; month?: number; compareAcademicYearId?: number; topDebtors?: number; monthsCount?: number },
): Promise<FounderDashboard> {
  return api.get<FounderDashboard>("/dashboard/founder", {
    query: { academicYearId, ...options },
  });
}
