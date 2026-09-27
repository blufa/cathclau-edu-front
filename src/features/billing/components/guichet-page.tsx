"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, Search, User } from "lucide-react";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useStudentsSummaryQuery } from "@/features/students/hooks/use-students";
import { listInvoicesByStudent } from "@/lib/api/billing";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { INVOICE_STATUS_LABEL, type Invoice } from "@/lib/types/billing";
import type { Student } from "@/lib/types/student";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardBody } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { notifyError } from "@/lib/feedback";
import { getBranding } from "@/lib/branding";

const num = (v: string | number | null | undefined) => Number(v ?? 0);

/**
 * Guichet d'accueil (§4) : recherche rapide d'un élève par nom/matricule, affichage instantané de
 * son solde financier, et impression directe d'un reçu du reste à payer à remettre au parent.
 */
const PAGE_SIZE = 10;

export default function GuichetPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Student | null>(null);

  useEffect(() => {
    const id = setTimeout(() => { setDebounced(query.trim()); setPage(0); }, 300);
    return () => clearTimeout(id);
  }, [query]);

  // Liste des élèves (nom, classe, parent principal) — toujours affichée, filtrée par la recherche.
  // `useStudentsSummaryQuery` (TanStack Query) au lieu du hook maison sans cache : passe par le
  // persister global IndexedDB (§retour comptable, guichet d'accueil hors-ligne) — une recherche déjà
  // faite en ligne reste consultable hors connexion, ce qui n'était pas le cas avant (écran central du
  // guichet, cassé hors-ligne : chaque frappe écrasait les résultats par une erreur réseau).
  const listQuery = useStudentsSummaryQuery({ search: debounced || undefined, page, size: PAGE_SIZE });
  const rows = listQuery.data?.content ?? [];

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const currentYear = years.find((y) => y.current) ?? years[0];
  const classesQuery = useCachedQuery(
    currentYear ? `classes:${currentYear.id}` : null,
    () => listClasses(currentYear!.id),
    [currentYear?.id],
  );
  const classLabel = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])),
    [classesQuery.data],
  );

  const invoicesQuery = useCachedQuery(
    selected ? `student-invoices:${selected.id}` : null,
    () => listInvoicesByStudent(selected!.id),
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
        <p className="text-sm text-gray-500">Liste des élèves avec leur classe et leur parent principal — recherchez par nom ou matricule, puis cliquez sur un élève pour voir sa situation financière.</p>
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

      {!selected && (
        listQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">Aucun élève trouvé.</p>
        ) : (
          <div>
            <Table>
              <THead><tr><TH>Élève</TH><TH>Classe</TH><TH>Parent principal</TH><TH /></tr></THead>
              <TBody>
                {rows.map((row) => (
                  <TR
                    key={row.student.id}
                    className="cursor-pointer hover:bg-brand-50/40"
                    onClick={() => setSelected(row.student)}
                  >
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                          <User className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-gray-900">{row.student.firstName} {row.student.lastName}</span>
                          <span className="block font-mono text-xs text-gray-400">{row.student.studentNumber}</span>
                        </span>
                      </div>
                    </TD>
                    <TD className="text-gray-600">{row.classId != null ? (classLabel.get(row.classId) ?? `#${row.classId}`) : "—"}</TD>
                    <TD className="text-gray-600">
                      {row.principalParentName ? (
                        <>
                          <span className="block">{row.principalParentName}</span>
                          {row.principalParentPhone && <span className="block text-xs text-gray-400">{row.principalParentPhone}</span>}
                        </>
                      ) : "—"}
                    </TD>
                    <TD className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(row.student)}>Voir</Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {listQuery.data && listQuery.data.totalPages > 1 && (
              <div className="mt-2">
                <Pagination page={page} totalPages={listQuery.data.totalPages} totalElements={listQuery.data.totalElements} onPageChange={setPage} />
              </div>
            )}
          </div>
        )
      )}

      {selected && (
        <Card className="max-w-xl">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-gray-900">{selected.firstName} {selected.lastName}</p>
                <p className="font-mono text-sm text-gray-500">{selected.studentNumber}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
                ← Retour à la liste
              </Button>
            </div>

            {invoicesQuery.loading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3 text-center">
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
