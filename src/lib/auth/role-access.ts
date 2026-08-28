import { NAVIGATION, type NavItem } from "@/config/navigation";
import type { AuthUser } from "@/lib/types/auth";
import type { RoleCode } from "@/lib/types/enums";
import { hasRole } from "./permissions";

interface RouteRoles {
  href: string;
  roles?: RoleCode[];
}

/** Aplatit la navigation en { href, roles } ; un enfant sans `roles` hérite de son parent (ex.
 * les sous-pages "Mon abonnement" qui ne portent le filtre que sur l'entrée de groupe). */
function flattenWithRoles(items: NavItem[], inherited?: RoleCode[]): RouteRoles[] {
  const out: RouteRoles[] = [];
  for (const item of items) {
    const roles = item.roles ?? inherited;
    if (item.href) out.push({ href: item.href, roles });
    if (item.children) out.push(...flattenWithRoles(item.children, roles));
  }
  return out;
}

const ROUTE_ROLES: RouteRoles[] = NAVIGATION.flatMap((section) => flattenWithRoles(section.items));

/**
 * Un chemin est autorisé pour l'utilisateur si aucune entrée de navigation ne le restreint
 * (page hors nav, ex. `/account` → accessible à tout utilisateur connecté), ou si son rôle
 * figure dans les `roles` de l'entrée la plus spécifique (préfixe le plus long) qui le couvre.
 *
 * C'est la même source de vérité (`NAVIGATION`) que l'affichage de la sidebar (`useNavGating`) :
 * un enseignant/élève qui navigue directement vers une URL admin (plutôt que via le menu, où le
 * lien est déjà masqué) est donc bloqué de la même façon — voir §1 RBAC du plan de refonte.
 */
export function isPathAllowedForUser(user: AuthUser | null, pathname: string): boolean {
  if (!user) return false;
  if (hasRole(user, "SUPER_ADMIN")) return true;
  // REDACTEUR est un compte plateforme sans tenant, strictement limité au blog — aucune page
  // tenant-scopée (dashboard, écoles, etc.) ne doit lui être accessible.
  if (hasRole(user, "REDACTEUR")) return pathname.startsWith("/platform/blog") || pathname === "/account";

  const candidates = ROUTE_ROLES.filter((r) => pathname === r.href || pathname.startsWith(`${r.href}/`));
  if (candidates.length === 0) return true;

  const match = candidates.reduce((best, r) => (r.href.length > best.href.length ? r : best));
  return !match.roles || hasRole(user, ...match.roles);
}

/** Route d'accueil de l'utilisateur — après connexion, et repli quand une page ne lui est pas destinée. */
export function roleHome(user: AuthUser | null): string {
  if (!user) return "/login";
  if (hasRole(user, "SUPER_ADMIN")) return "/platform/dashboard";
  if (hasRole(user, "REDACTEUR")) return "/platform/blog/posts";
  if (hasRole(user, "TEACHER")) return "/dashboard/enseignant";
  if (hasRole(user, "PARENT")) return "/children";
  if (hasRole(user, "STUDENT")) return "/my-results";
  return "/dashboard";
}
