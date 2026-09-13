"use client";

import { useEffect } from "react";
import {
  type BeforeInstallPromptEvent,
  isIosSafariDevice,
  isRunningStandalone,
  usePwaInstallStore,
} from "@/lib/store/pwa-install-store";
import { InstallBanner } from "@/components/pwa/install-banner";

/**
 * Capture des signaux d'installabilité PWA (à monter une seule fois près de la racine, voir
 * src/app/layout.tsx). Ne rend rien de visible par lui-même à part la bannière discrète.
 */
export function InstallPromptProvider() {
  const setDeferredPrompt = usePwaInstallStore((s) => s.setDeferredPrompt);
  const setInstalled = usePwaInstallStore((s) => s.setInstalled);
  const setIosSafari = usePwaInstallStore((s) => s.setIosSafari);

  useEffect(() => {
    setInstalled(isRunningStandalone());
    setIosSafari(isIosSafariDevice());

    function onBeforeInstallPrompt(event: Event) {
      // Empêche la mini-infobar native de Chrome — on affiche notre propre bannière à la place,
      // au moment de notre choix plutôt qu'au premier chargement.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setDeferredPrompt(null);
      setInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [setDeferredPrompt, setInstalled, setIosSafari]);

  return <InstallBanner />;
}
