"use client";

import { Modal as MantineModal } from "@mantine/core";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

/** Thin wrapper over Mantine Modal preserving the project's open/onClose/title API. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  return (
    <MantineModal opened={open} onClose={onClose} title={title} centered size="lg" radius="lg">
      {children}
    </MantineModal>
  );
}
