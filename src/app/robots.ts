import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * L'espace applicatif authentifié ((app)) n'a pas de préfixe d'URL commun (les groupes de routes
 * Next.js n'affectent pas l'URL) : on ne peut donc pas le lister ici de façon fiable/maintenable.
 * Sa mise à l'écart des moteurs de recherche passe par un `noindex` explicite sur son layout
 * (voir src/app/(app)/layout.tsx) — la méthode recommandée par Google pour du contenu déjà
 * authentifié, plus robuste qu'un simple Disallow (qui n'empêche pas la désindexation d'une page
 * déjà connue).
 */
/** Pages transactionnelles/d'authentification sans aucune valeur de contenu — liste stable et
 * courte (contrairement à l'espace (app), qui n'a pas de préfixe commun, voir commentaire ci-dessus). */
const DISALLOWED = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/resend-verification",
  "/maintenance",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOWED },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
