"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { HERO_SLIDES } from "@/lib/images";

/**
 * Hero image carousel: auto-advancing crossfade between HERO_SLIDES, with floating
 * KPI chips and clickable dots. Pauses on hover.
 */
export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % HERO_SLIDES.length), 4500);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className="relative mx-auto w-full max-w-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-white/60 shadow-2xl shadow-brand-500/20">
        <AnimatePresence mode="sync">
          <motion.div
            key={index}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          >
            <Image
              src={HERO_SLIDES[index].src}
              alt={HERO_SLIDES[index].alt}
              fill
              priority={index === 0}
              sizes="(max-width: 1024px) 100vw, 28rem"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-900/45 via-transparent to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* dots */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.src}
              aria-label={`Image ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/90"
              }`}
            />
          ))}
        </div>
      </div>

      {/* floating KPI chips */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute -left-4 top-8 rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 shadow-xl backdrop-blur"
      >
        <div className="text-xl font-bold text-brand-600">96 %</div>
        <div className="text-[11px] text-slate-500">Assiduité</div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="absolute -right-4 bottom-12 rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 shadow-xl backdrop-blur"
      >
        <div className="text-xl font-bold text-brand-600">+82 %</div>
        <div className="text-[11px] text-slate-500">Frais recouvrés</div>
      </motion.div>
    </div>
  );
}
