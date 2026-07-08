"use client";

import { Menu } from "@mantine/core";
import { Building2, ChevronDown } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { searchTenants } from "@/lib/api/platform";

/**
 * SUPER_ADMIN-only school switcher. Picking a school impersonates it (X-Tenant-Id) so every
 * tenant-scoped page operates on that school for testing/support. "Plateforme" clears it.
 */
export function TenantImpersonation() {
  const { user, impersonatedTenantId, setImpersonatedTenant } = useAuth();
  const isSuper = hasRole(user, "SUPER_ADMIN");
  const q = useQuery(
    () => (isSuper ? searchTenants({ page: 0, size: 100 }).then((p) => p.content) : Promise.resolve([])),
    [isSuper],
  );

  if (!isSuper) return null;

  const tenants = q.data ?? [];
  const current = tenants.find((t) => t.id === impersonatedTenantId);

  function choose(id: number | null) {
    setImpersonatedTenant(id);
    // Reload so every cached query refetches under the new tenant scope.
    window.location.reload();
  }

  return (
    <Menu position="bottom-start" width={260} withinPortal>
      <Menu.Target>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          <Building2 className="h-4 w-4" />
          <span className="hidden max-w-[160px] truncate sm:inline">{current ? current.schoolName : "Plateforme"}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Opérer en tant qu&apos;école</Menu.Label>
        <Menu.Item onClick={() => choose(null)} fw={impersonatedTenantId == null ? 700 : 400}>
          Plateforme (aucune école)
        </Menu.Item>
        <Menu.Divider />
        {tenants.length === 0 && <Menu.Item disabled>Aucune école</Menu.Item>}
        {tenants.map((t) => (
          <Menu.Item key={t.id} onClick={() => choose(t.id)} fw={t.id === impersonatedTenantId ? 700 : 400}>
            {t.schoolName}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
