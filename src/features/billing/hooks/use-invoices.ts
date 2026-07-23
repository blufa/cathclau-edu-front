import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import type { InvoiceStatus } from "@/lib/types/billing";
import { listFeesByTenant, listInvoicesByStatus, listInvoicesByStudent, listInvoicesByTenant } from "../api/billing";

export function useInvoicesQuery(tenantId: number | null, status: InvoiceStatus | "", studentFilter: string) {
  return useQuery({
    queryKey: qk.invoices.list({ tenantId, status, studentFilter }),
    queryFn: () => {
      if (studentFilter) return listInvoicesByStudent(Number(studentFilter));
      return status ? listInvoicesByStatus(tenantId as number, status) : listInvoicesByTenant(tenantId as number);
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
