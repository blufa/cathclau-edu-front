"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useAuth } from "@/providers/auth-provider";
import { isNavItemAllowed, type RoleGate } from "@/lib/auth/permissions";
import { useNavGating } from "@/hooks/use-nav-gating";
import type { ModuleCode } from "@/config/navigation";
import { cn } from "@/lib/utils";

export interface RouteTab extends RoleGate {
  label: string;
  href: string;
  /** Grise l'onglet (cadenas) si ce module n'est pas actif pour le tenant — même logique que la sidebar. */
  module?: ModuleCode;
}

/**
 * Barre d'onglets pour un groupe de pages sœurs qui partageaient auparavant plusieurs liens sidebar
 * (voir §1 du plan de refonte admin). Reprend exactement la même logique de gating que la sidebar
 * (`useNavGating`) : un onglet caché/grisé ici l'est aussi dans le menu, jamais l'inverse.
 */
export function RouteTabs({ tabs }: { tabs: RouteTab[] }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isDisabled } = useNavGating();

  const visible = tabs.filter((t) => isNavItemAllowed(user, t));
  if (visible.length <= 1) return null;

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {visible.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const disabled = tab.module ? isDisabled({ label: tab.label, module: tab.module }) : false;

          if (disabled) {
            return (
              <Tooltip key={tab.href} label="Indisponible — période d'essai terminée ou module non inclus dans votre plan" position="top">
                <span className="flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-gray-300">
                  {tab.label}
                  <Lock className="h-3 w-3" />
                </span>
              </Tooltip>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
