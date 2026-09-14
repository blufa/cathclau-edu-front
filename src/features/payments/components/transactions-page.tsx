"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, Receipt as ReceiptIcon, Search, FileText } from "lucide-react";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getReceiptPdfObjectUrlById } from "@/lib/api/payment";
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
import { useTransactionsQuery } from "../hooks/use-transactions";
import { useReceiptByReferenceQuery, useReceiptsQuery } from "../hooks/use-receipts";

const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN MoMo",
  WAVE: "Wave",
  STRIPE: "Stripe",
  DJOMY: "Djomy",
};

export default function PaymentTransactionsPage() {
  const { user } = useAuth();
  const canView = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT") || hasAnyPermission(user, ["transaction:read"]);

  if (!canView) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé à la comptabilité et à la direction.</div>;
  }

  return (
    <div className="space-y-5">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Transactions & reçus</h1>
        <p className="text-sm text-gray-500">Traçabilité des appels fournisseurs (mobile money, cartes) et reçus émis</p>
      </Reveal>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions" icon={Landmark}>Transactions fournisseur</TabsTrigger>
          <TabsTrigger value="receipts" icon={ReceiptIcon}>Reçus</TabsTrigger>
        </TabsList>
        <TabsPanel value="transactions"><TransactionsTab /></TabsPanel>
        <TabsPanel value="receipts"><ReceiptsTab /></TabsPanel>
      </Tabs>
    </div>
  );
}

// ── Transactions fournisseur ──────────────────────────────────────────────────
function TransactionsTab() {
  const [provider, setProvider] = useState<PaymentProvider | "">("");
  const q = useTransactionsQuery(provider);
  const [detail, setDetail] = useState<PaymentTransaction | null>(null);

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Moyen de paiement</label>
          <Select className="max-w-[220px]" value={provider} onChange={(e) => setProvider(e.target.value as PaymentProvider | "")}>
            <option value="">Tous les moyens</option>
            {(Object.keys(PROVIDER_LABEL) as PaymentProvider[]).map((p) => (<option key={p} value={p}>{PROVIDER_LABEL[p]}</option>))}
          </Select>
        </div>
        <p className="pb-1 text-xs text-gray-400">Historique technique des encaissements par opérateur — utile pour le rapprochement comptable.</p>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <Table>
            <THead>
              <TR><TH>ID</TH><TH>Paiement</TH><TH>Fournisseur</TH><TH>Réf. externe</TH><TH>Statut</TH><TH>Date</TH><TH className="text-right">Actions</TH></TR>
            </THead>
            <TBody>
              {rows.length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-gray-400">Aucune transaction.</TD></TR>}
              {rows.map((t) => (
                <TR key={t.id}>
                  <TD className="text-gray-500">#{t.id}</TD>
                  <TD className="font-mono text-xs text-gray-600">#{t.paymentId}</TD>
                  <TD><Badge tone="indigo">{PROVIDER_LABEL[t.provider] ?? t.provider}</Badge></TD>
                  <TD className="font-mono text-xs text-gray-600">{t.externalTransactionId ?? "—"}</TD>
                  <TD className="text-sm text-gray-700">{t.providerStatus ?? "—"}</TD>
                  <TD className="text-sm text-gray-500">{formatDateTime(t.createdAt)}</TD>
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
              <p className="mb-1 text-xs font-medium text-gray-500">Réponse brute du fournisseur</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{prettyJson(detail.responsePayload)}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Reçus ─────────────────────────────────────────────────────────────────────
function ReceiptsTab() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const [studentId, setStudentId] = useState<number | undefined>(undefined);
  const studentsQuery = useCachedQuery(tenantId ? `students-all:${tenantId}` : null, () => searchStudents({ size: 1000 }), [tenantId]);
  const students = useMemo(() => studentsQuery.data?.content ?? [], [studentsQuery.data]);
  const q = useReceiptsQuery(studentId);

  const [reference, setReference] = useState("");
  const [debouncedReference, setDebouncedReference] = useState("");
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  // Recherche dynamique du reçu par numéro : suit la frappe (debounce 350 ms), sans bouton ni
  // erreurs pendant la saisie (on efface simplement le résultat tant qu'aucun reçu ne correspond).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedReference(reference), 350);
    return () => clearTimeout(t);
  }, [reference]);
  const foundQuery = useReceiptByReferenceQuery(debouncedReference);
  const found = foundQuery.data ?? null;
  const searching = foundQuery.isFetching;

  async function openPdf(r: Receipt) {
    setOpeningId(r.id);
    try { setPreview({ url: await getReceiptPdfObjectUrlById(r.id), title: `Reçu ${r.reference}` }); }
    catch (err) { notifyError(err); } finally { setOpeningId(null); }
  }

  const rows = q.data ?? [];

  const studentOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", trigger: "Tous les élèves", label: "Tous les élèves", searchText: "tous" },
      ...students.map((s) => ({
        value: String(s.id),
        trigger: `${s.firstName} ${s.lastName}`,
        label: `${s.firstName} ${s.lastName}`,
        searchText: `${s.firstName} ${s.lastName}`,
      })),
    ],
    [students],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <label className="mb-1 block text-xs text-gray-500">Filtrer par élève</label>
          <SearchableSelect
            value={studentId ? String(studentId) : ""}
            options={studentOptions}
            onChange={(v) => setStudentId(v ? Number(v) : undefined)}
            triggerClassName="w-full justify-between px-3"
            noResultsLabel="Aucun élève"
          />
        </div>
        <div className="ml-auto">
          <label className="mb-1 block text-xs text-gray-500">Retrouver un reçu par son numéro</label>
          <div className="relative flex items-center">
            <Search className={`pointer-events-none absolute left-2.5 h-4 w-4 ${searching ? "animate-pulse text-brand-500" : "text-gray-400"}`} />
            <Input className="max-w-[220px] pl-8" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Numéro du reçu" />
          </div>
        </div>
      </div>

      {found && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-gray-700">
            <FileText className="h-4 w-4 text-brand-600" />
            Reçu <span className="font-mono">{found.reference}</span> — {formatGNF(found.amount)}
          </span>
          <Button size="sm" variant="ghost" loading={openingId === found.id} onClick={() => openPdf(found)}>Ouvrir PDF</Button>
        </div>
      )}

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <Table>
            <THead>
              <TR><TH>Numéro du reçu</TH><TH>Montant</TH><TH>Émis le</TH><TH className="text-right">Actions</TH></TR>
            </THead>
            <TBody>
              {rows.length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-gray-400">Aucun reçu.</TD></TR>}
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs text-gray-600">{r.reference}</TD>
                  <TD className="font-medium text-gray-900">{formatGNF(r.amount)}</TD>
                  <TD className="text-sm text-gray-500">{formatDateTime(r.generatedAt)}</TD>
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
    <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

/** Pretty-prints a provider payload if it is JSON, otherwise returns the raw string. */
function prettyJson(raw: string | null): string {
  if (!raw) return "—";
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}
