import { create } from "zustand";

const EXPANDED_KEY = "cathclau.sidebar.expanded";

function readPersistedExpanded(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(EXPANDED_KEY);
  return stored === null ? true : stored === "1";
}

interface SidebarState {
  /** Desktop: sidebar pleine largeur (true) ou repliée en icônes (false). Persisté. */
  isExpanded: boolean;
  /** Mobile: tiroir de navigation ouvert. */
  isMobileOpen: boolean;
  /** Survol d'une sidebar repliée (affichage temporaire des libellés). */
  isHovered: boolean;
  /** Clé du sous-menu actuellement ouvert (accordéon), ex. "Finances/Facturation". */
  openSubmenu: string | null;
  toggleExpanded: () => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobileOpen: () => void;
  setHovered: (hovered: boolean) => void;
  setOpenSubmenu: (key: string | null) => void;
}

/** État UI de la sidebar (remplace l'ancien slice Redux). */
export const useSidebarStore = create<SidebarState>((set, get) => ({
  isExpanded: readPersistedExpanded(),
  isMobileOpen: false,
  isHovered: false,
  openSubmenu: null,
  toggleExpanded: () => {
    const next = !get().isExpanded;
    if (typeof window !== "undefined") window.localStorage.setItem(EXPANDED_KEY, next ? "1" : "0");
    set({ isExpanded: next });
  },
  setMobileOpen: (isMobileOpen) => set({ isMobileOpen }),
  toggleMobileOpen: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
  setHovered: (isHovered) => set({ isHovered }),
  setOpenSubmenu: (key) => set((s) => ({ openSubmenu: s.openSubmenu === key ? null : key })),
}));
