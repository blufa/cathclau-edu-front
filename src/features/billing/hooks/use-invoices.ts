import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import type { InvoiceStatus } from "@/lib/types/billing";
import { listFeesByTenant, listInvoicesByStatus, listInvoicesByStudent, listInvoicesByTenant } from "../api/billing";

export function useInvoicesQuery(tenantId: number | null, status: InvoiceStatus | "", studentFilter: string, academicYearId?: number | null) {
  return useQuery({
    queryKey: qk.invoices.list({ tenantId, status, studentFilter, academicYearId }),
    queryFn: () => {
      if (studentFilter) return listInvoicesByStudent(Number(studentFilter));
      // Le filtre statut ignore volontairement l'année (rarement combiné) ; le cas courant (liste
      // par défaut) doit, lui, toujours être scopé à l'année pour ne pas mélanger les années.
      return status ? listInvoicesByStatus(tenantId as number, status) : listInvoicesByTenant(tenantId as number, academicYearId);
    },
    enabled: tenantId != null,
  });
}

export function useFeesQuery(tenantId: number | null) {
  return useQuery({
    queryKey: qk.fees.list({ tenantId }),
    queryFn: () => listFeesByTenant(tenantId as number),
    enabled: tenantId != null,
  });
}
