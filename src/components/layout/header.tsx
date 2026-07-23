"use client";

import { useRouter } from "next/navigation";
import { Menu, ChevronDown } from "lucide-react";
import { Dropdown, DropdownDivider, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { useSidebarStore } from "@/lib/store/sidebar-store";
import { notifyError } from "@/lib/feedback";
import { getBranding } from "@/lib/branding";
import { GlobalSearch } from "./global-search";
import { NotificationsMenu } from "./notifications-menu";
import { TenantImpersonation } from "./tenant-impersonation";

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const toggleMobileOpen = useSidebarStore((s) => s.toggleMobileOpen);
  const branding = getBranding();
  const tenantBranding = useBranding().branding;

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?"
    : "?";

  async function handleLogout() {
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      notifyError(err, "Déconnexion impossible");
    }
  }

  return (
    <div className="flex h-full items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
      {/* Left: burger + brand */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => toggleMobileOpen()}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 sm:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {tenantBranding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantBranding.logo} alt="logo" className="h-8 w-8 rounded-xl object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white shadow-sm shadow-brand-500/30">
              {branding.logoLetter}
            </div>
          )}
          <span className="hidden text-lg font-bold text-gray-900 sm:block">
            {tenantBranding?.schoolName ?? branding.appName}
          </span>
        </div>
      </div>

      {/* Center: global search */}
      <div className="mx-2 hidden flex-1 justify-center md:flex">
        <GlobalSearch />
      </div>

      {/* Right: notifications + profile */}
      <div className="flex items-center gap-2.5">
        <TenantImpersonation />
        <div className="md:hidden">
          <GlobalSearch />
        </div>
        <NotificationsMenu />

        <Dropdown
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-gray-100"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {initials}
              </span>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold leading-tight text-gray-900">
                  {user ? `${user.firstName} ${user.lastName}` : ""}
                </p>
                <p className="text-xs text-gray-400">{user?.roles.join(", ")}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
            </button>
          )}
        >
          <DropdownLabel>{user?.email}</DropdownLabel>
          <DropdownItem onClick={() => router.push("/account")}>Mon compte</DropdownItem>
          <DropdownDivider />
          <DropdownItem danger onClick={handleLogout}>
            Déconnexion
          </DropdownItem>
        </Dropdown>
      </div>
    </div>
  );
}
