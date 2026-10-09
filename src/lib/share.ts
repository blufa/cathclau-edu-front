/** true uniquement là où l'API Web Share existe (essentiellement mobile — Android Chrome, iOS Safari). */
export function canUseWebShare(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator;
}

/**
 * Télécharge réellement le fichier (jamais juste une redirection vers l'URL distante) sous le nom
 * donné — utilisé quand aucun partage natif n'est possible (desktop) pour que l'utilisateur ait le
 * vrai fichier en main à joindre lui-même dans WhatsApp Desktop (qui n'expose aucune API permettant
 * de joindre un fichier automatiquement depuis une page web/app).
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Partage le VRAI fichier (jamais un lien) via le menu de partage natif du téléphone. Contrairement
 * à {@link shareFile}, ne retombe JAMAIS sur un partage de simple lien — un appelant qui doit
 * absolument éviter d'exposer l'URL brute de stockage (ex. Cloudinary) dans le message (§retour
 * comptable : "je veux que tu partages juste ça [...], pas le lien cloudinary") doit utiliser cette
 * fonction, et gérer lui-même son propre repli (ex. téléchargement local) quand elle retourne `false`.
 *
 * Retourne `true` dès que le sélecteur de partage de FICHIER a bien été présenté à l'utilisateur (y
 * compris s'il l'a annulé — on ne doit alors pas déclencher un autre canal, l'utilisateur a déjà fait
 * un choix), `false` si le partage de fichier n'est pas supporté du tout (ex. desktop).
 */
export async function shareFileOnly(url: string, title: string, text?: string): Promise<boolean> {
  if (!canUseWebShare()) return false;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const extension = blob.type === "application/pdf" ? "pdf" : (url.match(/\.(\w+)(\?|$)/)?.[1] ?? "bin");
    const file = new File([blob], `${title}.${extension}`, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (!nav.canShare?.({ files: [file] })) return false;
    await navigator.share({ files: [file], title, text });
    return true;
  } catch (err) {
    return err instanceof DOMException && err.name === "AbortError";
  }
}

/**
 * Partage un fichier via le menu de partage natif du téléphone (WhatsApp, SMS, etc.). Retombe sur
 * le partage d'un simple LIEN (jamais la pièce jointe) si le partage de fichier n'est pas supporté —
 * acceptable pour un partage générique (bouton "Partager" d'un document quelconque), mais PAS pour un
 * flux qui doit garantir qu'aucun lien brut n'apparaît jamais (voir {@link shareFileOnly} dans ce cas).
 *
 * Retourne `true` dès qu'un sélecteur natif a bien été présenté à l'utilisateur (y compris s'il
 * l'a annulé — on ne doit alors PAS retomber sur un autre canal, l'utilisateur a déjà fait un choix),
 * `false` seulement si le partage natif n'est pas disponible du tout (ex. desktop) — dans ce cas
 * l'appelant peut retomber sur un autre canal (ex. lien direct `wa.me`).
 */
export async function shareFile(url: string, title: string, text?: string): Promise<boolean> {
  if (await shareFileOnly(url, title, text)) return true;
  if (!canUseWebShare()) return false;
  try {
    await navigator.share({ url, title, text });
    return true;
  } catch (err) {
    // AbortError (l'utilisateur a annulé) compte comme "géré" — seule l'absence totale de support
    // doit faire retomber l'appelant sur un autre canal.
    return err instanceof DOMException && err.name === "AbortError";
  }
}
