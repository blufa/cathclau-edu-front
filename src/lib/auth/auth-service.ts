import { api } from "@/lib/api/client";
import { getRefreshToken, clearTokens, setTokens } from "@/lib/auth/tokens";
import type { LoginResponse, MeResponse } from "@/lib/types/auth";

/** Authenticate and persist the returned tokens. */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>("/auth/login", { email, password }, { auth: false });
  setTokens(res.accessToken, res.refreshToken);
  return res;
}

/** Fetch the current user's profile (identity, roles, permissions, tenant). */
export function fetchMe(): Promise<MeResponse> {
  return api.get<MeResponse>("/auth/me");
}

/** Revoke the refresh token server-side and clear local tokens. */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) await api.post<void>("/auth/logout", { refreshToken }, { auth: false });
  } catch {
    // Logout must always succeed client-side: ignore a failed/expired server revocation.
  } finally {
    clearTokens();
  }
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return api.post<{ message: string }>("/auth/password/forgot", { email }, { auth: false });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return api.post<void>("/auth/password/reset", { token, newPassword }, { auth: false });
}

/** Demande un code OTP par SMS pour réinitialiser le mot de passe — identifier : username, email ou
 * numéro de téléphone (mêmes formats que la connexion). */
export function requestPasswordResetOtp(identifier: string): Promise<{ message: string }> {
  return api.post<{ message: string }>("/auth/password/otp/request", { identifier }, { auth: false });
}

/** Réinitialise le mot de passe avec le code OTP reçu par SMS. */
export function resetPasswordWithOtp(identifier: string, code: string, newPassword: string): Promise<void> {
  return api.post<void>("/auth/password/otp/reset", { identifier, code, newPassword }, { auth: false });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return api.post<void>("/auth/password/change", { currentPassword, newPassword });
}
