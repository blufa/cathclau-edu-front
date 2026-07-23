"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  addPlanModule,
  listModuleCatalog,
  listPlanModules,
  setPlanModuleActive,
} from "@/lib/api/platform";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { notifyError, notifySuccess } from "@/lib/feedback";

/** Manage the modules included in a plan (module M). */
export function PlanModulesModal({
  planId,
  planName,
  open,
  onClose,
}: {
  planId: number | null;
  planName: string;
  open: boolean;
  onClose: () => void;
}) {
  const catalog = useQuery(() => listModuleCatalog(), []);
  const modules = useQuery(
    () => (planId ? listPlanModules(planId) : Promise.resolve([])),
    [planId],
  );
  const [busy, setBusy] = useState<string | null>(null);

  const activeSet = new Set((modules.data ?? []).filter((m) => m.active).map((m) => m.moduleCode));

  async function toggle(code: string, on: boolean) {
    if (!planId) return;
    setBusy(code);
    try {
      if (on) await addPlanModule(planId, code);
      else await setPlanModuleActive(planId, code, false);
      notifySuccess("Modules du plan mis à jour");
      modules.refetch();
    } catch (err) {
      notifyError(err); // 409 if a dependency is missing
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Modules — ${planName}`}>
      {catalog.loading || modules.loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {(catalog.data ?? []).map((m) => {
            const on = activeSet.has(m.code);
            return (
              <div key={m.code} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{m.label}</span>
                    {m.premium && (
                      <Badge tone="amber">
                        <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Premium</span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {m.code}
                    {m.dependencies.length > 0 && ` · requiert ${m.dependencies.join(", ")}`}
                  </p>
                </div>
                <Switch
                  checked={on}
                  disabled={busy === m.code}
                  onChange={(checked) => toggle(m.code, checked)}
                  ariaLabel={m.label}
                />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
