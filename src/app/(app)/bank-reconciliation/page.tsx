"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Landmark, Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { listAccounts } from "@/lib/api/accounting";
import {
  addReconciliationItem,
  completeReconciliation,
  createReconciliation,
  deleteReconciliation,
  deleteReconciliationItem,
  getReconciliationItems,
  getReconciliationSummary,
  listReconciliations,
  reopenReconciliation,
} from "@/lib/api/banking";
import {
  RECON_ITEM_TYPE_LABEL,
  RECON_STATUS_LABEL,
  type BankReconciliation,
  type ReconciliationItemType,
} from "@/lib/types/banking";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export default function BankReconciliationPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");

  const q = useQuery(listReconciliations, []);
  const accountsQuery = useQuery(listAccounts, []);
  const accountName = useMemo(
    () => new Map((accountsQuery.data ?? []).map((a) => [a.id, a.label])),
    [accountsQuery.data],
  );
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<BankReconciliation | null>(null);

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Landmark className="h-6 w-6 text-brand-600" /> Rapprochement bancaire
          </h1>
          <p className="text-sm text-slate-500">Relevé bancaire vs livre, avec éléments en suspens</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau rapprochement</Button>}
      </Reveal>

      {q.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (q.data ?? []).length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Aucun rapprochement.</p>
      ) : (
        <Card>
          <CardBody>
            <Table>
              <THead><tr><TH>Date relevé</TH><TH>Compte</TH><TH className="text-right">Solde relevé</TH><TH className="text-right">Solde livre</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
              <TBody>
                {(q.data ?? []).map((r) => (
                  <TR key={r.id}>
                    <TD>{r.statementDate}</TD>
                    <TD className="font-medium text-slate-900">{accountName.get(r.treasuryAccountId) ?? `#${r.treasuryAccountId}`}</TD>
                    <TD className="text-right">{formatGNF(r.statementBalance)}</TD>
                    <TD className="text-right">{formatGNF(r.bookBalance)}</TD>
                    <TD><Badge tone={r.status === "COMPLETED" ? "green" : "amber"}>{RECON_STATUS_LABEL[r.status]}</Badge></TD>
                    <TD className="text-right"><Button size="sm" variant="ghost" onClick={() => setSelected(r)}>Ouvrir</Button></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau rapprochement">
        <ReconciliationForm accounts={(accountsQuery.data ?? []).map((a) => ({ value: String(a.id), label: a.label }))}
          onCancel={() => setCreating(false)} onDone={() => { setCreating(false); notifySuccess("Rapprochement démarré"); q.refetch(); }} />
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Rapprochement — ${selected ? accountName.get(selected.treasuryAccountId) ?? "" : ""}`}>
        {selected && <ReconciliationDetail recon={selected} canWrite={canWrite}
          onChanged={() => q.refetch()} onClosePanel={() => setSelected(null)} />}
      </Modal>
    </div>
  );
}

function ReconciliationDetail({ recon, canWrite, onChanged, onClosePanel }: {
  recon: BankReconciliation; canWrite: boolean; onChanged: () => void; onClosePanel: () => void;
}) {
  const itemsQuery = useQuery(() => getReconciliationItems(recon.id), [recon.id]);
  const summaryQuery = useQuery(() => getReconciliationSummary(recon.id), [recon.id]);
  const [adding, setAdding] = useState(false);
  const editable = canWrite && recon.status !== "COMPLETED";

  function refresh() { itemsQuery.refetch(); summaryQuery.refetch(); }
  function removeItem(id: number) {
    deleteReconciliationItem(id).then(() => { notifySuccess("Supprimé"); refresh(); }).catch(notifyError);
  }
  async function complete() {
    try { await completeReconciliation(recon.id); notifySuccess("Rapprochement clôturé"); onChanged(); onClosePanel(); } catch (e) { notifyError(e); }
  }
  async function reopen() {
    try { await reopenReconciliation(recon.id); notifySuccess("Rapprochement rouvert"); onChanged(); onClosePanel(); } catch (e) { notifyError(e); }
  }
  function remove() {
    confirmAction({
      title: "Supprimer", message: "Supprimer ce rapprochement ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteReconciliation(recon.id); notifySuccess("Supprimé"); onChanged(); onClosePanel(); } catch (e) { notifyError(e); } },
    });
  }

  const s = summaryQuery.data;
  return (
    <div className="space-y-4">
      {s && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card><CardBody>
            <p className="text-xs font-semibold uppercase text-slate-500">Solde banque ajusté</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatGNF(s.adjustedBank)}</p>
            <p className="text-xs text-slate-400">Relevé : {formatGNF(s.statementBalance)}</p>
          </CardBody></Card>
          <Card><CardBody>
            <p className="text-xs font-semibold uppercase text-slate-500">Solde livre ajusté</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatGNF(s.adjustedBook)}</p>
            <p className="text-xs text-slate-400">Livre : {formatGNF(s.bookBalance)}</p>
          </CardBody></Card>
          <div className="sm:col-span-2">
            <div className={`rounded-xl px-4 py-3 text-sm ${s.balanced ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {s.balanced ? "✓ Rapproché — écart nul." : `Écart : ${formatGNF(s.difference)} — ajoutez les éléments en suspens.`}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Éléments en suspens</h3>
        {editable && <Button size="sm" variant="ghost" onClick={() => setAdding(true)} leftSection={<Plus className="h-4 w-4" />}>Ajouter</Button>}
      </div>
      {itemsQuery.loading ? <div className="flex justify-center py-4"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Type</TH><TH>Description</TH><TH className="text-right">Montant</TH><TH /></tr></THead>
          <TBody>
            {(itemsQuery.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-4 text-center text-slate-400">Aucun élément.</TD></TR>}
            {(itemsQuery.data ?? []).map((it) => (
              <TR key={it.id}>
                <TD className="text-sm">{RECON_ITEM_TYPE_LABEL[it.itemType]}</TD>
                <TD className="text-sm text-slate-600">{it.description ?? "—"}</TD>
                <TD className="text-right">{formatGNF(it.amount)}</TD>
                <TD className="text-right">{editable && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeItem(it.id)}>Suppr.</Button>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {canWrite && (
        <div className="flex flex-wrap justify-end gap-2">
          {recon.status !== "COMPLETED" && <Button size="sm" onClick={complete} disabled={!s?.balanced}>Clôturer</Button>}
          {recon.status === "COMPLETED" && <Button size="sm" variant="secondary" onClick={reopen}>Rouvrir</Button>}
          <Button size="sm" variant="ghost" className="text-red-600" onClick={remove}>Supprimer</Button>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Élément en suspens">
        <ItemForm reconId={recon.id} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); refresh(); }} />
      </Modal>
    </div>
  );
}

function ReconciliationForm({ accounts, onCancel, onDone }: {
  accounts: { value: string; label: string }[]; onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: { treasuryAccountId: "", statementDate: "", statementBalance: 0 as number | string, notes: "" },
    validate: { treasuryAccountId: (v) => (v ? null : "Compte requis") },
  });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      await createReconciliation({
        treasuryAccountId: Number(values.treasuryAccountId), statementDate: values.statementDate || null,
        statementBalance: Number(values.statementBalance) || 0, notes: values.notes || null,
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <MantineSelect label="Compte de trésorerie" withAsterisk data={accounts} {...form.getInputProps("treasuryAccountId")} />
        <div className="grid grid-cols-2 gap-3">
          <DatePickerInput label="Date du relevé" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("statementDate")} />
          <NumberInput label="Solde du relevé (GNF)" thousandSeparator=" " {...form.getInputProps("statementBalance")} />
        </div>
        <Textarea label="Notes" autosize minRows={1} {...form.getInputProps("notes")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Démarrer</Button>
        </div>
      </Stack>
    </form>
  );
}

function ItemForm({ reconId, onCancel, onDone }: { reconId: number; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: { itemType: "OUTSTANDING_CHEQUE" as ReconciliationItemType, description: "", amount: 0 as number | string },
  });
  async function submit(values: typeof form.values) {
    if (!Number(values.amount)) { notifyError("Montant requis"); return; }
    setLoading(true);
    try {
      await addReconciliationItem(reconId, { itemType: values.itemType, description: values.description || null, amount: Number(values.amount) });
      notifySuccess("Élément ajouté"); onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <MantineSelect label="Type" allowDeselect={false}
          data={(Object.keys(RECON_ITEM_TYPE_LABEL) as ReconciliationItemType[]).map((t) => ({ value: t, label: RECON_ITEM_TYPE_LABEL[t] }))}
          {...form.getInputProps("itemType")} />
        <Textarea label="Description" autosize minRows={1} {...form.getInputProps("description")} />
        <NumberInput label="Montant (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("amount")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Ajouter</Button>
        </div>
      </Stack>
    </form>
  );
}
