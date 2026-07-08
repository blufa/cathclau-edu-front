"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = funds.find((f) => String(f.id) === selectedId) ?? funds[0] ?? null;
  const [creating, setCreating] = useState(false);

  function removeFund(f: PettyCashFund) {
    confirmAction({
      title: "Supprimer la caisse", message: `Supprimer « ${f.label} » et ses opérations ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteFund(f.id); setSelectedId(null); notifySuccess("Supprimée"); fundsQuery.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Coins className="h-6 w-6 text-brand-600" /> Petite caisse
          </h1>
          <p className="text-sm text-slate-500">Caisse à fonds fixe : bons de sortie et réapprovisionnements</p>
        </div>
        {canManage && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle caisse</Button>}
      </Reveal>

      {fundsQuery.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : funds.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Aucune caisse. Créez-en une pour commencer.</p>
      ) : (
        <>
          {funds.length > 1 && (
            <div className="max-w-md">
              <MantineSelect label="Caisse" data={funds.map((f) => ({ value: String(f.id), label: f.label }))}
                value={String(selected?.id ?? "")} onChange={setSelectedId} />
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
        <Card><CardBody><p className="text-xs font-semibold uppercase text-slate-500">Solde actuel</p>
          <p className={`mt-1 text-xl font-bold ${low ? "text-red-600" : "text-slate-900"}`}>{formatGNF(fund.currentBalance)}</p>
          {low && <Badge tone="red">Réapprovisionnement conseillé</Badge>}</CardBody></Card>
        <Card><CardBody><p className="text-xs font-semibold uppercase text-slate-500">Fonds fixe</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatGNF(fund.floatAmount)}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs font-semibold uppercase text-slate-500">Responsable</p>
          <p className="mt-1 text-sm text-slate-700">{fund.custodian ?? "—"}</p></CardBody></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {canWrite && <Button size="sm" onClick={() => setRecordingType("DISBURSEMENT")} leftSection={<Plus className="h-4 w-4" />}>Bon de sortie</Button>}
        {canWrite && <Button size="sm" variant="secondary" onClick={() => setRecordingType("REPLENISHMENT")}>Réapprovisionner</Button>}
        {canManage && <Button size="sm" variant="ghost" onClick={() => setEditingFund(true)}>Modifier la caisse</Button>}
        {canManage && <Button size="sm" variant="ghost" className="text-red-600" onClick={onDelete}>Supprimer la caisse</Button>}
      </div>

      <Card>
        <CardBody>
          {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
            <Table>
              <THead><tr><TH>Date</TH><TH>Type</TH><TH>Bon</TH><TH>Objet</TH><TH>Bénéficiaire</TH><TH className="text-right">Montant</TH><TH /></tr></THead>
              <TBody>
                {(q.data ?? []).length === 0 && <TR><TD colSpan={7} className="py-6 text-center text-slate-400">Aucune opération.</TD></TR>}
                {(q.data ?? []).map((t) => (
                  <TR key={t.id}>
                    <TD className="whitespace-nowrap text-sm">{t.txDate}</TD>
                    <TD><Badge tone={t.txType === "REPLENISHMENT" ? "green" : "amber"}>{PETTY_CASH_TX_TYPE_LABEL[t.txType]}</Badge></TD>
                    <TD className="text-sm">{t.voucherNumber ?? "—"}</TD>
                    <TD className="max-w-[200px] truncate text-sm text-slate-600" title={t.description ?? ""}>{t.description ?? "—"}{t.category ? <span className="block text-xs text-slate-400">{t.category}</span> : null}</TD>
                    <TD className="text-sm">{t.recipient ?? "—"}</TD>
                    <TD className={`text-right font-medium ${t.txType === "REPLENISHMENT" ? "text-emerald-700" : "text-slate-900"}`}>{t.txType === "REPLENISHMENT" ? "+" : "−"}{formatGNF(t.amount)}</TD>
                    <TD className="text-right">{canManage && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeTx(t.id)}>Suppr.</Button>}</TD>
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
  const form = useForm({
    mode: "controlled",
    initialValues: {
      label: initial?.label ?? "",
      floatAmount: (initial?.floatAmount != null ? Number(initial.floatAmount) : 0) as number | string,
      custodian: initial?.custodian ?? "",
    },
    validate: { label: (v) => (v ? null : "Requis") },
  });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = { label: values.label, floatAmount: Number(values.floatAmount) || 0, custodian: values.custodian || null };
      if (initial) await updateFund(initial.id, payload);
      else await createFund(payload);
      onDone();
    }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Libellé" withAsterisk placeholder="Caisse secrétariat" {...form.getInputProps("label")} />
        <NumberInput label="Fonds fixe (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("floatAmount")} />
        <TextInput label="Responsable" {...form.getInputProps("custodian")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
        </div>
      </Stack>
    </form>
  );
}

function TxForm({ fundId, type, suggested, onCancel, onDone }: {
  fundId: number; type: PettyCashTxType; suggested: number; onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      txDate: "", amount: (suggested || "") as number | string, voucherNumber: "",
      description: "", category: "", recipient: "",
    },
  });
  async function submit(values: typeof form.values) {
    if (!Number(values.amount)) { notifyError("Montant requis"); return; }
    setLoading(true);
    try {
      await recordTransaction(fundId, {
        txDate: values.txDate || null, txType: type, amount: Number(values.amount),
        voucherNumber: values.voucherNumber || null, description: values.description || null,
        category: values.category || null, recipient: values.recipient || null,
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <div className="grid grid-cols-2 gap-3">
          <DatePickerInput label="Date" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("txDate")} />
          <NumberInput label="Montant (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("amount")} />
        </div>
        {type === "DISBURSEMENT" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="N° de bon" {...form.getInputProps("voucherNumber")} />
              <TextInput label="Catégorie" placeholder="Fournitures, transport…" {...form.getInputProps("category")} />
            </div>
            <TextInput label="Bénéficiaire" {...form.getInputProps("recipient")} />
          </>
        )}
        <Textarea label="Objet / description" autosize minRows={2} {...form.getInputProps("description")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Enregistrer</Button>
        </div>
      </Stack>
    </form>
  );
}
