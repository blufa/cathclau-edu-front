import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  exclude: [/\.map$/],
  disable: process.env.NODE_ENV !== "production",
  // Page de secours hors-ligne (voir src/sw.ts, fallbacks.entries) : précachée explicitement car ce
  // n'est pas un asset buildé détecté automatiquement (fichier statique dans /public), sans quoi
  // matchPrecache() ne la trouverait jamais au moment de servir le fallback.
  additionalPrecacheEntries: [{ url: "/offline.html", revision: "1" }],
});

const nextConfig: NextConfig = {
  // Sortie autonome pour une image Docker légère (server.js + assets nécessaires uniquement).
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Médias hébergés sur Cloudinary (photos élèves, logos…).
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  // Filet de sécurité pour les anciennes URLs suite au regroupement du menu en onglets (refonte
  // admin) — favoris, historique navigateur, liens éventuellement non mis à jour ailleurs.
  async redirects() {
    return [
      { source: "/personnel", destination: "/teachers/staff", permanent: false },
      { source: "/report-cards", destination: "/grading/report-cards", permanent: false },
      { source: "/discipline", destination: "/student-life/discipline", permanent: false },
      { source: "/health", destination: "/student-life/health", permanent: false },
      { source: "/bank-reconciliation", destination: "/accounting/reconciliation", permanent: false },
      { source: "/petty-cash", destination: "/accounting/petty-cash", permanent: false },
      { source: "/grants", destination: "/budget/grants", permanent: false },
      { source: "/expenses", destination: "/budget/expenses", permanent: false },
      { source: "/announcements", destination: "/communications/announcements", permanent: false },
      { source: "/templates", destination: "/communications/templates", permanent: false },
      { source: "/roles", destination: "/users/roles", permanent: false },
      { source: "/webhooks", destination: "/biometric/webhooks", permanent: false },
      { source: "/fees", destination: "/invoices/fees", permanent: false },
      { source: "/billing-rules", destination: "/invoices/rules", permanent: false },
      { source: "/re-enrollment", destination: "/enrollments/re-enrollment", permanent: false },
      { source: "/enrollment-movements", destination: "/enrollments/movements", permanent: false },
      { source: "/dashboard/rentree", destination: "/enrollments/overview", permanent: false },
      // Session de caisse déplacée sous /payments (§retour comptable, point 27).
      { source: "/accounting/cashier-session", destination: "/payments/cashier-session", permanent: false },
      // Refonte du budget (§retour comptable, point 31) : /budget/expenses (catégories/fournisseurs/
      // dépenses à onglets) est remplacée par les fiches de dépense mensuelles, désormais sur /budget.
      { source: "/budget/expenses", destination: "/budget", permanent: false },
    ];
  },
};

// @serwist/next attache toujours une clé `webpack()` à la config, même avec `disable: true` — or
// Turbopack (utilisé par défaut par `next dev`) refuse de démarrer dès qu'une config webpack est
// présente, qu'elle soit active ou non. On n'applique donc le plugin Serwist qu'en production
// (`next build --webpack` / `next start`), jamais en dev, où le service worker est de toute façon
// désactivé et inutile.
export default process.env.NODE_ENV === "production" ? withSerwist(nextConfig) : nextConfig;
