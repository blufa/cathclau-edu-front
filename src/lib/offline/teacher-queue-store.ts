import { create } from "zustand";
import type { QueuedTeacher } from "./db";

interface TeacherQueueState {
  /** Miroir en mémoire de la table Dexie `teacherQueue` — même pattern que sync-queue-store.ts
   * (paiements) et enrollment-queue-store.ts (élèves). */
  items: QueuedTeacher[];
  syncing: boolean;
  setItems: (items: QueuedTeacher[]) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useTeacherQueueStore = create<TeacherQueueState>((set) => ({
  items: [],
  syncing: false,
  setItems: (items) => set({ items }),
  setSyncing: (syncing) => set({ syncing }),
}));
