"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  setRolePermissions,
  updateRole,
} from "@/lib/api/iam";
import { isSystemRole, type Role, type RoleInput } from "@/lib/types/iam";
import { PermissionMatrix } from "@/components/iam/permission-matrix";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Reveal } from "@/components/public/reveal";
import { CardSpotlight } from "@/components/ui/aceternity";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export default function RolesPage() {
  const { user } = useAuth();
  const allowed = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["role:read"]);

  const rolesQuery = useQuery(() => listRoles(), []);
  const permsQuery = useQuery(() => listPermissions(), []);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [permRole, setPermRole] = useState<Role | null>(null);

  if (!allowed) {
    return (
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Accès réservé aux administrateurs de l&apos;école.
      </div>
    );
  }

  function handleDelete(role: Role) {
    confirmAction({
      title: "Supprimer le rôle",
      message: `Supprimer le rôle « ${role.name} » ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteRole(role.id);
          notifySuccess("Rôle supprimé");
          rolesQuery.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  const roles = rolesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rôles & permissions</h1>
          <p className="text-sm text-slate-500">Définissez qui peut faire quoi dans l&apos;établissement</p>
        </div>
        <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>
          Nouveau rôle
        </Button>
      </Reveal>

      {rolesQuery.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Impossible de charger les rôles.</p>
      ) : rolesQuery.loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const system = isSystemRole(role);
            return (
              <CardSpotlight key={role.id} className="p-5">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  {system ? (
                    <Badge tone="gray">
                      <span className="inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Système
                      </span>
                    </Badge>
                  ) : (
                    <Badge tone="indigo">Personnalisé</Badge>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{role.name}</h3>
                <p className="mt-1 min-h-[2.5rem] text-sm text-slate-500">
                  {role.description ?? "—"}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {role.permissions.length} permission{role.permissions.length > 1 ? "s" : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setPermRole(role)}>
                    Permissions
                  </Button>
                  {!system && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(role)}>
                        Modifier
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(role)}>
                        Suppr.
                      </Button>
                    </>
                  )}
                </div>
              </CardSpotlight>
            );
          })}
        </div>
      )}

      {/* Create */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau rôle">
        <RoleForm
          submitLabel="Créer"
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            await createRole(input);
            setCreating(false);
            notifySuccess("Rôle créé");
            rolesQuery.refetch();
          }}
        />
      </Modal>

      {/* Edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier le rôle">
        {editing && (
          <RoleForm
            initial={editing}
            submitLabel="Enregistrer"
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              await updateRole(editing.id, input);
              setEditing(null);
              notifySuccess("Rôle mis à jour");
              rolesQuery.refetch();
            }}
          />
        )}
      </Modal>

      {/* Permission matrix */}
      <Modal open={!!permRole} onClose={() => setPermRole(null)} title={`Permissions — ${permRole?.name ?? ""}`}>
        {permRole && (
          <PermissionMatrix
            key={permRole.id}
            initialSelectedIds={new Set(permRole.permissions.map((p) => p.id))}
            permissions={permsQuery.data ?? []}
            loading={permsQuery.loading}
            onSave={(ids) => setRolePermissions(permRole.id, ids)}
            onSaved={() => {
              setPermRole(null);
              notifySuccess("Permissions enregistrées");
              rolesQuery.refetch();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Role create/edit form ────────────────────────────────────────────────────
function RoleForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Role;
  submitLabel: string;
  onSubmit: (input: RoleInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const schema = z.object({
    name: z.string().trim().min(1, "Nom requis"),
    description: z.string().nullable().optional(),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleInput>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? "", description: initial?.description ?? "" },
  });

  async function submit(values: RoleInput) {
    setLoading(true);
    try {
      await onSubmit(values);
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label htmlFor="name">
          Nom du rôle <span className="text-error-500">*</span>
        </Label>
        <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && <p className="text-xs text-error-600">{errors.name.message}</p>}
      </Field>
      <Field>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} {...register("description")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

