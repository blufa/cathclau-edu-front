"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  getLatestSubscription,
  getSubscriptionInvoices,
  initiatePayment,
} from "@/lib/api/platform";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

// Fixed payer number used for all Djomy initiations (the portal collects the real payer).
const PAYER_NUMBER = "614324299";

/**
 * Shown when the school has a PENDING subscription (chosen at signup) awaiting payment.
 * Initiates the Djomy payment and redirects straight to the portal (no form).
 */
export function PendingSubscriptionBanner() {
  const q = useQuery(() => getLatestSubscription(), []);
  const [paying, setPaying] = useState(false);
  const sub = q.data;

  if (!sub || sub.status !== "PENDING") return null;

  async function pay() {
    if (!sub) return;
    setPaying(true);
    try {
      const invoices = await getSubscriptionInvoices(sub.id);
      const invoice = invoices.find((i) => i.status !== "PAID" && i.status !== "CANCELLED") ?? invoices[0];
      if (!invoice) {
        notifyError(new Error("Aucune facture à payer"));
        return;
      }
      const res = await initiatePayment(sub.id, {
        invoiceId: invoice.id,
        amount: String(invoice.remainingBalance ?? invoice.totalAmount),
        channel: "DJOMY",
        paymentType: "FULL",
        payerNumber: PAYER_NUMBER,
      });
      if (res.redirectUrl) {
        notifySuccess("Ouverture du portail de paiement Djomy…");
        const win = window.open(res.redirectUrl, "_blank", "noopener,noreferrer");
        if (!win) window.location.assign(res.redirectUrl); // fallback if popups blocked
        return;
      }
      notifySuccess("Paiement initié. Suivez son statut dans Abonnement.");
    } catch (err) {
      notifyError(err);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Finalisez votre abonnement</p>
          <p className="text-sm text-amber-800">
            Votre abonnement ({formatGNF(sub.amount)}) est en attente de paiement. Réglez-le pour débloquer votre établissement.
          </p>
        </div>
      </div>
      <Button onClick={pay} loading={paying} className="shrink-0">Payer maintenant</Button>
    </div>
  );
}
