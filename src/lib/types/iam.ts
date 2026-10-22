/** IAM contracts mirrored from the backend iam module (users, roles, permissions). */

export interface User {
  id: number;
  tenantId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  photo: string | null;
  active: boolean;
  lastLoginAt: string | null;
  /** Dernière requête authentifiée reçue (§14 cahier des charges) — throttlée à la minute, jamais une
   * heure de déconnexion explicite. Permet de dériver une durée de session approximative avec
   * lastLoginAt (voir sessionDuration dans lib/format.ts), sans jamais en inventer une. */
  lastActivityAt: string | null;
  createdAt: string | null;
}

export interface Permission {
  id: number;
  name: string;
  /** Format `resource:action`, e.g. `eleve:create`, `note:read`. */
  code: string;
}

export interface Role {
  id: number;
  name: string;
  /** Non-null for system roles (SCHOOL_ADMIN, …); null for tenant-defined custom roles. */
  code: string | null;
  description: string | null;
  permissions: Permission[];
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  /** Optionnel : tous les utilisateurs se connectent par numéro de téléphone — l'email n'est qu'un
   * canal optionnel supplémentaire pour recevoir les identifiants. Au moins l'un des deux (email ou
   * phone) reste exigé côté backend. */
  email?: string | null;
  password: string;
  phone?: string | null;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  active?: boolean;
}

export interface RoleInput {
  name: string;
  description?: string | null;
}

/** A system role is built-in and cannot be deleted/renamed; identified by a non-null code. */
export function isSystemRole(role: Role): boolean {
  return role.code != null;
}

/** Splits a `resource:action` permission code into its two parts. */
export function splitPermission(code: string): { resource: string; action: string } {
  const [resource, action = ""] = code.split(":");
  return { resource, action };
}
