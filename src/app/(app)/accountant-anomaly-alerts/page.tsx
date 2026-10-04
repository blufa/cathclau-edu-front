"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { listAccountantAnomalyAlerts } from "@/lib/api/audit";
import { listUsers } from "@/lib/api/iam";
import { ANOMALY_STATUS_LABEL, ANOMALY_TYPE_LABEL, type AccountantAnomalyAlert } from "@/lib/types/accountant-anomaly";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Card, CardBody } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { formatDateTime } from "@/lib/format";

export default function AccountantAnomalyAlertsPage() {
  const { user } = useAuth();
  const canView = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["audit:read"]);

  const alertsQuery = useQuery(() => (canView ? listAccountantAnomalyAlerts() : Promise.resolve([])), [canView]);
  const usersQuery = useQuery(() => (canView ? listUsers(0, 200) : Promise.resolve(null)), [canView]);
  const userName = useMemo(() => {
    const map = new Map<number, string>();
    (usersQuery.data?.content ?? []).forEach((u) => map.set(u.id, `${u.firstName} ${u.lastName}`));
    return (id: number) => map.get(id) ?? `Utilisateur #${id}`;
  }, [usersQuery.data]);

  if (!canView) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        Vous n&apos;avez pas accès à cette page.
      </p>
    );
  }

  const alerts: AccountantAnomalyAlert[] = alertsQuery.data ?? [];
  const active = alerts.filter((a) => a.status === "ACTIVE");
  const resolved = alerts.filter((a) => a.status === "RESOLVED");

  return (
    <div className="space-y-5">
      <Reveal y={12}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <TrendingUp className="h-6 w-6 text-brand-600" /> Écarts statistiques entre comptables
        </h1>
        <p className="text-sm text-gray-500">
          Détecteur anti-fraude (§retour fondateurs) : un comptable dont les écarts de caisse ou le
          volume d&apos;exonérations dépasse nettement la moyenne de ses collègues, sur les 30
          derniers jours. Réévalué chaque semaine, résolu automatiquement si l&apos;écart disparaît.
        </p>
      </Reveal>

      {alertsQuery.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : alerts.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          Aucune anomalie détectée pour le moment.
        </p>
      ) : (
        <Card>
          <CardBody>
            <Table>
              <THead>
                <tr>
                  <TH>Comptable</TH>
                  <TH>Indicateur</TH>
                  <TH className="text-right">Valeur</TH>
                  <TH className="text-right">Moyenne des pairs</TH>
                  <TH>Statut</TH>
                  <TH>Détectée le</TH>
                  <TH>Résolue le</TH>
                </tr>
              </THead>
              <TBody>
                {[...active, ...resolved].map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium text-gray-900">{userName(a.cashierId)}</TD>
                    <TD>{ANOMALY_TYPE_LABEL[a.type]}</TD>
                    <TD className="text-right">{a.metricValue}</TD>
                    <TD className="text-right">{a.peerAverage}</TD>
                    <TD>
                      <Badge tone={a.status === "ACTIVE" ? "red" : "green"}>
                        {ANOMALY_STATUS_LABEL[a.status]}
                      </Badge>
                    </TD>
                    <TD>{formatDateTime(a.createdAt)}</TD>
                    <TD>{a.resolvedAt ? formatDateTime(a.resolvedAt) : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
