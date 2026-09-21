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
  /** Inspection régionale de l'éducation, imprimée au verso des badges/cartes. */
  ire: string | null;
  /** Direction préfectorale ou communale de l'éducation (DPE/DCE), imprimée au verso des badges/cartes. */
  dpeLabel: string | null;
  /** Sous-préfecture / commune (DSSEE), imprimée au verso des badges/cartes. */
  sousPrefectureLabel: string | null;
  /** Numéro de téléphone de l'école, imprimé sur les badges élève (contact en cas de besoin). */
  phone: string | null;
}

export function getTenantBranding(): Promise<TenantBranding> {
  return api.get<TenantBranding>("/tenant/branding");
}

export function updateTenantBranding(input: { logo?: string | null; brandColor?: string | null }): Promise<TenantBranding> {
  return api.put<TenantBranding>("/tenant/branding", input);
}
