"use client";

import { useState } from "react";
import { Switch } from "@mantine/core";
import { Calculator, Lock } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { listModuleCatalog, listTenantModules, presetTenantAccountingOnly, setTenantModuleActive } from "@/lib/api/platform";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

/** Effective modules of a tenant, with per-tenant activation overrides (module M). */
export function TenantModulesPanel({ tenantId }: { tenantId: number }) {
  const catalog = useQuery(() => listModuleCatalog(), []);
  const modules = useQuery(() => listTenantModules(tenantId), [tenantId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [presetting, setPresetting] = useState(false);

  const byCode = new Map((modules.data ?? []).map((m) => [m.moduleCode, m]));

  function applyAccountingOnly() {
    confirmAction({
      title: "Comptabilité seule",
      message:
        "Activer uniquement Comptabilité + Dépenses (et la gestion des utilisateurs), et désactiver tous les autres modules pour cette école ?",
      confirmLabel: "Appliquer",
      onConfirm: async () => {
        setPresetting(true);
        try {
          await presetTenantAccountingOnly(tenantId);
          notifySuccess("École passée en « comptabilité seule »");
          modules.refetch();
        } catch (err) {
          notifyError(err);
        } finally {
          setPresetting(false);
        }
      },
    });
  }

  async function toggle(code: string, on: boolean) {
    setBusy(code);
    try {
      await setTenantModuleActive(tenantId, code, on);
      notifySuccess("Modules de l'école mis à jour");
      modules.refetch();
    } catch (err) {
      notifyError(err); // 409 if a dependency is missing
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Modules de l&apos;école</CardTitle>
        <Button size="sm" variant="secondary" loading={presetting} onClick={applyAccountingOnly}
          leftSection={<Calculator className="h-4 w-4" />}>
          Comptabilité seule
        </Button>
      </CardHeader>
      <CardBody>
        {catalog.loading || modules.loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="space-y-2">
            {(catalog.data ?? []).map((m) => {
              const tm = byCode.get(m.code);
              const on = !!tm?.active;
              return (
                <div key={m.code} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{m.label}</span>
                      {m.premium && (
                        <Badge tone="amber">
                          <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Premium</span>
                        </Badge>
                      )}
                    </div>
                    {tm?.expirationDate && (
                      <p className="text-xs text-amber-600">Expire le {tm.expirationDate}</p>
                    )}
                  </div>
                  <Switch color="brand" checked={on} disabled={busy === m.code} onChange={(e) => toggle(m.code, e.currentTarget.checked)} />
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
