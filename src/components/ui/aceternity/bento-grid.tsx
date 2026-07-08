import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI — Bento Grid.
 * A responsive bento layout; pair with BentoGridItem.
 */
export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl grid-cols-1 gap-4 md:auto-rows-[18rem] md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/bento row-span-1 flex flex-col justify-between space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:shadow-xl",
        className,
      )}
    >
      {header}
      <div className="transition duration-200 group-hover/bento:translate-x-1">
        {icon}
        <div className="mt-2 mb-2 font-sans font-bold text-slate-700">{title}</div>
        <div className="font-sans text-xs font-normal text-slate-500">{description}</div>
      </div>
    </div>
  );
}
