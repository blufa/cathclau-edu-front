"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

/**
 * Aceternity UI — Hover Border Gradient.
 * A pill whose gradient border travels around the edge, accelerating on hover.
 */
export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  duration = 1,
  ...props
}: {
  children: React.ReactNode;
  containerClassName?: string;
  className?: string;
  as?: React.ElementType;
  duration?: number;
} & React.HTMLAttributes<HTMLElement>) {
  const [hovered, setHovered] = useState(false);
  const [direction, setDirection] = useState<Direction>("TOP");

  const rotateDirection = (current: Direction): Direction => {
    const dirs: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
    return dirs[(dirs.indexOf(current) + 1) % dirs.length];
  };

  const movingMap: Record<Direction, string> = {
    TOP: "radial-gradient(20.7% 50% at 50% 0%, #14b8a6 0%, rgba(255,255,255,0) 100%)",
    LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, #14b8a6 0%, rgba(255,255,255,0) 100%)",
    BOTTOM: "radial-gradient(20.7% 50% at 50% 100%, #14b8a6 0%, rgba(255,255,255,0) 100%)",
    RIGHT: "radial-gradient(16.2% 41.2% at 100% 50%, #14b8a6 0%, rgba(255,255,255,0) 100%)",
  };
  const highlight = "radial-gradient(75% 181% at 50% 50%, #22d3ee 0%, rgba(255,255,255,0) 100%)";

  useEffect(() => {
    if (hovered) return;
    const id = setInterval(() => setDirection((d) => rotateDirection(d)), duration * 1000);
    return () => clearInterval(id);
  }, [hovered, duration]);

  return (
    <Tag
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex h-min w-fit items-center justify-center overflow-visible rounded-full border border-slate-200 bg-white/20 p-px",
        containerClassName,
      )}
      {...props}
    >
      <div className={cn("z-10 rounded-[inherit] bg-white px-4 py-2 text-sm font-semibold text-slate-900", className)}>
        {children}
      </div>
      <motion.div
        className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
        style={{ filter: "blur(2px)" }}
        initial={{ background: movingMap[direction] }}
        animate={{ background: hovered ? [movingMap[direction], highlight] : movingMap[direction] }}
        transition={{ ease: "linear", duration: duration ?? 1 }}
      />
      <div className="absolute inset-px z-[1] rounded-[inherit] bg-white" />
    </Tag>
  );
}
