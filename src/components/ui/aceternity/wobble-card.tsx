"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI — Wobble Card.
 * A card that subtly translates and scales toward the cursor for a tactile, 3D feel.
 */
export function WobbleCard({
  children,
  containerClassName,
  className,
}: {
  children: React.ReactNode;
  containerClassName?: string;
  className?: string;
}) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - (left + width / 2)) / 20;
    const y = (e.clientY - (top + height / 2)) / 20;
    setMouse({ x, y });
  }

  return (
    <motion.section
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        setMouse({ x: 0, y: 0 });
      }}
      style={{
        transform: hovering
          ? `translate3d(${mouse.x}px, ${mouse.y}px, 0) scale3d(1, 1, 1)`
          : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
        transition: "transform 0.1s ease-out",
      }}
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-2xl bg-brand-700",
        containerClassName,
      )}
    >
      <motion.div
        style={{
          transform: hovering
            ? `translate3d(${-mouse.x}px, ${-mouse.y}px, 0) scale3d(1.03, 1.03, 1)`
            : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
          transition: "transform 0.1s ease-out",
        }}
        className={cn("h-full px-6 py-10 sm:px-10", className)}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
