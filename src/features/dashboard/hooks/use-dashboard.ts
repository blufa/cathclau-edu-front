import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import { searchStudents } from "@/lib/api/students";
import { listInvoicesByTenant } from "@/lib/api/billing";
import {
  getAttendanceHistory,
  getMonthlyFinancialSummary,
  type DailyAttendanceStats,
  type MonthlyFinancialSummary,
} from "@/lib/api/reporting";
import { listCommunicationsByTenant } from "@/lib/api/communication";
import type { Invoice } from "@/lib/types/billing";
import type { Communication } from "@/lib/types/communication";

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

/** Historique présences/absences/retards école entière des 14 derniers jours (tableau de bord
 * principal), école entière toutes classes confondues. */
export function useAttendanceHistoryQuery(enabled: boolean) {
  return useQuery<DailyAttendanceStats[]>({
    queryKey: ["dashboard", "attendance-history"],
    queryFn: () => getAttendanceHistory(),
    enabled,
  });
}

/** État financier du mois courant : masse salariale enseignants Primaire/Secondaire + personnel +
 * avances sur salaire accordées ce mois (tableau de bord principal). */
export function useMonthlyFinancialSummaryQuery(enabled: boolean) {
  return useQuery<MonthlyFinancialSummary>({
    queryKey: ["dashboard", "monthly-financial-summary"],
    queryFn: () => getMonthlyFinancialSummary(),
    enabled,
  });
}

/** Historique des communications du tenant, le plus récent en premier (10 derniers) — pas de
 * pagination côté backend, tri/troncature côté client. */
export function useRecentCommunicationsQuery(tenantId: number | null, enabled: boolean) {
  return useQuery<Communication[], Error, Communication[]>({
    queryKey: ["dashboard", "communications", tenantId],
    queryFn: () => listCommunicationsByTenant(tenantId as number),
    enabled: enabled && tenantId != null,
    select: (data) => [...data].sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? "")).slice(0, 5),
  });
}
