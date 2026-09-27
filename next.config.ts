import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// UNIQUEMENT le flag manuel `NEXT_OUTPUT_EXPORT=1`, posé par scripts/build-desktop.mjs (voir
// package.json → build:desktop) — jamais `TAURI_ENV_PLATFORM` : cette variable est posée par la CLI
// Tauri aussi bien pour `tauri build` QUE pour `tauri dev` (`beforeDevCommand`), et `output: "export"`
// interdit toute route dynamique dont l'id réel n'a pas été pré-généré (voir generateStaticParams
// "placeholder" sur students/[id] etc.) — un bug vécu en vrai : `npm run tauri:dev` plantait sur
// n'importe quelle fiche élève réelle (ex. /students/62) avec une 500 "missing param ... required with
// output: export", alors que le serveur de dev doit au contraire résoudre N'IMPORTE QUEL id librement.
const DESKTOP_BUILD = process.env.NEXT_OUTPUT_EXPORT === "1";

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
  // Sortie autonome pour une image Docker légère (server.js + assets nécessaires uniquement) côté
  // web/Hostinger ; export HTML/JS/CSS statique côté desktop, embarqué tel quel dans le binaire Tauri
  // (voir src-tauri/tauri.conf.json → build.frontendDist = "../out"). Les deux cibles partagent le
  // même code source Next.js, seule cette clé diffère.
  output: DESKTOP_BUILD ? "export" : "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Médias hébergés sur Cloudinary (photos élèves, logos…).
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    // `output: "export"` n'embarque pas de serveur d'optimisation d'image (pas de route /_next/image) —
    // sans ce flag, next/image casse silencieusement en mode desktop (image jamais chargée).
    unoptimized: DESKTOP_BUILD,
  },
  // Nécessaire en mode `export` : chaque route devient un fichier `xxx/index.html` sur disque : sans
  // slash final, Tauri (et tout serveur de fichiers statique) sert `xxx.html`, ce qui casse les chemins
  // relatifs des assets Next (`_next/...`) une fois ouvert directement depuis le disque.
  trailingSlash: DESKTOP_BUILD || undefined,
  // `redirects()` dépend d'un serveur Node (ou de Middleware) pour s'exécuter à la volée — silencieusement
  // ignoré par `output: "export"`. Inutile de le déclarer pour le build desktop : conservé uniquement
  // pour le web (favoris/liens historiques d'un site en ligne, sans objet dans une appli installée).
  ...(DESKTOP_BUILD
    ? {}
    : {
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
      }),
};

// @serwist/next attache toujours une clé `webpack()` à la config, même avec `disable: true` — or
// Turbopack (utilisé par défaut par `next dev`) refuse de démarrer dès qu'une config webpack est
// présente, qu'elle soit active ou non. On n'applique donc le plugin Serwist qu'en production
// (`next build --webpack` / `next start`), jamais en dev, où le service worker est de toute façon
// désactivé et inutile. Jamais non plus côté desktop : Tauri gère lui-même le hors-ligne via SQLite
// local (voir src/lib/offline/), un Service Worker PWA en plus serait redondant et pourrait mettre en
// cache des réponses API périmées à l'insu de la synchronisation nocturne.
export default process.env.NODE_ENV === "production" && !DESKTOP_BUILD ? withSerwist(nextConfig) : nextConfig;
