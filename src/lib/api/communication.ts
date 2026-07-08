import { api } from "@/lib/api/client";
import type {
  Communication,
  CommunicationChannel,
  MessageRecipient,
  MessageTemplate,
  SendCommunicationInput,
} from "@/lib/types/communication";

// ── Communications ─────────────────────────────────────────────────────────
export function sendCommunication(input: SendCommunicationInput): Promise<Communication> {
  return api.post<Communication>("/communications", input);
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
