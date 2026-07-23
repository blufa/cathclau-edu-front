"use client";

import { useSidebarStore } from "@/lib/store/sidebar-store";

/** Voile mobile derrière la sidebar ouverte en tiroir — clic pour refermer. */
export function Backdrop() {
  const isMobileOpen = useSidebarStore((s) => s.isMobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  if (!isMobileOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-gray-900/50 sm:hidden"
      onClick={() => setMobileOpen(false)}
    />
  );
}
