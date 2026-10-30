import { api, apiBlobUrl } from "@/lib/api/client";
import type {
  ChildDeductionDetail,
  FeeDeduction,
  Payslip,
  PayslipEmployeeType,
  PayslipLine,
  PayslipLineType,
  PayslipStatus,
  RuleComputation,
  SalaryAdvance,
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
  /** Coordonnées de virement (téléphone Mobile Money prioritaire, sinon compte bancaire), figées sur
   * la fiche pour le fichier bancaire (bouton « Fichier bancaire »). */
  teacherPhone?: string | null; bankAccount?: string | null;
}): Promise<Payslip> {
  return api.post<Payslip>("/payroll/payslips", input);
}

/** Flux PDF (A5 stylé) de la fiche de paie servi par le backend (object URL local). */
export function getPayslipPdfObjectUrl(id: number): Promise<string> {
  return apiBlobUrl(`/payroll/payslips/${id}/pdf/download`);
}
export function generateBatch(input: {
  periodLabel: string; periodStart?: string | null; periodEnd?: string | null; structureId?: number | null;
  wages: { teacherId: number; baseSalary: number; teacherName?: string | null; teacherPhone?: string | null; bankAccount?: string | null }[];
}): Promise<Payslip[]> {
  return api.post<Payslip[]>("/payroll/payslips/batch", input);
}
export function addPayslipLine(id: number, input: { label: string; lineType: PayslipLineType; amount: number }): Promise<Payslip> {
  return api.post<Payslip>(`/payroll/payslips/${id}/lines`, input);
}

/** Fiche de paie combinée pour un personnel direction/administratif qui enseigne aussi (§payroll) :
 * une seule fiche, salaire de base fixe + une ligne d'heures d'enseignement calculée automatiquement
 * depuis l'enseignant lié (`Employee.linkedTeacherId`). */
export function generateCombinedPayslip(input: {
  year: number; month: number; employeeId: number; employeeName?: string | null;
  employeeType: EmployeeType; baseSalary: number; linkedTeacherId: number; structureId?: number | null;
  employeePhone?: string | null; bankAccount?: string | null;
}): Promise<Payslip> {
  return api.post<Payslip>("/payroll/payslips/combined", {
    employeeId: input.employeeId, employeeName: input.employeeName, employeeType: input.employeeType,
    baseSalary: input.baseSalary, linkedTeacherId: input.linkedTeacherId, structureId: input.structureId,
    employeePhone: input.employeePhone, bankAccount: input.bankAccount,
  }, { query: { year: input.year, month: input.month } });
}
export function removePayslipLine(id: number, lineId: number): Promise<Payslip> {
  return api.delete<Payslip>(`/payroll/payslips/${id}/lines/${lineId}`);
}
/** Recalcule la ligne "Reste avantage personnel" d'une fiche encore modifiable — à appeler après avoir
 * retiré/réinclus une facture au cas par cas (modal "Détail de la retenue"), qui ne se répercute jamais
 * tout seul sur le montant déjà posé sur la fiche. */
export function refreshStaffBenefitDeductionLine(id: number): Promise<Payslip> {
  return api.post<Payslip>(`/payroll/payslips/${id}/refresh-staff-deduction`);
}
export function approvePayslip(id: number): Promise<Payslip> {
  return api.patch<Payslip>(`/payroll/payslips/${id}/approve`);
}
/** paymentMethod : "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" — jamais de valeur par défaut ici
 * (§retour utilisateur : marquer payée imposait silencieusement "Virement bancaire" même pour un
 * paiement en espèces) ; le comptable choisit explicitement dans le modal "Marquer comme payée". */
export function payPayslip(id: number, paymentMethod: string): Promise<Payslip> {
  return api.patch<Payslip>(`/payroll/payslips/${id}/pay`, { paymentMethod });
}
export function deletePayslip(id: number): Promise<void> {
  return api.delete<void>(`/payroll/payslips/${id}`);
}
// ── Self-service enseignant (« Ma paie ») ────────────────────────────────────
/** Mes propres fiches de paie (rôle TEACHER) — jamais celles d'un collègue, vérifié côté backend. */
export function listMyPayslips(): Promise<Payslip[]> {
  return api.get<Payslip[]>("/payroll/payslips/mine");
}
export function getMyPayslip(id: number): Promise<Payslip> {
  return api.get<Payslip>(`/payroll/payslips/mine/${id}`);
}
export function getMyPayslipPdfObjectUrl(id: number): Promise<string> {
  return apiBlobUrl(`/payroll/payslips/mine/${id}/pdf/download`);
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
/** Paie basée sur les heures réellement réalisées (cahier de textes — durée choisie séance par séance
 * dans le modal « Réaliser », théorique ou pointée), répartie par typologie de classe (normal/examen,
 * §6) pour appliquer le bon tarif à chacune. lateMinutes/earlyMinutes sont purement informatifs
 * (affichés sur la fiche de paie) : ils ne réduisent plus effectiveMinutes, toujours égal à
 * realizedMinutes. */
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
export const TEACHER_CYCLE_LABEL: Record<"MATERNELLE" | "PRIMAIRE" | "SECONDAIRE", string> = {
  MATERNELLE: "Maternelle", PRIMAIRE: "Primaire", SECONDAIRE: "Secondaire",
};
/** Cycle (MATERNELLE/PRIMAIRE/SECONDAIRE) de chaque enseignant demandé, déduit de ses classes
 * assignées — pour la colonne "Cycle" (Rémunération & heures) et la sélection rapide par niveau
 * (Générer en lot). */
export function getTeacherCycles(teacherIds: number[]): Promise<Record<number, "MATERNELLE" | "PRIMAIRE" | "SECONDAIRE">> {
  if (teacherIds.length === 0) return Promise.resolve({});
  return api.get("/payroll/teachers-cycle", { query: { teacherIds: teacherIds.join(",") } });
}

/** Toutes les rémunérations paramétrées du tenant — pour afficher le salaire de chaque enseignant
 * directement dans un tableau, sans ouvrir sa fiche (colonne "Salaire", Rémunération & heures). */
export function listCompensations(): Promise<TeacherCompensation[]> {
  return api.get<TeacherCompensation[]>("/payroll/compensation");
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
  teacherPhone?: string | null, bankAccount?: string | null,
): Promise<Payslip> {
  return api.post<Payslip>(`/payroll/teachers/${teacherId}/payslip`,
    { teacherName: teacherName ?? null, structureId: structureId ?? null,
      teacherPhone: teacherPhone ?? null, bankAccount: bankAccount ?? null },
    { query: { year, month } });
}
/** Génère automatiquement la fiche de paie du mois depuis l'emploi du temps validé (§6), sans saisie manuelle. */
export function generatePayslipFromTimetable(
  teacherId: number, year: number, month: number, teacherName?: string | null,
  teacherPhone?: string | null, bankAccount?: string | null,
): Promise<Payslip> {
  return api.post<Payslip>(`/payroll/teachers/${teacherId}/payslip-timetable`,
    { teacherName: teacherName ?? null, teacherPhone: teacherPhone ?? null, bankAccount: bankAccount ?? null },
    { query: { year, month } });
}
/** Génère la fiche du mois à partir d'heures réalisées saisies MANUELLEMENT par le comptable (§retour
 * comptable) — pour le cas où le cahier de textes n'a aucune séance validée ce mois (ex. directeur des
 * études n'a pas créé les séances), alors qu'une fiche doit quand même être générée pour appliquer les
 * retenues du mois (avances sur salaire, enfants de personnel). Le tarif reste celui configuré pour
 * l'enseignant, seules les heures sont saisies. normalMinutes/examMinutes en minutes (pas en heures). */
export function generatePayslipFromManualHours(
  teacherId: number, year: number, month: number, normalMinutes: number, examMinutes: number,
  teacherName?: string | null, teacherPhone?: string | null, bankAccount?: string | null,
): Promise<Payslip> {
  return api.post<Payslip>(`/payroll/teachers/${teacherId}/payslip-manual-hours`,
    { teacherName: teacherName ?? null, teacherPhone: teacherPhone ?? null, bankAccount: bankAccount ?? null,
      normalMinutes, examMinutes },
    { query: { year, month } });
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
export function previewFeeDeduction(teacherId: number, employeeType: PayslipEmployeeType = "TEACHER"): Promise<FeeDeduction> {
  return api.get<FeeDeduction>("/payroll/fee-deduction-rules/preview", { query: { teacherId, employeeType } });
}

/** Détail de la retenue "avantage personnel", enfant par enfant (modal de détail de la fiche de paie). */
export function getStaffBenefitDeductionDetail(
  staffId: number, employeeType: PayslipEmployeeType, year: number, month: number,
): Promise<ChildDeductionDetail[]> {
  return api.get<ChildDeductionDetail[]>("/payroll/fee-deduction-rules/detail", { query: { staffId, employeeType, year, month } });
}

/** Exclut (ou réintègre) spécifiquement UN enfant de la retenue — par enfant, pour le cas où certains
 *  enfants du même salarié bénéficient de l'avantage personnel et d'autres sont payés directement par
 *  un parent (§retour comptable). */
export function setChildStaffDeductionExcluded(
  staffId: number, employeeType: PayslipEmployeeType, studentId: number, excluded: boolean,
): Promise<void> {
  return api.patch<void>("/payroll/fee-deduction-rules/child-exclusion", undefined, { query: { staffId, employeeType, studentId, excluded } });
}

// ── Avances sur salaire ───────────────────────────────────────────────────────
/** Toutes les avances du tenant, ou celles d'un seul salarié si teacherId+employeeType sont fournis. */
export function listSalaryAdvances(params?: { teacherId?: number; employeeType?: EmployeeType }): Promise<SalaryAdvance[]> {
  return api.get<SalaryAdvance[]>("/payroll/salary-advances", {
    query: { teacherId: params?.teacherId, employeeType: params?.employeeType },
  });
}
/** Accorde une avance sur salaire — plafond (salaire de référence) vérifié côté backend, message clair
 * renvoyé si dépassé ou si une avance est déjà en cours pour ce salarié. */
export function grantSalaryAdvance(input: {
  employeeType: EmployeeType; teacherId: number; teacherName?: string | null; amount: number; reason?: string | null;
}): Promise<SalaryAdvance> {
  return api.post<SalaryAdvance>("/payroll/salary-advances", input);
}
export function cancelSalaryAdvance(id: number): Promise<SalaryAdvance> {
  return api.patch<SalaryAdvance>(`/payroll/salary-advances/${id}/annuler`);
}
/** Bon d'avance sur salaire (PDF A5, object URL local). */
export function getSalaryAdvanceVoucherPdfObjectUrl(id: number): Promise<string> {
  return apiBlobUrl(`/payroll/salary-advances/${id}/pdf/download`);
}
