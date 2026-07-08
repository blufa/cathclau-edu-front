"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import {
  cancelSubscription,
  listAllSubscriptionInvoices,
  listPlans,
  resendInvoice,
  searchSubscriptions,
  suspendSubscription,
} from "@/lib/api/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { InvoiceStatusBadge, SubscriptionStatusBadge } from "@/components/platform/status-badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataTable, type Column } from "@/components/ui/data-table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate, formatGNF } from "@/lib/format";
import { INVOICE_STATUS_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/platform-labels";
import {
  INVOICE_STATUSES,
  SUBSCRIPTION_STATUSES,
  type Subscription,
} from "@/lib/types/platform";

const PAGE_SIZE = 20;

export default function PlatformSubscriptionsPage() {
  return (
    <RequireSuperAdmin>
      <div className="space-y-8">
        <SubscriptionsSection />
        <GlobalInvoicesSection />
      </div>
    </RequireSuperAdmin>
  );
}

function SubscriptionsSection() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);

  const plansQuery = useQuery(() => listPlans(), []);
  const { data, loading, error, refetch } = useQuery(
    () => searchSubscriptions({ status: status || undefined, page, size: PAGE_SIZE }),
    [status, page],
  );

  const planName = (id: number) => plansQuery.data?.find((p) => p.id === id)?.name ?? `#${id}`;

  function act(s: Subscription, kind: "suspend" | "cancel") {
    confirmAction({
      title: kind === "suspend" ? "Suspendre l'abonnement" : "Annuler l'abonnement",
      message: `${kind === "suspend" ? "Suspendre" : "Annuler"} l'abonnement #${s.id} ?`,
      confirmLabel: kind === "suspend" ? "Suspendre" : "Annuler l'abonnement",
      danger: true,
      onConfirm: async () => {
        try {
          await (kind === "suspend" ? suspendSubscription(s.id) : cancelSubscription(s.id));
          notifySuccess("Abonnement mis à jour");
          refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  const columns: Column<Subscription>[] = [
    { key: "id", header: "#", accessor: (s) => s.id, render: (s) => s.id },
    { key: "tenantId", header: "École", accessor: (s) => s.tenantId, render: (s) => `#${s.tenantId}` },
    { key: "plan", header: "Plan", accessor: (s) => planName(s.planId), render: (s) => planName(s.planId) },
    {
      key: "period",
      header: "Période",
      accessor: (s) => `${s.startDate} ${s.endDate}`,
      render: (s) => `${formatDate(s.startDate)} → ${formatDate(s.endDate)}`,
    },
    { key: "amount", header: "Montant", accessor: (s) => Number(s.amount), render: (s) => formatGNF(s.amount) },
    { key: "status", header: "Statut", accessor: (s) => s.status, render: (s) => <SubscriptionStatusBadge status={s.status} /> },
    {
      key: "actions", header: "Actions", align: "right",
      render: (s) => (
        <div className="flex justify-end gap-1">
          {s.status === "ACTIVE" && <Button size="sm" variant="ghost" onClick={() => act(s, "suspend")}>Suspendre</Button>}
          {(s.status === "ACTIVE" || s.status === "SUSPENDED" || s.status === "PENDING") && (
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => act(s, "cancel")}>Annuler</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Abonnements</h1>
        <p className="text-sm text-gray-500">Supervision de tous les abonnements des écoles.</p>
      </div>
      <Select className="max-w-[220px]" value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}>
        <option value="">Tous les statuts</option>
        {SUBSCRIPTION_STATUSES.map((s) => (<option key={s} value={s}>{SUBSCRIPTION_STATUS_LABEL[s]}</option>))}
      </Select>
      <DataTable
        columns={columns}
        page={data}
        loading={loading}
        error={!!error}
        getRowKey={(s) => s.id}
        onPageChange={setPage}
        emptyLabel="Aucun abonnement."
        searchable
        searchPlaceholder="Rechercher (école, plan, statut)…"
        columnToggle
        exportable
        exportFilename="abonnements.csv"
      />
    </div>
  );
}

function GlobalInvoicesSection() {
  const [status, setStatus] = useState("");
  const { data, loading, error, refetch } = useQuery(
    () => listAllSubscriptionInvoices(status || undefined),
    [status],
  );

  function resend(id: number) {
    confirmAction({
      title: "Relancer la facture",
      message: `Renvoyer une relance pour la facture #${id} ?`,
      confirmLabel: "Relancer",
      onConfirm: async () => {
        try { await resendInvoice(id); notifySuccess("Relance envoyée"); refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Factures d&apos;abonnement (toutes écoles)</CardTitle>
          <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {INVOICE_STATUSES.map((s) => (<option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>))}
          </Select>
        </div>
      </CardHeader>
      <CardBody>
        {error ? (
          <p className="text-sm text-red-700">Impossible de charger les factures.</p>
        ) : loading && !data ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Référence</TH><TH>Abonnement</TH><TH>Total</TH><TH>Solde</TH><TH>Statut</TH><TH>Échéance</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {data?.length === 0 && (<TR><TD colSpan={7} className="py-10 text-center text-gray-400">Aucune facture.</TD></TR>)}
              {data?.map((inv) => (
                <TR key={inv.id}>
                  <TD className="font-mono text-xs">{inv.reference}</TD>
                  <TD>#{inv.subscriptionId}</TD>
                  <TD>{formatGNF(inv.totalAmount)}</TD>
                  <TD>{formatGNF(inv.remainingBalance)}</TD>
                  <TD><InvoiceStatusBadge status={inv.status} /></TD>
                  <TD>{formatDate(inv.dueDate)}</TD>
                  <TD className="text-right">
                    {(inv.status === "OVERDUE" || inv.status === "ISSUED" || inv.status === "PARTIAL") && (
                      <Button size="sm" variant="ghost" onClick={() => resend(inv.id)}>Relancer</Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
