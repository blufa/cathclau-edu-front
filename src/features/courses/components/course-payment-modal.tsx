"use client";

import { useEffect, useRef, useState } from "react";
import { confirmSchoolPaymentViaDjomy, initiateSelfServicePayment } from "@/lib/api/payment";
import { genRef } from "@/features/billing/components/pay-invoice-form";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { notifyError } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";
import type { PaymentStatus } from "@/lib/types/payment";
import type { Course, CoursePurchase } from "@/lib/types/courses";

const TERMINAL: PaymentStatus[] = ["SUCCEEDED", "FAILED", "REFUNDED"];
const POLL_MS = 3000;
const MAX_POLLS = 20;
// Numéro générique — le portail Djomy recueille le vrai numéro payeur à l'étape suivante.
const PAYER_NUMBER = "614324299";

/**
 * Paiement d'un achat de cours (§16 B) : réutilise le circuit Djomy déjà en place pour les frais
 * scolaires (paiement en ligne self-service) — la facture du cours est une facture normale du
 * module billing, aucun circuit de paiement dédié n'est créé.
 */
export function CoursePaymentModal({ course, purchase, studentId, onDone }: {
  course: Course; purchase: CoursePurchase; studentId: number; onDone: (paid: boolean) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef(0);

  useEffect(() => {
    if (!paymentId || (status && TERMINAL.includes(status))) return;
    const t = setInterval(async () => {
      pollRef.current += 1;
      try {
        const p = await confirmSchoolPaymentViaDjomy(paymentId);
        setStatus(p.status);
        if (TERMINAL.includes(p.status)) {
          clearInterval(t);
          if (p.status === "SUCCEEDED") onDone(true);
        }
      } catch {
        /* on continue de sonder */
      }
      if (pollRef.current >= MAX_POLLS) {
        clearInterval(t);
        setTimedOut(true);
      }
    }, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, status]);

  async function pay() {
    setSubmitting(true);
    try {
      const res = await initiateSelfServicePayment({
        invoiceId: purchase.invoiceId,
        studentId,
        reference: genRef(`COURS-${course.id}`),
        amount: Number(course.price),
        channel: "DJOMY",
        type: "COMPLETE",
        payerNumber: PAYER_NUMBER,
      });
      setPaymentId(res.payment.id);
      setStatus(res.payment.status);
      if (res.redirectUrl) {
        setRedirectUrl(res.redirectUrl);
        window.location.href = res.redirectUrl;
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (paymentId) {
    const done = status && TERMINAL.includes(status);
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {!done && !timedOut && (
          <>
            <Spinner />
            <p className="text-sm text-gray-500">En attente de confirmation du paiement…</p>
            {redirectUrl && <Button component="a" href={redirectUrl} target="_blank">Ouvrir la page de paiement</Button>}
          </>
        )}
        {status === "SUCCEEDED" && (
          <>
            <div className="text-4xl">✅</div>
            <p className="font-semibold text-gray-900">Paiement réussi</p>
            <p className="text-sm text-gray-500">Le cours « {course.title} » est déverrouillé.</p>
            <Button onClick={() => onDone(true)}>Voir le cours</Button>
          </>
        )}
        {status === "FAILED" && (
          <>
            <div className="text-4xl">❌</div>
            <p className="font-semibold text-gray-900">Paiement échoué</p>
            <Button variant="secondary" onClick={() => { setPaymentId(null); setStatus(null); pollRef.current = 0; setTimedOut(false); }}>
              Réessayer
            </Button>
          </>
        )}
        {timedOut && !done && (
          <div className="rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-800">
            Le paiement est toujours en attente. Le cours se déverrouillera automatiquement dès sa confirmation.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-gray-50 p-4 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Cours</span><span className="font-medium">{course.title}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Montant à payer</span><span className="font-semibold">{formatGNF(course.price)}</span></div>
      </div>
      <p className="text-sm text-gray-500">Paiement via Djomy (mobile money / carte). Vous serez redirigé vers le portail sécurisé.</p>
      <Button onClick={pay} loading={submitting} fullWidth>Payer {formatGNF(course.price)}</Button>
    </div>
  );
}
