"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import {
  confirmPlatformFeeSettlementViaDjomy,
  getPlatformFeeBalance,
  initiatePlatformFeeSettlement,
} from "@/lib/api/platform";
import { ApiError } from "@/lib/api/errors";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Label } from "@/components/ui/input";
import { formatGNF } from "@/lib/format";
import { notifySuccess } from "@/lib/feedback";

/**
 * Solde des frais plateforme dû par l'école courante (accumulé au fil des encaissements de
 * mensualités) et son règlement via Djomy — carte du dashboard finance de l'école.
 */
export function PlatformFeeSettlementCard() {
  const { data, loading, refetch } = useQuery(() => getPlatformFeeBalance(), []);
  const [open, setOpen] = useState(false);

  const balance = Number(data?.balance ?? 0);

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Frais plateforme</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">Solde dû à la plateforme</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? "…" : formatGNF(data?.balance ?? "0")}
              </p>
            </div>
            <Button onClick={() => setOpen(true)} disabled={loading || balance <= 0}>Verser</Button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Part des frais d&apos;usage de la plateforme ajoutée à vos factures de mensualité et déjà
            encaissée auprès des parents.
          </p>
          {!loading && balance <= 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Le bouton s&apos;active dès qu&apos;un parent a réellement <strong>payé</strong> une
              facture de mensualité incluant ce frais — le générer/émettre la facture ne suffit pas
              tant qu&apos;elle n&apos;est pas encaissée.
            </p>
          )}
        </CardBody>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Verser le solde à la plateforme">
        <PlatformFeeSettlementForm
          balance={data?.balance ?? "0"}
          onDone={() => { setOpen(false); refetch(); }}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function PlatformFeeSettlementForm({ balance, onDone, onCancel }: {
  balance: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [payerNumber, setPayerNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!payerNumber.trim()) {
      setError("Numéro requis.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const settlement = await initiatePlatformFeeSettlement(payerNumber.trim());
      if (settlement.redirectUrl) {
        // Confirmation au retour du portail Djomy (comme le paiement d'abonnement) : on tente une
        // première vérification tout de suite, puis l'école peut rouvrir cette page plus tard.
        void confirmPlatformFeeSettlementViaDjomy(settlement.id).catch(() => {});
        window.location.href = settlement.redirectUrl;
        return;
      }
      notifySuccess("Règlement initié");
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Échec de l'initiation du règlement.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-gray-50 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Montant à verser</span>
          <span className="font-semibold">{formatGNF(balance)}</span>
        </div>
      </div>
      {error && <div className="rounded-lg bg-error-50 px-3.5 py-2.5 text-sm text-error-700">{error}</div>}
      <Field>
        <Label>Numéro Mobile Money (payeur)</Label>
        <Input value={payerNumber} onChange={(e) => setPayerNumber(e.target.value)} placeholder="620 00 00 00" />
      </Field>
      <p className="text-xs text-gray-400">
        Paiement via Djomy — vous serez redirigé vers le portail sécurisé pour finaliser le versement.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button onClick={submit} loading={submitting}>Verser {formatGNF(balance)}</Button>
      </div>
    </div>
  );
}
