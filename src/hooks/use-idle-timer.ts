"use client";

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"] as const;

/**
 * Appelle `onIdle` après `timeoutMs` sans activité utilisateur (souris, clavier, défilement, tactile).
 * Le minuteur est réinitialisé par un `ref` (pas un `useState`) pour ne jamais re-render à chaque
 * mouvement de souris — seul le `setTimeout` lui-même change, aucun rendu React n'est déclenché par
 * l'activité normale.
 */
export function useIdleTimer(timeoutMs: number, onIdle: () => void, enabled: boolean) {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout>;

    function reset() {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    }

    reset();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [timeoutMs, enabled]);
}
