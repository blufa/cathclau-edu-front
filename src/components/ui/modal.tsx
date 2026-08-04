"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Omit (with `bare`) for a chromeless modal — e.g. the command palette. */
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Skips the title bar/close button/padding — the content owns its own chrome. */
  bare?: boolean;
  /** Vertical placement: "center" (default) or near the top (e.g. command palette). */
  align?: "center" | "top";
}

/** Modal Tailwind pur (remplace Mantine Modal), conserve l'API open/onClose/title de l'app. */
export function Modal({ open, onClose, title, children, className, bare, align = "center" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-4",
        align === "top" ? "pt-[12vh]" : "py-10 sm:items-center",
      )}
    >
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={cn(
          "relative w-full max-w-lg rounded-2xl bg-white shadow-theme-lg ring-1 ring-gray-900/5",
          !bare && "p-6",
          className,
        )}
      >
        {!bare && (
          <div className="mb-4 flex items-center justify-between">
            <h2 id="modal-title" className="text-base font-semibold text-gray-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="-mr-1.5 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
