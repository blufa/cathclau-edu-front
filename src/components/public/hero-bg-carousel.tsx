"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { HERO_SLIDES } from "@/lib/images";

/**
 * Full-bleed background carousel for the hero: auto-advancing crossfade with a slow Ken-Burns zoom
 * and a brand gradient overlay so white text stays legible. Renders only the background layer —
 * place hero content as a sibling with a higher z-index.
 */
export function HeroBgCarousel({ interval = 5000 }: { interval?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % HERO_SLIDES.length), interval);
    return () => clearInterval(id);
  }, [interval]);

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-slate-900">
      <AnimatePresence>
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.4, ease: "easeInOut" }, scale: { duration: 6, ease: "linear" } }}
        >
          <Image
            src={HERO_SLIDES[index].src}
            alt={HERO_SLIDES[index].alt}
            fill
            priority={index === 0}
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Gradient overlays for legibility */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/70 to-slate-900/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent,rgba(2,6,23,.55))]" />

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {HERO_SLIDES.map((s, i) => (
          <button
            key={s.src}
            aria-label={`Image ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`}
          />
        ))}
      </div>
    </div>
  );
}
