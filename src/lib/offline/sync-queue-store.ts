import { create } from "zustand";
import type { QueuedGroupPayment } from "./db";

interface SyncQueueState {
  /** Miroir en mémoire de la table Dexie `paymentQueue`, pour un rendu réactif — la source de vérité
   * persistée reste Dexie ; ce store est rafraîchi après chaque écriture (voir sync-engine.ts). */
  items: QueuedGroupPayment[];
  syncing: boolean;
  setItems: (items: QueuedGroupPayment[]) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useSyncQueueStore = create<SyncQueueState>((set) => ({
  items: [],
  syncing: false,
  setItems: (items) => set({ items }),
  setSyncing: (syncing) => set({ syncing }),
}));
