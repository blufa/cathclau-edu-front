"use client";

import { useEffect, useRef, useState } from "react";
import { listInvoicesByStudent } from "@/lib/api/billing";
import { confirmSchoolPaymentViaDjomy, initiateGroupPayment } from "@/lib/api/payment";
import { type Invoice } from "@/lib/types/billing";
import { type PaymentChannel } from "@/lib/types/payment";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Label, Field } from "@/components/ui/input";
import { formatGNF } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";

const PAYMENT_CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: "CASH", label: "Espèces (guichet)" },
  { value: "ORANGE_MONEY", label: "Orange Money (guichet)" },
  { value: "BANK_CARD", label: "Virement bancaire (guichet)" },
  { value: "DJOMY", label: "En ligne (Djomy)" },
];

const remainingOf = (inv: Invoice) => Number(inv.remainingBalance ?? inv.totalAmount);
const labelOf = (inv: Invoice) => inv.periodLabel || inv.reference;

type Child = { id: number; name: string };
type ChildInvoices = { child: Child; invoices: Invoice[] };

/**
 * Family checkout: pay the unpaid invoices of several children in one go. Builds a single grouped
 * payment across the selected invoices (any student), settled per-invoice server-side, producing one
 * receipt. Desk channels are immediate; Djomy opens one online transaction for the whole total.
 */
export function MultiChildCollectModal({
  students, tenantId, open, onClose, onCollected,
}: {
  students: Child[];
  tenantId: number;
  open: boolean;
  onClose: () => void;
  onCollected: () => void;
}) {
  const [data, setData] = useState<ChildInvoices[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [channel, setChannel] = useState<PaymentChannel>("CASH");
  const [paying, setPaying] = useState(false);
  const [onlineWaiting, setOnlineWaiting] = useState(false);
  const pollIdRef = useRef<number | null>(null);
  const pollTriesRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const res = await Promise.all(
          students.map(async (child) => ({
            child,
            invoices: (await listInvoicesByStudent(child.id)).filter((i) => i.status !== "PAID"),
          })),
        );
        if (active) setData(res);
      } catch (err) {
        notifyError(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, students]);

  const allInvoices = data.flatMap((d) => d.invoices);
  const selectedInvoices = allInvoices.filter((i) => selected.includes(i.id));
  const total = selectedInvoices.reduce((s, i) => s + remainingOf(i), 0);
  const remainingAfter = allInvoices.filter((i) => !selected.includes(i.id)).reduce((s, i) => s + remainingOf(i), 0);
  const online = channel === "DJOMY";
  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Polling Djomy après redirection : confirme/répartit dès que le paiement est réussi.
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
          onCollected();
          onClose();
        }
      } catch { /* on continue */ }
      if (pollTriesRef.current >= 40) { clearInterval(t); setOnlineWaiting(false); }
    }, 4000);
    return () => clearInterval(t);
  }, [onlineWaiting, onCollected, onClose]);

  async function pay() {
    if (selectedInvoices.length === 0) return;
    setPaying(true);
    try {
      // Libellé de couverture par enfant : « Awa: Octobre, Novembre · Moussa: Inscription ».
      const coverageLabel = data
        .map((d) => {
          const picked = d.invoices.filter((i) => selected.includes(i.id));
          return picked.length ? `${d.child.name}: ${picked.map(labelOf).join(", ")}` : null;
        })
        .filter(Boolean)
        .join(" · ");
      const res = await initiateGroupPayment({
        tenantId,
        studentId: selectedInvoices[0].studentId, // élève représentatif (répartition réelle par facture)
        channel,
        payerNumber: online ? "614324299" : undefined,
        coverageLabel,
        monthsCount: selectedInvoices.length,
        remainingAfter,
        shares: selectedInvoices.map((i) => ({ invoiceId: i.id, amount: remainingOf(i) })),
      });
      if (online) {
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
        onCollected();
        onClose();
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setPaying(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Encaissement famille (plusieurs enfants)">
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : allInvoices.length === 0 ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Aucune facture impayée pour les enfants sélectionnés.
        </p>
      ) : (
        <div className="space-y-4">
          {data.map((d) => d.invoices.length > 0 && (
            <div key={d.child.id} className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">{d.child.name}</p>
              <div className="space-y-1.5">
                {d.invoices.map((inv) => (
                  <label key={inv.id} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <Checkbox
                      checked={selected.includes(inv.id)}
                      onChange={() => toggle(inv.id)}
                      label={<span className="text-sm text-slate-700">{labelOf(inv)}</span>}
                    />
                    <span className="text-sm text-slate-600">{formatGNF(remainingOf(inv))}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-end">
            <Field>
              <Label>Mode de paiement</Label>
              <Select className="sm:w-56" value={channel} onChange={(e) => setChannel(e.target.value as PaymentChannel)}>
                {PAYMENT_CHANNELS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </Select>
            </Field>
            <div className="flex-1" />
            <Button onClick={pay} loading={paying || onlineWaiting} disabled={selectedInvoices.length === 0}>
              {online ? "Payer en ligne" : "Encaisser"} {selectedInvoices.length} · {formatGNF(total)}
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            {onlineWaiting
              ? "Portail Djomy ouvert dans un nouvel onglet — validation automatique dès le paiement confirmé."
              : "Un seul paiement réparti sur les factures choisies de chaque enfant, avec un reçu unique."}
          </p>
        </div>
      )}
    </Modal>
  );
}
