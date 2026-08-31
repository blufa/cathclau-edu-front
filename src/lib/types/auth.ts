/** Auth contracts mirrored from the backend iam module. */

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: number;
  tenantId: number | null;
  roles: string[];
}

export interface MeResponse {
  userId: number;
  tenantId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  photo: string | null;
  roles: string[];
  permissions: string[];
}

/** The authenticated user as held in the app context. `phone`/`photo` sont éventuellement fusionnés
 * depuis la fiche métier du rôle (Parent/Student/Teacher) — voir `auth-provider.tsx`. */
export interface AuthUser {
  userId: number;
  tenantId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  photo: string | null;
  roles: string[];
  permissions: string[];
}
