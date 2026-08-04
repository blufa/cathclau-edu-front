"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
        checked ? "bg-brand-600" : "bg-gray-200",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-1",
        )}
      />
    </button>
  );
}
