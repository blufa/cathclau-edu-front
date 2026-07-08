import { api } from "@/lib/api/client";
import type { Grant, GrantInput, GrantPayment, GrantPaymentInput } from "@/lib/types/grants";

export function listGrants(): Promise<Grant[]> {
  return api.get<Grant[]>("/grants");
}
export function getGrantPayments(id: number): Promise<GrantPayment[]> {
  return api.get<GrantPayment[]>(`/grants/${id}/payments`);
}
export function createGrant(input: GrantInput): Promise<Grant> {
  return api.post<Grant>("/grants", input);
}
export function updateGrant(id: number, input: GrantInput): Promise<Grant> {
  return api.put<Grant>(`/grants/${id}`, input);
}
export function cancelGrant(id: number): Promise<Grant> {
  return api.patch<Grant>(`/grants/${id}/cancel`);
}
export function deleteGrant(id: number): Promise<void> {
  return api.delete<void>(`/grants/${id}`);
}
export function addGrantPayment(id: number, input: GrantPaymentInput): Promise<GrantPayment> {
  return api.post<GrantPayment>(`/grants/${id}/payments`, input);
}
export function deleteGrantPayment(paymentId: number): Promise<void> {
  return api.delete<void>(`/grants/payments/${paymentId}`);
}
