import { defaultCache } from "@serwist/next/worker";
import { NetworkOnly, Serwist } from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Toute requête vers l'API (même origine ou l'API backend Spring Boot sur un autre sous-domaine)
 * ne doit jamais être interceptée/mise en cache par le service worker : TanStack Query gère déjà
 * son propre cache mémoire côté client, et src/lib/offline/ gère déjà la file d'attente et le
 * rejeu des mutations hors-ligne. Le SW se limite au cache de l'app-shell (JS/CSS/images/pages).
 * Placé en premier car Serwist essaie les matchers dans l'ordre et s'arrête au premier qui matche.
 */
const apiPassthrough: RuntimeCaching = {
  matcher: ({ url }) => url.pathname.includes("/api/"),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiPassthrough, ...defaultCache],
  // Page blanche au rechargement hors-ligne (§retour comptable, point 14) : les pages Next.js sont
  // mises en cache à l'exécution (NetworkFirst, voir defaultCache) au fil de la navigation — mais
  // une page jamais visitée en ligne, ou dont le cache a expiré, n'a rien à servir une fois hors
  // ligne, et jusqu'ici l'échec réseau remontait tel quel (page blanche). Cette page de secours
  // s'affiche à la place pour toute requête de NAVIGATION (rechargement/URL tapée) sans réponse
  // disponible — pas pour les appels API (passthrough ci-dessus, jamais concerné) ni pour les
  // requêtes RSC de navigation interne (déjà gérées par le routeur applicatif).
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher: ({ request }) => request.mode === "navigate",
      },
    ],
  },
});

serwist.addEventListeners();
