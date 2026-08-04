import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import { getReceiptByReference, listReceipts } from "../api/payments";

export function useReceiptsQuery(studentId: number | undefined) {
  return useQuery({
    queryKey: qk.receipts.list(studentId),
    queryFn: () => listReceipts(studentId),
  });
}

/** Recherche un reçu par son numéro (activée uniquement à partir de 3 caractères). */
export function useReceiptByReferenceQuery(reference: string) {
  const ref = reference.trim();
  return useQuery({
    queryKey: qk.receipts.byReference(ref),
    queryFn: () => getReceiptByReference(ref),
    enabled: ref.length >= 3,
    retry: false,
  });
}
