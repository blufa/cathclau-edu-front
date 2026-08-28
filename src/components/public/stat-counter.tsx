"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

/**
 * Chiffre qui s'anime en comptant jusqu'à sa valeur finale au moment où il entre dans le viewport
 * (équivalent du "Funfacts"/CounterUp de Vankine) — une seule fois, pas de dépendance ajoutée
 * (utilise framer-motion déjà présent).
 */
export function StatCounter({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.21, 0.47, 0.32, 0.98],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}
