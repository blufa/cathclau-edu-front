import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "teal" | "indigo" | "amber" | "rose" | "emerald" | "sky";

const ACCENT: Record<Accent, string> = {
  teal: "bg-brand-50 text-brand-700",
  indigo: "bg-indigo-50 text-indigo-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  emerald: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
};

/**
 * Modern KPI / metric card (TailAdmin / Tremor style): icon tile, label, large value,
 * optional hint and trend delta.
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  accent = "teal",
  trend,
  className,
}: {
  title: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  accent?: Accent;
  trend?: { value: string; positive?: boolean };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-5 ring-1 ring-slate-900/[0.02] transition hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        {Icon && (
          <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", ACCENT[accent])}>
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
        )}
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              trend.positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
            )}
          >
            {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
