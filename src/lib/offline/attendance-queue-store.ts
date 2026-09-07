import { create } from "zustand";
import type { QueuedAttendance } from "./db";

interface AttendanceQueueState {
  /** Miroir en mémoire de la table Dexie `attendanceQueue` — même pattern que les autres files
   * (paiements, inscriptions, enseignants, parents). */
  items: QueuedAttendance[];
  syncing: boolean;
  setItems: (items: QueuedAttendance[]) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useAttendanceQueueStore = create<AttendanceQueueState>((set) => ({
  items: [],
  syncing: false,
  setItems: (items) => set({ items }),
  setSyncing: (syncing) => set({ syncing }),
}));
