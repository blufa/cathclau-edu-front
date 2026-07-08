import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
  /** Polymorphic rendering (e.g. component={Link} href="…"). */
  component?: React.ElementType;
  href?: string;
  target?: string;
  /** Occasional Mantine-style top margin used at call sites. */
  mt?: string | number;
}

/**
 * Project button — clean admin style, brand-aware (follows the tenant colour via the
 * --color-brand-* CSS variables). Primary uses a subtle brand gradient; others are flat.
 */
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-600/20 hover:from-brand-600 hover:to-brand-700 focus-visible:ring-brand-500",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-slate-300",
  outline:
    "border border-brand-300 bg-transparent text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-400",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-300",
  danger: "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 focus-visible:ring-red-400",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth,
    leftSection,
    rightSection,
    component,
    className,
    children,
    disabled,
    mt,
    style,
    ...props
  },
  ref,
) {
  const Comp = (component ?? "button") as React.ElementType;
  const classes = cn(
    "inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-60",
    SIZE[size],
    VARIANT[variant],
    fullWidth && "w-full",
    className,
  );
  const mtStyle = mt != null ? { marginTop: typeof mt === "number" ? mt : mt } : undefined;

  return (
    <Comp
      ref={ref}
      className={classes}
      // Only a native <button> takes a disabled attribute; links ignore it gracefully.
      disabled={component ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      style={{ ...mtStyle, ...style }}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftSection}
      {children}
      {!loading && rightSection}
    </Comp>
  );
});
