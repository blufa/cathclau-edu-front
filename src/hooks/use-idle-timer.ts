"use client";

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"] as const;
/** Vérification périodique pendant que l'onglet est visible — un setInterval reste plus fiable qu'un
 * setTimeout unique de 15 min, mais sert surtout de filet : le vrai rattrapage se fait au retour au
 * premier plan (voir plus bas), pas ici. */
const CHECK_INTERVAL_MS = 15_000;
const STORAGE_KEY = "laca:last-activity-at";

/**
 * Appelle `onIdle` après `timeoutMs` sans activité utilisateur (souris, clavier, défilement, tactile).
 *
 * Version robuste mobile (§retour utilisateur) : un simple `setTimeout` de 15 min ne suffit pas — la
 * plupart des navigateurs mobiles SUSPENDENT ou ralentissent les minuteurs JS d'un onglet en
 * arrière-plan (bascule vers WhatsApp, verrouillage de l'écran). Pire, si le système tue l'onglet en
 * arrière-plan et que l'utilisatrice le rouvre plus tard, l'app redémarre et un minuteur en mémoire
 * repart silencieusement à zéro, sans jamais s'être déclenché — la session reste active bien plus
 * longtemps que prévu. On horodate donc chaque activité dans localStorage (survit à un rechargement)
 * et on compare au temps réel écoulé (`Date.now()`), vérifié :
 *  - à intervalle régulier pendant que l'onglet est visible ;
 *  - immédiatement au retour au premier plan (`visibilitychange`/`focus`) — rattrape d'un coup tout le
 *    temps passé en arrière-plan plutôt que de repartir de zéro ;
 *  - dès le montage — rattrape aussi un onglet tué puis rouvert par le système pendant qu'il était en
 *    arrière-plan.
 */
export function useIdleTimer(timeoutMs: number, onIdle: () => void, enabled: boolean) {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let fired = false;

    function readLastActivity(): number {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) return Number(stored);
      } catch {
        /* localStorage indisponible (navigation privée, quota) : repli sur "maintenant" ci-dessous. */
      }
      return Date.now();
    }

    function markActivity() {
      fired = false;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* ignore — sans localStorage, on perd juste la persistance entre rechargements. */
      }
    }

    function check() {
      if (fired) return;
      if (Date.now() - readLastActivity() >= timeoutMs) {
        fired = true;
        onIdleRef.current();
      }
    }

    markActivity();
    check();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActivity));
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, [timeoutMs, enabled]);
}
