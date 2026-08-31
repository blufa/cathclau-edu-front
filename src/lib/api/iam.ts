import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type {
  CreateUserInput,
  Permission,
  Role,
  RoleInput,
  UpdateUserInput,
  User,
} from "@/lib/types/iam";

// ── Users ────────────────────────────────────────────────────────────────
export function listUsers(page = 0, size = 20): Promise<Page<User>> {
  return api.get<Page<User>>("/users", { query: { page, size } });
}

/** Profil de l'utilisateur connecté (module iam). */
export function getCurrentUser(): Promise<User> {
  return api.get<User>("/users/me");
}

/** Réinitialise l'accès d'un utilisateur (nouveau mot de passe temporaire). */
/**
 * Réinitialise l'accès d'un utilisateur. Si {@code password} est fourni, il devient le nouveau mot de
 * passe (définitif) ; sinon un mot de passe temporaire est généré (à changer à la 1re connexion).
 */
export function resetUserAccess(
  id: number,
  password?: string,
): Promise<{ username?: string; temporaryPassword?: string; mustChangePassword?: boolean }> {
  return api.post<{ username?: string; temporaryPassword?: string; mustChangePassword?: boolean }>(
    `/users/${id}/reset-access`,
    password && password.trim() ? { password: password.trim() } : undefined,
  );
}

export function createUser(input: CreateUserInput): Promise<User> {
  return api.post<User>("/users", input);
}

/** Creates a login account and assigns it the given role (by code, e.g. "PARENT", "TEACHER"). */
export async function createUserWithRole(input: CreateUserInput, roleCode: string): Promise<User> {
  const user = await createUser(input);
  const roles = await listRoles();
  const role = roles.find((r) => (r.code ?? "").toUpperCase() === roleCode.toUpperCase());
  if (role) await assignRoleToUser(user.id, role.id);
  return user;
}

export function updateUser(id: number, input: UpdateUserInput): Promise<User> {
  return api.put<User>(`/users/${id}`, input);
}

export function activateUser(id: number): Promise<void> {
  return api.patch<void>(`/users/${id}/activate`);
}

export function deactivateUser(id: number): Promise<void> {
  return api.patch<void>(`/users/${id}/deactivate`);
}

export function deleteUser(id: number): Promise<void> {
  return api.delete<void>(`/users/${id}`);
}

/** Role names currently assigned to a user. */
export function getUserRoles(id: number): Promise<string[]> {
  return api.get<string[]>(`/users/${id}/roles`);
}

export function assignRoleToUser(userId: number, roleId: number): Promise<void> {
  return api.post<void>(`/users/${userId}/roles`, undefined, { query: { roleId } });
}

export function removeRoleFromUser(userId: number, roleId: number): Promise<void> {
  return api.delete<void>(`/users/${userId}/roles/${roleId}`);
}

// ── Roles & permissions ──────────────────────────────────────────────────
export function listRoles(): Promise<Role[]> {
  return api.get<Role[]>("/roles");
}

export function createRole(input: RoleInput): Promise<Role> {
  return api.post<Role>("/roles", input);
}

export function updateRole(id: number, input: RoleInput): Promise<Role> {
  return api.put<Role>(`/roles/${id}`, input);
}

export function deleteRole(id: number): Promise<void> {
  return api.delete<void>(`/roles/${id}`);
}

export function listPermissions(): Promise<Permission[]> {
  return api.get<Permission[]>("/permissions");
}

/** Replaces the role's permission set with the given permission IDs. */
export function setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
  return api.post<void>(`/roles/${roleId}/permissions`, { permissionIds });
}

/** Permissions octroyées directement à l'utilisateur, en plus de celles héritées de son rôle. */
export function getUserDirectPermissions(userId: number): Promise<Permission[]> {
  return api.get<Permission[]>(`/users/${userId}/permissions`);
}

/** Remplace les permissions octroyées directement à l'utilisateur (n'affecte pas celles du rôle). */
export function setUserPermissions(userId: number, permissionIds: number[]): Promise<void> {
  return api.post<void>(`/users/${userId}/permissions`, { permissionIds });
}
