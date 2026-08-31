"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { splitPermission, type Permission } from "@/lib/types/iam";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { notifyError } from "@/lib/feedback";

/**
 * Sélecteur de permissions (resource × action), groupé par ressource. Générique : ne connaît que la
 * sélection initiale et une fonction de sauvegarde — réutilisé pour les permissions d'un rôle
 * (users/roles/page.tsx) et les octrois directs à un utilisateur, en plus de son rôle (users/page.tsx).
 */
export function PermissionMatrix({
  initialSelectedIds,
  permissions,
  loading,
  onSave,
  onSaved,
}: {
  initialSelectedIds: Set<number>;
  permissions: Permission[];
  loading: boolean;
  onSave: (ids: number[]) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialSelectedIds));
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
      await onSave([...selected]);
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
