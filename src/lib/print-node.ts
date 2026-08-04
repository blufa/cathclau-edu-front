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
 * Concatène le texte de toutes les feuilles de style déjà chargées (Tailwind compilé, Mantine,
 * branding) en une seule chaîne, pour l'injecter en `<style>` inline dans l'iframe — synchrone et
 * immédiatement disponible, contrairement à des `<link rel="stylesheet">` clonés qui rechargeraient
 * les fichiers de façon asynchrone (et pouvaient ne pas être prêts avant l'appel à `print()`).
 */
function collectStylesheetText(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) parts.push(rule.cssText);
    } catch {
      // Feuille cross-origin (ex. police externe) : lecture de cssRules bloquée par le navigateur, on l'ignore.
    }
  }
  return parts.join("\n");
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

  doc.open();
  doc.write(
    `<!DOCTYPE html><html><head><style>${collectStylesheetText()}</style></head>` +
      `<body style="margin:0;padding:24px;display:flex;justify-content:center;">${node.outerHTML}</body></html>`,
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

  // Attend le chargement des images clonées (photo, logo, QR) avant d'imprimer, sinon la carte peut
  // sortir incomplète ; filet de sécurité si une image ne charge jamais (ex. logo manquant).
  const images = Array.from(doc.images);
  if (images.length === 0) {
    triggerPrint();
    return;
  }
  let remaining = images.length;
  images.forEach((img) => {
    if (img.complete) {
      remaining -= 1;
    } else {
      const onSettle = () => {
        remaining -= 1;
        if (remaining <= 0) triggerPrint();
      };
      img.addEventListener("load", onSettle, { once: true });
      img.addEventListener("error", onSettle, { once: true });
    }
  });
  if (remaining <= 0) triggerPrint();
  setTimeout(triggerPrint, 1000);
}
