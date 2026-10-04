/** Communication contracts mirrored from the backend communication module. */

export type CommunicationChannel = "SMS" | "EMAIL" | "WHATSAPP";
export type CommunicationReason = "LATE" | "ABSENCE" | "PAYMENT_DUE" | "RESULT" | "MEETING" | "EXAM" | "GENERAL" | "SALARY_PAID" | "SECURITY_ALERT";
export type RecipientType = "PARENT" | "STUDENT" | "TEACHER" | "GROUP";
export type DeliveryStatus = "PENDING" | "DELIVERED" | "FAILED";

/** Segmentation des destinataires d'une diffusion de masse (§11.1). */
export type BroadcastAudience =
  | "ALL_PARENTS"
  | "CLASS_PARENTS"
  | "CLASS_PARENTS_BOYS"
  | "CLASS_PARENTS_GIRLS"
  | "ALL_TEACHERS"
  | "ALL_STAFF"
  | "STUDENT_PARENTS"
  | "ALL";

export const BROADCAST_AUDIENCE_LABEL: Record<BroadcastAudience, string> = {
  ALL_PARENTS: "Tous les parents",
  CLASS_PARENTS: "Parents d'une classe",
  CLASS_PARENTS_BOYS: "Parents des garçons d'une classe",
  CLASS_PARENTS_GIRLS: "Parents des filles d'une classe",
  ALL_TEACHERS: "Tous les enseignants",
  ALL_STAFF: "Tout le personnel (enseignants + personnel)",
  STUDENT_PARENTS: "Parent(s) d'un élève précis",
  ALL: "Toute l'école (élèves, parents, enseignants, personnel)",
};

export type ScheduledBroadcastStatus = "PENDING" | "SENT" | "CANCELLED" | "FAILED";
export const SCHEDULED_BROADCAST_STATUS_LABEL: Record<ScheduledBroadcastStatus, string> = {
  PENDING: "En attente",
  SENT: "Envoyée",
  CANCELLED: "Annulée",
  FAILED: "Échouée",
};

/** Diffusion de masse programmée : part automatiquement à `sendAt`, sans action manuelle le jour J. */
export interface ScheduledBroadcast {
  id: number;
  tenantId: number | null;
  senderId: number | null;
  channel: CommunicationChannel;
  audience: BroadcastAudience;
  classId: number | null;
  studentId: number | null;
  subject: string | null;
  content: string;
  reason: CommunicationReason | null;
  sendAt: string;
  status: ScheduledBroadcastStatus;
  schoolEventId: number | null;
  createdAt: string;
  sentAt: string | null;
  errorMessage: string | null;
}

export interface ScheduleBroadcastInput {
  tenantId?: number | null;
  senderId?: number | null;
  channel: CommunicationChannel;
  audience: BroadcastAudience;
  classId?: number | null;
  studentId?: number | null;
  subject?: string | null;
  content: string;
  reason?: CommunicationReason | null;
  sendAt: string;
  schoolEventId?: number | null;
}

export const CHANNEL_LABEL: Record<CommunicationChannel, string> = {
  SMS: "SMS",
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
};
export const REASON_LABEL: Record<CommunicationReason, string> = {
  LATE: "Retard",
  ABSENCE: "Absence",
  PAYMENT_DUE: "Échéance de paiement",
  RESULT: "Résultat",
  MEETING: "Réunion",
  EXAM: "Examen",
  GENERAL: "Général",
  SALARY_PAID: "Salaire payé",
  SECURITY_ALERT: "Alerte sécurité",
};
export const RECIPIENT_TYPE_LABEL: Record<RecipientType, string> = {
  PARENT: "Parents",
  STUDENT: "Élèves",
  TEACHER: "Enseignants",
  GROUP: "Groupe",
};
export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  PENDING: "En attente",
  DELIVERED: "Livré",
  FAILED: "Échoué",
};

export interface Communication {
  id: number;
  tenantId: number | null;
  senderId: number | null;
  channel: CommunicationChannel;
  recipientType: RecipientType;
  subject: string | null;
  content: string;
  reason: CommunicationReason;
  sentAt: string | null;
}

export interface SendCommunicationInput {
  tenantId?: number | null;
  senderId?: number | null;
  channel: CommunicationChannel;
  recipientType: RecipientType;
  subject?: string | null;
  content: string;
  reason: CommunicationReason;
  recipientUserIds: number[];
  /** Téléphone/e-mail bruts (déjà résolus côté appelant) pour un destinataire précis — indispensable
   * pour qu'un envoi manuel parte réellement : un recipientUserId seul, sans destination, reste "en
   * attente" indéfiniment côté serveur (aucune résolution différée n'existe). */
  recipientDestinations?: string[];
  /** Clé d'idempotence générée côté client (une par tentative d'envoi) : rejouer avec la même clé
   * (double-clic, requête réseau dupliquée) renvoie la communication déjà créée côté serveur au lieu
   * d'en créer une seconde. */
  idempotencyKey?: string;
}

/** Diffusion de masse segmentée — le serveur résout lui-même les destinataires réels. */
export interface DiffusionInput {
  tenantId?: number | null;
  senderId?: number | null;
  channel: CommunicationChannel;
  audience: BroadcastAudience;
  classId?: number | null;
  studentId?: number | null;
  subject?: string | null;
  content: string;
  reason?: CommunicationReason | null;
  /** Clé d'idempotence générée côté client — voir {@link SendCommunicationInput.idempotencyKey}. */
  idempotencyKey?: string;
}

export interface MessageRecipient {
  id: number;
  communicationId: number;
  userId: number | null;
  destination: string | null;
  deliveryStatus: DeliveryStatus;
  read: boolean | null;
  deliveredAt: string | null;
}

export interface MessageTemplate {
  id: number;
  tenantId: number | null;
  reason: CommunicationReason;
  channel: CommunicationChannel;
  subject: string | null;
  body: string;
  createdAt: string | null;
}
