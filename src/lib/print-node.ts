/**
 * Impression isolée (badge/carte déjà rendu, ou document HTML généré en chaîne — reçus, relevés,
 * convocations…) en injectant le contenu dans le document PRINCIPAL, masqué (`display:none`) sauf
 * pendant l'impression (`@media print`), puis `window.print()` sur la fenêtre principale elle-même.
 *
 * Pourquoi ni iframe cachée, ni `window.open` :
 * - `window.open("", "_blank", ...)` : dans le webview desktop (Tauri), ça ne crée pas une vraie
 *   fenêtre séparée — ça remplace TOUTE la fenêtre de l'appli par le contenu à imprimer, sans bouton
 *   retour (le webview Tauri n'a pas de chrome de navigateur).
 * - Iframe cachée + `iframe.contentWindow.print()` (technique utilisée ici auparavant) : fonctionne en
 *   navigateur web mais ne déclenche RIEN dans le webview desktop (Tauri) — `iframe.contentWindow.print()`
 *   est un no-op silencieux dans son moteur, contrairement à `window.print()` sur la fenêtre principale,
 *   qui lui fonctionne (bug connu : https://github.com/tauri-apps/tauri/issues/13451).
 *
 * D'où cette troisième approche, qui marche identiquement sur web et desktop : le contenu à imprimer
 * est un vrai enfant du document principal (donc `window.print()` dessus fonctionne partout), juste
 * masqué en temps normal et le seul élément visible pendant l'impression.
 */
function printInMainDocument(innerHtml: string, extraPrintCss: string) {
  const root = document.createElement("div");
  root.id = "app-print-root";
  root.innerHTML = innerHtml;
  document.body.appendChild(root);

  const style = document.createElement("style");
  style.textContent = `
    @media print {
      body > :not(#app-print-root) { display: none !important; }
      #app-print-root { display: block !important; }
      ${extraPrintCss}
    }
  `;
  document.head.appendChild(style);

  let settled = false;
  function cleanup() {
    if (settled) return;
    settled = true;
    root.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  }

  function triggerPrint() {
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    // Filet de sécurité : certains OS/imprimantes virtuelles ne déclenchent jamais `afterprint`
    // (ex. annulation de la boîte de dialogue système) — sans lui, le nœud resterait dans le DOM.
    setTimeout(cleanup, 10000);
  }

  // Attend le chargement des images éventuelles (photo, logo, QR) avant d'imprimer — sinon la première
  // impression peut sortir incomplète ; filet de sécurité si l'une d'elles ne charge jamais.
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) {
    triggerPrint();
    return;
  }
  let remaining = images.length;
  images.forEach((img) => {
    if (img.complete) {
      remaining -= 1;
      return;
    }
    const onSettle = () => {
      remaining -= 1;
      if (remaining <= 0) triggerPrint();
    };
    img.addEventListener("load", onSettle, { once: true });
    img.addEventListener("error", onSettle, { once: true });
  });
  if (remaining <= 0) triggerPrint();
  setTimeout(triggerPrint, 1500);
}

/**
 * Imprime un document HTML autonome (déjà généré en chaîne, styles inline compris — reçus, relevés,
 * convocations…). Les styles embarqués dans le document (`<style>`) sont extraits et posés dans
 * `@media print` (ne s'appliquent donc jamais au reste de l'appli), le `<body>` devient le contenu
 * visible à l'impression.
 */
export function printHtmlDocument(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const extraCss = Array.from(doc.querySelectorAll("style")).map((s) => s.textContent ?? "").join("\n");
  printInMainDocument(doc.body?.innerHTML ?? "", extraCss);
}

/**
 * Imprime un nœud DOM isolément (ex. un badge/carte affiché dans une modale) — pas besoin de recharger
 * de feuilles de style : le clone reste dans le document principal, où elles sont déjà chargées.
 */
export function printNode(node: HTMLElement) {
  // Une seule page pour recto + verso (imprimés côte à côte par le composant badge lui-même via
  // `print:flex-row`) : le badge est destiné à être imprimé sur papier bristol puis plastifié/découpé à
  // la main, pas sur une imprimante à cartes PVC dédiée avec pagination automatique. `size: auto` laisse
  // le format papier réel choisi dans le dialogue d'impression (A4, Letter…).
  const wrapper = `<div style="display:flex;flex-direction:row;align-items:flex-start;justify-content:center;gap:6mm;">${node.outerHTML}</div>`;
  printInMainDocument(wrapper, "@page { size: auto; margin: 8mm; }");
}
