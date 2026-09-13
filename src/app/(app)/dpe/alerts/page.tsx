"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { listDpeAlerts, listDpeSchools, refreshDpeAlerts, updateDpeAlertStatus } from "@/lib/api/dpe";
import { DPE_ALERT_TYPE_LABEL, type DpeAlertPriority, type DpeAlertStatus } from "@/lib/types/dpe";
import { DpePrefectureBanner } from "@/components/platform/dpe-prefecture-banner";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";

const PRIORITY_TONE: Record<DpeAlertPriority, "red" | "amber" | "gray"> = {
  HAUTE: "red",
  MOYENNE: "amber",
  BASSE: "gray",
};

const STATUS_TONE: Record<DpeAlertStatus, "blue" | "amber" | "green"> = {
  NOUVELLE: "blue",
  EN_COURS: "amber",
  RESOLUE: "green",
};

const STATUS_LABEL: Record<DpeAlertStatus, string> = {
  NOUVELLE: "Nouvelle",
  EN_COURS: "En cours",
  RESOLUE: "Résolue",
};

export default function DpeAlertsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}>
      <DpeAlertsContent />
    </Suspense>
  );
}

function DpeAlertsContent() {
  const searchParams = useSearchParams();
  const prefectureId = searchParams.get("prefectureId") ? Number(searchParams.get("prefectureId")) : undefined;
  const [statutFilter, setStatutFilter] = useState<DpeAlertStatus | "">("NOUVELLE");
  const [refreshing, setRefreshing] = useState(false);
  const alertsQuery = useQuery(
    () => listDpeAlerts(statutFilter || undefined, prefectureId),
    [statutFilter, prefectureId],
  );
  const schoolsQuery = useQuery(() => listDpeSchools(prefectureId), [prefectureId]);

  const schoolName = useMemo(
    () => new Map((schoolsQuery.data ?? []).map((s) => [s.tenantId, s.schoolName])),
    [schoolsQuery.data],
  );

  const counts = useMemo(() => {
    const all = alertsQuery.data ?? [];
    return {
      nouvelle: all.filter((a) => a.statut === "NOUVELLE").length,
      enCours: all.filter((a) => a.statut === "EN_COURS").length,
      resolue: all.filter((a) => a.statut === "RESOLUE").length,
    };
  }, [alertsQuery.data]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshDpeAlerts(prefectureId);
      notifySuccess("Alertes réévaluées");
      alertsQuery.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setRefreshing(false);
    }
  }

  async function changeStatus(id: number, statut: DpeAlertStatus) {
    try {
      await updateDpeAlertStatus(id, statut, prefectureId);
      notifySuccess("Statut mis à jour");
      alertsQuery.refetch();
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Alertes</h1>
          <p className="text-sm text-gray-500">
            Incohérences détectées automatiquement dans les écoles de votre périmètre.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} loading={refreshing}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Réévaluer maintenant
        </Button>
      </div>

      <DpePrefectureBanner />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Nouvelles" value={counts.nouvelle} icon={AlertTriangle} accent="rose" />
        <StatCard title="En cours" value={counts.enCours} icon={Clock} accent="amber" />
        <StatCard title="Résolues" value={counts.resolue} icon={CheckCircle2} accent="emerald" />
      </div>

      <Card>
        <CardBody>
          <div className="mb-4 flex items-center justify-between gap-4">
            <Select
              aria-label="Filtrer par statut"
              className="max-w-[200px]"
              value={statutFilter}
              onChange={(e) => setStatutFilter(e.target.value as DpeAlertStatus | "")}
            >
              <option value="">Tous les statuts</option>
              <option value="NOUVELLE">Nouvelles</option>
              <option value="EN_COURS">En cours</option>
              <option value="RESOLUE">Résolues</option>
            </Select>
          </div>

          {alertsQuery.loading ? (
            <CardSkeleton />
          ) : alertsQuery.error ? (
            <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
              Impossible de charger les alertes.
            </div>
          ) : (
            <Table>
              <THead>
                <TR><TH>Priorité</TH><TH>École</TH><TH className="hidden sm:table-cell">Type</TH><TH>Description</TH><TH>Statut</TH><TH>Actions</TH></TR>
              </THead>
              <TBody>
                {(alertsQuery.data ?? []).map((a) => (
                  <TR key={a.id}>
                    <TD><Badge tone={PRIORITY_TONE[a.priorite]}>{a.priorite}</Badge></TD>
                    <TD className="font-medium">{schoolName.get(a.tenantId) ?? `École #${a.tenantId}`}</TD>
                    <TD className="hidden sm:table-cell">{DPE_ALERT_TYPE_LABEL[a.type]}</TD>
                    <TD className="max-w-sm text-sm text-gray-600">{a.description}</TD>
                    <TD><Badge tone={STATUS_TONE[a.statut]}>{STATUS_LABEL[a.statut]}</Badge></TD>
                    <TD>
                      <div className="flex gap-2">
                        {a.statut === "NOUVELLE" && (
                          <Button size="sm" variant="secondary" onClick={() => changeStatus(a.id, "EN_COURS")}>
                            Prendre en charge
                          </Button>
                        )}
                        {a.statut !== "RESOLUE" && (
                          <Button size="sm" onClick={() => changeStatus(a.id, "RESOLUE")}>Résoudre</Button>
                        )}
                        {a.statut === "RESOLUE" && (
                          <Button size="sm" variant="secondary" onClick={() => changeStatus(a.id, "EN_COURS")}>
                            Rouvrir
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
                {!alertsQuery.loading && (alertsQuery.data ?? []).length === 0 && (
                  <TR><TD colSpan={6} className="text-gray-400">Aucune alerte pour ce filtre.</TD></TR>
                )}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
