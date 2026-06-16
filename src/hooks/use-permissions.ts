"use client";

import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { hasPermission, hasRole, isSuperAdmin } from "@/lib/auth/permissions";
import type { RoleCode } from "@/lib/types/enums";

/** Permission/role checks for the current user (RBAC). */
export function usePermissions() {
  const { user } = useAuth();
  return useMemo(
    () => ({
      user,
      roles: user?.roles ?? [],
      permissions: user?.permissions ?? [],
      /** True if the user holds the given `ressource:action` permission. */
      can: (permission: string) => hasPermission(user, permission),
      /** True if the user has any of the given roles. */
      hasRole: (...roles: RoleCode[]) => hasRole(user, ...roles),
      isSuperAdmin: isSuperAdmin(user),
    }),
    [user],
  );
}
