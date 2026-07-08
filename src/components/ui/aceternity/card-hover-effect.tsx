"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI — Card Hover Effect.
 * A grid of cards where an animated highlight follows the hovered item.
 */
export function HoverEffect({
  items,
  className,
}: {
  items: { title: string; description: string; icon?: React.ReactNode }[];
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className={cn("grid grid-cols-1 py-2 md:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, idx) => (
        <div
          key={item.title}
          className="group relative block h-full w-full p-2"
          onMouseEnter={() => setHovered(idx)}
          onMouseLeave={() => setHovered(null)}
        >
          <AnimatePresence>
            {hovered === idx && (
              <motion.span
                className="absolute inset-0 block h-full w-full rounded-2xl bg-brand-100/70"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.2 } }}
              />
            )}
          </AnimatePresence>
          <Card>
            {item.icon}
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </Card>
        </div>
      ))}
    </div>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative z-20 h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition group-hover:border-brand-300",
        className,
      )}
    >
      <div className="relative z-50 space-y-3">{children}</div>
    </div>
  );
}

function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h4 className={cn("text-lg font-semibold tracking-tight text-slate-900", className)}>{children}</h4>;
}

function CardDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-sm leading-relaxed text-slate-500", className)}>{children}</p>;
}
