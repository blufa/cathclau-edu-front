import type { AuthUser } from "@/lib/types/auth";
import type { RoleCode } from "@/lib/types/enums";

/** Shape shared by NavItem (config/navigation.ts) and any route-role descriptor derived from it —
 * kept here (not in navigation.ts) so this file has no dependency on the nav config. */
export interface RoleGate {
  roles?: RoleCode[];
  permissions?: string[];
  excludeRoles?: RoleCode[];
}

/** Strips a Spring "ROLE_" prefix so role checks work regardless of how the backend serializes them. */
function normalize(role: string): string {
  return role.startsWith("ROLE_") ? role.slice(5) : role;
}

export function hasRole(user: AuthUser | null, ...roles: RoleCode[]): boolean {
  if (!user) return false;
  const owned = new Set(user.roles.map(normalize));
  // SUPER_ADMIN is all-powerful (incl. when impersonating a school): it satisfies every role check.
  if (owned.has("SUPER_ADMIN")) return true;
  return roles.some((r) => owned.has(r));
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return !!user && user.permissions.includes(permission);
}

/** True if the user holds at least one of the given permissions — used for nav/route gating so a
 * role built entirely from the permissions catalogue (no fixed role code) still sees its menus. */
export function hasAnyPermission(user: AuthUser | null, permissions: string[]): boolean {
  return !!user && permissions.some((p) => user.permissions.includes(p));
}

export function isSuperAdmin(user: AuthUser | null): boolean {
  return hasRole(user, "SUPER_ADMIN");
}

/** SCHOOL_ADMIN et SUPER_ADMIN n'ont pas à ouvrir de caisse pour encaisser/dépenser — le rituel
 * ouverture/clôture (rapprochement comptant physique vs système) vise le personnel de guichet, pas
 * la direction qui encaisse occasionnellement en direct (demande utilisateur, "il ne faut pas lui
 * bloquer"). Même règle côté backend, voir PaymentService.requireOpenCashierSession. */
export function isExemptFromCashierGate(user: AuthUser | null): boolean {
  return hasRole(user, "SCHOOL_ADMIN");
}

/** Single source of truth for "can this user see/reach this nav item or route?" — used by the
 * sidebar (useNavGating), the direct-URL guard and post-login redirect (role-access.ts), the
 * command palette (global-search.tsx) and the tab bar (route-tabs.tsx), so a role's visibility is
 * consistent everywhere rather than re-implemented per component. SUPER_ADMIN always passes. */
export function isNavItemAllowed(user: AuthUser | null, gate: RoleGate): boolean {
  if (isSuperAdmin(user)) return true;
  if (gate.excludeRoles && hasRole(user, ...gate.excludeRoles)) return false;
  if (!gate.roles && !gate.permissions) return true;
  return (!!gate.roles && hasRole(user, ...gate.roles))
      || (!!gate.permissions && hasAnyPermission(user, gate.permissions));
}
