"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  activateUser,
  assignRoleToUser,
  createUser,
  deactivateUser,
  deleteUser,
  getUserDirectPermissions,
  getUserRoles,
  listPermissions,
  listRoles,
  listUsers,
  removeRoleFromUser,
  resetUserAccess,
  setUserPermissions,
  updateUser,
} from "@/lib/api/iam";
import { ApiError } from "@/lib/api/errors";
import type { CreateUserInput, Role, User } from "@/lib/types/iam";
import { PermissionMatrix } from "@/components/iam/permission-matrix";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PhoneInput } from "@/components/ui/phone-input";
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
  const allowed = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["user:read"]);

  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [managingRoles, setManagingRoles] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [resetInfo, setResetInfo] = useState<{ name: string; username?: string; password?: string; mustChange?: boolean } | null>(null);

  // Client-side table: load the school's users (typically a small set) and let DataTable
  // handle search, sorting, pagination and CSV export.
  const { data, loading, error, refetch } = useQuery(() => listUsers(0, PAGE_SIZE), []);
  const rolesQuery = useQuery(() => listRoles(), []);

  if (!allowed) {
    return (
      <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">
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
          <span className="font-medium text-gray-900">{fullName(u)}</span>
        </div>
      ),
    },
    { key: "email", header: "Email", accessor: (u) => u.email, render: (u) => <span className="text-gray-600">{u.email}</span> },
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
      render: (u) => <span className="text-gray-500">{u.lastLoginAt?.slice(0, 10) ?? "—"}</span>,
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
          <Button size="sm" variant="ghost" onClick={() => setResetting(u)}>
            Mot de passe
          </Button>
          <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(u)}>
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500">Comptes et accès de l&apos;établissement</p>
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

      {/* Roles + permissions supplémentaires */}
      <Modal open={!!managingRoles} onClose={() => setManagingRoles(null)} title="Rôles & permissions de l'utilisateur" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {managingRoles && (
          <div className="space-y-6">
            <UserRolesEditor user={managingRoles} roles={rolesQuery.data ?? []} />
            <div className="border-t border-gray-100 pt-4">
              <h4 className="mb-1 text-sm font-semibold text-gray-900">Permissions supplémentaires</h4>
              <p className="mb-3 text-xs text-gray-500">
                À cocher en plus des permissions déjà incluses dans les rôles ci-dessus — utile pour donner un
                droit ponctuel à ce compte précis (ex. autoriser un comptable à créer des élèves) sans créer un
                rôle personnalisé.
              </p>
              <UserExtraPermissionsEditor user={managingRoles} />
            </div>
          </div>
        )}
      </Modal>

      {/* Reset password */}
      <Modal open={!!resetting} onClose={() => setResetting(null)} title="Réinitialiser le mot de passe">
        {resetting && (
          <PasswordResetForm
            user={resetting}
            onCancel={() => setResetting(null)}
            onDone={(res, mustChange) => {
              setResetInfo({ name: fullName(resetting), username: res.username, password: res.temporaryPassword, mustChange });
              setResetting(null);
            }}
          />
        )}
      </Modal>

      {/* Reset password result */}
      <Modal open={!!resetInfo} onClose={() => setResetInfo(null)} title="Mot de passe réinitialisé">
        {resetInfo && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Communiquez ces identifiants à <span className="font-medium text-gray-900">{resetInfo.name}</span>.
              {resetInfo.mustChange
                ? " Ce mot de passe est temporaire : il devra le changer à la prochaine connexion."
                : " Ce mot de passe est définitif ; il pourra le changer lui-même plus tard s'il le souhaite."}
            </p>
            {resetInfo.username && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500">Identifiant</p>
                <p className="font-mono text-sm font-medium text-gray-900">{resetInfo.username}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <div>
                <p className="text-xs text-gray-500">{resetInfo.mustChange ? "Mot de passe temporaire" : "Nouveau mot de passe"}</p>
                <p className="font-mono text-lg font-bold tracking-wider text-gray-900">{resetInfo.password ?? "—"}</p>
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
            <p className="text-xs text-warning-700">Ce mot de passe ne sera plus affiché ensuite. Notez-le si nécessaire.</p>
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
// Email optionnel : tous les utilisateurs se connectent par numéro de téléphone (voir
// CreateUserInput) — seul le couple email/téléphone doit avoir au moins une valeur, comme déjà
// exigé côté backend (UserService).
const createUserSchema = z.object({
  firstName: z.string().trim().min(1, "Requis"),
  lastName: z.string().trim().min(1, "Requis"),
  email: z.union([z.string().trim().regex(/^\S+@\S+\.\S+$/, "Email invalide"), z.literal("")]),
  password: z.string().min(8, "8 caractères minimum"),
  phone: z.string(),
}).refine((v) => v.email.trim() !== "" || v.phone.trim() !== "", {
  message: "Renseignez un email ou un numéro de téléphone",
  path: ["phone"],
});
type CreateUserFormValues = z.infer<typeof createUserSchema>;

function UserCreateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", phone: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: CreateUserFormValues) {
    setLoading(true);
    try {
      await createUser({ ...values, email: values.email.trim() === "" ? undefined : values.email } as CreateUserInput);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("email", { message: "Cet email est déjà utilisé dans l'école" });
      } else {
        notifyError(err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Prénom <span className="text-error-500">*</span></Label>
          <Input value={v.firstName} onChange={(e) => setValue("firstName", e.target.value)} aria-invalid={!!errors.firstName} />
          {errors.firstName && <p className="text-xs text-error-600">{errors.firstName.message}</p>}
        </Field>
        <Field>
          <Label>Nom <span className="text-error-500">*</span></Label>
          <Input value={v.lastName} onChange={(e) => setValue("lastName", e.target.value)} aria-invalid={!!errors.lastName} />
          {errors.lastName && <p className="text-xs text-error-600">{errors.lastName.message}</p>}
        </Field>
      </div>
      <Field>
        <Label>Email</Label>
        <Input value={v.email} onChange={(e) => setValue("email", e.target.value)} aria-invalid={!!errors.email} />
        {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
      </Field>
      <PhoneInput label="Téléphone" value={v.phone} onChange={(val) => setValue("phone", val)} />
      {errors.phone && <p className="text-xs text-error-600">{errors.phone.message}</p>}
      <p className="text-xs text-gray-400">Email ou téléphone requis (au moins l&apos;un des deux) — la connexion se fait par numéro de téléphone.</p>
      <Field>
        <Label>Mot de passe initial <span className="text-error-500">*</span></Label>
        <Input type="password" value={v.password} onChange={(e) => setValue("password", e.target.value)} aria-invalid={!!errors.password} />
        {errors.password && <p className="text-xs text-error-600">{errors.password.message}</p>}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          Créer
        </Button>
      </div>
    </form>
  );
}

// ── Edit form ───────────────────────────────────────────────────────────────
const editUserSchema = z.object({
  firstName: z.string().trim().min(1, "Requis"),
  lastName: z.string().trim().min(1, "Requis"),
  phone: z.string(),
  active: z.boolean(),
});
type EditUserFormValues = z.infer<typeof editUserSchema>;

function UserEditForm({ user, onCancel, onSaved }: { user: User; onCancel: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
      active: user.active,
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: EditUserFormValues) {
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
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Prénom <span className="text-error-500">*</span></Label>
          <Input value={v.firstName} onChange={(e) => setValue("firstName", e.target.value)} aria-invalid={!!errors.firstName} />
          {errors.firstName && <p className="text-xs text-error-600">{errors.firstName.message}</p>}
        </Field>
        <Field>
          <Label>Nom <span className="text-error-500">*</span></Label>
          <Input value={v.lastName} onChange={(e) => setValue("lastName", e.target.value)} aria-invalid={!!errors.lastName} />
          {errors.lastName && <p className="text-xs text-error-600">{errors.lastName.message}</p>}
        </Field>
      </div>
      <PhoneInput label="Téléphone" value={v.phone} onChange={(val) => setValue("phone", val)} />
      <div className="flex items-center gap-3">
        <Switch checked={v.active} onChange={(checked) => setValue("active", checked)} ariaLabel="Compte actif" />
        <span className="text-sm text-gray-700">Compte actif</span>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

// ── Password reset form ──────────────────────────────────────────────────────
function PasswordResetForm({
  user,
  onCancel,
  onDone,
}: {
  user: User;
  onCancel: () => void;
  onDone: (res: { username?: string; temporaryPassword?: string }, mustChange: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const chosen = password.trim().length > 0;
  const tooShort = chosen && password.trim().length < 8;

  async function submit() {
    if (tooShort) return;
    setLoading(true);
    try {
      // Mot de passe saisi → définitif ; vide → temporaire généré par le serveur.
      const res = await resetUserAccess(user.id, chosen ? password.trim() : undefined);
      onDone(res, res.mustChangePassword ?? !chosen);
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Définissez un nouveau mot de passe pour{" "}
        <span className="font-medium text-gray-900">{fullName(user)}</span>. Son ancien mot de passe et ses
        sessions actives seront révoqués.
      </p>
      <Field>
        <Label>Nouveau mot de passe</Label>
        <p className="text-xs text-gray-400">Laissez vide pour générer un mot de passe temporaire automatiquement.</p>
        <Input type="password" placeholder="8 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={tooShort} />
        {tooShort && <p className="text-xs text-error-600">8 caractères minimum</p>}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" loading={loading} onClick={submit} disabled={tooShort}>
          {chosen ? "Définir le mot de passe" : "Générer un mot de passe"}
        </Button>
      </div>
    </div>
  );
}

// ── Roles editor ─────────────────────────────────────────────────────────────
function UserRolesEditor({ user, roles }: { user: User; roles: Role[] }) {
  const rolesQuery = useQuery(() => getUserRoles(user.id), [user.id]);
  const [busy, setBusy] = useState<number | null>(null);
  // Comparé par id (pas par nom) : un rôle personnalisé peut porter le même libellé qu'un rôle
  // système (ex. deux rôles nommés « Comptable ») — comparer par nom faisait apparaître le mauvais
  // rôle comme attribué, rendant son retrait impossible en pratique.
  const assignedIds = new Set((rolesQuery.data ?? []).map((r) => r.id));

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
        const assigned = assignedIds.has(role.id);
        return (
          <div
            key={role.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{role.name}</p>
              {role.description && <p className="text-xs text-gray-500">{role.description}</p>}
            </div>
            <Button
              size="sm"
              variant={assigned ? "ghost" : "primary"}
              loading={busy === role.id}
              onClick={() => toggle(role, assigned)}
              className={assigned ? "text-error-600" : undefined}
            >
              {assigned ? "Retirer" : "Affecter"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ── Extra (direct) permissions editor ────────────────────────────────────────
function UserExtraPermissionsEditor({ user }: { user: User }) {
  const permsQuery = useQuery(() => listPermissions(), []);
  const directQuery = useQuery(() => getUserDirectPermissions(user.id), [user.id]);

  if (permsQuery.loading || directQuery.loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <PermissionMatrix
      key={user.id}
      initialSelectedIds={new Set((directQuery.data ?? []).map((p) => p.id))}
      permissions={permsQuery.data ?? []}
      loading={false}
      onSave={(ids) => setUserPermissions(user.id, ids)}
      onSaved={() => {
        notifySuccess("Permissions supplémentaires mises à jour. Elles seront rafraîchies à la prochaine connexion.");
        directQuery.refetch();
      }}
    />
  );
}
