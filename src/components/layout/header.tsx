"use client";

import { useRouter } from "next/navigation";
import { Burger, Group, Menu, Text } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { notifyError } from "@/lib/feedback";
import { getBranding } from "@/lib/branding";
import { GlobalSearch } from "./global-search";
import { NotificationsMenu } from "./notifications-menu";
import { TenantImpersonation } from "./tenant-impersonation";

export function Header({ navOpened, onToggleNav }: { navOpened: boolean; onToggleNav: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
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
    <Group h="100%" px="md" justify="space-between" wrap="nowrap" className="border-b border-slate-200 bg-white">
      {/* Left: burger + brand */}
      <Group gap="sm" wrap="nowrap">
        <Burger opened={navOpened} onClick={onToggleNav} hiddenFrom="sm" size="sm" />
        <Group gap="xs" wrap="nowrap">
          {tenantBranding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantBranding.logo} alt="logo" className="h-8 w-8 rounded-xl object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white shadow-sm shadow-brand-500/30">
              {branding.logoLetter}
            </div>
          )}
          <Text fw={700} size="lg" className="hidden sm:block">
            {tenantBranding?.schoolName ?? branding.appName}
          </Text>
        </Group>
      </Group>

      {/* Center: global search */}
      <div className="mx-2 hidden flex-1 justify-center md:flex">
        <GlobalSearch />
      </div>

      {/* Right: notifications + profile */}
      <Group gap="sm" wrap="nowrap">
        <TenantImpersonation />
        <div className="md:hidden">
          <GlobalSearch />
        </div>
        <NotificationsMenu />

        <Menu position="bottom-end" withArrow shadow="md" radius="lg">
          <Menu.Target>
            <button type="button" className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-slate-100">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--color-brand-600)" }}
              >
                {initials}
              </span>
              <div className="hidden text-left sm:block">
                <Text size="sm" fw={600} lh={1.1}>
                  {user ? `${user.firstName} ${user.lastName}` : ""}
                </Text>
                <Text size="xs" c="dimmed">
                  {user?.roles.join(", ")}
                </Text>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{user?.email}</Menu.Label>
            <Menu.Item onClick={() => router.push("/account")}>Mon compte</Menu.Item>
            <Menu.Item color="red" onClick={handleLogout}>
              Déconnexion
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
