"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Menu déroulant générique (trigger + panneau positionné, fermeture au clic extérieur/Échap).
 * Remplace les usages de Mantine `Menu`/`Popover` dans le shell (header, notifications, impersonation).
 */
export function Dropdown({
  trigger,
  children,
  align = "end",
  panelClassName,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (opts: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 min-w-[14rem] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3.5 py-2 text-xs font-medium text-gray-400">{children}</div>;
}

export function DropdownItem({
  children,
  onClick,
  danger,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition-colors",
        disabled && "cursor-not-allowed text-gray-300",
        !disabled && danger && "text-error-600 hover:bg-error-50",
        !disabled && !danger && "text-gray-700 hover:bg-gray-50",
        active && "bg-brand-50 font-medium text-brand-700",
      )}
    >
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 h-px bg-gray-100" />;
}
