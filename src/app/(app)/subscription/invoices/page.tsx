"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@/hooks/use-query";
import { getInvoicePdfUrl, getMyInvoices } from "@/lib/api/platform";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/platform/status-badge";
import { formatDate, formatGNF } from "@/lib/format";
import { notifyError } from "@/lib/feedback";
import { openPdfInApp } from "@/lib/open-pdf";
import { BILLING_PERIOD_LABEL, INVOICE_STATUS_LABEL } from "@/lib/platform-labels";
import { INVOICE_STATUSES, type InvoiceStatus, type SubscriptionInvoice } from "@/lib/types/platform";

const PAYABLE: InvoiceStatus[] = ["ISSUED", "PARTIAL", "OVERDUE"];

export default function SubscriptionInvoicesPage() {
  const router = useRouter();
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const { data, loading, error } = useQuery(() => getMyInvoices(), []);

  const invoices = (data ?? []).filter((i) => !status || i.status === status);

  async function openPdf(inv: SubscriptionInvoice) {
    try {
      const { pdfUrl } = await getInvoicePdfUrl(inv.id);
      if (pdfUrl) openPdfInApp(pdfUrl, `Facture ${inv.reference}`);
      else notifyError(new Error("PDF en cours de génération"), "PDF en cours de génération, réessayez.");
    } catch (err) {
      notifyError(err, "PDF indisponible (génération en cours).");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Factures d&apos;abonnement</h1>
        <p className="text-sm text-gray-500">Vos factures d&apos;abonnement à la plateforme.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus | "")}>
          <option value="">Tous les statuts</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>
          ))}
        </Select>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Impossible de charger les factures.</p>
      ) : loading && !data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : invoices.length === 0 ? (
        <Card><CardBody className="py-10 text-center text-sm text-gray-400">Aucune facture pour le moment.</CardBody></Card>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Référence</TH>
              <TH>Période</TH>
              <TH>Total</TH>
              <TH>Solde</TH>
              <TH>Statut</TH>
              <TH>Échéance</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {invoices.map((inv) => {
              const overdue = inv.status === "OVERDUE";
              return (
                <TR key={inv.id} className={overdue ? "bg-red-50" : undefined}>
                  <TD className="font-mono text-xs">{inv.reference}</TD>
                  <TD>{BILLING_PERIOD_LABEL[inv.billingPeriod]}</TD>
                  <TD>{formatGNF(inv.totalAmount)}</TD>
                  <TD className={Number(inv.remainingBalance) > 0 ? "text-red-600" : undefined}>
                    {formatGNF(inv.remainingBalance)}
                  </TD>
                  <TD><InvoiceStatusBadge status={inv.status} /></TD>
                  <TD>{formatDate(inv.dueDate)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openPdf(inv)}>PDF</Button>
                      {PAYABLE.includes(inv.status) && (
                        <Button size="sm" onClick={() => router.push(`/subscription/payment?invoiceId=${inv.id}`)}>
                          Payer
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
