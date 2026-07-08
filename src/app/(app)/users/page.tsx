"use client";

import { useState } from "react";
import { Stack, Switch, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  activateUser,
  assignRoleToUser,
  createUser,
  deactivateUser,
  deleteUser,
  getUserRoles,
  listRoles,
  listUsers,
  removeRoleFromUser,
  resetUserAccess,
  updateUser,
} from "@/lib/api/iam";
import { ApiError } from "@/lib/api/errors";
import type { CreateUserInput, Role, User } from "@/lib/types/iam";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const PAGE_SIZE = 200;

function fullName(u: User) {
  return `${u.firstName} ${u.lastName}`.trim();
}
function initials(u: User) {
  return `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function UsersPage() {
  const { user } = useAuth();
  const allowed = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [managingRoles, setManagingRoles] = useState<User | null>(null);
  const [resetInfo, setResetInfo] = useState<{ name: string; username?: string; password?: string } | null>(null);

  // Client-side table: load the school's users (typically a small set) and let DataTable
  // handle search, sorting, pagination and CSV export.
  const { data, loading, error, refetch } = useQuery(() => listUsers(0, PAGE_SIZE), []);
  const rolesQuery = useQuery(() => listRoles(), []);

  if (!allowed) {
    return (
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Accès réservé aux administrateurs de l&apos;école.
      </div>
    );
  }

  const rows = (data?.content ?? []).filter(
    (u) => !activeFilter || String(u.active) === activeFilter,
  );

  async function handleToggleActive(u: User) {
    try {
      if (u.active) await deactivateUser(u.id);
      else await activateUser(u.id);
      notifySuccess(u.active ? "Utilisateur désactivé" : "Utilisateur activé");
      refetch();
    } catch (err) {
      notifyError(err);
    }
  }

  function handleResetAccess(u: User) {
    confirmAction({
      title: "Réinitialiser l'accès",
      message: `Générer un nouveau mot de passe temporaire pour ${fullName(u)} ? Son ancien mot de passe ne fonctionnera plus.`,
      confirmLabel: "Réinitialiser",
      onConfirm: async () => {
        try {
          const res = await resetUserAccess(u.id);
          setResetInfo({ name: fullName(u), username: res.username, password: res.temporaryPassword });
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  function handleDelete(u: User) {
    confirmAction({
      title: "Supprimer l'utilisateur",
      message: `Supprimer ${fullName(u)} ? Son accès sera révoqué.`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteUser(u.id);
          notifySuccess("Utilisateur supprimé");
          refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Utilisateur",
      accessor: (u) => fullName(u),
      render: (u) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
            {initials(u)}
          </span>
          <span className="font-medium text-slate-900">{fullName(u)}</span>
        </div>
      ),
    },
    { key: "email", header: "Email", accessor: (u) => u.email, render: (u) => <span className="text-slate-600">{u.email}</span> },
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
      render: (u) => <span className="text-slate-500">{u.lastLoginAt?.slice(0, 10) ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setManagingRoles(u)}>
            Rôles
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
            Modifier
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleToggleActive(u)}>
            {u.active ? "Désactiver" : "Activer"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleResetAccess(u)}>
            Réinit. accès
          </Button>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(u)}>
            Suppr.
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Utilisateurs</h1>
          <p className="text-sm text-slate-500">Comptes et accès de l&apos;établissement</p>
        </div>
        <Button onClick={() => setCreating(true)} leftSection={<UserPlus className="h-4 w-4" />}>
          Nouvel utilisateur
        </Button>
      </Reveal>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          className="max-w-[180px]"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as "" | "true" | "false")}
        >
          <option value="">Tous les statuts</option>
          <option value="true">Actifs</option>
          <option value="false">Inactifs</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={!!error}
        getRowKey={(u) => u.id}
        emptyLabel="Aucun utilisateur."
        searchable
        searchPlaceholder="Rechercher (nom, email)…"
        columnToggle
        exportable
        exportFilename="utilisateurs.csv"
      />

      {/* Create */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel utilisateur">
        <UserCreateForm
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            notifySuccess("Utilisateur créé");
            refetch();
          }}
        />
      </Modal>

      {/* Edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'utilisateur">
        {editing && (
          <UserEditForm
            user={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              notifySuccess("Utilisateur mis à jour");
              refetch();
            }}
          />
        )}
      </Modal>

      {/* Roles */}
      <Modal open={!!managingRoles} onClose={() => setManagingRoles(null)} title="Rôles de l'utilisateur">
        {managingRoles && (
          <UserRolesEditor user={managingRoles} roles={rolesQuery.data ?? []} />
        )}
      </Modal>

      {/* Reset access result */}
      <Modal open={!!resetInfo} onClose={() => setResetInfo(null)} title="Nouvel accès généré">
        {resetInfo && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Communiquez ces identifiants à <span className="font-medium text-slate-900">{resetInfo.name}</span>.
              Il pourra changer son mot de passe après connexion.
            </p>
            {resetInfo.username && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Identifiant</p>
                <p className="font-mono text-sm font-medium text-slate-900">{resetInfo.username}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <div>
                <p className="text-xs text-slate-500">Mot de passe temporaire</p>
                <p className="font-mono text-lg font-bold tracking-wider text-slate-900">{resetInfo.password ?? "—"}</p>
              </div>
              {resetInfo.password && (
                <Button size="sm" variant="secondary" onClick={() => {
                  navigator.clipboard?.writeText(resetInfo.password ?? "").then(
                    () => notifySuccess("Mot de passe copié"),
                    () => notifyError(new Error("Copie impossible")),
                  );
                }}>Copier</Button>
              )}
            </div>
            <p className="text-xs text-amber-700">Ce mot de passe ne sera plus affiché ensuite. Notez-le si nécessaire.</p>
            <div className="flex justify-end">
              <Button onClick={() => setResetInfo(null)}>J&apos;ai noté</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Create form ────────────────────────────────────────────────────────────
function UserCreateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm<CreateUserInput>({
    mode: "controlled",
    initialValues: { firstName: "", lastName: "", email: "", password: "", phone: "" },
    validate: {
      firstName: (v) => (v ? null : "Requis"),
      lastName: (v) => (v ? null : "Requis"),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Email invalide"),
      password: (v) => (v.length >= 8 ? null : "8 caractères minimum"),
    },
  });

  async function submit(values: CreateUserInput) {
    setLoading(true);
    try {
      await createUser(values);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setFieldError("email", "Cet email est déjà utilisé dans l'école");
      } else {
        notifyError(err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Prénom" withAsterisk {...form.getInputProps("firstName")} />
          <TextInput label="Nom" withAsterisk {...form.getInputProps("lastName")} />
        </div>
        <TextInput label="Email" withAsterisk {...form.getInputProps("email")} />
        <TextInput label="Téléphone" {...form.getInputProps("phone")} />
        <TextInput label="Mot de passe initial" type="password" withAsterisk {...form.getInputProps("password")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" loading={loading}>
            Créer
          </Button>
        </div>
      </Stack>
    </form>
  );
}

// ── Edit form ───────────────────────────────────────────────────────────────
function UserEditForm({ user, onCancel, onSaved }: { user: User; onCancel: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
      active: user.active,
    },
    validate: {
      firstName: (v) => (v ? null : "Requis"),
      lastName: (v) => (v ? null : "Requis"),
    },
  });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      await updateUser(user.id, values);
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Prénom" withAsterisk {...form.getInputProps("firstName")} />
          <TextInput label="Nom" withAsterisk {...form.getInputProps("lastName")} />
        </div>
        <TextInput label="Téléphone" {...form.getInputProps("phone")} />
        <Switch
          label="Compte actif"
          color="teal"
          checked={form.values.active}
          onChange={(e) => form.setFieldValue("active", e.currentTarget.checked)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" loading={loading}>
            Enregistrer
          </Button>
        </div>
      </Stack>
    </form>
  );
}

// ── Roles editor ─────────────────────────────────────────────────────────────
function UserRolesEditor({ user, roles }: { user: User; roles: Role[] }) {
  const rolesQuery = useQuery(() => getUserRoles(user.id), [user.id]);
  const [busy, setBusy] = useState<number | null>(null);
  const assignedNames = new Set(rolesQuery.data ?? []);

  async function toggle(role: Role, assigned: boolean) {
    setBusy(role.id);
    try {
      if (assigned) await removeRoleFromUser(user.id, role.id);
      else await assignRoleToUser(user.id, role.id);
      notifySuccess("Rôles mis à jour. Les autorisations seront rafraîchies à la prochaine connexion.");
      rolesQuery.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  }

  if (rolesQuery.loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {roles.map((role) => {
        const assigned = assignedNames.has(role.name);
        return (
          <div
            key={role.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{role.name}</p>
              {role.description && <p className="text-xs text-slate-500">{role.description}</p>}
            </div>
            <Button
              size="sm"
              variant={assigned ? "ghost" : "primary"}
              loading={busy === role.id}
              onClick={() => toggle(role, assigned)}
              className={assigned ? "text-red-600" : undefined}
            >
              {assigned ? "Retirer" : "Affecter"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
