"use client";

import { Building2, ChevronDown, Check } from "lucide-react";
import { Dropdown, DropdownDivider, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
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
    <Dropdown
      align="start"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          <Building2 className="h-4 w-4" />
          <span className="hidden max-w-[160px] truncate sm:inline">{current ? current.schoolName : "Plateforme"}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
    >
      <DropdownLabel>Opérer en tant qu&apos;école</DropdownLabel>
      <DropdownItem onClick={() => choose(null)} active={impersonatedTenantId == null}>
        {impersonatedTenantId == null && <Check className="h-3.5 w-3.5" />}
        Plateforme (aucune école)
      </DropdownItem>
      <DropdownDivider />
      {tenants.length === 0 && <DropdownItem disabled>Aucune école</DropdownItem>}
      {tenants.map((t) => (
        <DropdownItem key={t.id} onClick={() => choose(t.id)} active={t.id === impersonatedTenantId}>
          {t.id === impersonatedTenantId && <Check className="h-3.5 w-3.5" />}
          {t.schoolName}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
