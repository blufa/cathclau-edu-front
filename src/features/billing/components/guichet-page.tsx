"use client";

import { useEffect, useState } from "react";
import { Printer, Search, User } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { searchStudents } from "@/lib/api/students";
import { listInvoicesByStudent } from "@/lib/api/billing";
import { INVOICE_STATUS_LABEL, type Invoice } from "@/lib/types/billing";
import type { Student } from "@/lib/types/student";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardBody } from "@/components/ui/card";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { notifyError } from "@/lib/feedback";
import { getBranding } from "@/lib/branding";

const num = (v: string | number | null | undefined) => Number(v ?? 0);

/**
 * Guichet d'accueil (§4) : recherche rapide d'un élève par nom/matricule, affichage instantané de
 * son solde financier, et impression directe d'un reçu du reste à payer à remettre au parent.
 */
export default function GuichetPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const searchQuery = useQuery(
    () => (debounced.length >= 2 ? searchStudents({ search: debounced, size: 8 }) : Promise.resolve(null)),
    [debounced],
  );
  const results = searchQuery.data?.content ?? [];

  const invoicesQuery = useQuery(
    () => (selected ? listInvoicesByStudent(selected.id) : Promise.resolve([])),
    [selected?.id],
  );
  const invoices = invoicesQuery.data ?? [];
  const totalBilled = invoices.reduce((s, i) => s + num(i.totalAmount), 0);
  const totalPaid = invoices.reduce((s, i) => s + num(i.paidAmount), 0);
  const balance = invoices.reduce((s, i) => s + num(i.remainingBalance ?? num(i.totalAmount) - num(i.paidAmount)), 0);
  const unpaid = invoices.filter((i) => i.status !== "PAID" && num(i.remainingBalance ?? num(i.totalAmount) - num(i.paidAmount)) > 0);

  function printReceipt() {
    if (!selected) return;
    const branding = getBranding();
    const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
    const rows = unpaid.map((i) => {
      const due = num(i.remainingBalance ?? num(i.totalAmount) - num(i.paidAmount));
      return `<tr><td>${esc(i.reference)}</td><td>${esc(i.periodLabel ?? INVOICE_STATUS_LABEL[i.status])}</td>`
        + `<td class="right">${esc(formatGNF(i.totalAmount))}</td><td class="right">${esc(formatGNF(due))}</td></tr>`;
    }).join("") || `<tr><td colspan="4" class="empty">Aucun solde restant.</td></tr>`;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu du reste à payer</title>`
      + `<style>body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#0f172a}h1{font-size:18px;margin:0 0 2px}`
      + `.sub{color:#64748b;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-top:10px}`
      + `th,td{border:1px solid #cbd5e1;padding:8px;font-size:12px}th{background:#f1f5f9;text-align:left}.right{text-align:right}`
      + `.empty{text-align:center;color:#94a3b8}.total{margin-top:14px;font-size:15px;font-weight:700;text-align:right}`
      + `@media print{body{padding:0}}</style></head><body>`
      + `<h1>${esc(branding.appName)} — Reçu du reste à payer</h1>`
      + `<div class="sub">Édité le ${new Date().toLocaleDateString("fr-FR")}</div>`
      + `<p><strong>${esc(selected.firstName)} ${esc(selected.lastName)}</strong> — matricule ${esc(selected.studentNumber)}</p>`
      + `<table><thead><tr><th>Référence</th><th>Période</th><th class="right">Montant total</th><th class="right">Reste dû</th></tr></thead>`
      + `<tbody>${rows}</tbody></table>`
      + `<p class="total">Solde total restant dû : ${esc(formatGNF(balance))}</p>`
      + `<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { notifyError("Autorisez les pop-ups pour imprimer le reçu."); return; }
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Guichet d&apos;accueil</h1>
        <p className="text-sm text-gray-500">Recherchez un élève par nom ou matricule pour voir instantanément sa situation financière.</p>
      </Reveal>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Nom, prénom ou matricule…"
          className="pl-9"
        />
      </div>

      {!selected && debounced.length >= 2 && (
        <div className="max-w-md space-y-1">
          {searchQuery.loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun élève trouvé.</p>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s)}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <User className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-gray-900">{s.firstName} {s.lastName}</span>
                  <span className="block font-mono text-xs text-gray-400">{s.studentNumber}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {selected && (
        <Card className="max-w-xl">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-gray-900">{selected.firstName} {selected.lastName}</p>
                <p className="font-mono text-sm text-gray-500">{selected.studentNumber}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setSelected(null); setQuery(""); }}>
                Nouvelle recherche
              </Button>
            </div>

            {invoicesQuery.loading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Facturé</p>
                    <p className="text-sm font-semibold text-gray-900">{formatGNF(totalBilled)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Payé</p>
                    <p className="text-sm font-semibold text-success-600">{formatGNF(totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Reste à payer</p>
                    <p className={`text-sm font-bold ${balance > 0 ? "text-error-600" : "text-success-600"}`}>{formatGNF(balance)}</p>
                  </div>
                </div>

                {unpaid.length > 0 && (
                  <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                    {unpaid.map((i: Invoice) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div>
                          <span className="font-mono text-xs text-gray-500">{i.reference}</span>
                          <span className="ml-2 text-gray-700">{i.periodLabel ?? "Frais"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={i.status === "PARTIAL" ? "amber" : "red"}>{INVOICE_STATUS_LABEL[i.status]}</Badge>
                          <span className="font-medium text-gray-900">
                            {formatGNF(num(i.remainingBalance ?? num(i.totalAmount) - num(i.paidAmount)))}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <Button onClick={printReceipt} leftSection={<Printer className="h-4 w-4" />} fullWidth>
                  Imprimer le reçu du reste à payer
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
