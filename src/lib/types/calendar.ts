export type AcademicEventType =
  | "HOLIDAY" | "VACATION" | "CONGE" | "EXAM" | "MEETING" | "FEE_DUE" | "RESULT" | "ENROLLMENT" | "OTHER";

export const EVENT_TYPE_LABEL: Record<AcademicEventType, string> = {
  HOLIDAY: "Jour férié",
  VACATION: "Vacances",
  CONGE: "Congé",
  EXAM: "Composition / Examen",
  MEETING: "Réunion / Conseil",
  FEE_DUE: "Échéance de paiement",
  RESULT: "Proclamation des résultats",
  ENROLLMENT: "Rentrée / Inscriptions",
  OTHER: "Autre",
};

export const EVENT_TYPE_TONE: Record<AcademicEventType, "red" | "amber" | "indigo" | "green" | "gray"> = {
  HOLIDAY: "red",
  VACATION: "amber",
  CONGE: "gray",
  EXAM: "indigo",
  MEETING: "green",
  FEE_DUE: "amber",
  RESULT: "indigo",
  ENROLLMENT: "green",
  OTHER: "gray",
};

export interface AcademicEvent {
  id: number;
  academicYearId: number;
  title: string;
  eventType: AcademicEventType;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface AcademicEventInput {
  academicYearId: number;
  title: string;
  eventType: AcademicEventType;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
}
