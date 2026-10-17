"use client";

import { useMemo, useState } from "react";
import { CircleDot, ShieldMinus, UserPlus, Users as UsersIcon } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { listPlatformUsers, searchTenants } from "@/lib/api/platform";
import { getUserRevokedPermissions, listPermissions, setUserRevokedPermissions } from "@/lib/api/iam";
import type { PlatformUser } from "@/lib/types/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { NewRedacteurModal } from "@/components/platform/new-redacteur-modal";
import { PermissionMatrix } from "@/components/iam/permission-matrix";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/stat-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import { notifySuccess } from "@/lib/feedback";

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
  const [creatingRedacteur, setCreatingRedacteur] = useState(false);
  const [reducingPrivileges, setReducingPrivileges] = useState<PlatformUser | null>(null);

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
    {
      key: "actions",
      header: "",
      sortable: false,
      accessor: () => "",
      render: (u) =>
        u.roles.length > 0 && !u.roles.includes("SUPER_ADMIN") ? (
          <Button size="sm" variant="ghost" leftSection={<ShieldMinus className="h-3.5 w-3.5" />} onClick={() => setReducingPrivileges(u)}>
            Privilèges
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Utilisateurs</h1>
          <p className="text-sm text-slate-500">Tous les comptes, toutes écoles confondues.</p>
        </div>
        <Button leftSection={<UserPlus className="h-4 w-4" />} onClick={() => setCreatingRedacteur(true)}>
          Nouveau rédacteur
        </Button>
      </div>

      <NewRedacteurModal
        open={creatingRedacteur}
        onClose={() => setCreatingRedacteur(false)}
        onCreated={() => usersQuery.refetch()}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Comptes au total" value={users.length} icon={UsersIcon} accent="indigo" />
        <StatCard title="En ligne maintenant" value={onlineCount} icon={CircleDot} accent={onlineCount > 0 ? "emerald" : "teal"}
          hint="Actifs dans les 5 dernières minutes" />
        <StatCard title="Écoles avec au moins un connecté" value={onlineTenants} icon={UsersIcon} accent="sky" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchableSelect
          triggerClassName="max-w-[240px] justify-between px-3"
          value={tenantFilter}
          onChange={setTenantFilter}
          options={[
            { value: "", trigger: "Toutes les écoles", label: "Toutes les écoles", searchText: "" },
            ...(tenantsQuery.data?.content ?? []).map((t): SearchableOption => ({
              value: String(t.id), trigger: t.schoolName, label: t.schoolName, searchText: t.schoolName,
            })),
          ]}
        />
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

      <Modal
        open={!!reducingPrivileges}
        onClose={() => setReducingPrivileges(null)}
        title={`Réduire les privilèges — ${reducingPrivileges ? fullName(reducingPrivileges) : ""}`}
      >
        {reducingPrivileges && (
          <ReducePrivilegesEditor user={reducingPrivileges} onDone={() => setReducingPrivileges(null)} />
        )}
      </Modal>
    </div>
  );
}

/** Retire des permissions à CET utilisateur précis, même si son rôle (SCHOOL_ADMIN...) les accorde —
 * le rôle est partagé par toute la plateforme (§retour comptable), donc modifier ses permissions
 * affecterait toutes les écoles. La case cochée ici = permission RETIRÉE, pas accordée. */
function ReducePrivilegesEditor({ user, onDone }: { user: PlatformUser; onDone: () => void }) {
  const permsQuery = useQuery(() => listPermissions(), []);
  const revokedQuery = useQuery(() => getUserRevokedPermissions(user.id), [user.id]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Les permissions cochées ci-dessous sont RETIRÉES à {fullName(user)} — les autres admins du rôle{" "}
        {user.roles.join("/")} ne sont pas affectés. Une reconnexion sera nécessaire pour que ça s&apos;applique.
      </p>
      <PermissionMatrix
        key={user.id}
        initialSelectedIds={new Set((revokedQuery.data ?? []).map((p) => p.id))}
        permissions={permsQuery.data ?? []}
        loading={permsQuery.loading || revokedQuery.loading}
        onSave={(ids) => setUserRevokedPermissions(user.id, ids)}
        onSaved={() => {
          notifySuccess("Privilèges mis à jour — une reconnexion sera demandée à l'utilisateur.");
          onDone();
        }}
      />
    </div>
  );
}
