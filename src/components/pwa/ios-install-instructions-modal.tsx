"use client";

import { Share, SquarePlus, MoreHorizontal } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface IosInstallInstructionsModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  { icon: Share, text: "Appuyez sur le bouton «Partager» dans la barre de Safari." },
  { icon: MoreHorizontal, text: "Faites défiler la liste des actions." },
  { icon: SquarePlus, text: "Appuyez sur «Sur l'écran d'accueil» puis «Ajouter»." },
];

/** iOS Safari n'expose pas `beforeinstallprompt` : seule une marche à suivre manuelle est possible. */
export function IosInstallInstructionsModal({ open, onClose }: IosInstallInstructionsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Installer sur iPhone / iPad" className="max-w-sm">
      <ol className="space-y-4">
        {STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <step.icon className="h-4 w-4" />
            </span>
            <p className="pt-1 text-sm text-gray-700">{step.text}</p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
