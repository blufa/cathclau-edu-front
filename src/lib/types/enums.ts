/** Domain enums mirrored from the backend (kept in sync manually). */

export const ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "DIRECTOR",
  "ACCOUNTANT",
  "SECRETARY",
  "TEACHER",
  "RESPONSABLE_PEDAGOGIQUE",
  "PARENT",
  "STUDENT",
] as const;
export type RoleCode = (typeof ROLES)[number];

export const COMMUNICATION_CHANNELS = ["SMS", "EMAIL", "WHATSAPP"] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const COMMUNICATION_REASONS = [
  "LATE",
  "ABSENCE",
  "PAYMENT_DUE",
  "RESULT",
  "MEETING",
  "GENERAL",
] as const;
export type CommunicationReason = (typeof COMMUNICATION_REASONS)[number];
