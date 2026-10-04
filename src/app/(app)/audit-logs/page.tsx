"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { searchAuditLogs } from "@/lib/api/audit";
import { listUsers } from "@/lib/api/iam";
import {
  AUDIT_ACTION_LABEL, AUDIT_FRAUD_ACTIONS, AUDIT_RESOURCE_LABEL, formatAuditDetails,
  type AuditLogEntry,
} from "@/lib/types/audit";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Reveal } from "@/components/public/reveal";
import { formatDateTime } from "@/lib/format";

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

  const usersQuery = useQuery(() => (canView ? listUsers(0, 200) : Promise.resolve(null)), [canView]);
  const userName = useMemo(() => {
    const map = new Map<number, string>();
    (usersQuery.data?.content ?? []).forEach((u) => map.set(u.id, `${u.firstName} ${u.lastName}`));
    return (id: number | null) => (id == null ? "Système" : map.get(id) ?? `Utilisateur #${id}`);
  }, [usersQuery.data]);

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
      accessor: (l) => userName(l.utilisateurId),
      render: (l) => userName(l.utilisateurId),
    },
    {
      key: "ressource",
      header: "Ressource",
      accessor: (l) => `${AUDIT_RESOURCE_LABEL[l.ressource] ?? l.ressource} #${l.ressourceId ?? ""}`,
      render: (l) => `${AUDIT_RESOURCE_LABEL[l.ressource] ?? l.ressource}${l.ressourceId != null ? ` #${l.ressourceId}` : ""}`,
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
        <Select className="max-w-[260px]" value={action} onChange={(e) => { setPage(0); setAction(e.target.value); }}>
          <option value="">Toutes les actions</option>
          {Object.entries(AUDIT_ACTION_LABEL).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </Select>
        <Select className="max-w-[220px]" value={utilisateurId} onChange={(e) => { setPage(0); setUtilisateurId(e.target.value); }}>
          <option value="">Tous les utilisateurs</option>
          {(usersQuery.data?.content ?? []).map((u) => (
            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
          ))}
        </Select>
        <div className="flex items-center gap-2">
          <DatePicker value={from} onChange={(v) => { setPage(0); setFrom(v); }} placeholder="Depuis le…" clearable />
          <span className="text-sm text-gray-400">→</span>
          <DatePicker value={to} onChange={(v) => { setPage(0); setTo(v); }} placeholder="Jusqu'au…" clearable />
        </div>
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
