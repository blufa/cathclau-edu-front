"use client";

import { useMemo, useState } from "react";
import { CircleDot, Users as UsersIcon } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { listPlatformUsers, searchTenants } from "@/lib/api/platform";
import type { PlatformUser } from "@/lib/types/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";

const TENANTS_PAGE_SIZE = 500;

function fullName(u: PlatformUser) {
  return `${u.firstName} ${u.lastName}`.trim();
}
function initials(u: PlatformUser) {
  return `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function PlatformUsersPage() {
  return (
    <RequireSuperAdmin>
      <PlatformUsersTable />
    </RequireSuperAdmin>
  );
}

function PlatformUsersTable() {
  const [tenantFilter, setTenantFilter] = useState("");

  const usersQuery = useQuery(() => listPlatformUsers(), []);
  const tenantsQuery = useQuery(() => searchTenants({ size: TENANTS_PAGE_SIZE }), []);

  const tenantName = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of tenantsQuery.data?.content ?? []) map.set(t.id, t.schoolName);
    return map;
  }, [tenantsQuery.data]);

  const users = usersQuery.data ?? [];
  const rows = tenantFilter ? users.filter((u) => String(u.tenantId) === tenantFilter) : users;

  const onlineCount = users.filter((u) => u.online).length;
  const onlineTenants = new Set(users.filter((u) => u.online).map((u) => u.tenantId)).size;

  const columns: Column<PlatformUser>[] = [
    {
      key: "name",
      header: "Utilisateur",
      accessor: (u) => fullName(u),
      render: (u) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
            {initials(u)}
          </span>
          <div>
            <p className="font-medium text-slate-900">{fullName(u)}</p>
            <p className="text-xs text-slate-400">{u.email ?? u.username ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "tenant",
      header: "École",
      accessor: (u) => (u.tenantId != null ? tenantName.get(u.tenantId) ?? `#${u.tenantId}` : "Plateforme"),
      render: (u) => (
        <span className="text-slate-600">
          {u.tenantId != null ? tenantName.get(u.tenantId) ?? `#${u.tenantId}` : "Plateforme (aucune école)"}
        </span>
      ),
    },
    {
      key: "roles",
      header: "Rôle(s)",
      accessor: (u) => u.roles.join(", "),
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.length === 0 ? <span className="text-slate-300">—</span> : u.roles.map((r) => <Badge key={r} tone="indigo">{r}</Badge>)}
        </div>
      ),
    },
    {
      key: "online",
      header: "En ligne",
      accessor: (u) => (u.online ? "En ligne" : "Hors ligne"),
      render: (u) => (
        <Badge tone={u.online ? "green" : "gray"}>
          <CircleDot className="mr-1 inline h-3 w-3" />
          {u.online ? "En ligne" : "Hors ligne"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Statut",
      accessor: (u) => (u.active ? "Actif" : "Inactif"),
      render: (u) => <Badge tone={u.active ? "green" : "gray"}>{u.active ? "Actif" : "Inactif"}</Badge>,
    },
    {
      key: "lastLoginAt",
      header: "Dernière connexion",
      accessor: (u) => u.lastLoginAt?.slice(0, 10) ?? "",
      render: (u) => <span className="text-slate-500">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Utilisateurs</h1>
        <p className="text-sm text-slate-500">Tous les comptes, toutes écoles confondues.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Comptes au total" value={users.length} icon={UsersIcon} accent="indigo" />
        <StatCard title="En ligne maintenant" value={onlineCount} icon={CircleDot} accent={onlineCount > 0 ? "emerald" : "teal"}
          hint="Actifs dans les 5 dernières minutes" />
        <StatCard title="Écoles avec au moins un connecté" value={onlineTenants} icon={UsersIcon} accent="sky" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          className="max-w-[240px]"
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
        >
          <option value="">Toutes les écoles</option>
          {(tenantsQuery.data?.content ?? []).map((t) => (
            <option key={t.id} value={String(t.id)}>{t.schoolName}</option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={usersQuery.loading}
        error={!!usersQuery.error}
        getRowKey={(u) => u.id}
        emptyLabel="Aucun utilisateur."
        searchable
        searchPlaceholder="Rechercher (nom, email)…"
        columnToggle
        exportable
        exportFilename="utilisateurs-plateforme.csv"
      />
    </div>
  );
}
