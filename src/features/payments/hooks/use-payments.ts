import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import {
  getPaymentDjomyStatus,
  getPaymentReceiptPdf,
  listPaymentsByTenant,
  refundPayment,
} from "../api/payments";

export function usePaymentsQuery(tenantId: number | null) {
  return useQuery({
    queryKey: qk.payments.list({ tenantId }),
    queryFn: () => listPaymentsByTenant(tenantId as number),
    enabled: tenantId != null,
  });
}

export function useRefundPaymentMutation(tenantId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: number) => refundPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.payments.list({ tenantId }) });
    },
  });
}

/** Interroge le statut Djomy d'un paiement en attente puis rafraîchit la liste. */
export function useCheckPaymentStatusMutation(tenantId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: number) => getPaymentDjomyStatus(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.payments.list({ tenantId }) });
    },
  });
}

export function useDownloadReceiptMutation() {
  return useMutation({
    mutationFn: (paymentId: number) => getPaymentReceiptPdf(paymentId),
  });
}
