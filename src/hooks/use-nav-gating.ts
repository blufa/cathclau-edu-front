"use client";

import { usePathname } from "next/navigation";
import { NAVIGATION, type NavItem } from "@/config/navigation";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getActiveModules } from "@/lib/api/modules";
import { getLatestSubscription } from "@/lib/api/platform";

/**
 * Filtrage par rôle + verrouillage par module de la navigation — logique partagée entre la sidebar
 * et les barres d'onglets (`route-tabs.tsx`) pour qu'un onglet soit caché/grisé exactement comme le
 * serait le lien sidebar correspondant (voir §5 risque 1 du plan de refonte admin).
 */
export function useNavGating() {
  const { user } = useAuth();
  const pathname = usePathname();

  const isActive = (href?: string) => !!href && (pathname === href || pathname.startsWith(`${href}/`));
  const isItemActive = (item: NavItem): boolean =>
    isActive(item.href) || (item.children?.some((c) => isActive(c.href)) ?? false);

  // SUPER_ADMIN voit toute la navigation (tests & supervision) ; les autres rôles ne voient que
  // les sections que leurs rôles autorisent. Les sections vides sont retirées.
  const isSuperAdmin = hasRole(user, "SUPER_ADMIN");
  const filterItem = (item: NavItem): NavItem | null => {
    if (!isSuperAdmin && item.roles && !hasRole(user, ...item.roles)) return null;
    if (item.children?.length) {
      const kids = item.children.map(filterItem).filter((c): c is NavItem => c !== null);
      if (kids.length === 0) return null;
      return { ...item, children: kids };
    }
    return item;
  };
  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.map(filterItem).filter((i): i is NavItem => i !== null),
  })).filter((section) => section.items.length > 0);

  // Les entrées gated par module sont grisées quand le module n'est pas actif pour le tenant
  // (ex. essai terminé) ; un abonnement PENDING verrouille tous les modules fonctionnels.
  const modulesQuery = useQuery(() => getActiveModules(), []);
  const activeModules = modulesQuery.data ? new Set(modulesQuery.data) : null;

  const subQuery = useQuery(() => getLatestSubscription(), []);
  const paymentRequired = subQuery.data?.status === "PENDING";

  const isDisabled = (item: NavItem) => {
    if (!item.module) return false;
    if (paymentRequired) return true;
    // Pas encore chargé, ou aucun module provisionné (ex. seed sans lignes de module) : on affiche
    // les menus plutôt que de tout verrouiller — on ne grise que si l'ensemble actif est positivement connu.
    if (activeModules === null || activeModules.size === 0) return false;
    return !activeModules.has(item.module);
  };

  return { sections, isActive, isItemActive, isDisabled };
}
