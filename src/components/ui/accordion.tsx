"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItem {
  q: React.ReactNode;
  a: React.ReactNode;
}

/** Accordéon FAQ simple (un seul panneau ouvert à la fois) — remplace Mantine `Accordion`. */
export function Accordion({ items, className }: { items: AccordionItem[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item, i) => {
        const expanded = open === i;
        return (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : i)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-base font-semibold text-slate-900">{item.q}</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")}
              />
            </button>
            {expanded && <div className="px-5 pb-4 text-sm leading-relaxed text-slate-600">{item.a}</div>}
          </div>
        );
      })}
    </div>
  );
}
