"use client";

import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { ApiError } from "@/lib/api/errors";

export function notifySuccess(message: string, title = "Succès") {
  notifications.show({ title, message, color: "green" });
}

/** Shows an error toast, extracting the server-side problem detail when available. */
export function notifyError(error: unknown, fallback = "Une erreur est survenue") {
  const message = error instanceof ApiError ? error.userMessage : fallback;
  notifications.show({ title: "Erreur", message, color: "red" });
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Opens a Mantine confirm modal; runs onConfirm on validation. */
export function confirmAction({ title, message, confirmLabel = "Confirmer", danger, onConfirm }: ConfirmOptions) {
  modals.openConfirmModal({
    title,
    centered: true,
    children: <Text size="sm">{message}</Text>,
    labels: { confirm: confirmLabel, cancel: "Annuler" },
    confirmProps: danger ? { color: "red" } : undefined,
    onConfirm: () => {
      void onConfirm();
    },
  });
}
