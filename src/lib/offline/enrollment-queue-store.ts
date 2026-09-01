import { create } from "zustand";
import type { QueuedEnrollment } from "./db";

interface EnrollmentQueueState {
  /** Miroir en mémoire de la table Dexie `enrollmentQueue` — même pattern que sync-queue-store.ts
   * (paiements). La source de vérité persistée reste Dexie ; rafraîchi après chaque écriture. */
  items: QueuedEnrollment[];
  syncing: boolean;
  setItems: (items: QueuedEnrollment[]) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useEnrollmentQueueStore = create<EnrollmentQueueState>((set) => ({
  items: [],
  syncing: false,
  setItems: (items) => set({ items }),
  setSyncing: (syncing) => set({ syncing }),
}));
