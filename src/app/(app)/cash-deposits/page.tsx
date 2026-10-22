"use client";

import { useMemo, useState } from "react";
import { Banknote } from "lucide-react";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { listUsers } from "@/lib/api/iam";
import { createCashDeposit, rejectCashDeposit, searchCashDeposits, validateCashDeposit } from "@/lib/api/cash-deposits";
import {
  CASH_DEPOSIT_METHOD_LABEL, CASH_DEPOSIT_STATUS_LABEL,
  type CashDeposit, type CashDepositMethod, type CashDepositStatus,
} from "@/lib/types/cash-deposit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, MoneyInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDateTime, formatGNF } from "@/lib/format";

const METHOD_OPTIONS: CashDepositMethod[] = ["CASH", "ORANGE_MONEY", "BANK_CARD"];

function genIdempotencyKey(): string {
  return `DEPOT-${Date.now().toString(36)}-${Math.floor(Math.random() * 100000)}`;
}

export default function CashDepositsPage() {
  const { user } = useAuth();
  const canCreate = hasAnyPermission(user, ["depot:create"]);
  const canValidate = hasAnyPermission(user, ["depot:valider"]);
  const canRead = hasAnyPermission(user, ["depot:read"]);
  // La direction/le fondateur voit les dépôts de tous les comptables ; un comptable ne voit que les siens.
  const canSeeAll = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const [statusFilter, setStatusFilter] = useState<CashDepositStatus | "">("");
  const [methodFilter, setMethodFilter] = useState<CashDepositMethod | "">("");
  const [creating, setCreating] = useState(false);
  const [rejecting, setRejecting] = useState<CashDeposit | null>(null);

  const listQuery = useCachedQuery(
    canRead ? `cash-deposits:${statusFilter}:${methodFilter}` : null,
    () => searchCashDeposits({
      accountantId: canSeeAll ? undefined : user?.userId,
      status: statusFilter || undefined,
      method: methodFilter || undefined,
    }),
    [canRead, canSeeAll, user?.userId, statusFilter, methodFilter],
  );
  const usersQuery = useCachedQuery(canSeeAll ? "users:first-page" : null, () => listUsers(0, 100), [canSeeAll]);
  const accountantName = useMemo(() => {
    const map = new Map<number, string>();
    (usersQuery.data?.content ?? []).forEach((u) => map.set(u.id, `${u.firstName} ${u.lastName}`));
    return (id: number) => map.get(id) ?? `Comptable #${id}`;
  }, [usersQuery.data]);

  async function decide(d: CashDeposit, action: "validate" | "reject") {
    if (action === "validate") {
      confirmAction({
        title: "Valider ce dépôt",
        message: `Confirmer avoir reçu ${formatGNF(d.amount)} de ${accountantName(d.accountantId)} ?`,
        confirmLabel: "Valider",
        onConfirm: async () => {
          try { await validateCashDeposit(d.id); notifySuccess("Dépôt validé — SMS envoyé au comptable."); listQuery.refetch(); }
          catch (err) { notifyError(err); }
        },
      });
    } else {
      setRejecting(d);
    }
  }

  if (!canRead) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé au personnel comptable et à la direction.</div>;
  }

  const deposits = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
              <Banknote className="h-6 w-6 text-brand-600" /> Dépôts de fonds
            </h1>
            <p className="text-sm text-gray-500">
              Argent remis par le comptable au fondateur — en attente jusqu&apos;à sa validation dans la plateforme.
            </p>
          </div>
          {canCreate && <Button onClick={() => setCreating(true)}>Nouveau dépôt</Button>}
        </div>
      </Reveal>

      <div className="flex flex-wrap gap-3">
        <Field>
          <Label>Statut</Label>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CashDepositStatus | "")}>
            <option value="">Tous</option>
            {Object.entries(CASH_DEPOSIT_STATUS_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Moyen</Label>
          <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as CashDepositMethod | "")}>
            <option value="">Tous</option>
            {METHOD_OPTIONS.map((m) => (<option key={m} value={m}>{CASH_DEPOSIT_METHOD_LABEL[m]}</option>))}
          </Select>
        </Field>
      </div>

      {listQuery.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : deposits.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">Aucun dépôt pour l&apos;instant.</p>
      ) : (
        <Card>
          <CardBody>
            <Table>
              <THead>
                <tr>
                  {canSeeAll && <TH>Comptable</TH>}
                  <TH>Déposé le</TH>
                  <TH>Moyen</TH>
                  <TH className="text-right">Montant</TH>
                  <TH>Référence</TH>
                  <TH>Statut</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {deposits.map((d) => (
                  <TR key={d.id}>
                    {canSeeAll && <TD className="font-medium text-gray-900">{accountantName(d.accountantId)}</TD>}
                    <TD className="text-gray-500">{formatDateTime(d.depositedAt)}</TD>
                    <TD className="text-gray-500">{CASH_DEPOSIT_METHOD_LABEL[d.method as CashDepositMethod] ?? d.method}</TD>
                    <TD className="text-right font-medium text-gray-900">{formatGNF(d.amount)}</TD>
                    <TD className="text-gray-400">{d.transactionReference ?? "—"}</TD>
                    <TD>
                      <Badge tone={d.status === "VALIDATED" ? "green" : d.status === "REJECTED" ? "red" : "amber"}>
                        {CASH_DEPOSIT_STATUS_LABEL[d.status]}
                      </Badge>
                      {d.status === "REJECTED" && d.rejectionReason && (
                        <p className="mt-1 text-xs text-gray-400">{d.rejectionReason}</p>
                      )}
                    </TD>
                    <TD className="text-right">
                      {canValidate && d.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => decide(d, "reject")}>Rejeter</Button>
                          <Button size="sm" onClick={() => decide(d, "validate")}>Valider</Button>
                        </div>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau dépôt">
        <CreateDepositForm onCancel={() => setCreating(false)} onDone={() => { setCreating(false); listQuery.refetch(); }} />
      </Modal>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Rejeter ce dépôt">
        {rejecting && (
          <RejectDepositForm
            deposit={rejecting}
            accountantLabel={accountantName(rejecting.accountantId)}
            onCancel={() => setRejecting(null)}
            onDone={() => { setRejecting(null); listQuery.refetch(); }}
          />
        )}
      </Modal>
    </div>
  );
}

function CreateDepositForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<CashDepositMethod>("CASH");
  const [transactionReference, setTransactionReference] = useState("");
  const [destinationAccount, setDestinationAccount] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  // Générée une seule fois à l'ouverture du formulaire (§5.1) : un double-clic sur "Enregistrer" ou un
  // rechargement de page rejoue la même clé au lieu de créer un second dépôt.
  const [idempotencyKey] = useState(genIdempotencyKey);

  async function submit() {
    if (!amount || amount <= 0) { notifyError("Indiquez un montant valide."); return; }
    setLoading(true);
    try {
      await createCashDeposit({
        amount, method,
        transactionReference: transactionReference || null,
        destinationAccount: destinationAccount || null,
        comment: comment || null,
        idempotencyKey,
      });
      notifySuccess("Dépôt enregistré — en attente de validation, SMS envoyé au fondateur.");
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field>
        <Label>Montant (GNF) <span className="text-error-500">*</span></Label>
        <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
      </Field>
      <Field>
        <Label>Moyen <span className="text-error-500">*</span></Label>
        <Select value={method} onChange={(e) => setMethod(e.target.value as CashDepositMethod)}>
          {METHOD_OPTIONS.map((m) => (<option key={m} value={m}>{CASH_DEPOSIT_METHOD_LABEL[m]}</option>))}
        </Select>
      </Field>
      <Field>
        <Label>Compte / destination (optionnel)</Label>
        <Input value={destinationAccount} onChange={(e) => setDestinationAccount(e.target.value)}
          placeholder="Ex. numéro Orange Money ou IBAN du fondateur" />
      </Field>
      <Field>
        <Label>Référence de transaction (optionnel)</Label>
        <Input value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} />
      </Field>
      <Field>
        <Label>Commentaire (optionnel)</Label>
        <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <p className="text-xs text-gray-400">
        Ce dépôt reste <strong>en attente</strong> tant que le fondateur ne l&apos;a pas validé dans la
        plateforme — un SMS lui est envoyé immédiatement.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Enregistrer</Button>
      </div>
    </div>
  );
}

function RejectDepositForm({ deposit, accountantLabel, onCancel, onDone }: {
  deposit: CashDeposit; accountantLabel: string; onCancel: () => void; onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!reason.trim()) { notifyError("Indiquez le motif du rejet."); return; }
    setLoading(true);
    try {
      await rejectCashDeposit(deposit.id, reason.trim());
      notifySuccess("Dépôt rejeté — SMS envoyé au comptable.");
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Dépôt de {formatGNF(deposit.amount)} ({accountantLabel}) — ce rejet sera notifié par SMS.
      </p>
      <Field>
        <Label>Motif <span className="text-error-500">*</span></Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Ex. montant incorrect, référence introuvable…" autoFocus />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" variant="danger" onClick={submit} loading={loading}>Rejeter</Button>
      </div>
    </div>
  );
}
