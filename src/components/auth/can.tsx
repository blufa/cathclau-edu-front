"use client";

import { usePermissions } from "@/hooks/use-permissions";
import type { RoleCode } from "@/lib/types/enums";

interface CanProps {
  /** Required `ressource:action` permission. */
  permission?: string;
  /** Allowed roles (any match). */
  role?: RoleCode[];
  /** Rendered when the user lacks access. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's permissions/roles.
 * <Can permission="eleve:create">…</Can> or <Can role={["SCHOOL_ADMIN"]}>…</Can>.
 */
export function Can({ permission, role, fallback = null, children }: CanProps) {
  const { can, hasRole } = usePermissions();
  const allowed = (!permission || can(permission)) && (!role || hasRole(...role));
  return <>{allowed ? children : fallback}</>;
}
