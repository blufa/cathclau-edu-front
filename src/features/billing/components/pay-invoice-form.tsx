"use client";

import { useState } from "react";
import { initiatePayment } from "@/lib/api/payment";
import { type PaymentChannel } from "@/lib/types/payment";
import { type Invoice } from "@/lib/types/billing";
import { Button } from "@/components/ui/button";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

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
 * through the Djomy portal elsewhere (not offered here). Caps the amount at the remaining balance,
 * so partial payments are supported. Reused by the invoices page and the enrollment fee-collection modal.
 */
export function PayInvoiceForm({ invoice, tenantId, onDone }: { invoice: Invoice; tenantId: number; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const remaining = Number(invoice.remainingBalance ?? invoice.totalAmount);
  const [channel, setChannel] = useState<PaymentChannel>("CASH");
  const [amount, setAmount] = useState(remaining);

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
        <Label>Montant (GNF)</Label>
        <Input type="number" min={0} max={remaining} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </Field>
      <p className="text-xs text-slate-400">
        Encaissement au guichet : paiement validé immédiatement et reçu généré. Pour un paiement
        en ligne, le parent passe par le portail Djomy depuis son espace.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="submit" loading={loading}>Encaisser {formatGNF(amount)}</Button>
      </div>
    </form>
  );
}
