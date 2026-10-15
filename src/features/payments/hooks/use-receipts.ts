import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import { getReceiptByReference, listReceipts, refreshReceiptStudentName } from "../api/payments";

export function useReceiptsQuery(studentId: number | undefined) {
  return useQuery({
    queryKey: qk.receipts.list(studentId),
    queryFn: () => listReceipts(studentId),
  });
}

/** Recalcule le nom de l'élève sur un reçu déjà émis (faute de frappe corrigée après coup, §retour
 * comptable) et rafraîchit les listes affichées. */
export function useRefreshReceiptStudentNameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (receiptId: number) => refreshReceiptStudentName(receiptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.receipts.all });
    },
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
