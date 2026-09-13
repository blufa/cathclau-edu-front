"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { MAX_ROLE_TABS, MOBILE_TABS, type MobileTabItem } from "@/config/mobile-tabs";
import { useAuth } from "@/providers/auth-provider";
import { isNavItemAllowed } from "@/lib/auth/permissions";
import { roleHome } from "@/lib/auth/role-access";
import { useSidebarStore } from "@/lib/store/sidebar-store";
import { notifyInfo } from "@/lib/feedback";
import { cn } from "@/lib/utils";

function openGlobalSearch() {
  // Réutilise le raccourci ⌘K/Ctrl+K déjà écouté par GlobalSearch (header.tsx) plutôt que de
  // dupliquer un état d'ouverture partagé — un tap déclenche le même raccourci clavier.
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
}

/**
 * Barre d'onglets fixe en bas d'écran, uniquement sur mobile (même breakpoint que le tiroir de
 * navigation existant). Donne un accès direct aux 3-4 actions les plus fréquentes du rôle, plus un
 * onglet « Plus » qui ouvre le tiroir complet (utile en particulier pour le staff, qui a bien plus
 * de routes que ce qu'une barre d'onglets peut afficher).
 */
export function MobileTabBar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isMobileOpen = useSidebarStore((s) => s.isMobileOpen);
  const toggleMobileOpen = useSidebarStore((s) => s.toggleMobileOpen);

  const items = MOBILE_TABS.filter((item) => isNavItemAllowed(user, item)).slice(0, MAX_ROLE_TABS);

  function isActive(item: MobileTabItem): boolean {
    const href = item.action === "role-home" ? roleHome(user) : item.href;
    return !!href && (pathname === href || pathname.startsWith(`${href}/`));
  }

  function handleComingSoon(label: string) {
    notifyInfo(`« ${label} » arrive bientôt.`);
  }

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white sm:hidden",
        isMobileOpen && "hidden",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(item);
          const iconAndLabel = (
            <>
              <span className="relative">
                <item.icon className={cn("h-5 w-5", active ? "text-brand-600" : "text-gray-400")} />
                {item.comingSoon && (
                  <span className="absolute -right-1.5 -top-1 rounded-full bg-gray-300 px-1 text-[8px] font-semibold leading-tight text-white">
                    !
                  </span>
                )}
              </span>
              <span className={cn("text-[11px] font-medium", active ? "text-brand-600" : "text-gray-500")}>
                {item.label}
              </span>
            </>
          );
          const className = "flex flex-col items-center justify-center gap-1 py-2";

          if (item.comingSoon) {
            return (
              <button key={item.key} type="button" onClick={() => handleComingSoon(item.label)} className={className}>
                {iconAndLabel}
              </button>
            );
          }
          if (item.action === "open-search") {
            return (
              <button key={item.key} type="button" onClick={openGlobalSearch} className={className}>
                {iconAndLabel}
              </button>
            );
          }
          const href = item.action === "role-home" ? roleHome(user) : (item.href ?? "#");
          return (
            <Link key={item.key} href={href} className={className}>
              {iconAndLabel}
            </Link>
          );
        })}

        <button type="button" onClick={() => toggleMobileOpen()} className="flex flex-col items-center justify-center gap-1 py-2">
          <Menu className="h-5 w-5 text-gray-400" />
          <span className="text-[11px] font-medium text-gray-500">Plus</span>
        </button>
      </div>
    </nav>
  );
}
