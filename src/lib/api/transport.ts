import { api } from "@/lib/api/client";
import type {
  RouteInput, TransportDirection, TransportRoute, TransportStop, TransportSubscription,
} from "@/lib/types/transport";

// ── Lignes & arrêts ──────────────────────────────────────────────────────────
export function listRoutes(): Promise<TransportRoute[]> {
  return api.get<TransportRoute[]>("/transport/routes");
}
export function createRoute(input: RouteInput): Promise<TransportRoute> {
  return api.post<TransportRoute>("/transport/routes", input);
}
export function updateRoute(id: number, input: RouteInput): Promise<TransportRoute> {
  return api.put<TransportRoute>(`/transport/routes/${id}`, input);
}
export function deleteRoute(id: number): Promise<void> {
  return api.delete<void>(`/transport/routes/${id}`);
}
export function listStops(routeId: number): Promise<TransportStop[]> {
  return api.get<TransportStop[]>(`/transport/routes/${routeId}/stops`);
}
export function addStop(routeId: number, input: { name: string; pickupTime?: string | null; dropTime?: string | null; sequence?: number }): Promise<TransportStop> {
  return api.post<TransportStop>(`/transport/routes/${routeId}/stops`, input);
}
export function deleteStop(stopId: number): Promise<void> {
  return api.delete<void>(`/transport/routes/stops/${stopId}`);
}

// ── Abonnements ──────────────────────────────────────────────────────────────
export function listSubscriptions(params?: { routeId?: number; studentId?: number }): Promise<TransportSubscription[]> {
  return api.get<TransportSubscription[]>("/transport/subscriptions", { query: { routeId: params?.routeId, studentId: params?.studentId } });
}

/** Nombre de mois de transport déjà réglés, par élève (§retour comptable : "savoir qui a payé le
 * transport", précisé en "le nombre de mois payé") — clés = id élève en string (sérialisation JSON
 * d'une Map<Long,Long>), absent de l'objet si l'élève n'a encore rien payé. */
export function getTransportPaidMonthsCount(): Promise<Record<string, number>> {
  return api.get<Record<string, number>>("/transport/subscriptions/paid-months-count");
}

/** Ids des élèves ayant réglé le transport pour {@code month} (format "YYYY-MM", mois en cours par
 * défaut côté backend si omis) — §retour comptable : filtre "qui a payé le mois en cours". */
export function getTransportPaidForMonth(month?: string): Promise<number[]> {
  return api.get<number[]>("/transport/subscriptions/paid-for-month", { query: { month } });
}
export function subscribe(input: {
  routeId: number; stopId?: number | null; studentId: number; direction: TransportDirection;
  startDate?: string | null; monthlyFee?: number | null;
}): Promise<TransportSubscription> {
  return api.post<TransportSubscription>("/transport/subscriptions", input);
}
export function cancelSubscription(id: number): Promise<TransportSubscription> {
  return api.patch<TransportSubscription>(`/transport/subscriptions/${id}/cancel`);
}
export function deleteSubscription(id: number): Promise<void> {
  return api.delete<void>(`/transport/subscriptions/${id}`);
}
