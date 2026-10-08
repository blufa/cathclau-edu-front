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

/** Élèves ayant déjà réglé au moins un mois de transport (§retour comptable : "savoir qui a payé
 * le transport") — parmi les abonnés actifs, ceux absents de cette liste n'ont encore rien payé. */
export function getTransportPaidStudentIds(): Promise<number[]> {
  return api.get<number[]>("/transport/subscriptions/paid-student-ids");
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
