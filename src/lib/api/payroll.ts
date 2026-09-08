import { api, apiBlobUrl } from "@/lib/api/client";
import type {
  FeeDeduction,
  Payslip,
  PayslipLine,
  PayslipLineType,
  PayslipStatus,
  RuleComputation,
  SalaryFeeDeductionRule,
  SalaryFeeDeductionRuleInput,
  SalaryRule,
  SalaryStructure,
} from "@/lib/types/payroll";

// ── Structures & règles ──────────────────────────────────────────────────────
export function listStructures(): Promise<SalaryStructure[]> {
  return api.get<SalaryStructure[]>("/payroll/structures");
}
export function createStructure(input: { name: string; code?: string | null }): Promise<SalaryStructure> {
  return api.post<SalaryStructure>("/payroll/structures", input);
}
export function deleteStructure(id: number): Promise<void> {
  return api.delete<void>(`/payroll/structures/${id}`);
}
export function listRules(structureId: number): Promise<SalaryRule[]> {
  return api.get<SalaryRule[]>(`/payroll/structures/${structureId}/rules`);
}
export function addRule(structureId: number, input: {
  label: string; code?: string | null; category?: string | null;
  lineType: PayslipLineType; computation: RuleComputation; value: number; sequence?: number;
}): Promise<SalaryRule> {
  return api.post<SalaryRule>(`/payroll/structures/${structureId}/rules`, input);
}
export function deleteRule(ruleId: number): Promise<void> {
  return api.delete<void>(`/payroll/structures/rules/${ruleId}`);
}

// ── Fiches de paie ────────────────────────────────────────────────────────────
export function listPayslips(params?: { teacherId?: number; status?: PayslipStatus }): Promise<Payslip[]> {
  return api.get<Payslip[]>("/payroll/payslips", { query: { teacherId: params?.teacherId, status: params?.status } });
}
export function getPayslipLines(id: number): Promise<PayslipLine[]> {
  return api.get<PayslipLine[]>(`/payroll/payslips/${id}/lines`);
}
/** Nature du salarié (§7.1) : enseignant (défaut) ou personnel non-enseignant. */
export type EmployeeType = "TEACHER" | "ADMINISTRATIVE" | "DIRECTION" | "SUPPORT";

export function generatePayslip(input: {
  employeeType?: EmployeeType | null;
  teacherId: number; teacherName?: string | null; periodLabel: string; periodStart?: string | null; periodEnd?: string | null;
  baseSalary: number; structureId?: number | null; notes?: string | null;
  absentDays?: number | null; workingDays?: number | null;
  overtimeHours?: number | null; overtimeRate?: number | null; overtimeMultiplier?: number | null;
}): Promise<Payslip> {
  return api.post<Payslip>("/payroll/payslips", input);
}

/** Flux PDF (A5 stylé) de la fiche de paie servi par le backend (object URL local). */
export function getPayslipPdfObjectUrl(id: number): Promise<string> {
  return apiBlobUrl(`/payroll/payslips/${id}/pdf/download`);
}
export function generateBatch(input: {
  periodLabel: string; periodStart?: string | null; periodEnd?: string | null; structureId?: number | null;
  wages: { teacherId: number; baseSalary: number }[];
}): Promise<Payslip[]> {
  return api.post<Payslip[]>("/payroll/payslips/batch", input);
}
export function addPayslipLine(id: number, input: { label: string; lineType: PayslipLineType; amount: number }): Promise<Payslip> {
  return api.post<Payslip>(`/payroll/payslips/${id}/lines`, input);
}
export function removePayslipLine(id: number, lineId: number): Promise<Payslip> {
  return api.delete<Payslip>(`/payroll/payslips/${id}/lines/${lineId}`);
}
export function approvePayslip(id: number): Promise<Payslip> {
  return api.patch<Payslip>(`/payroll/payslips/${id}/approve`);
}
export function payPayslip(id: number, paymentMethod = "BANK_TRANSFER"): Promise<Payslip> {
  return api.patch<Payslip>(`/payroll/payslips/${id}/pay`, { paymentMethod });
}
export function deletePayslip(id: number): Promise<void> {
  return api.delete<void>(`/payroll/payslips/${id}`);
}
export function bankFileUrl(): Promise<string> {
  return apiBlobUrl("/payroll/payslips/bank-file");
}

/** Statistiques de présence d'un enseignant sur une période (pour pré-remplir les absences en paie). */
export function getTeacherAttendanceStats(teacherId: number, from?: string | null, to?: string | null): Promise<{ teacherId: number; totalDays: number; presentDays: number; absentDays: number }> {
  return api.get(`/attendance/teachers/${teacherId}/stats`, { query: { from: from ?? undefined, to: to ?? undefined } });
}

// ── Rémunération (mode horaire/fixe) & paie mensuelle ───────────────────────────
export type PayMode = "HOURLY" | "FIXED";
export interface TeacherCompensation {
  id: number; tenantId: number | null; teacherId: number;
  payMode: PayMode;
  /** Tarif horaire pour les classes normales / classes d'examen (§6). */
  hourlyRateNormal: string; hourlyRateExam: string;
  fixedSalary: string;
}
/** Mois précis (année + mois) où l'enseignant est payé pendant les vacances — avantage accordé au
 * cas par cas par la direction (§6), voir addVacationPayMonth/listVacationPayMonths. */
export interface TeacherVacationPayMonth {
  id: number; tenantId: number | null; teacherId: number; year: number; month: number;
}
/** Paie basée sur les heures réellement réalisées (cahier de textes), retard/départ anticipé cumulés
 * déduits, répartie par typologie de classe (normal/examen, §6) pour appliquer le bon tarif à chacune. */
export interface MonthlyPay {
  teacherId: number; year: number; month: number; payMode: string;
  realizedMinutes: number; lateMinutes: number; earlyMinutes: number; effectiveMinutes: number;
  normalEffectiveMinutes: number; examEffectiveMinutes: number;
  hourlyRateNormal: string; hourlyRateExam: string;
  fixedSalary: string; teachingPay: string; grossPay: string;
}
/** Paie calculée automatiquement depuis l'emploi du temps validé, par typologie de classe (§6). */
export interface TheoreticalMonthlyPay {
  teacherId: number; year: number; month: number; payMode: string;
  normalMinutes: number; examMinutes: number;
  hourlyRateNormal: string; hourlyRateExam: string; fixedSalary: string;
  teachingPay: string; grossPay: string;
}
export function getCompensation(teacherId: number): Promise<TeacherCompensation | null> {
  return api.get<TeacherCompensation>(`/payroll/compensation/${teacherId}`).catch(() => null);
}
export function setCompensation(
  teacherId: number,
  input: { payMode: PayMode; hourlyRateNormal: number; hourlyRateExam: number; fixedSalary: number },
): Promise<TeacherCompensation> {
  return api.put<TeacherCompensation>(`/payroll/compensation/${teacherId}`, input);
}
export function listVacationPayMonths(teacherId: number): Promise<TeacherVacationPayMonth[]> {
  return api.get<TeacherVacationPayMonth[]>(`/payroll/compensation/${teacherId}/vacation-pay`);
}
export function addVacationPayMonth(teacherId: number, year: number, month: number): Promise<TeacherVacationPayMonth> {
  return api.post<TeacherVacationPayMonth>(`/payroll/compensation/${teacherId}/vacation-pay`, undefined, { query: { year, month } });
}
export function removeVacationPayMonth(teacherId: number, id: number): Promise<void> {
  return api.delete<void>(`/payroll/compensation/${teacherId}/vacation-pay/${id}`);
}
export function getMonthlyPay(teacherId: number, year: number, month: number): Promise<MonthlyPay> {
  return api.get<MonthlyPay>(`/payroll/teachers/${teacherId}/monthly-pay`, { query: { year, month } });
}
export function getTheoreticalPay(teacherId: number, year: number, month: number): Promise<TheoreticalMonthlyPay> {
  return api.get<TheoreticalMonthlyPay>(`/payroll/teachers/${teacherId}/theoretical-pay`, { query: { year, month } });
}
/** Génère automatiquement la fiche de paie du mois (brut basé sur les heures réalisées). */
export function generatePayslipFromHours(
  teacherId: number, year: number, month: number, teacherName?: string | null, structureId?: number | null,
): Promise<Payslip> {
  return api.post<Payslip>(`/payroll/teachers/${teacherId}/payslip`,
    { teacherName: teacherName ?? null, structureId: structureId ?? null }, { query: { year, month } });
}
/** Génère automatiquement la fiche de paie du mois depuis l'emploi du temps validé (§6), sans saisie manuelle. */
export function generatePayslipFromTimetable(teacherId: number, year: number, month: number, teacherName?: string | null): Promise<Payslip> {
  return api.post<Payslip>(`/payroll/teachers/${teacherId}/payslip-timetable`, { teacherName: teacherName ?? null }, { query: { year, month } });
}

// ── Règles de déduction sur salaire (frais scolarité enfants du personnel) ───
export function listFeeDeductionRules(): Promise<SalaryFeeDeductionRule[]> {
  return api.get<SalaryFeeDeductionRule[]>("/payroll/fee-deduction-rules");
}
export function createFeeDeductionRule(input: SalaryFeeDeductionRuleInput): Promise<SalaryFeeDeductionRule> {
  return api.post<SalaryFeeDeductionRule>("/payroll/fee-deduction-rules", input);
}
export function updateFeeDeductionRule(id: number, input: SalaryFeeDeductionRuleInput): Promise<SalaryFeeDeductionRule> {
  return api.put<SalaryFeeDeductionRule>(`/payroll/fee-deduction-rules/${id}`, input);
}
export function deleteFeeDeductionRule(id: number): Promise<void> {
  return api.delete<void>(`/payroll/fee-deduction-rules/${id}`);
}
export function previewFeeDeduction(teacherId: number): Promise<FeeDeduction> {
  return api.get<FeeDeduction>("/payroll/fee-deduction-rules/preview", { query: { teacherId } });
}
