"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI — Infinite Moving Cards.
 * Marquee of items that scroll seamlessly; great for a trust / logos band.
 */
export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "slow",
  pauseOnHover = true,
  className,
}: {
  items: { quote?: string; name: string; title?: string }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const scroller = scrollerRef.current;
    if (!container || !scroller) return;

    // Duplicate items so the marquee can loop seamlessly.
    const children = Array.from(scroller.children);
    children.forEach((child) => {
      const clone = child.cloneNode(true);
      scroller.appendChild(clone);
    });

    container.style.setProperty(
      "--animation-direction",
      direction === "left" ? "forwards" : "reverse",
    );
    container.style.setProperty(
      "--animation-duration",
      speed === "fast" ? "20s" : speed === "normal" ? "40s" : "80s",
    );
    setStart(true);
  }, [direction, speed]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
        className,
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-4",
          start && "animate-scroll",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
      >
        {items.map((item) => (
          <li
            key={item.name}
            className="relative w-[260px] max-w-full shrink-0 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-brand-50/40 px-6 py-5 md:w-[320px]"
          >
            {item.quote && (
              <span className="block text-sm leading-relaxed text-slate-600">{item.quote}</span>
            )}
            <span className="mt-3 block text-sm font-semibold text-slate-900">{item.name}</span>
            {item.title && <span className="block text-xs text-slate-400">{item.title}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
