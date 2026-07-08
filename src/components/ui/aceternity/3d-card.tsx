"use client";

import * as React from "react";
import { createContext, useContext, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MouseEnterContext = createContext<boolean>(false);

/**
 * Aceternity UI — 3D Card. Tilts toward the cursor; pair with CardBody and CardItem
 * (CardItem with a positive translateZ "pops" forward).
 */
export function CardContainer({
  children,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 18;
    const y = (e.clientY - top - height / 2) / 18;
    ref.current.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  }
  function onMouseLeave() {
    setHovering(false);
    if (ref.current) ref.current.style.transform = "rotateY(0deg) rotateX(0deg)";
  }

  return (
    <MouseEnterContext.Provider value={hovering}>
      <div
        className={cn("flex items-center justify-center", containerClassName)}
        style={{ perspective: "1000px" }}
      >
        <div
          ref={ref}
          onMouseEnter={() => setHovering(true)}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          className={cn("relative transition-all duration-200 ease-linear", className)}
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}
        </div>
      </div>
    </MouseEnterContext.Provider>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("[transform-style:preserve-3d] [&>*]:[transform-style:preserve-3d]", className)}>
      {children}
    </div>
  );
}

export function CardItem({
  as: Tag = "div",
  children,
  className,
  translateZ = 0,
  ...rest
}: {
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  translateZ?: number | string;
} & React.HTMLAttributes<HTMLElement>) {
  const hovering = useContext(MouseEnterContext);
  return (
    <Tag
      className={cn("transition duration-200 ease-linear", className)}
      style={{ transform: hovering ? `translateZ(${translateZ}px)` : "translateZ(0px)" }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
