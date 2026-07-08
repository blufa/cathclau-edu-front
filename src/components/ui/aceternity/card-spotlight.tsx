"use client";

import { useState } from "react";
import { useMotionTemplate, useMotionValue, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI — Card Spotlight.
 * A card with a radial highlight that follows the cursor. Wrap any content.
 */
export function CardSpotlight({
  children,
  className,
  radius = 280,
  color = "rgba(20, 184, 166, 0.18)",
}: {
  children: React.ReactNode;
  className?: string;
  radius?: number;
  color?: string;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovering, setHovering] = useState(false);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  }

  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, ${color}, transparent 80%)`;

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white",
        className,
      )}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ background, opacity: hovering ? 1 : 0 }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
