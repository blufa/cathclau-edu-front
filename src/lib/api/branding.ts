import { api } from "@/lib/api/client";

export interface TenantBranding {
  tenantId: number | null;
  schoolName: string | null;
  logo: string | null;
  brandColor: string | null;
}

export function getTenantBranding(): Promise<TenantBranding> {
  return api.get<TenantBranding>("/tenant/branding");
}

export function updateTenantBranding(input: { logo?: string | null; brandColor?: string | null }): Promise<TenantBranding> {
  return api.put<TenantBranding>("/tenant/branding", input);
}
