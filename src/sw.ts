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
});

serwist.addEventListeners();
