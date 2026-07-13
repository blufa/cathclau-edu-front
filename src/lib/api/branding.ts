import { api } from "@/lib/api/client";

export interface TenantBranding {
  tenantId: number | null;
  schoolName: string | null;
  logo: string | null;
  brandColor: string | null;
  /** Devise de l'établissement, imprimée au verso des badges/cartes. */
  motto: string | null;
  /** Slogan de l'établissement, imprimé au verso des badges/cartes. */
  slogan: string | null;
}

export function getTenantBranding(): Promise<TenantBranding> {
  return api.get<TenantBranding>("/tenant/branding");
}

export function updateTenantBranding(input: { logo?: string | null; brandColor?: string | null }): Promise<TenantBranding> {
  return api.put<TenantBranding>("/tenant/branding", input);
}
