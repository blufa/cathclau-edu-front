"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { getCurrentAcademicYear } from "@/lib/api/academics";
import { searchEnrollments } from "@/lib/api/enrollments";
import { getInvoicePdfObjectUrl, listFeesByClass, listInstallments, listInvoicesByStudent } from "@/lib/api/billing";
import { isNetworkError } from "@/lib/api/errors";
import { FEE_TYPE_LABEL, type FeeType, type Invoice } from "@/lib/types/billing";
import { type PaymentChannel } from "@/lib/types/payment";
import { submitGroupPaymentOfflineAware } from "@/lib/offline/submit-group-payment";
import { useSyncQueueStore } from "@/lib/offline/sync-queue-store";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Label, Field, MoneyInput } from "@/components/ui/input";
import { FilePreview } from "@/components/ui/file-preview";
import { formatGNF, monthShortLabel } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { printHtmlDocument } from "@/lib/print-node";
import { FileText } from "lucide-react";

const PAYMENT_CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: "CASH", label: "Espèces (guichet)" },
  { value: "ORANGE_MONEY", label: "Orange Money (guichet)" },
  { value: "BANK_CARD", label: "Virement bancaire (guichet)" },
  { value: "DJOMY", label: "En ligne (Djomy)" },
];

const GROUP_ORDER: Record<FeeType, number> = {
  ENROLLMENT: 0, RE_ENROLLMENT: 0, MONTHLY: 1, TRANSPORT: 2, CANTEEN: 2, EXAM: 2, OTHER: 2, PLATFORM: 2,
};


const remainingOf = (inv: Invoice) => Number(inv.remainingBalance ?? inv.totalAmount);

interface ChildRow {
  studentId: number;
  studentName: string;
  invoice: Invoice;
  label: string;
  coveredMonths: string[];
}

/** Factures impayées d'un enfant, triées et étiquetées comme sur son propre écran d'encaissement
 * (inscription d'abord, puis scolarité chronologique, puis frais annexes). */
async function fetchChildRows(studentId: number, studentName: string, classId: number | null): Promise<ChildRow[]> {
  const [invoicesAll, fees] = await Promise.all([
    listInvoicesByStudent(studentId),
    classId ? listFeesByClass(classId) : Promise.resolve([]),
  ]);
  const unpaid = invoicesAll.filter((inv) => inv.status !== "PAID");
  const monthlyFee = fees.find((f) => f.type === "MONTHLY");
  const installments = monthlyFee ? await listInstallments(monthlyFee.id) : [];
  const installmentMonths = new Map(installments.map((i) => [i.id, [...(i.months ?? [])].sort()]));
  const installmentSortKey = new Map(installments.map((i) => {
    const months = [...(i.months ?? [])].sort();
    return [i.id, months[0] ?? i.dueDate ?? "9999-12"];
  }));
  // Mois couverts PAR CETTE FACTURE précisément (pas par toute la tranche) — voir la même correction
  // dans CollectFeeModal : avec « paiement par mois », plusieurs factures partagent le même
  // installmentId (une par mois) ; sans ça chacune affichait à tort tous les mois de la tranche.
  const coveredMonthsByInvoiceId = new Map<number, string[]>();
  {
    const byInstallmentId = new Map<number, Invoice[]>();
    for (const inv of unpaid) {
      if (inv.installmentId == null) continue;
      const list = byInstallmentId.get(inv.installmentId) ?? [];
      list.push(inv);
      byInstallmentId.set(inv.installmentId, list);
    }
    for (const [instId, invs] of byInstallmentId) {
      const monthsOfInstallment = installmentMonths.get(instId) ?? [];
      if (invs.length <= 1 || monthsOfInstallment.length <= 1) {
        for (const inv of invs) coveredMonthsByInvoiceId.set(inv.id, monthsOfInstallment);
        continue;
      }
      [...invs].sort((a, b) => a.id - b.id).forEach((inv, idx) => {
        const single = monthsOfInstallment[idx];
        coveredMonthsByInvoiceId.set(inv.id, single != null ? [single] : monthsOfInstallment);
      });
    }
  }
  const feeById = new Map(fees.map((f) => [f.id, f]));
  function groupOf(inv: Invoice): number {
    const fee = inv.feeId != null ? feeById.get(inv.feeId) : undefined;
    return fee ? GROUP_ORDER[fee.type] : 2;
  }
  function sortKeyOf(inv: Invoice): string {
    return inv.periodLabel ? (installmentSortKey.get(inv.installmentId ?? -1) ?? "9999-12") : "";
  }
  const sorted = [...unpaid].sort((a, b) => {
    const g = groupOf(a) - groupOf(b);
    return g !== 0 ? g : sortKeyOf(a).localeCompare(sortKeyOf(b));
  });
  return sorted.map((inv) => {
    const fee = inv.feeId != null ? feeById.get(inv.feeId) : undefined;
    const label = inv.periodLabel ?? (fee ? (fee.type === "OTHER" && fee.label ? fee.label : FEE_TYPE_LABEL[fee.type]) : inv.reference);
    return { studentId, studentName, invoice: inv, label, coveredMonths: coveredMonthsByInvoiceId.get(inv.id) ?? [] };
  });
}

/**
 * Encaissement groupé pour plusieurs enfants (fratrie ou sélection libre) : un parent peut régler en
 * une fois l'inscription, la scolarité (avec ses mois) et les frais annexes de PLUSIEURS enfants — un
 * seul paiement, un seul reçu détaillant chaque enfant. Option à côté de l'encaissement par élève
 * (CollectFeeModal).
 */
export function MultiChildCollectModal({
  students, tenantId, open, onClose, onCollected,
}: {
  students: { id: number; name: string }[]; tenantId: number; open: boolean; onClose: () => void; onCollected: () => void;
}) {
  const q = useQuery(async () => {
    if (!open || students.length === 0) return [] as ChildRow[];
    const year = await getCurrentAcademicYear();
    const perChild = await Promise.all(students.map(async (student) => {
      let classId: number | null = null;
      if (year) {
        const enrollments = await searchEnrollments({ studentId: student.id, academicYearId: year.id, status: "VALIDATED" });
        classId = enrollments[0]?.classId ?? null;
      }
      return fetchChildRows(student.id, student.name, classId);
    }));
    return perChild.flat();
  }, [open, students.map((s) => s.id).join(",")]);
  const rows = q.data ?? [];
  const studentIds = [...new Set(rows.map((r) => r.studentId))];

  const [selected, setSelected] = useState<number[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<number, number>>({});
  const [monthSelections, setMonthSelections] = useState<Record<number, string[]>>({});
  const [channel, setChannel] = useState<PaymentChannel>("CASH");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);

  function amountFor(row: ChildRow): number {
    const custom = customAmounts[row.invoice.id];
    return custom != null ? Math.min(Math.max(custom, 0), remainingOf(row.invoice)) : remainingOf(row.invoice);
  }
  function setAmount(row: ChildRow, value: number) {
    setCustomAmounts((prev) => ({ ...prev, [row.invoice.id]: Math.min(Math.max(value, 0), remainingOf(row.invoice)) }));
  }
  function toggleMonth(row: ChildRow, month: string) {
    const current = monthSelections[row.invoice.id] ?? row.coveredMonths;
    const next = current.includes(month) ? current.filter((x) => x !== month) : [...current, month];
    setMonthSelections((prev) => ({ ...prev, [row.invoice.id]: next }));
    const perMonth = Number(row.invoice.totalAmount) / row.coveredMonths.length;
    setAmount(row, next.length * perMonth);
  }
  /** Libellé précis pour le reçu (voir CollectFeeModal.receiptLabelFor) : reflète le(s) mois
   * réellement réglé(s) plutôt que le libellé complet de la tranche quand le paiement est partiel. */
  function receiptLabelFor(row: ChildRow): string {
    if (row.coveredMonths.length <= 1) return row.label;
    const checked = monthSelections[row.invoice.id] ?? row.coveredMonths;
    if (checked.length === row.coveredMonths.length) return row.label;
    const monthsLabel = [...checked].sort().map(monthShortLabel).join(", ");
    return monthsLabel ? `${row.label} — ${monthsLabel} réglé(s)` : row.label;
  }
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allIds = rows.map((r) => r.invoice.id);
  const toggleAll = () => setSelected((s) => (s.length === allIds.length ? [] : allIds));

  const selectedRows = rows.filter((r) => selected.includes(r.invoice.id));
  const total = selectedRows.reduce((s, r) => s + amountFor(r), 0);
  const remainingAfter = rows.reduce((s, r) => {
    if (!selected.includes(r.invoice.id)) return s + remainingOf(r.invoice);
    return s + Math.max(0, remainingOf(r.invoice) - amountFor(r));
  }, 0);
  const online = channel === "DJOMY";

  async function showPdf(inv: Invoice) {
    try { setPreview({ url: await getInvoicePdfObjectUrl(inv.id), title: `Facture ${inv.reference}` }); }
    catch (err) { notifyError(err); }
  }

  const queuedPayments = useSyncQueueStore((s) => s.items)
    .filter((i) => studentIds.some((sid) => i.studentIds.includes(sid)));

  /** Reçu provisoire imprimable (pas de PDF serveur tant que le paiement n'est pas synchronisé) — voir
   * CollectFeeModal.printProvisionalReceipt (même logique, dupliquée : deux écrans indépendants). */
  function printProvisionalReceipt(entry: (typeof queuedPayments)[number]) {
    const total = entry.input.shares.reduce((s, x) => s + x.amount, 0);
    printHtmlDocument(`<!doctype html><html><head><title>Reçu provisoire</title>
      <style>body{font-family:sans-serif;padding:24px;color:#111}
      h1{font-size:16px}p{margin:6px 0}.tag{color:#b45309;font-weight:600}</style></head>
      <body>
        <h1>Reçu PROVISOIRE</h1>
        <p class="tag">Enregistré hors-ligne — sera remplacé par le reçu officiel après synchronisation.</p>
        <p>Référence locale : OFFLINE-${entry.id.slice(0, 8).toUpperCase()}</p>
        <p>Date : ${new Date(entry.createdAt).toLocaleString("fr-FR")}</p>
        <p>Détail : ${entry.input.coverageLabel}</p>
        <p>Montant : ${formatGNF(total)}</p>
      </body></html>`);
  }

  async function collect() {
    // paidMonths : sur une tranche multi-mois, précise quels mois sont réglés par cette part (voir
    // CollectFeeModal, même logique).
    const shares = selectedRows
      .map((r) => ({
        invoiceId: r.invoice.id, studentId: r.studentId, amount: amountFor(r),
        paidMonths: r.coveredMonths.length > 1 ? (monthSelections[r.invoice.id] ?? r.coveredMonths) : undefined,
      }))
      .filter((s) => s.amount > 0);
    if (shares.length === 0) return;
    setLoading(true);
    try {
      const coverageLabel = `Fratrie (${studentIds.length} enfant${studentIds.length > 1 ? "s" : ""}) — `
        + selectedRows.map((r) => `${r.studentName} : ${receiptLabelFor(r)}`).join(", ");
      const attempt = await submitGroupPaymentOfflineAware({
        tenantId, studentId: rows[0]?.studentId, channel,
        payerNumber: online ? "614324299" : undefined,
        coverageLabel, monthsCount: selectedRows.length, remainingAfter, shares,
        academicYearId: selectedRows[0]?.invoice.academicYearId ?? null,
      });
      if (attempt.outcome === "queued" || attempt.outcome === "queued-desktop") {
        notifySuccess("Encaissement enregistré hors-ligne — sera synchronisé automatiquement.");
        setSelected([]); setCustomAmounts({}); setMonthSelections({});
        return;
      }
      notifySuccess(`${selectedRows.length} facture(s) encaissée(s) pour ${studentIds.length} enfant(s) — reçu unique généré.`);
      setSelected([]); setCustomAmounts({}); setMonthSelections({});
      onCollected();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Encaissement groupé (${students.length} élève${students.length > 1 ? "s" : ""})`} className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {q.loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : students.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Aucun élève sélectionné.</p>
        ) : rows.length === 0 && isNetworkError(q.error) ? (
          <p className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-800">
            Impossible de charger les factures (hors-ligne) — rouvrez cette fenêtre pendant que vous étiez
            connecté, ou reconnectez-vous pour continuer.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Toutes les factures de tous les enfants sont soldées.</p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{studentIds.length} enfant(s) — factures à régler</p>
                <button type="button" onClick={toggleAll} className="text-xs text-brand-700 hover:underline">
                  {selected.length === allIds.length ? "Tout décocher" : "Tout sélectionner"}
                </button>
              </div>

              {studentIds.map((sid) => {
                const childRows = rows.filter((r) => r.studentId === sid);
                return (
                  <div key={sid} className="mb-3 last:mb-0">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{childRows[0].studentName}</p>
                    <div className="space-y-1.5">
                      {childRows.map((row) => {
                        const isChecked = selected.includes(row.invoice.id);
                        const checkedSubMonths = monthSelections[row.invoice.id] ?? row.coveredMonths;
                        const partial = isChecked && amountFor(row) < remainingOf(row.invoice);
                        return (
                          <div key={row.invoice.id} className="rounded-lg px-2 py-1.5 hover:bg-white">
                            <label className="flex cursor-pointer items-center justify-between gap-2">
                              <Checkbox
                                checked={isChecked}
                                onChange={() => toggle(row.invoice.id)}
                                label={(
                                  <span className="text-sm text-slate-700">
                                    {row.label}
                                    {row.invoice.discountAmount != null && Number(row.invoice.discountAmount) > 0 && (
                                      <span className="ml-1.5 text-xs font-medium text-success-600">
                                        (remise −{formatGNF(row.invoice.discountAmount)}{row.invoice.discountReason && ` · ${row.invoice.discountReason}`})
                                      </span>
                                    )}
                                  </span>
                                )}
                              />
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => showPdf(row.invoice)}
                                  className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                                  <FileText className="h-3.5 w-3.5" />
                                </button>
                                {isChecked ? (
                                  <MoneyInput className="w-36" value={amountFor(row)} onValueChange={(n) => setAmount(row, n)} />
                                ) : (
                                  <span className="text-sm text-slate-600">{formatGNF(remainingOf(row.invoice))}</span>
                                )}
                              </div>
                            </label>
                            {isChecked && row.coveredMonths.length > 1 && (
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-6">
                                {row.coveredMonths.map((month) => (
                                  <Checkbox
                                    key={month}
                                    checked={checkedSubMonths.includes(month)}
                                    onChange={() => toggleMonth(row, month)}
                                    label={<span className="text-xs text-slate-500">{monthShortLabel(month)}</span>}
                                  />
                                ))}
                              </div>
                            )}
                            {partial && (
                              <p className="pl-6 text-xs text-warning-600">
                                Paiement partiel — reste {formatGNF(remainingOf(row.invoice) - amountFor(row))} sur cette facture.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 flex flex-col gap-3 border-t border-brand-100 pt-3 sm:flex-row sm:items-end">
                <Field>
                  <Label>Mode de paiement</Label>
                  <Select className="sm:w-56" value={channel} onChange={(e) => setChannel(e.target.value as PaymentChannel)}>
                    {PAYMENT_CHANNELS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                  </Select>
                </Field>
                <div className="flex-1" />
                <Button onClick={collect} loading={loading} disabled={selected.length === 0}>
                  {online ? "Payer en ligne" : "Encaisser"} {selected.length} facture{selected.length > 1 ? "s" : ""} · {formatGNF(total)}
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Un seul paiement, un seul reçu listant chaque enfant et ses factures réglées.
              </p>
            </div>

            {queuedPayments.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-warning-700">
                  Reçus provisoires (hors-ligne — en attente de synchronisation)
                </p>
                {queuedPayments.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">
                      <span className="font-mono text-xs">OFFLINE-{entry.id.slice(0, 8).toUpperCase()}</span> ·{" "}
                      {formatGNF(entry.input.shares.reduce((s, x) => s + x.amount, 0))}
                    </span>
                    <button type="button"
                      onClick={() => printProvisionalReceipt(entry)}
                      className="inline-flex items-center gap-1 text-xs text-warning-700 hover:underline">
                      Reçu provisoire
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
