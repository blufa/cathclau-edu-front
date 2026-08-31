"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

export interface TestimonialItem {
  quote: string;
  name: string;
  role: string;
}

/**
 * Carrousel de témoignages : grande photo à gauche, carte de citation mise en avant à droite —
 * navigation manuelle (flèches + puces) avec rotation automatique en fond, même mécanique que
 * `HeroBgCarousel`. Pas de photo de personne (les témoignages n'en ont pas) : avatar en initiales,
 * cohérent avec le pattern déjà utilisé ailleurs sur le site.
 */
export function TestimonialCarousel({
  items,
  image,
  interval = 6000,
}: {
  items: TestimonialItem[];
  image: string;
  interval?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), interval);
    return () => clearInterval(id);
  }, [interval, items.length]);

  if (items.length === 0) return null;
  const current = items[index];
  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);
  const initials = current.name.split(" ").map((w) => w[0]).join("").slice(0, 2);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-xl">
        <Image src={image} alt="Vie scolaire dans un établissement partenaire" fill sizes="(max-width: 1024px) 100vw, 32rem" className="object-cover" />
      </div>

      <div className="relative">
        <Quote className="h-10 w-10 text-brand-200" strokeWidth={1.5} />
        <div className="relative mt-2 min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.figure
              key={index}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <blockquote className="text-lg leading-relaxed text-slate-700">“{current.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                  {initials}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{current.name}</span>
                  <span className="block text-xs text-slate-500">{current.role}</span>
                </span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        {items.length > 1 && (
          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              aria-label="Témoignage précédent"
              onClick={prev}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-2">
              {items.map((t, i) => (
                <button
                  key={t.name}
                  aria-label={`Témoignage ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-brand-600" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Témoignage suivant"
              onClick={next}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
