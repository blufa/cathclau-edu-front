import { create } from "zustand";
import type { QueuedParent } from "./db";

interface ParentQueueState {
  /** Miroir en mémoire de la table Dexie `parentQueue` — même pattern que les autres stores offline. */
  items: QueuedParent[];
  syncing: boolean;
  setItems: (items: QueuedParent[]) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useParentQueueStore = create<ParentQueueState>((set) => ({
  items: [],
  syncing: false,
  setItems: (items) => set({ items }),
  setSyncing: (syncing) => set({ syncing }),
}));
