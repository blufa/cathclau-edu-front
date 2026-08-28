"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HERO_SLIDES } from "@/lib/images";

/**
 * Full-bleed background carousel for the hero: auto-advancing crossfade with a slow Ken-Burns zoom
 * and a brand gradient overlay so white text stays legible. Renders only the background layer —
 * place hero content as a sibling with a higher z-index.
 */
export function HeroBgCarousel({ interval = 5000, controls = false }: { interval?: number; controls?: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % HERO_SLIDES.length), interval);
    return () => clearInterval(id);
  }, [interval]);

  const prev = () => setIndex((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  const next = () => setIndex((i) => (i + 1) % HERO_SLIDES.length);

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

      {/* Voile léger pour la lisibilité du texte — la photo doit rester nettement visible,
          comme dans le hero du template de référence (pas un lavis bleu opaque). */}
      <div className="absolute inset-0 bg-brand-900/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-900/70 via-transparent to-brand-900/20" />

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

      {/* Manual navigation arrows */}
      {controls && (
        <>
          <button
            type="button"
            aria-label="Image précédente"
            onClick={prev}
            className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur transition hover:bg-white/25 sm:left-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Image suivante"
            onClick={next}
            className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur transition hover:bg-white/25 sm:right-8"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
