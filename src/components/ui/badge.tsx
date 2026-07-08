import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "gray" | "green" | "amber" | "red" | "indigo" | "blue" | "brand";

/** Soft status pill (clean admin style). Semantic tones stay fixed; `brand` follows the tenant colour. */
const TONE: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-600",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  indigo: "bg-indigo-50 text-indigo-700",
  blue: "bg-sky-50 text-sky-700",
  brand: "bg-brand-50 text-brand-700",
};

export function Badge({
  tone = "gray",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
