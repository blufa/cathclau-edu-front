import { api } from "@/lib/api/client";
import type {
  Communication,
  CommunicationChannel,
  DiffusionInput,
  MessageRecipient,
  MessageTemplate,
  PaymentReminderCandidate,
  ScheduleBroadcastInput,
  ScheduledBroadcast,
  SendCommunicationInput,
} from "@/lib/types/communication";

// ── SMS : solde du bundle (SUPER_ADMIN) ──────────────────────────────────────
export interface SmsBalance {
  country: string | null;
  offerName: string | null;
  availableUnits: number | null;
  status: string | null;
  expirationDate: string | null;
}

/** Solde SMS du compte plateforme (Orange). Liste vide si le fournisseur n'est pas configuré. */
export function getSmsBalance(): Promise<SmsBalance[]> {
  return api.get<SmsBalance[]>("/communications/sms/solde");
}

// ── Communications ─────────────────────────────────────────────────────────
export function sendCommunication(input: SendCommunicationInput): Promise<Communication> {
  return api.post<Communication>("/communications", input);
}

/** Tous les élèves d'une classe avec leur statut de paiement de la mensualité (à jour/retard/échéance
 * proche), leur progression en tranches et leurs contacts parents — pour trier/filtrer avant une
 * relance SMS ciblée. */
export function listPaymentReminderCandidates(classId: number): Promise<PaymentReminderCandidate[]> {
  return api.get<PaymentReminderCandidate[]>("/communications/payment-reminders", { query: { classId } });
}

/** Diffusion de masse segmentée (tous les parents, une classe, garçons/filles, enseignants, élève
 * précis) — le serveur résout lui-même les numéros/e-mails réels. */
export function sendDiffusion(input: DiffusionInput): Promise<Communication> {
  return api.post<Communication>("/communications/diffusion", input);
}

/** Programme une diffusion de masse à une date/heure future — part automatiquement, sans action
 * manuelle le jour J (ex. annonce d'un événement école à toute l'école). */
export function scheduleBroadcast(input: ScheduleBroadcastInput): Promise<ScheduledBroadcast> {
  return api.post<ScheduledBroadcast>("/communications/diffusion/programmee", input);
}

export function listScheduledBroadcasts(tenantId: number): Promise<ScheduledBroadcast[]> {
  return api.get<ScheduledBroadcast[]>("/communications/diffusion/programmee", { query: { tenantId } });
}

/** Annule une diffusion programmée tant qu'elle n'est pas encore partie. */
export function cancelScheduledBroadcast(id: number): Promise<void> {
  return api.delete<void>(`/communications/diffusion/programmee/${id}`);
}

export function listCommunicationsByTenant(tenantId: number): Promise<Communication[]> {
  return api.get<Communication[]>(`/communications/tenant/${tenantId}`);
}

export function listCommunicationsByChannel(tenantId: number, channel: CommunicationChannel): Promise<Communication[]> {
  return api.get<Communication[]>(`/communications/tenant/${tenantId}/channel/${channel}`);
}

export function deleteCommunication(id: number): Promise<void> {
  return api.delete<void>(`/communications/${id}`);
}

export function getCommunicationRecipients(communicationId: number): Promise<MessageRecipient[]> {
  return api.get<MessageRecipient[]>(`/communications/messages/communication/${communicationId}`);
}

// ── Templates ────────────────────────────────────────────────────────────────
export function listTemplates(tenantId: number): Promise<MessageTemplate[]> {
  return api.get<MessageTemplate[]>("/templates-message", { query: { tenantId } });
}

export function createTemplate(input: {
  tenantId: number;
  reason: string;
  channel: string;
  subject?: string | null;
  body: string;
}): Promise<MessageTemplate> {
  return api.post<MessageTemplate>("/templates-message", input);
}

export function updateTemplate(id: number, input: {
  tenantId: number;
  reason: string;
  channel: string;
  subject?: string | null;
  body: string;
}): Promise<MessageTemplate> {
  return api.put<MessageTemplate>(`/templates-message/${id}`, input);
}

export function deleteTemplate(id: number): Promise<void> {
  return api.delete<void>(`/templates-message/${id}`);
}

// ── Communications par expéditeur ────────────────────────────────────────────
export function listCommunicationsBySender(senderId: number): Promise<Communication[]> {
  return api.get<Communication[]>(`/communications/sender/${senderId}`);
}

// ── Message recipients (statuts de livraison / lecture) ──────────────────────
export function listRecipientsByUser(userId: number): Promise<MessageRecipient[]> {
  return api.get<MessageRecipient[]>(`/communications/messages/user/${userId}`);
}
export function listUnreadRecipientsByUser(userId: number): Promise<MessageRecipient[]> {
  return api.get<MessageRecipient[]>(`/communications/messages/user/${userId}/unread`);
}
export function countUnreadRecipientsByUser(userId: number): Promise<number> {
  return api.get<number>(`/communications/messages/user/${userId}/unread/count`);
}
export function markRecipientDelivered(id: number): Promise<MessageRecipient> {
  return api.put<MessageRecipient>(`/communications/messages/${id}/deliver`);
}
export function markRecipientFailed(id: number): Promise<MessageRecipient> {
  return api.put<MessageRecipient>(`/communications/messages/${id}/fail`);
}
export function markRecipientRead(id: number): Promise<MessageRecipient> {
  return api.put<MessageRecipient>(`/communications/messages/${id}/read`);
}
