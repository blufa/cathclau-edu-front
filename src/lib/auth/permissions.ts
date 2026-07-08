import type { AuthUser } from "@/lib/types/auth";
import type { RoleCode } from "@/lib/types/enums";

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

export function isSuperAdmin(user: AuthUser | null): boolean {
  return hasRole(user, "SUPER_ADMIN");
}
