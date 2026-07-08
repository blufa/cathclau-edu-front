import { Badge } from "@/components/ui/badge";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  TENANT_STATUS_LABEL,
  TENANT_STATUS_TONE,
} from "@/lib/platform-labels";
import type {
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
  TenantStatus,
} from "@/lib/types/platform";

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return <Badge tone={TENANT_STATUS_TONE[status]}>{TENANT_STATUS_LABEL[status]}</Badge>;
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge tone={SUBSCRIPTION_STATUS_TONE[status]}>{SUBSCRIPTION_STATUS_LABEL[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={INVOICE_STATUS_TONE[status]}>{INVOICE_STATUS_LABEL[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_STATUS_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}
