import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900",
        "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
        "disabled:cursor-not-allowed disabled:bg-gray-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
