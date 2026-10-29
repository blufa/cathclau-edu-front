"use client";

import { useState } from "react";
import { History, Printer } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { listAuditLogActors, searchAuditLogs } from "@/lib/api/audit";
import { getSchoolProfile } from "@/lib/api/platform";
import {
  AUDIT_ACTION_LABEL, AUDIT_FRAUD_ACTIONS, AUDIT_RESOURCE_LABEL, formatAuditDetails,
  type AuditLogEntry,
} from "@/lib/types/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Reveal } from "@/components/public/reveal";
import { formatDateTime } from "@/lib/format";
import { printHtmlDocument } from "@/lib/print-node";
import { officialPrintHeaderHtml, PRINT_HEADER_CSS } from "@/lib/print-header";

const PAGE_SIZE = 20;

export default function AuditLogsPage() {
  const { user } = useAuth();
  const canView = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["audit:read"]);

  const [action, setAction] = useState("");
  const [utilisateurId, setUtilisateurId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const { data, loading, error } = useQuery(
    () => (canView
      ? searchAuditLogs({
          action: action || undefined,
          utilisateurId: utilisateurId ? Number(utilisateurId) : undefined,
          from: from ? `${from}T00:00:00` : undefined,
          to: to ? `${to}T23:59:59` : undefined,
          page,
          size: PAGE_SIZE,
        })
      : Promise.resolve(null)),
    [canView, action, utilisateurId, from, to, page],
  );

  // Noms d'acteur/ressource déjà résolus côté serveur (AuditResourceNameResolver) — n'exige plus
  // user:read/eleve:read côté frontend (certains rôles consultant le journal, ex. comptable, ont
  // audit:read sans ces autres permissions, ce qui rendait les filtres inutilisables silencieusement).
  const actorsQuery = useQuery(() => (canView ? listAuditLogActors() : Promise.resolve(null)), [canView]);
  function userName(l: AuditLogEntry): string {
    if (l.utilisateurId == null) return "Système";
    return l.utilisateurNom ?? `Utilisateur #${l.utilisateurId}`;
  }
  function actorNameById(id: number): string {
    const actor = (actorsQuery.data ?? []).find((a) => a.id === id);
    return actor ? `${actor.firstName} ${actor.lastName}` : `Utilisateur #${id}`;
  }

  function resourceLabel(l: AuditLogEntry): string {
    if (l.ressourceId == null) return AUDIT_RESOURCE_LABEL[l.ressource] ?? l.ressource;
    if (l.ressourceNom) return l.ressourceNom;
    return `${AUDIT_RESOURCE_LABEL[l.ressource] ?? l.ressource} #${l.ressourceId}`;
  }

  const profileQuery = useQuery(() => getSchoolProfile(), []);

  /** Imprime la page courante du journal (celle affichée à l'écran, avec les mêmes filtres) — passe
   * par le dialogue d'impression du navigateur, "Enregistrer en PDF" fait le reste (retour
   * utilisateur : "je dois pouvoir les imprimer sur un pdf aussi"). */
  function printAuditLog() {
    const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
    const filterParts = [
      action ? `Action : ${AUDIT_ACTION_LABEL[action] ?? action}` : null,
      utilisateurId ? `Utilisateur : ${actorNameById(Number(utilisateurId))}` : null,
      from ? `Depuis le ${from}` : null,
      to ? `Jusqu'au ${to}` : null,
    ].filter((p): p is string => !!p);
    const rows = data?.content ?? [];
    printHtmlDocument(`<!doctype html><html><head><title>Journal d'audit</title>
      <style>
        body{font-family:sans-serif;padding:24px;color:#111}${PRINT_HEADER_CSS}
        h1{font-size:15px;margin:0 0 4px}
        .sub{font-size:11px;color:#64748b;margin-bottom:14px}
        table{width:100%;border-collapse:collapse;font-size:10.5px}
        th,td{border-bottom:1px solid #e2e8f0;padding:5px 6px;text-align:left;vertical-align:top}
        th{color:#475569;font-weight:600}
      </style></head>
      <body>
        ${officialPrintHeaderHtml(profileQuery.data)}
        <h1>Journal d&apos;audit</h1>
        <p class="sub">
          ${filterParts.length > 0 ? esc(filterParts.join(" · ")) + " · " : ""}
          Page ${page + 1} · ${rows.length} entrée(s) · imprimé le ${new Date().toLocaleString("fr-FR")}
        </p>
        <table>
          <thead><tr><th>Date</th><th>Action</th><th>Utilisateur</th><th>Ressource</th><th>Détails</th></tr></thead>
          <tbody>
            ${rows.map((l) => `<tr>
              <td>${esc(formatDateTime(l.createdAt))}</td>
              <td>${esc(AUDIT_ACTION_LABEL[l.action] ?? l.action)}</td>
              <td>${esc(userName(l))}</td>
              <td>${esc(resourceLabel(l))}</td>
              <td>${esc(formatAuditDetails(l.details))}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </body></html>`);
  }

  if (!canView) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        Vous n&apos;avez pas accès au journal d&apos;audit.
      </p>
    );
  }

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "createdAt",
      header: "Date",
      accessor: (l) => l.createdAt,
      render: (l) => formatDateTime(l.createdAt),
    },
    {
      key: "action",
      header: "Action",
      accessor: (l) => AUDIT_ACTION_LABEL[l.action] ?? l.action,
      render: (l) => (
        <Badge tone={AUDIT_FRAUD_ACTIONS.has(l.action) ? "red" : "gray"}>
          {AUDIT_ACTION_LABEL[l.action] ?? l.action}
        </Badge>
      ),
    },
    {
      key: "utilisateur",
      header: "Utilisateur",
      accessor: (l) => userName(l),
      render: (l) => userName(l),
    },
    {
      key: "ressource",
      header: "Ressource",
      accessor: resourceLabel,
      render: resourceLabel,
    },
    {
      key: "details",
      header: "Détails",
      accessor: (l) => formatAuditDetails(l.details),
      render: (l) => <span className="text-xs text-gray-500">{formatAuditDetails(l.details)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <Reveal y={12}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <History className="h-6 w-6 text-brand-600" /> Journal d&apos;audit
        </h1>
        <p className="text-sm text-gray-500">
          Trace des actions sensibles de l&apos;école (inscriptions, factures, exonérations, caisse…) —
          lecture seule, jamais modifiable.
        </p>
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <SearchableSelect
          triggerClassName="max-w-[260px] justify-between px-3"
          value={action}
          onChange={(v) => { setPage(0); setAction(v); }}
          options={[
            { value: "", trigger: "Toutes les actions", label: "Toutes les actions", searchText: "" },
            ...Object.entries(AUDIT_ACTION_LABEL).map(([code, label]): SearchableOption => (
              { value: code, trigger: label, label, searchText: label }
            )),
          ]}
        />
        <SearchableSelect
          triggerClassName="max-w-[220px] justify-between px-3"
          value={utilisateurId}
          onChange={(v) => { setPage(0); setUtilisateurId(v); }}
          options={[
            { value: "", trigger: "Tous les utilisateurs", label: "Tous les utilisateurs", searchText: "" },
            ...(actorsQuery.data ?? []).map((u): SearchableOption => {
              const label = `${u.firstName} ${u.lastName}`;
              return { value: String(u.id), trigger: label, label, searchText: label };
            }),
          ]}
        />
        <div className="flex items-center gap-2">
          <DatePicker value={from} onChange={(v) => { setPage(0); setFrom(v); }} placeholder="Depuis le…" clearable />
          <span className="text-sm text-gray-400">→</span>
          <DatePicker value={to} onChange={(v) => { setPage(0); setTo(v); }} placeholder="Jusqu'au…" clearable />
        </div>
        <Button variant="secondary" leftSection={<Printer className="h-4 w-4" />} onClick={printAuditLog} disabled={!data || data.content.length === 0}>
          Imprimer / PDF
        </Button>
      </div>

      <DataTable
        columns={columns}
        page={data}
        loading={loading}
        error={!!error}
        getRowKey={(l) => l.id}
        onPageChange={setPage}
        emptyLabel="Aucune entrée."
        searchable
        searchPlaceholder="Rechercher…"
        exportable
        exportFilename="journal-audit.csv"
      />
    </div>
  );
}
