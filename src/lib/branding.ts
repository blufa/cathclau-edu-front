/**
 * Tenant branding (nom, logo, couleur primaire). Centralisé ici pour être injecté
 * par tenant au login plus tard : la page de login d'un tenant expose son branding
 * en lecture publique côté backend. Tant que cet endpoint n'est pas branché, on
 * utilise les valeurs par défaut ci-dessous (couleur primaire = thème Mantine `indigo`).
 */
export interface Branding {
  appName: string;
  /** Single-letter mark shown when no logo URL is available. */
  logoLetter: string;
  logoUrl: string | null;
  /** Mantine color name used as primary. */
  primaryColor: string;
}

export const DEFAULT_BRANDING: Branding = {
  appName: "CathClau Edu",
  logoLetter: "C",
  logoUrl: null,
  primaryColor: "indigo",
};

/** Current branding. Will be derived from the tenant's public branding once wired. */
export function getBranding(): Branding {
  return DEFAULT_BRANDING;
}
