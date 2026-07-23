"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery as useLegacyQuery } from "@/hooks/use-query";
import { searchStudents } from "@/lib/api/students";
import {
  PAYMENT_CHANNEL_LABEL,
  PAYMENT_STATUS_LABEL,
  type Payment,
  type PaymentStatus,
} from "@/lib/types/payment";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";
import {
  useCheckPaymentStatusMutation,
  useDownloadReceiptMutation,
  usePaymentsQuery,
  useRefundPaymentMutation,
} from "../hooks/use-payments";

const STATUS_TONE: Record<PaymentStatus, "gray" | "amber" | "green" | "red" | "indigo"> = {
  INITIATED: "gray",
  PENDING: "amber",
  SUCCEEDED: "green",
  FAILED: "red",
  REFUNDED: "indigo",
};

export default function PaymentsListPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canRefund = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");

  const q = usePaymentsQuery(tenantId);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const studentsQuery = useLegacyQuery(() => searchStudents({ size: 1000 }), []);
  const studentName = useMemo(() => {
    const map = new Map<number, string>();
    (studentsQuery.data?.content ?? []).forEach((s) => map.set(s.id, `${s.firstName} ${s.lastName}`));
    return (id: number) => map.get(id) ?? `Élève #${id}`;
  }, [studentsQuery.data]);

  const refundMutation = useRefundPaymentMutation(tenantId);
  const checkStatusMutation = useCheckPaymentStatusMutation(tenantId);
  const downloadReceiptMutation = useDownloadReceiptMutation();

  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  const rows = (q.data ?? []).filter((p) => !status || p.status === status);

  async function receipt(p: Payment) {
    try {
      const res = await downloadReceiptMutation.mutateAsync(p.id);
      if (res.url) window.open(res.url, "_blank");
      else notifySuccess("Reçu en génération, réessayez dans un instant.");
    } catch (err) {
      notifyError(err);
    }
  }

  async function checkStatus(p: Payment) {
    try {
      const res = await checkStatusMutation.mutateAsync(p.id);
      notifySuccess(res.status ? `Statut du paiement : ${PAYMENT_STATUS_LABEL[res.status as PaymentStatus] ?? res.status}` : "Statut mis à jour");
    } catch (err) {
      notifyError(err);
    }
  }

  function refund(p: Payment) {
    confirmAction({
      title: "Rembourser le paiement",
      message: `Rembourser ${p.reference} (${formatGNF(p.amount)}) ?`,
      confirmLabel: "Rembourser",
      danger: true,
      onConfirm: async () => {
        try {
          await refundMutation.mutateAsync(p.id);
          notifySuccess("Paiement remboursé");
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Paiements</h1>
        <p className="text-sm text-gray-500">Encaissements et reçus</p>
      </Reveal>

      <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | "")}>
        <option value="">Tous les statuts</option>
        {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((s) => (<option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>))}
      </Select>

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Référence</TH><TH>Élève</TH><TH>Montant</TH><TH>Canal</TH><TH>Statut</TH><TH>Date</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-gray-400">Aucun paiement.</TD></TR>}
            {rows.map((p) => (
              <TR key={p.id}>
                <TD className="font-mono text-xs text-gray-600">{p.reference}</TD>
                <TD className="text-gray-700">{studentName(p.studentId)}</TD>
                <TD className="font-medium text-gray-900">{formatGNF(p.amount)}</TD>
                <TD>{PAYMENT_CHANNEL_LABEL[p.channel]}</TD>
                <TD><Badge tone={STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge></TD>
                <TD className="text-gray-500">{p.paidAt?.slice(0, 10) ?? "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {(p.status === "INITIATED" || p.status === "PENDING") && (
                      <Button size="sm" variant="ghost" loading={checkStatusMutation.isPending && checkStatusMutation.variables === p.id} onClick={() => checkStatus(p)}>Vérifier</Button>
                    )}
                    {p.status === "SUCCEEDED" && <Button size="sm" variant="ghost" onClick={() => receipt(p)}>Reçu PDF</Button>}
                    {canRefund && p.status === "SUCCEEDED" && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => refund(p)}>Rembourser</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
