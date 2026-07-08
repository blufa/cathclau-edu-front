/** In-app notification contracts mirrored from the backend inbox module (§13). */

export type NotificationType =
  | "REPORT_CARD" | "ABSENCE" | "PAYMENT" | "INVOICE"
  | "ANNOUNCEMENT" | "HOMEWORK" | "MESSAGE" | "GENERAL";

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  REPORT_CARD: "Bulletin",
  ABSENCE: "Absence",
  PAYMENT: "Paiement",
  INVOICE: "Facture",
  ANNOUNCEMENT: "Annonce",
  HOMEWORK: "Devoir",
  MESSAGE: "Message",
  GENERAL: "Général",
};

export interface Notification {
  id: number;
  tenantId: number | null;
  userId: number | null;
  type: NotificationType;
  title: string;
  content: string | null;
  link: string | null;
  read: boolean;
  createdAt: string | null;
}
