"use client";

import { useMemo, useState } from "react";
import { Stack, TextInput, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Check, Lock, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  setRolePermissions,
  updateRole,
} from "@/lib/api/iam";
import { isSystemRole, splitPermission, type Permission, type Role, type RoleInput } from "@/lib/types/iam";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { CardSpotlight } from "@/components/ui/aceternity";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export default function RolesPage() {
  const { user } = useAuth();
  const allowed = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

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
            role={permRole}
            permissions={permsQuery.data ?? []}
            loading={permsQuery.loading}
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
  const form = useForm<RoleInput>({
    mode: "controlled",
    initialValues: { name: initial?.name ?? "", description: initial?.description ?? "" },
    validate: { name: (v) => (v && v.trim() ? null : "Nom requis") },
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
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Nom du rôle" withAsterisk {...form.getInputProps("name")} />
        <Textarea label="Description" autosize minRows={2} {...form.getInputProps("description")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
        </div>
      </Stack>
    </form>
  );
}

// ── Permission matrix (resource × action) ────────────────────────────────────
function PermissionMatrix({
  role,
  permissions,
  loading,
  onSaved,
}: {
  role: Role;
  permissions: Permission[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(role.permissions.map((p) => p.id)),
  );
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const { resource } = splitPermission(p.code);
      if (!map.has(resource)) map.set(resource, []);
      map.get(resource)!.push(p);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleResource(perms: Permission[], allOn: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (allOn) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await setRolePermissions(role.id, [...selected]);
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
        {grouped.map(([resource, perms]) => {
          const allOn = perms.every((p) => selected.has(p.id));
          return (
            <div key={resource} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold capitalize text-slate-900">{resource}</h4>
                <button
                  type="button"
                  onClick={() => toggleResource(perms, allOn)}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  {allOn ? "Tout décocher" : "Tout cocher"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {perms.map((p) => {
                  const on = selected.has(p.id);
                  const { action } = splitPermission(p.code);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                        on
                          ? "border-brand-300 bg-brand-50 text-brand-800"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                          on ? "bg-brand-600 text-white" : "border border-slate-300"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="font-mono">{action || p.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">{selected.size} permission(s) sélectionnée(s)</span>
        <Button onClick={save} loading={saving}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
