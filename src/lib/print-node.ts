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
import { PDFDocument } from "pdf-lib";

/**
 * Fusionne plusieurs PDF (ex. un reçu par enfant, après une inscription groupée — §retour comptable :
 * "il clique une seule fois sur imprimer pour tous les reçus encaissés") en UN SEUL PDF, pour
 * l'imprimer ensuite via {@link stageFilePrintRoot} comme un document normal.
 *
 * Pourquoi la fusion plutôt que plusieurs iframes empilées (essayé en premier, abandonné) : chaque
 * iframe a une hauteur fixe (`100vh`, la hauteur de l'écran) — en impression, ça ne correspond PAS à
 * la hauteur d'une page papier, et un reçu qui dépasse cette hauteur fixe est simplement ROGNÉ (une
 * iframe ne reflow jamais son contenu au-delà de sa boîte, contrairement à une page qui peut créer de
 * nouvelles pages). Un vrai PDF fusionné, lui, est paginé NATIVEMENT par la visionneuse PDF du
 * navigateur — exactement comme n'importe quel PDF multi-pages déjà imprimé normalement ailleurs dans
 * l'appli, sans bricolage CSS de saut de page.
 */
export async function mergePdfsForPrint(urls: string[]): Promise<string> {
  const merged = await PDFDocument.create();
  for (const url of urls) {
    const bytes = await fetch(url).then((r) => r.arrayBuffer());
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  const mergedBytes = await merged.save();
  return URL.createObjectURL(new Blob([mergedBytes as unknown as BlobPart], { type: "application/pdf" }));
}

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

/**
 * Imprime une planche de badges (3×3, CR80, voir {@code BadgeSheet}) sur papier bristol A4 — contexte
 * différent de {@link printNode} : ici le format papier EST imposé (A4, sinon la grille de 9 cartes ne
 * tient plus dans la page) et les coins arrondis des cartes doivent être conservés à l'impression (ce
 * sont les repères de découpe), contrairement à une carte imprimée seule puis découpée à la main.
 */
export function printBadgeSheet(node: HTMLElement) {
  // Marge réduite à 3mm : 3 rangées de cartes CR80 portrait (85,6mm chacune) tiennent de justesse sur
  // une page A4 — une marge plus large faisait déborder la 3e rangée (les trois dernières cartes) sur
  // une deuxième page, voir le détail du calcul dans badge-sheet.tsx. Au-delà de cette marge CSS, la
  // plupart des navigateurs réservent AUSSI 10-25mm en haut/bas pour leurs propres en-tête/pied de page
  // (titre, date, numéro) — invisible depuis le CSS, seulement désactivable manuellement dans la boîte
  // de dialogue d'impression ("En-têtes et pieds de page" décoché) si ça déborde encore malgré tout.
  printInMainDocument(node.outerHTML, "@page { size: A4; margin: 2.5mm; }");
}

/**
 * Prépare l'impression directe d'un fichier déjà téléchargé (PDF généré côté serveur — reçu,
 * facture… — ou image, voir `kind` ; pas un document HTML généré en chaîne — voir
 * {@link printHtmlDocument} pour ce cas) : contrairement à {@link printInMainDocument}, ne déclenche
 * PAS l'impression tout de suite — pose juste le contenu (masqué sauf pendant l'impression) et
 * retourne une fonction de nettoyage, à appeler quand l'aperçu se ferme.
 *
 * Pourquoi cette distinction (§retour comptable — "le clic Imprimer ne doit jamais ouvrir un nouvel
 * onglet, et Ctrl+P doit marcher aussi") : `window.print()` déclenché explicitement par le bouton
 * « Imprimer » ET le raccourci natif Ctrl+P appellent tous les deux la MÊME impression navigateur —
 * pour que Ctrl+P produise le bon résultat SANS JavaScript dédié à l'écoute de cette touche, le
 * contenu à imprimer (et le CSS qui masque le reste de la page) doit déjà être en place dans le DOM
 * au moment où l'utilisateur appuie sur Ctrl+P, pas seulement au moment du clic sur le bouton — d'où
 * le fait de poser ceci dès l'ouverture de l'aperçu (voir `FilePreview`), pas dans le clic lui-même.
 *
 * Réutilise une VRAIE iframe/img (jamais `iframe.contentWindow.print()`, qui ne fait rien dans le
 * webview desktop Tauri — voir le commentaire de {@link printInMainDocument}) : l'élément participe
 * au rendu de la page principale, c'est `window.print()` SUR LA FENÊTRE PRINCIPALE qui déclenche
 * l'impression, jamais l'iframe elle-même — ce qui fonctionne identiquement sur web et sur desktop.
 */
export function stageFilePrintRoot(url: string, kind: "pdf" | "image" = "pdf"): () => void {
  const root = document.createElement("div");
  root.id = "app-print-root";
  let el: HTMLIFrameElement | HTMLImageElement;
  if (kind === "image") {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Document à imprimer";
    img.style.width = "100%";
    img.style.objectFit = "contain";
    el = img;
  } else {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = "Document à imprimer";
    iframe.style.width = "100%";
    iframe.style.height = "100vh";
    iframe.style.border = "none";
    el = iframe;
  }
  root.appendChild(el);
  document.body.appendChild(root);

  const style = document.createElement("style");
  style.textContent = `
    @media print {
      body > :not(#app-print-root) { display: none !important; }
      #app-print-root { display: block !important; }
      #app-print-root iframe { width: 100%; height: 100%; }
      #app-print-root img { width: 100%; }
      /* A4 explicite : les reçus/factures générés côté serveur (OpenPdfReceiptGenerator) sont tous
         en A4 — sans ça, le dialogue d'impression du webview desktop peut retomber sur un format
         par défaut différent (Letter) et mal cadrer la page. */
      @page { size: A4; margin: 0; }
    }
  `;
  document.head.appendChild(style);

  let removed = false;
  return function unstage() {
    if (removed) return;
    removed = true;
    root.remove();
    style.remove();
  };
}
