import type { SchoolProfile } from "@/lib/api/platform";
import { officialPrintHeaderHtml, PRINT_HEADER_CSS } from "@/lib/print-header";
import { printHtmlDocument } from "@/lib/print-node";

/**
 * Impression d'une liste tabulaire simple (élèves, enseignants…) — en-tête officiel de l'école, titre,
 * filtres appliqués, date d'impression et nombre total de lignes, puis un tableau paginé nativement
 * par le navigateur (§10 cahier des charges). Portrait A4, pas de mise en page spécifique par ligne.
 */
export interface PrintListOptions {
  profile: SchoolProfile | null | undefined;
  title: string;
  /** Résumé des filtres appliqués (ex. "Classe : 6ème A · Statut : Validée") — affiché sous le titre. */
  subtitle?: string | null;
  columns: string[];
  rows: (string | number)[][];
}

const esc = (v: string | number) => String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));

function buildPrintListHtml(opts: PrintListOptions): string {
  const printedAt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const headerHtml = officialPrintHeaderHtml(opts.profile);
  const rowsHtml = opts.rows.map((row) =>
    `<tr>${row.map((cell) => `<td class="pl-cell">${esc(cell)}</td>`).join("")}</tr>`,
  ).join("");
  return `
    <style>
      ${PRINT_HEADER_CSS}
      @page { size: A4; margin: 15mm; }
      .pl-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
      .pl-subtitle { font-size: 11px; color: #475569; margin: 0 0 10px; }
      .pl-meta { font-size: 9.5px; color: #94a3b8; margin: 0 0 12px; }
      table.pl-table { width: 100%; border-collapse: collapse; font-size: 10px; }
      table.pl-table th { text-align: left; border-bottom: 1.5px solid #0d9488; padding: 4px 6px; color: #0f172a; }
      table.pl-table .pl-cell { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; color: #334155; }
      table.pl-table tr { break-inside: avoid; }
    </style>
    ${headerHtml}
    <p class="pl-title">${esc(opts.title)}</p>
    ${opts.subtitle ? `<p class="pl-subtitle">${esc(opts.subtitle)}</p>` : ""}
    <p class="pl-meta">Imprimé le ${esc(printedAt)} — ${opts.rows.length} ligne${opts.rows.length > 1 ? "s" : ""}</p>
    <table class="pl-table">
      <thead><tr>${opts.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${rowsHtml || `<tr><td class="pl-cell" colspan="${opts.columns.length}">Aucune donnée.</td></tr>`}</tbody>
    </table>
  `;
}

export function printList(opts: PrintListOptions): void {
  printHtmlDocument(buildPrintListHtml(opts));
}
