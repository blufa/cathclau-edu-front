/** Site-wide constants for SEO (metadataBase, sitemap, robots, JSON-LD, OG/canonical URLs). */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "CathClau Edu";
export const SITE_DESCRIPTION =
  "CathClau Edu — plateforme de gestion d'établissements scolaires en Guinée : élèves, notes, présences, paiements et communication école-parents.";
