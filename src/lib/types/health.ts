export interface HealthRecord {
  id: number;
  tenantId: number | null;
  studentId: number;
  bloodGroup: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  medications: string | null;
  pai: boolean;
  paiDetails: string | null;
  dietaryRestrictions: string | null;
  doctorName: string | null;
  doctorPhone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  insurance: string | null;
  notes: string | null;
  updatedAt: string | null;
}

export interface HealthRecordInput {
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  medications?: string | null;
  pai?: boolean;
  paiDetails?: string | null;
  dietaryRestrictions?: string | null;
  doctorName?: string | null;
  doctorPhone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  insurance?: string | null;
  notes?: string | null;
}

export type VisitOutcome = "RETURNED_TO_CLASS" | "REST" | "SENT_HOME" | "REFERRED_HOSPITAL" | "OTHER";

export const VISIT_OUTCOME_LABEL: Record<VisitOutcome, string> = {
  RETURNED_TO_CLASS: "Retour en classe",
  REST: "Mise au repos",
  SENT_HOME: "Renvoyé à la maison",
  REFERRED_HOSPITAL: "Orienté à l'hôpital",
  OTHER: "Autre",
};

export interface InfirmaryVisit {
  id: number;
  tenantId: number | null;
  studentId: number;
  visitDate: string;
  visitTime: string | null;
  reason: string | null;
  careGiven: string | null;
  temperature: string | null;
  outcome: VisitOutcome;
  parentNotified: boolean;
  recordedBy: number | null;
  createdAt: string | null;
}

export interface VisitInput {
  studentId: number;
  visitDate?: string | null;
  visitTime?: string | null;
  reason?: string | null;
  careGiven?: string | null;
  temperature?: number | null;
  outcome: VisitOutcome;
}
