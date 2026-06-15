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
  roles: string[];
  permissions: string[];
}

/** The authenticated user as held in the app context. */
export interface AuthUser {
  userId: number;
  tenantId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roles: string[];
  permissions: string[];
}
