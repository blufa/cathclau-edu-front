export type AccountantAnomalyType = "CASH_DISCREPANCY" | "EXEMPTION_VOLUME";
export type AccountantAnomalyStatus = "ACTIVE" | "RESOLVED";

export const ANOMALY_TYPE_LABEL: Record<AccountantAnomalyType, string> = {
  CASH_DISCREPANCY: "Écarts de caisse cumulés",
  EXEMPTION_VOLUME: "Volume d'exonérations accordées",
};

export const ANOMALY_STATUS_LABEL: Record<AccountantAnomalyStatus, string> = {
  ACTIVE: "Active",
  RESOLVED: "Résolue",
};

export interface AccountantAnomalyAlert {
  id: number;
  cashierId: number;
  type: AccountantAnomalyType;
  metricValue: string;
  peerAverage: string;
  status: AccountantAnomalyStatus;
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
}
