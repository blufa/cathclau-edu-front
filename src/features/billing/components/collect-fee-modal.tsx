"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { applyEarlyPaymentDiscount, generateMonthlyInvoices, getInvoicePdfObjectUrl, listFeesByClass, listInstallments, listInvoicesByStudent } from "@/lib/api/billing";
import { confirmSchoolPaymentViaDjomy, getReceiptPdfObjectUrl, initiateGroupPayment, listPaymentsByStudent } from "@/lib/api/payment";
import { FEE_TYPE_LABEL, type FeeType, type Invoice } from "@/lib/types/billing";
import { type PaymentChannel } from "@/lib/types/payment";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Label, Field, MoneyInput } from "@/components/ui/input";
import { FilePreview } from "@/components/ui/file-preview";
import { formatGNF } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { FileText, Receipt as ReceiptIcon } from "lucide-react";

/** Modes d'encaissement : guichet (immédiat) + en ligne via Djomy (une seule transaction). */
const PAYMENT_CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: "CASH", label: "Espèces (guichet)" },
  { value: "ORANGE_MONEY", label: "Orange Money (guichet)" },
  { value: "BANK_CARD", label: "Virement bancaire (guichet)" },
  { value: "DJOMY", label: "En ligne (Djomy)" },
];

const remainingOf = (inv: Invoice) => Number(inv.remainingBalance ?? inv.totalAmount);

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** À partir d'un mois "YYYY-MM", son libellé court (ex. "mai"). */
function monthShortLabel(monthValue: string): string {
  const [, m] = monthValue.split("-").map(Number);
  return MONTHS_FR[m - 1] ?? monthValue;
}

/** Ordre d'affichage naturel du guichet : inscription/réinscription d'abord, puis la scolarité
 * (tranches, triées chronologiquement), puis les frais annexes (transport, cantine, examen…). */
const GROUP_ORDER: Record<FeeType, number> = {
  ENROLLMENT: 0, RE_ENROLLMENT: 0, MONTHLY: 1, TRANSPORT: 2, CANTEEN: 2, EXAM: 2, OTHER: 2,
};

/**
 * Opens the student's invoices so the desk can collect ("encaisser") them in a single unified list —
 * tuition tranches (chronologically ordered) alongside enrolment and annex fees (transport, canteen…)
 * — so the desk can tick everything a family wants to settle at once and record it as ONE grouped
 * payment with a single receipt. Each settled payment exposes its receipt PDF (preview / download / print).
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
  const receipts = (payments.data ?? []).filter((p) => p.status === "SUCCEEDED");
  const monthlyFee = (fees.data ?? []).find((f) => f.type === "MONTHLY");
  const hasAnyMonthly = all.some((inv) => inv.periodLabel);

  // Mois librement choisis par tranche (§billing) : nécessaires pour afficher le détail des mois
  // couverts par chaque mensualité, trier les tranches chronologiquement, et permettre un paiement
  // partiel « par mois » à l'encaissement.
  const installments = useQuery(
    () => (open && monthlyFee ? listInstallments(monthlyFee.id) : Promise.resolve([])),
    [open, monthlyFee?.id],
  );
  const installmentMonths = new Map((installments.data ?? []).map((i) => [i.id, i.months ?? []]));
  const installmentSortKey = new Map(
    (installments.data ?? []).map((i) => {
      const months = [...(i.months ?? [])].sort();
      return [i.id, months[0] ?? i.dueDate ?? "9999-12"];
    }),
  );

  // Libellé + ordre d'affichage de chaque facture : les mensualités gardent leur périodLabel (déjà
  // « Tranche N (mois…) ») ; les autres frais (inscription, annexes) affichent leur type de frais.
  const feeById = new Map((fees.data ?? []).map((f) => [f.id, f]));
  function labelFor(inv: Invoice): string {
    if (inv.periodLabel) return inv.periodLabel;
    const fee = inv.feeId != null ? feeById.get(inv.feeId) : undefined;
    if (!fee) return inv.reference;
    return fee.type === "OTHER" && fee.label ? fee.label : FEE_TYPE_LABEL[fee.type];
  }
  function groupOf(inv: Invoice): number {
    const fee = inv.feeId != null ? feeById.get(inv.feeId) : undefined;
    return fee ? GROUP_ORDER[fee.type] : 2;
  }
  function sortKeyOf(inv: Invoice): string {
    return inv.periodLabel ? (installmentSortKey.get(inv.installmentId ?? -1) ?? "9999-12") : "";
  }
  const payable = [...unpaid].sort((a, b) => {
    const g = groupOf(a) - groupOf(b);
    if (g !== 0) return g;
    return sortKeyOf(a).localeCompare(sortKeyOf(b));
  });

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
            {payable.length > 0 && (
              <InvoiceCollect
                invoices={payable}
                labelFor={labelFor}
                installmentMonths={installmentMonths}
                monthlyFeeId={monthlyFee?.id ?? null}
                tenantId={tenantId}
                studentId={studentId}
                onShowPdf={(inv) => showPdf(`Facture ${inv.reference}`, () => getInvoicePdfObjectUrl(inv.id))}
                onDone={refetchAll}
              />
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

            {payable.length === 0 && !monthlyFee && (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                Toutes les factures sont soldées.
              </p>
            )}

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
 * Unified collection: tick any mix of tuition tranches, enrolment/re-enrolment and annex fees
 * (transport, canteen…) and settle them at the desk in one click, as a single grouped payment with a
 * single receipt. A parent may come with just the enrolment + a couple of months' advance on a
 * tranche — partial amounts are always accepted, never refused. Online (Djomy) grouped payment is
 * handled from the parent portal.
 */
function InvoiceCollect({
  invoices, labelFor, installmentMonths, monthlyFeeId, tenantId, studentId, onShowPdf, onDone,
}: {
  invoices: Invoice[];
  labelFor: (inv: Invoice) => string;
  /** Mois "YYYY-MM" couverts par tranche (installmentId → mois), pour le détail et le paiement par mois. */
  installmentMonths: Map<number, string[]>;
  /** Id du frais MENSUALITE (scolarité) — sert à isoler les tranches pour la remise année complète. */
  monthlyFeeId: number | null;
  tenantId: number;
  studentId: number;
  onShowPdf: (inv: Invoice) => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [channel, setChannel] = useState<PaymentChannel>("CASH");
  const [loading, setLoading] = useState(false);
  const [onlineWaiting, setOnlineWaiting] = useState(false);
  const pollIdRef = useRef<number | null>(null);
  const pollTriesRef = useRef(0);
  // Montant retenu par facture : par défaut le solde restant, mais éditable pour un paiement partiel —
  // un parent peut venir avec moins que le montant de la tranche/du frais, jamais refusé.
  const [customAmounts, setCustomAmounts] = useState<Record<number, number>>({});
  // Mois cochés dans chaque tranche multi-mois, pour aider au calcul (« je paie 2 des 5 mois »).
  const [monthSelections, setMonthSelections] = useState<Record<number, string[]>>({});

  const allIds = invoices.map((inv) => inv.id);
  const monthlyIds = invoices.filter((inv) => inv.feeId === monthlyFeeId).map((inv) => inv.id);
  const wholeYear = monthlyIds.length > 0 && monthlyIds.every((id) => selected.includes(id));

  // Paiement de toutes les tranches restantes en un coup : la remise pour paiement annuel complet
  // (§billing, configurable dans Règles de facturation) s'applique côté serveur — jamais confiée au
  // front. Recalculée dès que toute la scolarité est sélectionnée ; sans effet si aucune règle active.
  const discountQuery = useQuery(
    () => (wholeYear && monthlyFeeId ? applyEarlyPaymentDiscount(studentId, monthlyFeeId) : Promise.resolve(null)),
    [wholeYear, monthlyFeeId, studentId],
  );
  // Les factures de scolarité sont remplacées par leur version remisée ; le reste de la liste (inscription,
  // frais annexes) n'est jamais concerné par cette remise et reste inchangé.
  const discounted = discountQuery.data;
  const effectiveInvoices = wholeYear && discounted
    ? invoices.map((inv) => discounted.find((d) => d.id === inv.id) ?? inv)
    : invoices;
  const discountApplied = wholeYear && discounted
    ? monthlyIds.reduce((s, id) => s + remainingOf(invoices.find((i) => i.id === id)!), 0)
      - monthlyIds.reduce((s, id) => s + remainingOf(effectiveInvoices.find((i) => i.id === id)!), 0)
    : 0;

  /** Montant retenu pour cette facture : personnalisé si saisi, sinon le solde restant en entier. */
  function amountFor(m: Invoice): number {
    const custom = customAmounts[m.id];
    return custom != null ? Math.min(Math.max(custom, 0), remainingOf(m)) : remainingOf(m);
  }
  function setAmount(m: Invoice, value: number) {
    setCustomAmounts((prev) => ({ ...prev, [m.id]: Math.min(Math.max(value, 0), remainingOf(m)) }));
  }
  /** Coche/décoche un mois d'une tranche multi-mois : recalcule le montant proportionnellement. */
  function toggleMonth(m: Invoice, allMonths: string[], month: string) {
    const current = monthSelections[m.id] ?? allMonths;
    const next = current.includes(month) ? current.filter((x) => x !== month) : [...current, month];
    setMonthSelections((prev) => ({ ...prev, [m.id]: next }));
    const perMonth = Number(m.totalAmount) / allMonths.length;
    setAmount(m, next.length * perMonth);
  }

  const selectedInvoices = effectiveInvoices.filter((m) => selected.includes(m.id));
  const total = selectedInvoices.reduce((s, m) => s + amountFor(m), 0);
  // « Combien lui reste » : factures non cochées en entier + le reliquat des factures payées partiellement.
  const remainingAfter = effectiveInvoices.reduce((s, m) => {
    if (!selected.includes(m.id)) return s + remainingOf(m);
    return s + Math.max(0, remainingOf(m) - amountFor(m));
  }, 0);
  const online = channel === "DJOMY";
  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleMonthlyFees = () =>
    setSelected((s) => (wholeYear ? s.filter((id) => !monthlyIds.includes(id)) : [...new Set([...s, ...monthlyIds])]));
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
          setCustomAmounts({});
          setMonthSelections({});
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
    const shares = selectedInvoices.map((m) => ({ invoiceId: m.id, amount: amountFor(m) })).filter((s) => s.amount > 0);
    if (shares.length === 0) return;
    setLoading(true);
    try {
      // Un seul paiement groupé → un seul reçu listant tout ce qui a été réglé (inscription, tranches
      // avec leurs mois, frais annexes) et le reste à payer.
      const coverageLabel = wholeYear && selectedInvoices.length === monthlyIds.length
        ? "Scolarité complète"
        : selectedInvoices.map(labelFor).filter(Boolean).join(", ");
      const res = await initiateGroupPayment({
        tenantId, studentId, channel,
        payerNumber: online ? "614324299" : undefined,
        coverageLabel,
        monthsCount: selectedInvoices.length,
        remainingAfter,
        shares,
        academicYearId: selectedInvoices[0]?.academicYearId ?? null,
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
        notifySuccess(`${selectedInvoices.length} facture(s) encaissée(s) — reçu généré.`);
        setSelected([]);
        setCustomAmounts({});
        setMonthSelections({});
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
        <p className="text-sm font-semibold text-slate-700">Factures à régler</p>
        <div className="flex gap-3 text-xs">
          {monthlyIds.length > 0 && (
            <button type="button" onClick={toggleMonthlyFees} className="text-brand-700 hover:underline">
              {wholeYear ? "Décocher la scolarité" : "Toute la scolarité"}
            </button>
          )}
          <button type="button" onClick={toggleAll} className="text-slate-500 hover:underline">
            {selected.length === allIds.length ? "Tout décocher" : "Tout sélectionner"}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {effectiveInvoices.map((m) => {
          const coveredMonths = installmentMonths.get(m.installmentId ?? -1) ?? [];
          const isChecked = selected.includes(m.id);
          const checkedSubMonths = monthSelections[m.id] ?? coveredMonths;
          const partial = isChecked && amountFor(m) < remainingOf(m);
          return (
            <div key={m.id} className="rounded-lg px-2 py-1.5 hover:bg-white">
              <label className="flex cursor-pointer items-center justify-between gap-2">
                <Checkbox
                  checked={isChecked}
                  onChange={() => toggle(m.id)}
                  label={(
                    <span className="text-sm text-slate-700">
                      {labelFor(m)}
                      {m.discountAmount != null && Number(m.discountAmount) > 0 && (
                        <span className="ml-1.5 text-xs font-medium text-success-600" title={m.discountReason ?? undefined}>
                          (remise −{formatGNF(m.discountAmount)})
                        </span>
                      )}
                    </span>
                  )}
                />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onShowPdf(m)}
                    className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                  {isChecked ? (
                    <MoneyInput
                      className="w-36"
                      value={amountFor(m)}
                      onValueChange={(n) => setAmount(m, n)}
                    />
                  ) : (
                    <span className="text-sm text-slate-600">{formatGNF(remainingOf(m))}</span>
                  )}
                </div>
              </label>
              {isChecked && coveredMonths.length > 1 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-6">
                  {coveredMonths.map((month) => (
                    <Checkbox
                      key={month}
                      checked={checkedSubMonths.includes(month)}
                      onChange={() => toggleMonth(m, coveredMonths, month)}
                      label={<span className="text-xs text-slate-500">{monthShortLabel(month)}</span>}
                    />
                  ))}
                </div>
              )}
              {partial && (
                <p className="pl-6 text-xs text-warning-600">
                  Paiement partiel — reste {formatGNF(remainingOf(m) - amountFor(m))} sur cette facture.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {wholeYear && discountQuery.loading && (
        <p className="mt-2 text-xs text-slate-400">Vérification d&apos;une remise pour paiement annuel complet…</p>
      )}
      {wholeYear && discountApplied > 0 && (
        <p className="mt-2 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700">
          Remise scolarité complète appliquée : −{formatGNF(discountApplied)}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-brand-100 pt-3 sm:flex-row sm:items-end">
        <Field>
          <Label>Mode de paiement</Label>
          <Select className="sm:w-56" value={channel} onChange={(e) => setChannel(e.target.value as PaymentChannel)}>
            {PAYMENT_CHANNELS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
          </Select>
        </Field>
        <div className="flex-1" />
        <Button onClick={collect} loading={loading || onlineWaiting} disabled={selected.length === 0}>
          {online ? "Payer en ligne" : "Encaisser"} {selected.length} facture{selected.length > 1 ? "s" : ""} · {formatGNF(total)}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {onlineWaiting
          ? "Portail Djomy ouvert dans un nouvel onglet. Le règlement sera validé automatiquement dès le paiement confirmé."
          : online
            ? "Paiement en ligne : une seule transaction Djomy pour tout ce qui est coché, un reçu unique."
            : "Encaissement au guichet : validé immédiatement, un reçu unique listant tout ce qui est réglé et le reste à payer."}
      </p>
    </div>
  );
}
