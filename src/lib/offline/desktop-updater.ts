import { isDesktop } from "./desktop-runtime";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

let checked = false;

/**
 * Vérifie une mise à jour desktop disponible et propose de l'installer — sans ça, le plugin updater
 * (déjà configuré : clé de signature, endpoint `/updates/latest.json`, permissions dans
 * `capabilities/default.json`) n'était jamais appelé nulle part : une nouvelle release ne se
 * proposait jamais au démarrage, malgré tout le reste du dispositif déjà en place (§retour comptable).
 * Import dynamique uniquement (jamais au niveau racine d'un fichier partagé) : `@tauri-apps/
 * plugin-updater` échoue au chargement dans le build web — même précaution que `desktop-db.ts`.
 */
export async function checkForDesktopUpdate(): Promise<void> {
  if (!isDesktop() || checked) return;
  checked = true;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return;

    confirmAction({
      title: "Mise à jour disponible",
      message: `Une nouvelle version (${update.version}) est disponible. Installer maintenant ? `
        + "L'application redémarrera automatiquement une fois l'installation terminée.",
      confirmLabel: "Mettre à jour",
      onConfirm: async () => {
        try {
          await update.downloadAndInstall();
          notifySuccess("Mise à jour installée — redémarrage...");
          // Sur Windows, downloadAndInstall() quitte déjà l'appli après avoir lancé l'installeur —
          // ce relaunch() ne s'exécute alors jamais, sans effet indésirable. Sur macOS/Linux, il faut
          // ce redémarrage explicite pour charger la nouvelle version.
          const { relaunch } = await import("@tauri-apps/plugin-process");
          await relaunch();
        } catch (err) {
          notifyError(err, "Échec de la mise à jour");
        }
      },
    });
  } catch (err) {
    // Jamais bloquant pour l'utilisateur (hors-ligne, endpoint /updates temporairement indisponible...)
    // — juste consigné, retenté au prochain lancement.
    console.error("Vérification de mise à jour desktop échouée", err);
  }
}
