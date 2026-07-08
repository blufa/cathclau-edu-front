/** Webhook contracts mirrored from the backend webhooks module (outgoing endpoints + events). */

export type WebhookEventType = "PAYMENT_RECEIVED" | "REPORT_CARD_AVAILABLE" | "ABSENCE" | "ENROLLMENT";
export type WebhookDeliveryStatus = "PENDING" | "SENT" | "FAILED";

export const WEBHOOK_EVENT_TYPE_LABEL: Record<WebhookEventType, string> = {
  PAYMENT_RECEIVED: "Paiement reçu",
  REPORT_CARD_AVAILABLE: "Bulletin disponible",
  ABSENCE: "Absence",
  ENROLLMENT: "Inscription",
};

export const WEBHOOK_STATUS_LABEL: Record<WebhookDeliveryStatus, string> = {
  PENDING: "En attente",
  SENT: "Envoyé",
  FAILED: "Échoué",
};

export interface WebhookEndpoint {
  id: number;
  tenantId: number | null;
  url: string;
  secret: string | null;
  /** Comma-separated subscribed event types. */
  events: string | null;
  active: boolean;
  createdAt: string | null;
}

export interface WebhookEvent {
  id: number;
  endpointId: number;
  eventType: WebhookEventType;
  payload: string | null;
  status: WebhookDeliveryStatus;
  attemptCount: number | null;
  responseCode: number | null;
  nextAttemptAt: string | null;
  createdAt: string | null;
}
