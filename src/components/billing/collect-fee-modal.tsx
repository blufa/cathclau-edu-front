"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox, Select } from "@mantine/core";
import { useQuery } from "@/hooks/use-query";
import { generateMonthlyInvoices, getInvoicePdfObjectUrl, listFeesByClass, listInvoicesByStudent } from "@/lib/api/billing";
import { confirmSchoolPaymentViaDjomy, getReceiptPdfObjectUrl, initiateGroupPayment, listPaymentsByStudent } from "@/lib/api/payment";
import { INVOICE_STATUS_LABEL, type Invoice } from "@/lib/types/billing";
import { type PaymentChannel } from "@/lib/types/payment";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { FilePreview } from "@/components/ui/file-preview";
import { PayInvoiceForm } from "@/components/billing/pay-invoice-form";
import { formatGNF } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { FileText, Receipt as ReceiptIcon } from "lucide-react";

const STATUS_TONE: Record<Invoice["status"], "red" | "amber" | "green"> = {
  UNPAID: "red", PARTIAL: "amber", PAID: "green",
};

/** Modes d'encaissement : guichet (immédiat) + en ligne via Djomy (une seule transaction). */
const PAYMENT_CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: "CASH", label: "Espèces (guichet)" },
  { value: "ORANGE_MONEY", label: "Orange Money (guichet)" },
  { value: "BANK_CARD", label: "Virement bancaire (guichet)" },
  { value: "DJOMY", label: "En ligne (Djomy)" },
];

const remainingOf = (inv: Invoice) => Number(inv.remainingBalance ?? inv.totalAmount);

/**
 * Opens the student's invoices so the desk can collect ("encaisser") them. Monthly tuition invoices
 * are grouped so the parent can tick several months (or the whole year) and pay them in one go at the
 * desk; other invoices (enrolment…) keep a per-invoice form. Each settled payment exposes its receipt
 * PDF (preview / download / print).
 */
export function CollectFeeModal({
  studentId, tenantId, classId, open, onClose, onCollected,
}: {
  studentId: number;
  tenantId: number;
  /** Classe de l'élève — permet de générer les mensualités à partir du frais MENSUALITE de la classe. */
  classId?: number;
  open: boolean;
  onClose: () => void;
  onCollected: () => void;
}) {
  const q = useQuery(() => (open ? listInvoicesByStudent(studentId) : Promise.resolve([])), [open, studentId]);
  const payments = useQuery(() => (open ? listPaymentsByStudent(studentId) : Promise.resolve([])), [open, studentId]);
  const fees = useQuery(() => (open && classId ? listFeesByClass(classId) : Promise.resolve([])), [open, classId]);

  const all = q.data ?? [];
  const unpaid = all.filter((inv) => inv.status !== "PAID");
  const monthly = unpaid.filter((inv) => inv.periodLabel);
  const others = unpaid.filter((inv) => !inv.periodLabel);
  const receipts = (payments.data ?? []).filter((p) => p.status === "SUCCEEDED");
  const monthlyFee = (fees.data ?? []).find((f) => f.type === "MONTHLY");
  const hasAnyMonthly = all.some((inv) => inv.periodLabel);

  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  function refetchAll() { q.refetch(); payments.refetch(); onCollected(); }

  async function generateMonths() {
    if (!monthlyFee) return;
    setGenerating(true);
    try {
      const created = await generateMonthlyInvoices(tenantId, studentId, monthlyFee.id);
      notifySuccess(created.length > 0 ? `${created.length} mensualité(s) générée(s)` : "Mensualités déjà générées");
      q.refetch();
    } catch (err) { notifyError(err); } finally { setGenerating(false); }
  }

  async function showPdf(title: string, fetchUrl: () => Promise<string>) {
    try {
      setPreview({ url: await fetchUrl(), title });
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Facture & encaissement">
        {q.loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : all.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Aucune facture pour cet élève. Vérifiez qu&apos;un frais d&apos;inscription est configuré pour la classe.
          </p>
        ) : (
          <div className="space-y-5">
            {monthly.length > 0 && (
              <MonthlyCollect months={monthly} tenantId={tenantId} studentId={studentId} onDone={refetchAll} />
            )}

            {/* À l'inscription : générer les mensualités pour pouvoir payer l'inscription + les mois choisis. */}
            {monthlyFee && !hasAnyMonthly && (
              <div className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Mensualités non encore générées pour cet élève.
                </p>
                <Button onClick={generateMonths} loading={generating}>Générer les mensualités</Button>
              </div>
            )}

            {others.length === 0 && monthly.length === 0 && !monthlyFee && (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                Toutes les factures sont soldées.
              </p>
            )}

            {others.map((inv) => (
              <div key={inv.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{inv.reference}</p>
                    <p className="text-sm text-slate-700">
                      Total {formatGNF(inv.totalAmount)} · Payé {formatGNF(inv.paidAmount ?? 0)} ·{" "}
                      <span className="font-medium">Reste {formatGNF(inv.remainingBalance ?? inv.totalAmount)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button"
                      onClick={() => showPdf(`Facture ${inv.reference}`, () => getInvoicePdfObjectUrl(inv.id))}
                      className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                      <FileText className="h-4 w-4" /> Facture PDF
                    </button>
                    <Badge tone={STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
                  </div>
                </div>
                <PayInvoiceForm invoice={inv} tenantId={tenantId} onDone={refetchAll} />
              </div>
            ))}

            {receipts.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-slate-500">Reçus de paiement</p>
                {receipts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">
                      <span className="font-mono text-xs">{p.reference}</span> · {formatGNF(p.amount)}
                    </span>
                    <button type="button"
                      onClick={() => showPdf(`Reçu ${p.reference}`, () => getReceiptPdfObjectUrl(p.id))}
                      className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                      <ReceiptIcon className="h-4 w-4" /> Reçu PDF
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} />
    </>
  );
}

/**
 * Multi-month tuition collection: tick several months (or all of them = the year) and collect them at
 * the desk in one click. Each selected month is recorded as its own immediate payment, so every month
 * keeps its own receipt. Online (Djomy) grouped payment is handled from the parent portal.
 */
function MonthlyCollect({
  months, tenantId, studentId, onDone,
}: {
  months: Invoice[];
  tenantId: number;
  studentId: number;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [channel, setChannel] = useState<PaymentChannel>("CASH");
  const [loading, setLoading] = useState(false);
  const [onlineWaiting, setOnlineWaiting] = useState(false);
  const pollIdRef = useRef<number | null>(null);
  const pollTriesRef = useRef(0);

  const allIds = months.map((m) => m.id);
  const selectedMonths = months.filter((m) => selected.includes(m.id));
  const total = selectedMonths.reduce((s, m) => s + remainingOf(m), 0);
  // « Combien lui reste » : somme des mois non réglés restants après ce paiement.
  const remainingAfter = months.filter((m) => !selected.includes(m.id)).reduce((s, m) => s + remainingOf(m), 0);
  const wholeYear = selected.length === allIds.length && allIds.length > 0;
  const online = channel === "DJOMY";
  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected((s) => (s.length === allIds.length ? [] : allIds));

  // Polling Djomy après redirection : confirme/répartit automatiquement dès que le paiement est réussi.
  useEffect(() => {
    if (!onlineWaiting || pollIdRef.current == null) return;
    const t = setInterval(async () => {
      pollTriesRef.current += 1;
      try {
        const p = await confirmSchoolPaymentViaDjomy(pollIdRef.current as number);
        if (p.status === "SUCCEEDED") {
          clearInterval(t);
          setOnlineWaiting(false);
          notifySuccess("Paiement en ligne confirmé — reçu généré.");
          setSelected([]);
          onDone();
        }
      } catch { /* on continue de vérifier */ }
      if (pollTriesRef.current >= 40) {
        clearInterval(t);
        setOnlineWaiting(false);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [onlineWaiting, onDone]);

  async function collect() {
    if (selectedMonths.length === 0) return;
    setLoading(true);
    try {
      // Un seul paiement groupé → un seul reçu listant les mois réglés et le reste à payer.
      const coverageLabel = wholeYear
        ? "Année complète"
        : selectedMonths.map((m) => m.periodLabel).filter(Boolean).join(", ");
      const res = await initiateGroupPayment({
        tenantId, studentId, channel,
        payerNumber: online ? "614324299" : undefined,
        coverageLabel,
        monthsCount: selectedMonths.length,
        remainingAfter,
        shares: selectedMonths.map((m) => ({ invoiceId: m.id, amount: remainingOf(m) })),
      });
      if (online) {
        // Une seule transaction Djomy pour le total : on ouvre le portail puis on attend la confirmation.
        pollIdRef.current = res.payment.id;
        pollTriesRef.current = 0;
        setOnlineWaiting(true);
        if (res.redirectUrl) {
          const w = window.open(res.redirectUrl, "_blank", "noopener,noreferrer");
          if (!w) window.location.assign(res.redirectUrl);
        }
      } else {
        notifySuccess(`${selectedMonths.length} mois encaissé(s) — reçu généré.`);
        setSelected([]);
        onDone();
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Mensualités</p>
        <button type="button" onClick={toggleAll} className="text-xs text-brand-700 hover:underline">
          {selected.length === allIds.length ? "Tout décocher" : "Toute l'année"}
        </button>
      </div>

      <div className="space-y-1.5">
        {months.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white">
            <Checkbox
              checked={selected.includes(m.id)}
              onChange={() => toggle(m.id)}
              label={<span className="text-sm text-slate-700">{m.periodLabel}</span>}
            />
            <span className="text-sm text-slate-600">{formatGNF(remainingOf(m))}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-brand-100 pt-3 sm:flex-row sm:items-end">
        <Select
          label="Mode de paiement"
          className="sm:w-56"
          data={PAYMENT_CHANNELS}
          value={channel}
          onChange={(value) => value && setChannel(value as PaymentChannel)}
        />
        <div className="flex-1" />
        <Button onClick={collect} loading={loading || onlineWaiting} disabled={selected.length === 0}>
          {online ? "Payer en ligne" : "Encaisser"} {selected.length} mois · {formatGNF(total)}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {onlineWaiting
          ? "Portail Djomy ouvert dans un nouvel onglet. L'abonnement des mois sera validé automatiquement dès le paiement confirmé."
          : online
            ? "Paiement en ligne : une seule transaction Djomy pour tous les mois choisis, un reçu unique."
            : "Encaissement au guichet : validé immédiatement, un reçu unique listant les mois et le reste à payer."}
      </p>
    </div>
  );
}
