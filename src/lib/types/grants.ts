export type GrantStatus = "EXPECTED" | "PARTIAL" | "RECEIVED" | "CANCELLED";

export const GRANT_STATUS_LABEL: Record<GrantStatus, string> = {
  EXPECTED: "Attendue",
  PARTIAL: "Partiellement reçue",
  RECEIVED: "Reçue",
  CANCELLED: "Annulée",
};

export interface Grant {
  id: number;
  tenantId: number | null;
  source: string;
  reference: string | null;
  purpose: string | null;
  academicYear: string | null;
  totalAmount: string;
  receivedAmount: string;
  status: GrantStatus;
  notes: string | null;
  createdAt: string | null;
}

export interface GrantPayment {
  id: number;
  tenantId: number | null;
  grantId: number;
  paymentDate: string;
  amount: string;
  method: string | null;
  reference: string | null;
  treasuryAccountId: number | null;
  notes: string | null;
  createdAt: string | null;
}

export interface GrantInput {
  source: string;
  reference?: string | null;
  purpose?: string | null;
  academicYear?: string | null;
  totalAmount: number;
  notes?: string | null;
}

export interface GrantPaymentInput {
  paymentDate?: string | null;
  amount: number;
  method?: string | null;
  reference?: string | null;
  treasuryAccountId?: number | null;
  notes?: string | null;
}
