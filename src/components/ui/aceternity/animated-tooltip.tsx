"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI — Animated Tooltip.
 * Avatars with a spring-tilted tooltip that tracks the cursor. Used for testimonials / team.
 */
export function AnimatedTooltip({
  items,
  className,
}: {
  items: { id: number; name: string; designation: string; initials: string }[];
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);
  const rotate = useSpring(useTransform(x, [-100, 100], [-45, 45]), springConfig);
  const translateX = useSpring(useTransform(x, [-100, 100], [-50, 50]), springConfig);

  return (
    <div className={cn("flex", className)}>
      {items.map((item) => (
        <div
          className="group relative -mr-3"
          key={item.id}
          onMouseEnter={() => setHovered(item.id)}
          onMouseLeave={() => setHovered(null)}
        >
          <AnimatePresence mode="popLayout">
            {hovered === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", ...springConfig } }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                style={{ translateX, rotate, whiteSpace: "nowrap" }}
                className="absolute -top-16 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center rounded-md bg-slate-900 px-4 py-2 text-xs shadow-xl"
              >
                <div className="absolute inset-x-10 -bottom-px z-30 h-px w-1/5 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
                <div className="relative z-30 text-base font-bold text-white">{item.name}</div>
                <div className="text-xs text-white/70">{item.designation}</div>
              </motion.div>
            )}
          </AnimatePresence>
          <div
            onMouseMove={(e) => {
              const halfWidth = e.currentTarget.offsetWidth / 2;
              x.set(e.nativeEvent.offsetX - halfWidth);
            }}
            className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md transition duration-300 group-hover:z-30 group-hover:scale-105"
          >
            {item.initials}
          </div>
        </div>
      ))}
    </div>
  );
}
