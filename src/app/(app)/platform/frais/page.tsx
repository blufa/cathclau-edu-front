"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { getPlatformFeeAmount, setPlatformFeeAmount } from "@/lib/api/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

export default function PlatformFeePage() {
  return (
    <RequireSuperAdmin>
      <PlatformFeeSettings />
    </RequireSuperAdmin>
  );
}

function PlatformFeeSettings() {
  const { data, loading, refetch } = useQuery(() => getPlatformFeeAmount(), []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Frais d&apos;usage de la plateforme</h1>
        <p className="text-sm text-gray-500">
          Montant ajouté automatiquement à chaque facture de mensualité générée par une école — réservé
          à la plateforme, réglé ensuite par l&apos;école depuis son tableau de bord finance (bouton
          « Verser »).
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Montant actuel</CardTitle></CardHeader>
        <CardBody>
          {loading || !data ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <PlatformFeeForm key={data.amount} currentAmount={data.amount} onSaved={refetch} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function PlatformFeeForm({ currentAmount, onSaved }: { currentAmount: string; onSaved: () => void }) {
  const [amount, setAmount] = useState(currentAmount);
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = amount.trim();
    if (!value || Number(value) < 0) {
      notifyError("Montant invalide.");
      return;
    }
    setSaving(true);
    try {
      await setPlatformFeeAmount(value);
      notifySuccess("Montant du frais plateforme mis à jour");
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-3xl font-semibold text-gray-900">{formatGNF(currentAmount)}</p>
      <div className="max-w-xs">
        <Field>
          <Label>Nouveau montant (par mensualité)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      <p className="text-xs text-gray-400">
        Le changement ne s&apos;applique qu&apos;aux factures générées à partir de maintenant — les
        factures déjà émises gardent le montant qui était actif au moment de leur génération.
      </p>
      <Button onClick={save} loading={saving}>Enregistrer</Button>
    </div>
  );
}
