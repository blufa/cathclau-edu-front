import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import { searchStudents } from "@/lib/api/students";
import { listInvoicesByTenant } from "@/lib/api/billing";
import type { Invoice } from "@/lib/types/billing";

/** Effectif élèves courant (utilisé pour la carte quota du dashboard). */
export function useStudentsCountQuery(enabled: boolean) {
  return useQuery({
    queryKey: qk.students.list({ size: 1 }),
    queryFn: () => searchStudents({ size: 1 }),
    enabled,
  });
}

export function useRecentInvoicesQuery(tenantId: number | null, enabled: boolean) {
  return useQuery<Invoice[]>({
    queryKey: qk.invoices.list({ tenantId }),
    queryFn: () => listInvoicesByTenant(tenantId as number),
    enabled: enabled && tenantId != null,
  });
}
