/**
 * Script ponctuel (pas exécuté au build) : reprend les fichiers CSS déjà compilés du template
 * Vankine tels quels (mêmes règles, aucune réécriture de valeurs), mais les confine sous un
 * sélecteur ".vankine-scope" pour qu'ils ne puissent jamais s'appliquer en dehors du site public
 * (l'espace applicatif authentifié reste en Tailwind, jamais touché par Bootstrap/theme.css).
 *
 * Usage : node scripts/scope-vankine-css.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import prefixSelector from "postcss-prefix-selector";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const templateCssDir = join(
  root,
  "Vankine-nextjs-v2.1.0-unzip-first/1.Vankine-Nextjs/public/assets/css",
);
const outDir = join(root, "public/vankine/css");
mkdirSync(outDir, { recursive: true });

const FILES = [
  { src: "global-settings.css" },
  { src: "plugins/bootstrap.min.css" },
  { src: "theme.css" },
  { src: "plugins/animate.min.css" },
  { src: "plugins/flaticon_vankine.css" },
  { src: "plugins/font-awesome.min.css" },
  { src: "plugins/uicons-regular-rounded.css" },
  { src: "plugins/uicons-regular-straight.css" },
];

const prefixPlugin = prefixSelector({
  prefix: ".vankine-scope",
  transform(prefix, selector) {
    // :root/html/body : ces sélecteurs ciblent la racine du document et ne peuvent jamais être
    // un descendant (":root" ne matche littéralement jamais en position imbriquée) — on les
    // remplace directement par le conteneur scope, qui porte alors les variables CSS et les
    // styles de base à la place de <html>/<body>, hérités par tous ses descendants comme :root le
    // ferait normalement pour tout le document.
    const trimmed = selector.trim();
    if (/^(:root|html|body)\b/.test(trimmed)) {
      return prefix + trimmed.replace(/^(:root|html|body)/, "").trim();
    }
    return `${prefix} ${trimmed}`;
  },
});

for (const { src } of FILES) {
  const srcPath = join(templateCssDir, src);
  let css = readFileSync(srcPath, "utf8");
  // Les CSS du template référencent leurs polices en "../../fonts/…" (relatif à assets/css/plugins/
  // ou assets/css/) — nos fichiers scopés vivent tous dans public/vankine/css/, les polices dans
  // public/vankine/fonts/ : un seul niveau à remonter, jamais deux.
  css = css.replace(/url\((["']?)(?:\.\.\/)+fonts\//g, "url($1../fonts/");

  const result = postcss([prefixPlugin]).process(css, { from: srcPath }).css;
  const outName = src.split("/").pop();
  writeFileSync(join(outDir, outName), result, "utf8");
  console.log(`✓ ${src} -> public/vankine/css/${outName} (${(result.length / 1024).toFixed(0)} Ko)`);
}
