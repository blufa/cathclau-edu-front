"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api/errors";

export function notifySuccess(message: string, title = "Succès") {
  toast.success(title, { description: message });
}

/** Shows an error toast, extracting the server-side problem detail when available. Falls back to
 * `.message` for a plain Error/exception, or the raw text for a hand-written validation string (ex.
 * `notifyError(validationError)` where `validationError` is a local string, not a caught exception) —
 * before this, anything that wasn't an ApiError silently showed the generic fallback instead of the
 * actual reason, defeating the purpose of a specific, user-facing validation message. */
export function notifyError(error: unknown, fallback = "Une erreur est survenue") {
  const message = error instanceof ApiError ? error.userMessage
    : error instanceof Error ? error.message
    : typeof error === "string" ? error
    : fallback;
  toast.error("Erreur", { description: message });
}

export function notifyInfo(message: string, title = "Information") {
  toast.info(title, { description: message });
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

type ConfirmListener = (opts: ConfirmOptions | null) => void;
let confirmListener: ConfirmListener | null = null;

/** Ouvre une boîte de confirmation Tailwind (rendue par `ConfirmDialogHost`, monté une fois dans le layout racine). */
export function confirmAction(opts: ConfirmOptions) {
  confirmListener?.(opts);
}

/** À monter une seule fois près de la racine de l'app (voir `src/app/layout.tsx`). */
export function ConfirmDialogHost() {
  const [active, setActive] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    confirmListener = setActive;
    return () => {
      confirmListener = null;
    };
  }, []);

  if (!active) return null;

  async function handleConfirm() {
    if (!active) return;
    setBusy(true);
    try {
      await active.onConfirm();
    } finally {
      setBusy(false);
      setActive(null);
    }
  }

  return (
    <Modal open onClose={() => (busy ? undefined : setActive(null))} title={active.title} className="max-w-sm">
      <p className="text-sm text-gray-600">{active.message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => setActive(null)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleConfirm}
          className={
            active.danger
              ? "rounded-lg bg-error-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-error-700 disabled:opacity-50"
              : "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          }
        >
          {active.confirmLabel ?? "Confirmer"}
        </button>
      </div>
    </Modal>
  );
}
