"use client";

import { useState } from "react";
import { initiatePayment } from "@/lib/api/payment";
import { type PaymentChannel } from "@/lib/types/payment";
import { type Invoice } from "@/lib/types/billing";
import { Button } from "@/components/ui/button";
import { Label, Field, MoneyInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";
import { useCashierSessionGate } from "@/hooks/use-cashier-session-gate";

/** Pure reference generator shared by the billing collection flows. */
export function genRef(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

/** Modes d'encaissement au guichet : argent déjà reçu, enregistrés immédiatement (reçu généré). */
const DESK_CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: "CASH", label: "Espèces" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "BANK_CARD", label: "Virement bancaire" },
];

/**
 * Collect a payment ("encaisser") against an invoice at the desk — cash, Orange Money or bank
 * transfer, all recorded immediately with a receipt. Online payment by the parent from home goes
 * through the Djomy portal elsewhere (not offered here). Le montant n'est plus plafonné au solde dû
 * (§4 cahier des charges, trop-perçu) : un montant saisi au-delà du solde est accepté — le surplus
 * est automatiquement conservé comme crédit disponible de l'élève côté backend
 * (InvoiceService#applyPayment), réutilisable sur une facture future. Reused by the invoices page and
 * the enrollment fee-collection modal.
 */
export function PayInvoiceForm({ invoice, tenantId, onDone }: { invoice: Invoice; tenantId: number; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const remaining = Number(invoice.remainingBalance ?? invoice.totalAmount);
  const [channel, setChannel] = useState<PaymentChannel>("CASH");
  const [amount, setAmount] = useState(remaining);
  const surplus = Math.max(0, amount - remaining);
  // Tous les canaux proposés ici sont guichet (voir DESK_CHANNELS) : jamais de paiement en ligne sur
  // ce formulaire, la barrière caisse s'applique donc sans condition de canal.
  const { sessionOpen, loading: sessionLoading } = useCashierSessionGate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await initiatePayment({
        tenantId, invoiceId: invoice.id, studentId: invoice.studentId,
        reference: genRef(`PAY-${invoice.reference}`),
        amount, channel,
        type: amount >= remaining ? "COMPLETE" : "PARTIAL",
        payerNumber: "614324299",
        academicYearId: invoice.academicYearId,
      });
      if (res.redirectUrl) {
        notifySuccess("Ouverture du portail de paiement dans un nouvel onglet…");
        const win = window.open(res.redirectUrl, "_blank", "noopener,noreferrer");
        if (!win) window.location.assign(res.redirectUrl);
        return;
      }
      const label = DESK_CHANNELS.find((c) => c.value === channel)?.label ?? "Paiement";
      notifySuccess(`Encaissement ${label} validé — reçu généré.`);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field>
        <Label>Mode d&apos;encaissement</Label>
        <Select value={channel} onChange={(e) => setChannel(e.target.value as PaymentChannel)}>
          {DESK_CHANNELS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
        </Select>
      </Field>
      <Field>
        <Label>Montant</Label>
        <MoneyInput value={amount} onValueChange={setAmount} />
      </Field>
      {surplus > 0 && (
        <p className="rounded-md bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800">
          Facture soldée à {formatGNF(remaining)} — le surplus de {formatGNF(surplus)} sera conservé
          comme crédit disponible sur le compte de l&apos;élève, réutilisable sur une prochaine facture.
        </p>
      )}
      {!sessionLoading && !sessionOpen ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Caisse fermée : ouvrez votre caisse (menu « Session de caisse ») avant d&apos;encaisser.
        </p>
      ) : (
        <p className="text-xs text-slate-400">
          Encaissement au guichet : paiement validé immédiatement et reçu généré. Pour un paiement
          en ligne, le parent passe par le portail Djomy depuis son espace.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="submit" loading={loading} disabled={!sessionLoading && !sessionOpen}>Encaisser {formatGNF(amount)}</Button>
      </div>
    </form>
  );
}
