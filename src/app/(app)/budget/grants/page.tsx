"use client";

import { useState } from "react";
import { HandCoins, Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import {
  addGrantPayment,
  cancelGrant,
  createGrant,
  updateGrant,
  deleteGrant,
  deleteGrantPayment,
  getGrantPayments,
  listGrants,
} from "@/lib/api/grants";
import { GRANT_STATUS_LABEL, type Grant, type GrantStatus } from "@/lib/types/grants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, MoneyInput, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<GrantStatus, "amber" | "blue" | "green" | "gray"> = {
  EXPECTED: "amber", PARTIAL: "blue", RECEIVED: "green", CANCELLED: "gray",
};

export default function GrantsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");

  const q = useQuery(listGrants, []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Grant | null>(null);
  const [paymentsFor, setPaymentsFor] = useState<Grant | null>(null);

  function cancel(g: Grant) {
    confirmAction({
      title: "Annuler la subvention", message: `Annuler « ${g.source} » ?`, confirmLabel: "Annuler la subvention", danger: true,
      onConfirm: async () => { try { await cancelGrant(g.id); notifySuccess("Subvention annulée"); q.refetch(); } catch (e) { notifyError(e); } },
    });
  }
  function remove(g: Grant) {
    confirmAction({
      title: "Supprimer la subvention", message: `Supprimer « ${g.source} » et ses versements ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteGrant(g.id); notifySuccess("Supprimée"); q.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <HandCoins className="h-6 w-6 text-brand-600" /> Subventions
          </h1>
          <p className="text-sm text-gray-500">Recettes hors frais parents (État, ONG, donateurs) et versements reçus</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle subvention</Button>}
      </Reveal>

      {q.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (q.data ?? []).length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">Aucune subvention enregistrée.</p>
      ) : (
        <Card>
          <CardBody>
            <Table>
              <THead><tr><TH>Source</TH><TH>Objet</TH><TH>Année</TH><TH className="text-right">Total</TH><TH className="text-right">Reçu</TH><TH className="text-right">Reste</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
              <TBody>
                {(q.data ?? []).map((g) => {
                  const remaining = Number(g.totalAmount) - Number(g.receivedAmount);
                  return (
                    <TR key={g.id}>
                      <TD className="font-medium text-gray-900">{g.source}{g.reference ? <span className="block text-xs text-gray-400">{g.reference}</span> : null}</TD>
                      <TD className="max-w-[200px] truncate text-sm text-gray-600" title={g.purpose ?? ""}>{g.purpose ?? "—"}</TD>
                      <TD className="text-sm">{g.academicYear ?? "—"}</TD>
                      <TD className="text-right">{formatGNF(g.totalAmount)}</TD>
                      <TD className="text-right text-success-700">{formatGNF(g.receivedAmount)}</TD>
                      <TD className="text-right">{formatGNF(String(remaining))}</TD>
                      <TD><Badge tone={STATUS_TONE[g.status]}>{GRANT_STATUS_LABEL[g.status]}</Badge></TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setPaymentsFor(g)}>Versements</Button>
                          {canWrite && g.status !== "CANCELLED" && <Button size="sm" variant="ghost" onClick={() => setEditing(g)}>Modifier</Button>}
                          {canWrite && g.status !== "CANCELLED" && g.status !== "RECEIVED" && <Button size="sm" variant="ghost" onClick={() => cancel(g)}>Annuler</Button>}
                          {canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(g)}>Suppr.</Button>}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier la subvention" : "Nouvelle subvention"}>
        <GrantForm initial={editing} onCancel={() => { setCreating(false); setEditing(null); }}
          onDone={() => { setCreating(false); setEditing(null); notifySuccess(editing ? "Subvention mise à jour" : "Subvention créée"); q.refetch(); }} />
      </Modal>

      <Modal open={!!paymentsFor} onClose={() => setPaymentsFor(null)} title={`Versements — ${paymentsFor?.source ?? ""}`}>
        {paymentsFor && <PaymentsPanel grant={paymentsFor} canWrite={canWrite} onChanged={() => q.refetch()} />}
      </Modal>
    </div>
  );
}

function PaymentsPanel({ grant, canWrite, onChanged }: { grant: Grant; canWrite: boolean; onChanged: () => void }) {
  const q = useQuery(() => getGrantPayments(grant.id), [grant.id]);
  const [adding, setAdding] = useState(false);

  function removePayment(id: number) {
    confirmAction({
      title: "Supprimer le versement", message: "Confirmer ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteGrantPayment(id); notifySuccess("Supprimé"); q.refetch(); onChanged(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Total : <strong>{formatGNF(grant.totalAmount)}</strong> · Reçu : <strong className="text-success-700">{formatGNF(grant.receivedAmount)}</strong></p>
      {canWrite && !adding && <Button size="sm" onClick={() => setAdding(true)} leftSection={<Plus className="h-4 w-4" />}>Enregistrer un versement</Button>}
      {adding && <PaymentForm grantId={grant.id} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); notifySuccess("Versement enregistré"); q.refetch(); onChanged(); }} />}
      {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Date</TH><TH className="text-right">Montant</TH><TH>Mode</TH><TH>Réf.</TH><TH /></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-4 text-center text-gray-400">Aucun versement.</TD></TR>}
            {(q.data ?? []).map((p) => (
              <TR key={p.id}>
                <TD>{p.paymentDate}</TD>
                <TD className="text-right font-medium">{formatGNF(p.amount)}</TD>
                <TD className="text-sm">{p.method ?? "—"}</TD>
                <TD className="text-sm">{p.reference ?? "—"}</TD>
                <TD className="text-right">{canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => removePayment(p.id)}>Suppr.</Button>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function GrantForm({ initial, onCancel, onDone }: { initial?: Grant | null; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(initial?.source ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [academicYear, setAcademicYear] = useState(initial?.academicYear ?? "");
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount ? String(Number(initial.totalAmount)) : "0");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  async function submit() {
    if (!source.trim()) { notifyError("Source requise"); return; }
    setLoading(true);
    try {
      const payload = {
        source, reference: reference || null, purpose: purpose || null,
        academicYear: academicYear || null, totalAmount: Number(totalAmount) || 0, notes: notes || null,
      };
      if (initial) await updateGrant(initial.id, payload);
      else await createGrant(payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <Field>
        <Label>Source (bailleur) <span className="text-error-500">*</span></Label>
        <Input placeholder="Ministère de l'Éducation, ONG…" value={source} onChange={(e) => setSource(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field><Label>Référence</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field><Label>Année scolaire</Label><Input placeholder="2025-2026" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} /></Field>
      </div>
      <Field><Label>Objet</Label><Input placeholder="Cantine, équipement…" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
      <Field><Label>Montant total attendu</Label><MoneyInput value={totalAmount} onValueChange={(n) => setTotalAmount(String(n))} /></Field>
      <Field><Label>Notes</Label><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </div>
  );
}

function PaymentForm({ grantId, onCancel, onDone }: { grantId: number; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  async function submit() {
    if (!Number(amount)) { notifyError("Montant requis"); return; }
    setLoading(true);
    try {
      await addGrantPayment(grantId, {
        paymentDate: paymentDate || null, amount: Number(amount),
        method: method || null, reference: reference || null, notes: null,
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field><Label>Date</Label><DatePicker value={paymentDate} clearable onChange={setPaymentDate} /></Field>
        <Field><Label>Montant</Label><MoneyInput value={amount} onValueChange={(n) => setAmount(String(n))} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field><Label>Mode</Label><Input placeholder="Virement, chèque…" value={method} onChange={(e) => setMethod(e.target.value)} /></Field>
        <Field><Label>Référence</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Enregistrer</Button>
      </div>
    </div>
  );
}
