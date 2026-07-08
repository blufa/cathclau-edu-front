/** Communication contracts mirrored from the backend communication module. */

export type CommunicationChannel = "SMS" | "EMAIL" | "WHATSAPP";
export type CommunicationReason = "LATE" | "ABSENCE" | "PAYMENT_DUE" | "RESULT" | "MEETING" | "GENERAL";
export type RecipientType = "PARENT" | "STUDENT" | "TEACHER" | "GROUP";
export type DeliveryStatus = "PENDING" | "DELIVERED" | "FAILED";

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
  GENERAL: "Général",
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
