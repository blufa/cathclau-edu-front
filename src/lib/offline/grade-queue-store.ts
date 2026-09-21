import { create } from "zustand";
import type { QueuedGradeEntry } from "./db";

interface GradeQueueState {
  /** Miroir en mémoire de la table Dexie `gradeQueue` — même pattern que les autres files
   * (paiements, inscriptions, enseignants, parents, présences). */
  items: QueuedGradeEntry[];
  syncing: boolean;
  setItems: (items: QueuedGradeEntry[]) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useGradeQueueStore = create<GradeQueueState>((set) => ({
  items: [],
  syncing: false,
  setItems: (items) => set({ items }),
  setSyncing: (syncing) => set({ syncing }),
}));
