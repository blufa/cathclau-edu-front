import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Surface card — Aceternity-inspired: soft rounded-2xl shell, subtle ring + shadow,
 * gentle lift on hover. Replaces the previous Mantine Paper while keeping the
 * Card / CardHeader / CardTitle / CardBody API used across the app.
 */
export function Card({
  className,
  children,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white ring-1 ring-slate-900/[0.02]",
        hover && "transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-slate-100 px-3 py-4 sm:px-5", className)} {...props} />;
}

export function CardTitle({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-base font-semibold tracking-tight text-slate-900", className)}>
      {children}
    </h3>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-3 py-4 sm:px-5", className)} {...props} />;
}
