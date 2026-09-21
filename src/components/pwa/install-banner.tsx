"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissInstallBanner, hasDismissedBannerRecently, usePwaInstallStore } from "@/lib/store/pwa-install-store";
import { IosInstallInstructionsModal } from "@/components/pwa/ios-install-instructions-modal";

/** Délai avant la première apparition — jamais au premier chargement (mauvaise pratique UX connue). */
const SHOW_AFTER_MS = 8000;

/**
 * Bannière discrète "Ajouter à l'écran d'accueil", uniquement sur mobile (même logique d'affichage
 * que la barre d'onglets). Cohabite avec un accès permanent équivalent dans /account.
 */
export function InstallBanner() {
  const deferredPrompt = usePwaInstallStore((s) => s.deferredPrompt);
  const isInstalled = usePwaInstallStore((s) => s.isInstalled);
  const isIos = usePwaInstallStore((s) => s.isIos);
  const isIosSafari = usePwaInstallStore((s) => s.isIosSafari);
  const setDeferredPrompt = usePwaInstallStore((s) => s.setDeferredPrompt);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  // Sur iOS (tout navigateur), la marche à suivre manuelle est toujours proposable ; ailleurs, il faut
  // que Chrome/Edge ait effectivement signalé l'event `beforeinstallprompt`.
  const installable = Boolean(deferredPrompt) || isIos;

  useEffect(() => {
    if (!installable || isInstalled) return;
    if (hasDismissedBannerRecently()) return;
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [installable, isInstalled]);

  function handleDismiss() {
    dismissInstallBanner();
    setDismissed(true);
  }

  async function handleInstall() {
    if (isIos) {
      setShowIosModal(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible || dismissed || isInstalled) return null;

  return (
    <>
      <div className="fixed inset-x-3 bottom-20 z-40 sm:hidden">
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Installer l&apos;application</p>
            <p className="truncate text-xs text-gray-500">Accès rapide depuis votre écran d&apos;accueil</p>
          </div>
          <Button size="sm" onClick={handleInstall} leftSection={<Download className="h-4 w-4" />}>
            Installer
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <IosInstallInstructionsModal open={showIosModal} onClose={() => setShowIosModal(false)} inSafari={isIosSafari} />
    </>
  );
}
