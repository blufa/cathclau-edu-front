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
          // max-h-[90vh] + en-tête fixe/corps défilant séparément (au lieu d'un bloc unique) : sur un
          // écran bas (15 pouces, souvent 768px de hauteur utile) un formulaire à beaucoup de champs
          // ne doit jamais être coupé en bas ni forcer à faire défiler toute la page derrière le
          // fond assombri — seul le contenu du modal défile, le titre/bouton fermer restent visibles.
          "relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-theme-lg ring-1 ring-gray-900/5",
          bare ? "overflow-y-auto" : "overflow-hidden",
          className,
        )}
      >
        {!bare && (
          <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
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
        {bare ? children : <div className="overflow-y-auto px-6 pb-6">{children}</div>}
      </div>
    </div>,
    document.body,
  );
}
