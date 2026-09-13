"use client";

import { useMemo, useState } from "react";
import { Coins, Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import {
  createFund,
  updateFund,
  deleteFund,
  deleteTransaction,
  getFundTransactions,
  listFunds,
  recordTransaction,
} from "@/lib/api/pettycash";
import { PETTY_CASH_TX_TYPE_LABEL, type PettyCashFund, type PettyCashTxType } from "@/lib/types/pettycash";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export default function PettyCashPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY");
  const canManage = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");

  const fundsQuery = useQuery(listFunds, []);
  const funds = useMemo(() => fundsQuery.data ?? [], [fundsQuery.data]);
  const [selectedId, setSelectedId] = useState("");
  const selected = funds.find((f) => String(f.id) === selectedId) ?? funds[0] ?? null;
  const [creating, setCreating] = useState(false);
  const fundOptions: SearchableOption[] = useMemo(
    () => funds.map((f) => ({ value: String(f.id), trigger: f.label, label: f.label, searchText: f.label })),
    [funds],
  );

  function removeFund(f: PettyCashFund) {
    confirmAction({
      title: "Supprimer la caisse", message: `Supprimer « ${f.label} » et ses opérations ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteFund(f.id); setSelectedId(""); notifySuccess("Supprimée"); fundsQuery.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Coins className="h-6 w-6 text-brand-600" /> Petite caisse
          </h1>
          <p className="text-sm text-gray-500">Caisse à fonds fixe : bons de sortie et réapprovisionnements</p>
        </div>
        {canManage && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle caisse</Button>}
      </Reveal>

      {fundsQuery.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : funds.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">Aucune caisse. Créez-en une pour commencer.</p>
      ) : (
        <>
          {funds.length > 1 && (
            <div className="max-w-md">
              <Field>
                <Label>Caisse</Label>
                <SearchableSelect value={String(selected?.id ?? "")} options={fundOptions} onChange={setSelectedId} triggerClassName="w-full justify-between px-3" />
              </Field>
            </div>
          )}
          {selected && (
            <FundDetail key={selected.id} fund={selected} canWrite={canWrite} canManage={canManage}
              onDelete={() => removeFund(selected)} onBalanceChange={() => fundsQuery.refetch()} />
          )}
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle caisse">
        <FundForm onCancel={() => setCreating(false)} onDone={() => { setCreating(false); notifySuccess("Caisse créée"); fundsQuery.refetch(); }} />
      </Modal>
    </div>
  );
}

function FundDetail({ fund, canWrite, canManage, onDelete, onBalanceChange }: {
  fund: PettyCashFund; canWrite: boolean; canManage: boolean; onDelete: () => void; onBalanceChange: () => void;
}) {
  const q = useQuery(() => getFundTransactions(fund.id), [fund.id, fund.currentBalance]);
  const [recordingType, setRecordingType] = useState<PettyCashTxType | null>(null);
  const [editingFund, setEditingFund] = useState(false);

  function refresh() { q.refetch(); onBalanceChange(); }
  function removeTx(id: number) {
    confirmAction({
      title: "Supprimer l'opération", message: "Confirmer ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteTransaction(id); notifySuccess("Supprimée"); refresh(); } catch (e) { notifyError(e); } },
    });
  }

  const low = Number(fund.currentBalance) < Number(fund.floatAmount) * 0.2;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardBody><p className="text-xs font-semibold uppercase text-gray-500">Solde actuel</p>
          <p className={`mt-1 text-xl font-bold ${low ? "text-error-600" : "text-gray-900"}`}>{formatGNF(fund.currentBalance)}</p>
          {low && <Badge tone="red">Réapprovisionnement conseillé</Badge>}</CardBody></Card>
        <Card><CardBody><p className="text-xs font-semibold uppercase text-gray-500">Fonds fixe</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatGNF(fund.floatAmount)}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs font-semibold uppercase text-gray-500">Responsable</p>
          <p className="mt-1 text-sm text-gray-700">{fund.custodian ?? "—"}</p></CardBody></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {canWrite && <Button size="sm" onClick={() => setRecordingType("DISBURSEMENT")} leftSection={<Plus className="h-4 w-4" />}>Bon de sortie</Button>}
        {canWrite && <Button size="sm" variant="secondary" onClick={() => setRecordingType("REPLENISHMENT")}>Réapprovisionner</Button>}
        {canManage && <Button size="sm" variant="ghost" onClick={() => setEditingFund(true)}>Modifier la caisse</Button>}
        {canManage && <Button size="sm" variant="ghost" className="text-error-600" onClick={onDelete}>Supprimer la caisse</Button>}
      </div>

      <Card>
        <CardBody>
          {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
            <Table>
              <THead><tr><TH>Date</TH><TH>Type</TH><TH className="hidden sm:table-cell">Bon</TH><TH>Objet</TH><TH className="hidden sm:table-cell">Bénéficiaire</TH><TH className="text-right">Montant</TH><TH /></tr></THead>
              <TBody>
                {(q.data ?? []).length === 0 && <TR><TD colSpan={100} className="py-6 text-center text-gray-400">Aucune opération.</TD></TR>}
                {(q.data ?? []).map((t) => (
                  <TR key={t.id}>
                    <TD className="whitespace-nowrap text-sm">{t.txDate}</TD>
                    <TD><Badge tone={t.txType === "REPLENISHMENT" ? "green" : "amber"}>{PETTY_CASH_TX_TYPE_LABEL[t.txType]}</Badge></TD>
                    <TD className="hidden text-sm sm:table-cell">{t.voucherNumber ?? "—"}</TD>
                    <TD className="max-w-[200px] truncate text-sm text-gray-600" title={t.description ?? ""}>{t.description ?? "—"}{t.category ? <span className="block text-xs text-gray-400">{t.category}</span> : null}</TD>
                    <TD className="hidden text-sm sm:table-cell">{t.recipient ?? "—"}</TD>
                    <TD className={`text-right font-medium ${t.txType === "REPLENISHMENT" ? "text-success-700" : "text-gray-900"}`}>{t.txType === "REPLENISHMENT" ? "+" : "−"}{formatGNF(t.amount)}</TD>
                    <TD className="text-right">{canManage && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => removeTx(t.id)}>Suppr.</Button>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={recordingType != null} onClose={() => setRecordingType(null)}
        title={recordingType === "REPLENISHMENT" ? "Réapprovisionnement" : "Bon de sortie"}>
        {recordingType && <TxForm fundId={fund.id} type={recordingType}
          suggested={recordingType === "REPLENISHMENT" ? Math.max(0, Number(fund.floatAmount) - Number(fund.currentBalance)) : 0}
          onCancel={() => setRecordingType(null)} onDone={() => { setRecordingType(null); notifySuccess("Opération enregistrée"); refresh(); }} />}
      </Modal>

      <Modal open={editingFund} onClose={() => setEditingFund(false)} title="Modifier la caisse">
        <FundForm initial={fund} onCancel={() => setEditingFund(false)}
          onDone={() => { setEditingFund(false); notifySuccess("Caisse mise à jour"); onBalanceChange(); }} />
      </Modal>
    </div>
  );
}

function FundForm({ initial, onCancel, onDone }: { initial?: PettyCashFund | null; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [floatAmount, setFloatAmount] = useState(initial?.floatAmount != null ? String(Number(initial.floatAmount)) : "0");
  const [custodian, setCustodian] = useState(initial?.custodian ?? "");
  async function submit() {
    if (!label.trim()) { notifyError("Libellé requis"); return; }
    setLoading(true);
    try {
      const payload = { label, floatAmount: Number(floatAmount) || 0, custodian: custodian || null };
      if (initial) await updateFund(initial.id, payload);
      else await createFund(payload);
      onDone();
    }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        <Input placeholder="Caisse secrétariat" value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field><Label>Fonds fixe (GNF)</Label><Input type="number" min={0} value={floatAmount} onChange={(e) => setFloatAmount(e.target.value)} /></Field>
      <Field><Label>Responsable</Label><Input value={custodian} onChange={(e) => setCustodian(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </div>
  );
}

function TxForm({ fundId, type, suggested, onCancel, onDone }: {
  fundId: number; type: PettyCashTxType; suggested: number; onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [txDate, setTxDate] = useState("");
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [voucherNumber, setVoucherNumber] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [recipient, setRecipient] = useState("");
  async function submit() {
    if (!Number(amount)) { notifyError("Montant requis"); return; }
    setLoading(true);
    try {
      await recordTransaction(fundId, {
        txDate: txDate || null, txType: type, amount: Number(amount),
        voucherNumber: voucherNumber || null, description: description || null,
        category: category || null, recipient: recipient || null,
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field><Label>Date</Label><DatePicker value={txDate} clearable onChange={setTxDate} maxDate={new Date()} /></Field>
        <Field><Label>Montant (GNF)</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>
      {type === "DISBURSEMENT" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field><Label>N° de bon</Label><Input value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} /></Field>
            <Field><Label>Catégorie</Label><Input placeholder="Fournitures, transport…" value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
          </div>
          <Field><Label>Bénéficiaire</Label><Input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></Field>
        </>
      )}
      <Field><Label>Objet / description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Enregistrer</Button>
      </div>
    </div>
  );
}
