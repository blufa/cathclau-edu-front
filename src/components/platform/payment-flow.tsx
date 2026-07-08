"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Stack, Text } from "@mantine/core";
import { useSubscription } from "@/providers/subscription-provider";
import { confirmPaymentViaDjomy, getMyInvoices, initiatePayment } from "@/lib/api/platform";
import { ApiError } from "@/lib/api/errors";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PaymentStatusBadge } from "@/components/platform/status-badge";
import { formatGNF } from "@/lib/format";
import { type PaymentStatus, type SubscriptionInvoice } from "@/lib/types/platform";

const TERMINAL: PaymentStatus[] = ["SUCCESSFUL", "FAILED", "REFUNDED"];
const POLL_MS = 3000;
const MAX_POLLS = 20;
// Fixed payer number used for all Djomy initiations (the portal collects the real payer).
const PAYER_NUMBER = "614324299";

export function PaymentFlow() {
  const params = useSearchParams();
  const invoiceId = Number(params.get("invoiceId"));
  const { refresh } = useSubscription();

  const [invoice, setInvoice] = useState<SubscriptionInvoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef(0);

  // Load the target invoice.
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoadingInvoice(true);
      try {
        const list = await getMyInvoices();
        if (active) setInvoice(list.find((i) => i.id === invoiceId) ?? null);
      } catch {
        if (active) setInvoice(null);
      } finally {
        if (active) setLoadingInvoice(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [invoiceId]);

  // Poll Djomy's live status and auto-activate the subscription as soon as the payment is SUCCESS
  // (same effect as the webhook, which isn't reachable locally). confirmPaymentViaDjomy is a no-op
  // server-side until Djomy reports success, then it confirms the payment and activates the plan.
  useEffect(() => {
    if (!paymentId || (status && TERMINAL.includes(status))) return;
    const t = setInterval(async () => {
      pollRef.current += 1;
      try {
        const p = await confirmPaymentViaDjomy(paymentId);
        setStatus(p.status);
        if (TERMINAL.includes(p.status)) {
          clearInterval(t);
          if (p.status === "SUCCESSFUL") refresh();
        }
      } catch {
        /* keep polling */
      }
      if (pollRef.current >= MAX_POLLS) {
        clearInterval(t);
        setTimedOut(true);
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [paymentId, status, refresh]);

  async function pay() {
    if (!invoice) return;
    setError(null);
    setSubmitting(true);
    try {
      const payment = await initiatePayment(invoice.subscriptionId, {
        invoiceId: invoice.id,
        amount: invoice.remainingBalance,
        channel: "DJOMY",
        paymentType: "FULL",
        payerNumber: PAYER_NUMBER,
      });
      setPaymentId(payment.id);
      setStatus(payment.status);
      if (payment.redirectUrl) {
        setRedirectUrl(payment.redirectUrl);
        window.location.href = payment.redirectUrl;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Échec de l'initiation du paiement.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInvoice) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }
  if (!invoice) {
    return (
      <Alert color="red" variant="light">
        Facture introuvable. <Link href="/subscription/invoices" className="underline">Retour aux factures</Link>
      </Alert>
    );
  }

  // ── Status screen (after initiation) ──
  if (paymentId) {
    const done = status && TERMINAL.includes(status);
    return (
      <Card>
        <CardHeader><CardTitle>Statut du paiement</CardTitle></CardHeader>
        <CardBody>
          <Stack align="center" gap="md" py="md">
            {!done && !timedOut && (
              <>
                <Spinner />
                <Text c="dimmed">En attente de confirmation du paiement…</Text>
                {status && <PaymentStatusBadge status={status} />}
                {redirectUrl && (
                  <Button component="a" href={redirectUrl} target="_blank">Ouvrir la page de paiement</Button>
                )}
              </>
            )}

            {status === "SUCCESSFUL" && (
              <>
                <div className="text-4xl">✅</div>
                <Text fw={600}>Paiement réussi</Text>
                <Text c="dimmed" size="sm">Votre abonnement a été mis à jour.</Text>
                <Button component={Link} href="/dashboard">Retour au tableau de bord</Button>
              </>
            )}

            {status === "FAILED" && (
              <>
                <div className="text-4xl">❌</div>
                <Text fw={600}>Paiement échoué</Text>
                <Button variant="secondary" onClick={() => { setPaymentId(null); setStatus(null); pollRef.current = 0; setTimedOut(false); }}>
                  Réessayer
                </Button>
              </>
            )}

            {timedOut && !done && (
              <Alert color="yellow" variant="light">
                Le paiement est toujours en attente. Vous pouvez fermer cette page : l&apos;abonnement sera
                activé automatiquement dès que le paiement Djomy est confirmé.
              </Alert>
            )}
          </Stack>
        </CardBody>
      </Card>
    );
  }

  // ── Checkout screen ──
  return (
    <Card>
      <CardHeader><CardTitle>Paiement de la facture {invoice.reference}</CardTitle></CardHeader>
      <CardBody>
        <Stack gap="lg">
          <div className="rounded-lg bg-gray-50 p-4 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Facture</span><span className="font-mono">{invoice.reference}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Montant à payer</span><span className="font-semibold">{formatGNF(invoice.remainingBalance)}</span></div>
          </div>

          {error && <Alert color="red" variant="light">{error}</Alert>}

          <Text size="sm" c="dimmed">Paiement via Djomy (mobile money / carte). Vous serez redirigé vers le portail sécurisé.</Text>

          <Button onClick={pay} loading={submitting} fullWidth>
            Payer {formatGNF(invoice.remainingBalance)}
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            Le succès du paiement est confirmé par le fournisseur. Ne fermez pas la page pendant le traitement.
          </Text>
        </Stack>
      </CardBody>
    </Card>
  );
}
