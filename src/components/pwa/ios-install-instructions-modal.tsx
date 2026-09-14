"use client";

import { Compass, Share, SquarePlus, MoreHorizontal } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface IosInstallInstructionsModalProps {
  open: boolean;
  onClose: () => void;
  /** false si l'appareil est bien un iPhone/iPad mais que le navigateur actuel n'est pas Safari
   * (Chrome/Firefox/Edge iOS sont techniquement du WebKit, mais Apple réserve l'installation à Safari). */
  inSafari?: boolean;
}

const SAFARI_STEPS = [
  { icon: Share, text: "Appuyez sur le bouton «Partager» dans la barre de Safari." },
  { icon: MoreHorizontal, text: "Faites défiler la liste des actions." },
  { icon: SquarePlus, text: "Appuyez sur «Sur l'écran d'accueil» puis «Ajouter»." },
];

const OPEN_IN_SAFARI_STEP = {
  icon: Compass,
  text: "Sur iPhone/iPad, l'installation n'est possible que depuis Safari. Copiez le lien de cette page et ouvrez-le dans Safari, puis reprenez les étapes ci-dessous.",
};

/** iOS n'expose jamais `beforeinstallprompt` (aucun navigateur, Safari inclus) : seule une marche à suivre manuelle est possible. */
export function IosInstallInstructionsModal({ open, onClose, inSafari = true }: IosInstallInstructionsModalProps) {
  const steps = inSafari ? SAFARI_STEPS : [OPEN_IN_SAFARI_STEP, ...SAFARI_STEPS];
  return (
    <Modal open={open} onClose={onClose} title="Installer sur iPhone / iPad" className="max-w-sm">
      <ol className="space-y-4">
        {steps.map((step, i) => (
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
