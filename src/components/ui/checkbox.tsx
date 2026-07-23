import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const input = (
    <input
      ref={ref}
      id={inputId}
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/30",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label htmlFor={inputId} className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700", props.disabled && "cursor-not-allowed opacity-60")}>
      {input}
      {label}
    </label>
  );
});
