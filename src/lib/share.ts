/** true uniquement là où l'API Web Share existe (essentiellement mobile — Android Chrome, iOS Safari). */
export function canUseWebShare(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator;
}

/**
 * Partage un fichier via le menu de partage natif du téléphone (WhatsApp, SMS, etc.). Retombe sur
 * le partage d'un simple lien si le partage de fichier n'est pas supporté par le navigateur.
 */
export async function shareFile(url: string, title: string): Promise<void> {
  if (!canUseWebShare()) return;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const extension = blob.type === "application/pdf" ? "pdf" : (url.match(/\.(\w+)(\?|$)/)?.[1] ?? "bin");
    const file = new File([blob], `${title}.${extension}`, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return;
    }
  } catch {
    // Récupération/partage du fichier impossible (CORS, etc.) — repli sur le partage du lien.
  }
  try {
    await navigator.share({ url, title });
  } catch {
    // L'utilisateur a annulé le partage, ou aucune app cible disponible — pas d'erreur à afficher.
  }
}
