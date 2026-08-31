import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * Web app manifest (installabilité mobile / "Ajouter à l'écran d'accueil"), généré à
 * /manifest.webmanifest. Réutilise l'icône carrée déjà présente (src/app/icon.png, 256x256).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Gestion scolaire`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1e4fa8",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
    ],
  };
}
