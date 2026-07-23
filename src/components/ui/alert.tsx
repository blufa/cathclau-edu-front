import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "green" | "red" | "amber" | "gray";

const TONE: Record<Tone, string> = {
  brand: "border-brand-100 bg-brand-50 text-brand-800",
  green: "border-green-100 bg-green-50 text-green-800",
  red: "border-red-100 bg-red-50 text-red-700",
  amber: "border-amber-100 bg-amber-50 text-amber-800",
  gray: "border-gray-200 bg-gray-50 text-gray-700",
};

export function Alert({
  tone = "gray",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", TONE[tone], className)}>{children}</div>;
}
