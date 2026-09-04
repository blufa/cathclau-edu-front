import { create } from "zustand";

interface NetworkState {
  /** État de connectivité réel : mis à jour par les événements navigateur ET par le résultat concret
   *  de chaque requête API (voir lib/api/http.ts) — plus fiable que navigator.onLine seul, qui reste
   *  `true` tant que le routeur Wi-Fi local répond même si l'accès internet est mort. */
  online: boolean;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  setOnline: (online) => set({ online }),
}));

let wired = false;

/** Branche les événements online/offline du navigateur une seule fois (appelé au montage de l'app). */
export function wireNetworkListeners(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => useNetworkStore.getState().setOnline(true));
  window.addEventListener("offline", () => useNetworkStore.getState().setOnline(false));
}
