import { create } from "zustand";
import type { QueuedTeacherUpdate } from "./db";

interface TeacherUpdateQueueState {
  /** Miroir en mémoire de la table Dexie `teacherUpdateQueue` — même pattern que
   * teacher-queue-store.ts (création). */
  items: QueuedTeacherUpdate[];
  syncing: boolean;
  setItems: (items: QueuedTeacherUpdate[]) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useTeacherUpdateQueueStore = create<TeacherUpdateQueueState>((set) => ({
  items: [],
  syncing: false,
  setItems: (items) => set({ items }),
  setSyncing: (syncing) => set({ syncing }),
}));
