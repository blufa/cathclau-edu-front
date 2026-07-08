"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { searchStudents } from "@/lib/api/students";
import {
  getPaymentDjomyStatus,
  getPaymentReceiptPdf,
  listPaymentsByTenant,
  refundPayment,
} from "@/lib/api/payment";
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

const STATUS_TONE: Record<PaymentStatus, "gray" | "amber" | "green" | "red" | "indigo"> = {
  INITIATED: "gray",
  PENDING: "amber",
  SUCCEEDED: "green",
  FAILED: "red",
  REFUNDED: "indigo",
};

export default function PaymentsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canRefund = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");

  const q = useQuery(() => (tenantId ? listPaymentsByTenant(tenantId) : Promise.resolve([])), [tenantId]);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }), []);
  const studentName = useMemo(() => {
    const map = new Map<number, string>();
    (studentsQuery.data?.content ?? []).forEach((s) => map.set(s.id, `${s.firstName} ${s.lastName}`));
    return (id: number) => map.get(id) ?? `Élève #${id}`;
  }, [studentsQuery.data]);

  if (!tenantId) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  const rows = (q.data ?? []).filter((p) => !status || p.status === status);

  async function receipt(p: Payment) {
    try {
      const res = await getPaymentReceiptPdf(p.id);
      if (res.url) window.open(res.url, "_blank");
      else notifySuccess("Reçu en génération, réessayez dans un instant.");
    } catch (err) { notifyError(err); }
  }
  async function checkStatus(p: Payment) {
    setCheckingId(p.id);
    try {
      const res = await getPaymentDjomyStatus(p.id);
      notifySuccess(res.status ? `Statut du paiement : ${PAYMENT_STATUS_LABEL[res.status as PaymentStatus] ?? res.status}` : "Statut mis à jour");
      q.refetch();
    } catch (err) { notifyError(err); } finally { setCheckingId(null); }
  }

  function refund(p: Payment) {
    confirmAction({
      title: "Rembourser le paiement", message: `Rembourser ${p.reference} (${formatGNF(p.amount)}) ?`,
      confirmLabel: "Rembourser", danger: true,
      onConfirm: async () => { try { await refundPayment(p.id); notifySuccess("Paiement remboursé"); q.refetch(); } catch (err) { notifyError(err); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Paiements</h1>
        <p className="text-sm text-slate-500">Encaissements et reçus</p>
      </Reveal>

      <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | "")}>
        <option value="">Tous les statuts</option>
        {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((s) => (<option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>))}
      </Select>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Référence</TH><TH>Élève</TH><TH>Montant</TH><TH>Canal</TH><TH>Statut</TH><TH>Date</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-slate-400">Aucun paiement.</TD></TR>}
            {rows.map((p) => (
              <TR key={p.id}>
                <TD className="font-mono text-xs text-slate-600">{p.reference}</TD>
                <TD className="text-slate-700">{studentName(p.studentId)}</TD>
                <TD className="font-medium text-slate-900">{formatGNF(p.amount)}</TD>
                <TD>{PAYMENT_CHANNEL_LABEL[p.channel]}</TD>
                <TD><Badge tone={STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge></TD>
                <TD className="text-slate-500">{p.paidAt?.slice(0, 10) ?? "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {(p.status === "INITIATED" || p.status === "PENDING") && (
                      <Button size="sm" variant="ghost" loading={checkingId === p.id} onClick={() => checkStatus(p)}>Vérifier</Button>
                    )}
                    {p.status === "SUCCEEDED" && <Button size="sm" variant="ghost" onClick={() => receipt(p)}>Reçu PDF</Button>}
                    {canRefund && p.status === "SUCCEEDED" && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => refund(p)}>Rembourser</Button>}
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
