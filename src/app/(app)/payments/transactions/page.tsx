"use client";

import { useMemo, useState } from "react";
import { Tabs, Title, Select as MantineSelect } from "@mantine/core";
import { Landmark, Receipt as ReceiptIcon, Search, FileText } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  getReceiptByReference,
  getReceiptPdfObjectUrlById,
  listReceipts,
  listTransactions,
} from "@/lib/api/payment";
import { searchStudents } from "@/lib/api/students";
import type { PaymentProvider, PaymentTransaction, Receipt } from "@/lib/types/payment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { FilePreview } from "@/components/ui/file-preview";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { notifyError } from "@/lib/feedback";
import { formatGNF, formatDateTime } from "@/lib/format";

const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN MoMo",
  WAVE: "Wave",
  STRIPE: "Stripe",
  DJOMY: "Djomy",
};

export default function PaymentTransactionsPage() {
  const { user } = useAuth();
  const canView = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");

  if (!canView) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé à la comptabilité et à la direction.</div>;
  }

  return (
    <div className="space-y-5">
      <Reveal y={12}>
        <Title order={2}>Transactions & reçus</Title>
        <p className="text-sm text-gray-500">Traçabilité des appels fournisseurs (mobile money, cartes) et reçus émis</p>
      </Reveal>

      <Tabs defaultValue="transactions" color="brand" variant="pills" radius="md" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="transactions" leftSection={<Landmark className="h-4 w-4" />}>Transactions fournisseur</Tabs.Tab>
          <Tabs.Tab value="receipts" leftSection={<ReceiptIcon className="h-4 w-4" />}>Reçus</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="transactions"><TransactionsTab /></Tabs.Panel>
        <Tabs.Panel value="receipts"><ReceiptsTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ── Transactions fournisseur ──────────────────────────────────────────────────
function TransactionsTab() {
  const [provider, setProvider] = useState<PaymentProvider | "">("");
  const q = useQuery(
    () => listTransactions({ provider: provider || undefined }),
    [provider],
  );
  const [detail, setDetail] = useState<PaymentTransaction | null>(null);

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Moyen de paiement</label>
          <Select className="max-w-[220px]" value={provider} onChange={(e) => setProvider(e.target.value as PaymentProvider | "")}>
            <option value="">Tous les moyens</option>
            {(Object.keys(PROVIDER_LABEL) as PaymentProvider[]).map((p) => (<option key={p} value={p}>{PROVIDER_LABEL[p]}</option>))}
          </Select>
        </div>
        <p className="pb-1 text-xs text-slate-400">Historique technique des encaissements par opérateur — utile pour le rapprochement comptable.</p>
      </div>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <Table>
            <THead>
              <TR><TH>ID</TH><TH>Paiement</TH><TH>Fournisseur</TH><TH>Réf. externe</TH><TH>Statut</TH><TH>Date</TH><TH className="text-right">Actions</TH></TR>
            </THead>
            <TBody>
              {rows.length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-slate-400">Aucune transaction.</TD></TR>}
              {rows.map((t) => (
                <TR key={t.id}>
                  <TD className="text-slate-500">#{t.id}</TD>
                  <TD className="font-mono text-xs text-slate-600">#{t.paymentId}</TD>
                  <TD><Badge tone="indigo">{PROVIDER_LABEL[t.provider] ?? t.provider}</Badge></TD>
                  <TD className="font-mono text-xs text-slate-600">{t.externalTransactionId ?? "—"}</TD>
                  <TD className="text-sm text-slate-700">{t.providerStatus ?? "—"}</TD>
                  <TD className="text-sm text-slate-500">{formatDateTime(t.createdAt)}</TD>
                  <TD className="text-right">
                    <div className="inline-flex gap-1">
                      {t.redirectUrl && (
                        <a href={t.redirectUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:underline">Portail</a>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDetail(t)}>Détails</Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Modal open={detail != null} onClose={() => setDetail(null)} title={`Transaction #${detail?.id ?? ""}`}>
        {detail && (
          <div className="space-y-3 text-sm">
            <Field label="Fournisseur" value={PROVIDER_LABEL[detail.provider] ?? detail.provider} />
            <Field label="Paiement" value={`#${detail.paymentId}`} />
            <Field label="Réf. externe" value={detail.externalTransactionId ?? "—"} />
            <Field label="Statut fournisseur" value={detail.providerStatus ?? "—"} />
            <Field label="Date" value={formatDateTime(detail.createdAt)} />
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Réponse brute du fournisseur</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{prettyJson(detail.responsePayload)}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Reçus ─────────────────────────────────────────────────────────────────────
function ReceiptsTab() {
  const [studentId, setStudentId] = useState<number | undefined>(undefined);
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }), []);
  const students = useMemo(() => studentsQuery.data?.content ?? [], [studentsQuery.data]);
  const q = useQuery(() => listReceipts(studentId), [studentId]);

  const [reference, setReference] = useState("");
  const [found, setFound] = useState<Receipt | null>(null);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  async function openPdf(r: Receipt) {
    setOpeningId(r.id);
    try { setPreview({ url: await getReceiptPdfObjectUrlById(r.id), title: `Reçu ${r.reference}` }); }
    catch (err) { notifyError(err); } finally { setOpeningId(null); }
  }

  async function lookup() {
    if (!reference.trim()) return;
    setSearching(true);
    try { setFound(await getReceiptByReference(reference.trim())); }
    catch (err) { setFound(null); notifyError(err); } finally { setSearching(false); }
  }

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <label className="mb-1 block text-xs text-slate-500">Filtrer par élève</label>
          <MantineSelect
            placeholder="Tous les élèves" clearable searchable
            data={students.map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName}` }))}
            value={studentId ? String(studentId) : null}
            onChange={(v) => setStudentId(v ? Number(v) : undefined)}
            nothingFoundMessage="Aucun élève"
          />
        </div>
        <div className="ml-auto">
          <label className="mb-1 block text-xs text-slate-500">Retrouver un reçu par son numéro</label>
          <div className="flex gap-2">
            <Input className="max-w-[200px]" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Numéro du reçu" />
            <Button onClick={lookup} loading={searching}><Search className="mr-1 h-4 w-4" /> Chercher</Button>
          </div>
        </div>
      </div>

      {found && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-slate-700">
            <FileText className="h-4 w-4 text-brand-600" />
            Reçu <span className="font-mono">{found.reference}</span> — {formatGNF(found.amount)}
          </span>
          <Button size="sm" variant="ghost" loading={openingId === found.id} onClick={() => openPdf(found)}>Ouvrir PDF</Button>
        </div>
      )}

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <Table>
            <THead>
              <TR><TH>Numéro du reçu</TH><TH>Montant</TH><TH>Émis le</TH><TH className="text-right">Actions</TH></TR>
            </THead>
            <TBody>
              {rows.length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-slate-400">Aucun reçu.</TD></TR>}
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs text-slate-600">{r.reference}</TD>
                  <TD className="font-medium text-slate-900">{formatGNF(r.amount)}</TD>
                  <TD className="text-sm text-slate-500">{formatDateTime(r.generatedAt)}</TD>
                  <TD className="text-right">
                    <Button size="sm" variant="ghost" loading={openingId === r.id} onClick={() => openPdf(r)}>Ouvrir PDF</Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  );
}

/** Pretty-prints a provider payload if it is JSON, otherwise returns the raw string. */
function prettyJson(raw: string | null): string {
  if (!raw) return "—";
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}
