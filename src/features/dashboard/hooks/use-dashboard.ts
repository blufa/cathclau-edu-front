import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import { searchStudents } from "@/lib/api/students";
import { listInvoicesByTenant } from "@/lib/api/billing";
import { listAcademicYears, listPeriods } from "@/lib/api/academics";
import {
  getAcademicDashboard,
  getTodayAttendanceStats,
  getUpcomingInstallments,
  type AcademicDashboard,
  type TodayAttendanceStats,
  type UpcomingInstallment,
} from "@/lib/api/reporting";
import { listReportCards } from "@/lib/api/grading";
import { listCommunicationsByTenant } from "@/lib/api/communication";
import { listEvents } from "@/lib/api/calendar";
import type { Invoice } from "@/lib/types/billing";
import type { Communication } from "@/lib/types/communication";
import type { AcademicEvent } from "@/lib/types/calendar";

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

/** Période actuellement ouverte de l'année scolaire courante (une école peut avoir plusieurs
 * périodes ouvertes en parallèle si ses cycles primaire/secondaire ne sont pas synchronisés — on
 * prend la première trouvée, son libellé est affiché à côté des chiffres pour rester sans ambiguïté). */
export function useCurrentPeriodQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", "current-period"],
    queryFn: async () => {
      const years = await listAcademicYears();
      const currentYear = years.find((y) => y.current) ?? years[0];
      if (!currentYear) return null;
      const periods = await listPeriods(currentYear.id);
      return periods.find((p) => !p.closed) ?? periods[periods.length - 1] ?? null;
    },
    enabled,
  });
}

/** Reporting académique agrégé (moyenne générale, taux de réussite, moyennes par classe) de la
 * période courante — réutilise l'endpoint déjà construit pour §10.1 (Vision Fondateur / reporting). */
export function useAcademicDashboardQuery(periodId: number | null, enabled: boolean) {
  return useQuery<AcademicDashboard>({
    queryKey: ["dashboard", "academic", periodId],
    queryFn: () => getAcademicDashboard(periodId as number),
    enabled: enabled && periodId != null,
  });
}

/** Répartition du nombre d'élèves par tranche de moyenne générale (période courante), calculée à
 * partir des bulletins de chaque classe — aucun endpoint agrégé dédié n'existe côté backend. */
export function useAverageDistributionQuery(classIds: number[], periodId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", "average-distribution", periodId, classIds],
    queryFn: async () => {
      const perClass = await Promise.all(classIds.map((id) => listReportCards(id, periodId as number)));
      const buckets = { excellent: 0, bien: 0, assezBien: 0, aAmeliorer: 0 };
      for (const cards of perClass) {
        for (const c of cards) {
          const avg = c.overallAverage != null ? Number(c.overallAverage) : null;
          if (avg == null || Number.isNaN(avg)) continue;
          if (avg >= 16) buckets.excellent++;
          else if (avg >= 14) buckets.bien++;
          else if (avg >= 10) buckets.assezBien++;
          else buckets.aAmeliorer++;
        }
      }
      return buckets;
    },
    enabled: enabled && periodId != null && classIds.length > 0,
  });
}

/** Taux de présence élèves du jour, toutes classes confondues. */
export function useTodayAttendanceQuery(enabled: boolean) {
  return useQuery<TodayAttendanceStats>({
    queryKey: ["dashboard", "attendance-today"],
    queryFn: () => getTodayAttendanceStats(),
    enabled,
  });
}

/** Prochaines échéances de paiement des frais (5 par défaut, 30 prochains jours). */
export function useUpcomingInstallmentsQuery(enabled: boolean) {
  return useQuery<UpcomingInstallment[]>({
    queryKey: ["dashboard", "upcoming-installments"],
    queryFn: () => getUpcomingInstallments(),
    enabled,
  });
}

/** Prochains événements du calendrier académique (réunions, sorties, échéances…), toutes années
 * confondues (pas besoin de résoudre l'année courante) — filtrés/triés côté client, le jeu de
 * données d'un établissement reste petit. */
export function useUpcomingEventsQuery(enabled: boolean) {
  return useQuery<AcademicEvent[], Error, AcademicEvent[]>({
    queryKey: ["dashboard", "upcoming-events"],
    queryFn: () => listEvents(),
    enabled,
    select: (data) => {
      const today = new Date().toISOString().slice(0, 10);
      return [...data]
        .filter((e) => e.startDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 5);
    },
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
