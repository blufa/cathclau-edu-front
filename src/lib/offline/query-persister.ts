import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { offlineDb } from "./db";

const STORAGE_KEY = "react-query-cache";

/**
 * Adaptateur de stockage async (IndexedDB via Dexie, `offlineDb.queryCache`) pour le persister React
 * Query — remplace le persister par défaut basé sur `localStorage` (capacité bien trop faible pour les
 * listes de factures/paiements d'une école entière, voir `db.ts`). Une seule entrée globale, comme le
 * ferait `localStorage` : React Query sérialise tout son cache en un seul blob JSON à chaque écriture.
 */
const dexieStorage = {
  async getItem(): Promise<string | null> {
    const entry = await offlineDb.queryCache.get(STORAGE_KEY);
    return entry?.value ?? null;
  },
  async setItem(_key: string, value: string): Promise<void> {
    await offlineDb.queryCache.put({ key: STORAGE_KEY, value });
  },
  async removeItem(): Promise<void> {
    await offlineDb.queryCache.delete(STORAGE_KEY);
  },
};

/**
 * Persiste tout le cache React Query (factures, paiements, reçus, transactions, classes, élèves,
 * dashboard…) dans IndexedDB — pour qu'un agent qui a consulté ces écrans en ligne les retrouve encore
 * après avoir coupé la connexion ou rafraîchi la page, sans attendre un nouvel appel réseau. Les
 * données restent affichées telles quelles jusqu'à `maxAge` ; React Query retente un rafraîchissement
 * réseau normalement dès que possible, sans jamais bloquer l'affichage du contenu déjà en cache (voir
 * `staleTime`/`retry` dans `lib/query.ts`, inchangés).
 */
export const queryPersister = createAsyncStoragePersister({
  storage: dexieStorage,
  key: STORAGE_KEY,
  // Assez long pour couvrir un cycle « je travaille hors-ligne toute la journée, je synchronise le
  // soir » sans perdre le cache entre deux sessions — pas une donnée de vérité, juste un affichage en
  // attendant un rafraîchissement réseau.
  throttleTime: 1_000,
});

export const QUERY_PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
