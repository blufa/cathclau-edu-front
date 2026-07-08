import { api } from "@/lib/api/client";
import type { WebhookDeliveryStatus, WebhookEndpoint, WebhookEvent } from "@/lib/types/webhook";

// ── Endpoints (outgoing) ─────────────────────────────────────────────────────
export function listEndpointsByTenant(tenantId: number): Promise<WebhookEndpoint[]> {
  return api.get<WebhookEndpoint[]>(`/webhooks/endpoints/tenant/${tenantId}`);
}

export function createEndpoint(input: { tenantId: number; url: string; secret: string; events: string }): Promise<WebhookEndpoint> {
  return api.post<WebhookEndpoint>("/webhooks/endpoints", input);
}

export function updateEndpoint(id: number, input: { url: string; secret: string; events: string; active: boolean }): Promise<WebhookEndpoint> {
  return api.put<WebhookEndpoint>(`/webhooks/endpoints/${id}`, input);
}

export function activateEndpoint(id: number): Promise<void> {
  return api.put<void>(`/webhooks/endpoints/${id}/activate`);
}

export function deactivateEndpoint(id: number): Promise<void> {
  return api.put<void>(`/webhooks/endpoints/${id}/deactivate`);
}

export function deleteEndpoint(id: number): Promise<void> {
  return api.delete<void>(`/webhooks/endpoints/${id}`);
}

// ── Events (journal) ─────────────────────────────────────────────────────────
export function listEvents(params: { status?: WebhookDeliveryStatus; endpointId?: number } = {}): Promise<WebhookEvent[]> {
  return api.get<WebhookEvent[]>("/webhooks/events", { query: params });
}

export function replayEvent(id: number): Promise<WebhookEvent> {
  return api.post<WebhookEvent>(`/webhooks/events/${id}/replay`);
}
