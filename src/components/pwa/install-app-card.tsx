"use client";

import { useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { usePwaInstallStore } from "@/lib/store/pwa-install-store";
import { IosInstallInstructionsModal } from "@/components/pwa/ios-install-instructions-modal";
import { notifyInfo } from "@/lib/feedback";

/** Point d'entrée permanent (page /account) pour installer l'app, en complément de la bannière. */
export function InstallAppCard() {
  const deferredPrompt = usePwaInstallStore((s) => s.deferredPrompt);
  const isInstalled = usePwaInstallStore((s) => s.isInstalled);
  const isIos = usePwaInstallStore((s) => s.isIos);
  const isIosSafari = usePwaInstallStore((s) => s.isIosSafari);
  const setDeferredPrompt = usePwaInstallStore((s) => s.setDeferredPrompt);
  const [showIosModal, setShowIosModal] = useState(false);

  async function handleInstall() {
    // Tout navigateur sur iPhone/iPad (Safari ou non) : `beforeinstallprompt` n'existe jamais là-bas,
    // on montre toujours la marche à suivre manuelle plutôt que le message générique Android.
    if (isIos) {
      setShowIosModal(true);
      return;
    }
    if (!deferredPrompt) {
      notifyInfo("Votre navigateur ne propose pas l'installation ici. Essayez depuis Chrome sur Android.");
      return;
    }
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-brand-600" /> Application mobile
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {isInstalled ? (
          <p className="text-sm text-gray-500">L&apos;application est déjà installée sur cet appareil.</p>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Installez {"l'application"} sur votre téléphone pour un accès plus rapide, comme une vraie
              application mobile.
            </p>
            <Button onClick={handleInstall} leftSection={<Download className="h-4 w-4" />}>
              {isIos ? "Comment installer sur iPhone" : "Installer l'application"}
            </Button>
          </>
        )}
      </CardBody>
      <IosInstallInstructionsModal open={showIosModal} onClose={() => setShowIosModal(false)} inSafari={isIosSafari} />
    </Card>
  );
}
