"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears } from "@/lib/api/academics";
import { searchStudents } from "@/lib/api/students";
import { listUsers } from "@/lib/api/iam";
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
import { openPdfInApp } from "@/lib/open-pdf";
import { formatGNF } from "@/lib/format";
import { WhatsAppInvoiceButton } from "@/components/billing/whatsapp-invoice-button";
import {
  useCheckPaymentStatusMutation,
  useDownloadReceiptMutation,
  usePaymentsQuery,
  useRefundPaymentMutation,
} from "../hooks/use-payments";
import { getPaymentReceiptPdf } from "@/lib/api/payment";

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
  const canRefund = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT") || hasAnyPermission(user, ["paiement:refund"]);

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(
    () => [...(yearsQuery.data ?? [])].sort((a, b) => (b.label ?? "").localeCompare(a.label ?? "", "fr", { numeric: true })),
    [yearsQuery.data],
  );
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const yearId = selectedYearId ?? defaultYearId;
  const q = usePaymentsQuery(tenantId, yearId);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const studentsQuery = useCachedQuery(
    tenantId ? `students-all-v2:${tenantId}` : null,
    () => searchStudents({ size: 1000 }).then((p) => p.content),
    [tenantId],
  );
  const studentName = useMemo(() => {
    const map = new Map<number, string>();
    (studentsQuery.data ?? []).forEach((s) => map.set(s.id, `${s.firstName} ${s.lastName}`));
    return (id: number) => map.get(id) ?? `Élève archivé (#${id})`;
  }, [studentsQuery.data]);

  // Filtre « Comptable » (rapprochement) — visible seulement pour les rôles qui supervisent les
  // encaissements des autres (pas un comptable qui ne verrait que les siens, ça reste une liste globale).
  const canSeeCashierFilter = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const usersQuery = useCachedQuery(
    canSeeCashierFilter && tenantId ? `users-page1:${tenantId}` : null,
    () => listUsers(0, 100),
    [canSeeCashierFilter, tenantId],
  );
  const cashierName = useMemo(() => {
    const map = new Map<number, string>();
    (usersQuery.data?.content ?? []).forEach((u) => map.set(u.id, `${u.firstName} ${u.lastName}`));
    return (id: number) => map.get(id) ?? `Utilisateur #${id}`;
  }, [usersQuery.data]);
  const [cashierId, setCashierId] = useState<number | "">("");

  const refundMutation = useRefundPaymentMutation(tenantId);
  const checkStatusMutation = useCheckPaymentStatusMutation(tenantId);
  const downloadReceiptMutation = useDownloadReceiptMutation();

  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  const rows = (q.data ?? [])
    .filter((p) => !status || p.status === status)
    .filter((p) => !cashierId || p.collectedByUserId === cashierId);
  const cashierTotal = cashierId
    ? rows.filter((p) => p.status === "SUCCEEDED").reduce((sum, p) => sum + Number(p.amount), 0)
    : null;

  async function receipt(p: Payment) {
    try {
      const res = await downloadReceiptMutation.mutateAsync(p.id);
      if (res.url) openPdfInApp(res.url, "Reçu");
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

      <div className="flex flex-wrap items-center gap-3">
        <Select className="max-w-[200px]" value={yearId ?? ""} onChange={(e) => setSelectedYearId(e.target.value ? Number(e.target.value) : null)}>
          {years.length === 0 && <option value="">—</option>}
          {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
        </Select>
        <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | "")}>
          <option value="">Tous les statuts</option>
          {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((s) => (<option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>))}
        </Select>
        {canSeeCashierFilter && (usersQuery.data?.content?.length ?? 0) > 0 && (
          <Select className="max-w-[220px]" value={cashierId} onChange={(e) => setCashierId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Tous les comptables</option>
            {(usersQuery.data?.content ?? []).map((u) => (<option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>))}
          </Select>
        )}
      </div>

      {cashierId !== "" && cashierTotal !== null && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <span className="font-semibold">{cashierName(cashierId)}</span> a encaissé{" "}
          <span className="font-semibold">{formatGNF(cashierTotal)}</span> sur {rows.filter((p) => p.status === "SUCCEEDED").length} paiement(s) réussi(s) —
          dans le filtre courant (année/statut).
        </div>
      )}

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH className="hidden sm:table-cell">Référence</TH><TH>Élève</TH><TH>Montant</TH><TH className="hidden sm:table-cell">Canal</TH><TH>Statut</TH><TH className="hidden sm:table-cell">Date</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucun paiement.</TD></TR>}
            {rows.map((p) => (
              <TR key={p.id}>
                <TD className="hidden font-mono text-xs text-gray-600 sm:table-cell">{p.reference}</TD>
                <TD className="text-gray-700">{studentName(p.studentId)}</TD>
                <TD className="font-medium text-gray-900">{formatGNF(p.amount)}</TD>
                <TD className="hidden sm:table-cell">{PAYMENT_CHANNEL_LABEL[p.channel]}</TD>
                <TD><Badge tone={STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge></TD>
                <TD className="hidden text-gray-500 sm:table-cell">{p.paidAt?.slice(0, 10) ?? "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {(p.status === "INITIATED" || p.status === "PENDING") && (
                      <Button size="sm" variant="ghost" loading={checkStatusMutation.isPending && checkStatusMutation.variables === p.id} onClick={() => checkStatus(p)}>Vérifier</Button>
                    )}
                    {p.status === "SUCCEEDED" && <Button size="sm" variant="ghost" onClick={() => receipt(p)}>Reçu PDF</Button>}
                    {p.status === "SUCCEEDED" && (
                      <WhatsAppInvoiceButton
                        studentId={p.studentId}
                        buildMessage={async () => {
                          const { url } = await getPaymentReceiptPdf(p.id);
                          const name = studentName(p.studentId);
                          return `Bonjour, voici le reçu de paiement de ${formatGNF(p.amount)} pour ${name} (réf. ${p.reference}).${url ? ` ${url}` : ""}`;
                        }}
                      />
                    )}
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
