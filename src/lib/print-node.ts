/**
 * Imprime un nœud DOM isolément (ex. un badge/carte affiché dans une modale) via une iframe cachée,
 * plutôt que la technique `visibility:hidden` sur tout le document.
 *
 * Pourquoi : le badge est rendu à l'intérieur d'une modale (portail Mantine avec sa propre pile de
 * positionnement/z-index). Basculer `visibility` sur `*` puis forcer `position:fixed` sur le badge
 * dépend du « containing block » de ses ancêtres — imprévisible selon la structure de la modale et le
 * navigateur, ce qui pouvait produire une page d'impression vide. Cloner le nœud dans une iframe
 * indépendante évite complètement ce problème.
 */

/**
 * Repère les feuilles de style déjà chargées (Tailwind compilé, Mantine, branding) pour les
 * reproduire dans l'iframe — en deux groupes :
 * - `links` : URL des feuilles externes (`<link rel="stylesheet">`), à recharger telles quelles via de
 *   vrais `<link>` dans l'iframe. **Ne pas** les sérialiser via `cssRules`/`cssText` : sur cette
 *   application, la lecture de `sheet.cssRules` échoue silencieusement (ou ne renvoie qu'une poignée de
 *   règles) pour une partie des feuilles Tailwind compilées selon le navigateur/la façon dont elles ont
 *   été chargées — ce qui produisait un badge quasi sans style à l'impression (constaté : `<style>`
 *   final ne contenant presque aucune règle). Laisser le navigateur RE-TÉLÉCHARGER et parser lui-même
 *   le fichier CSS original est fiable dans tous les cas, contrairement à sa reconstruction manuelle.
 * - `inlineCss` : texte des feuilles SANS URL (`<style>` injectés directement, ex. CSS-in-JS), pour
 *   lesquelles il n'y a pas de fichier à relier — celles-ci restent sérialisées via `cssText`.
 */
function collectStylesheets(): { links: string[]; inlineCss: string } {
  const links: string[] = [];
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.href) {
      links.push(sheet.href);
      continue;
    }
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) parts.push(rule.cssText);
    } catch {
      // Feuille cross-origin sans URL exploitable : lecture de cssRules bloquée, on l'ignore.
    }
  }
  return { links: [...new Set(links)], inlineCss: parts.join("\n") };
}

export function printNode(node: HTMLElement) {
  const iframe = document.createElement("iframe");
  // Taille réelle (non nulle) exigée pour que la mise en page interne (largeurs, flex…) se calcule
  // correctement — une iframe 0×0 rend son contenu à une largeur de 0 et imprime une page vide. On la
  // sort simplement de l'écran visible plutôt que de la réduire à rien.
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "-10000px";
  iframe.style.width = "800px";
  iframe.style.height = "600px";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }

  const { links, inlineCss } = collectStylesheets();
  const linkTags = links.map((href) => `<link rel="stylesheet" href="${href}">`).join("");

  // Une seule page pour recto + verso (imprimés côte à côte par le composant badge lui-même via
  // `print:flex-row`) : le badge est destiné à être imprimé sur papier bristol puis plastifié/découpé à
  // la main, pas sur une imprimante à cartes PVC dédiée avec pagination automatique. `size: auto` laisse
  // le format papier réel choisi dans le dialogue d'impression (A4, Letter…), sans forcer une deuxième
  // page comme le faisait l'ancien `print:break-after-page`.
  doc.open();
  doc.write(
    `<!DOCTYPE html><html><head>${linkTags}<style>${inlineCss}` +
      `@page{size:auto;margin:8mm;}</style></head>` +
      `<body style="margin:0;padding:0;display:flex;flex-direction:row;align-items:flex-start;justify-content:center;gap:6mm;">${node.outerHTML}</body></html>`,
  );
  doc.close();

  let settled = false;
  function triggerPrint() {
    if (settled) return;
    settled = true;
    const win = iframe.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
    setTimeout(() => iframe.remove(), 500);
  }

  // Attend le chargement des feuilles de style ET des images clonées (photo, logo, QR) avant
  // d'imprimer — sans quoi le badge peut sortir sans styles (feuilles pas encore chargées) ou
  // incomplet (images pas encore chargées) ; filet de sécurité si l'un d'eux ne charge jamais.
  const styleLinks = Array.from(doc.querySelectorAll("link[rel=stylesheet]"));
  const images = Array.from(doc.images);
  const pending = [...styleLinks, ...images];
  if (pending.length === 0) {
    triggerPrint();
    return;
  }
  let remaining = pending.length;
  pending.forEach((el) => {
    const isLoadedImage = el instanceof HTMLImageElement && el.complete;
    if (isLoadedImage) {
      remaining -= 1;
    } else {
      const onSettle = () => {
        remaining -= 1;
        if (remaining <= 0) triggerPrint();
      };
      el.addEventListener("load", onSettle, { once: true });
      el.addEventListener("error", onSettle, { once: true });
    }
  });
  if (remaining <= 0) triggerPrint();
  setTimeout(triggerPrint, 1500);
}
