// Génère/complète `latest.json` (manifeste attendu par le plugin updater de Tauri) à partir des
// artefacts produits par `tauri build` — cherche récursivement tout fichier `.sig` sous le dossier
// donné et déduit la plateforme (windows-x86_64, windows-i686, darwin-x86_64, darwin-aarch64,
// linux-x86_64) depuis le nom de fichier de l'installeur associé.
//
// Appelé une fois par job de build (32 bits, 64 bits...) dans la CI desktop — chaque appel FUSIONNE
// ses résultats dans le `latest.json` existant plutôt que de l'écraser, pour accumuler les plateformes
// au fil des jobs du même workflow (voir .github/workflows/desktop-release.yml).
//
// Usage : node scripts/generate-update-manifest.mjs <version> <base-url> [bundle-dir]
// Exemple :
//   node scripts/generate-update-manifest.mjs 0.1.1 https://ecole.jeccamtech.com/updates/0.1.1 \
//     src-tauri/target/i686-pc-windows-msvc/release/bundle
//
// ATTENTION : écrit selon la structure documentée de Tauri v2, jamais exécutée ici faute de build
// Windows possible dans cet environnement (macOS, cross-compilation GUI non fiable) — à vérifier lors
// du premier vrai run CI (voir DEPLOY-DESKTOP.md).
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const [, , version, baseUrl, bundleDirArg] = process.argv;
if (!version || !baseUrl) {
  console.error("Usage: node scripts/generate-update-manifest.mjs <version> <base-url> [bundle-dir]");
  process.exit(1);
}
const bundleDir = bundleDirArg
  ? path.resolve(bundleDirArg)
  : path.join(root, "src-tauri/target/release/bundle");

// Nom de fichier de l'installeur → clé de plateforme attendue par le plugin updater Tauri. L'ORDRE
// compte : les motifs les plus spécifiques (ex. "_x86-setup") doivent être testés avant les motifs
// génériques pour éviter une fausse détection.
const NAME_TO_PLATFORM = [
  { test: /_x64-setup\.exe$/, platform: "windows-x86_64" },
  { test: /_x86-setup\.exe$/, platform: "windows-i686" },
  { test: /_x64\.msi$/, platform: "windows-x86_64" },
  { test: /_x86\.msi$/, platform: "windows-i686" },
  { test: /_aarch64\.app\.tar\.gz$/, platform: "darwin-aarch64" },
  { test: /_x64\.app\.tar\.gz$/, platform: "darwin-x86_64" },
  { test: /\.AppImage\.tar\.gz$/, platform: "linux-x86_64" },
];

async function findArtifacts(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findArtifacts(full)));
      continue;
    }
    if (!entry.name.endsWith(".sig")) continue;
    const artifactPath = full.slice(0, -".sig".length);
    const artifactName = path.basename(artifactPath);
    const match = NAME_TO_PLATFORM.find((m) => m.test.test(artifactName));
    if (!match) {
      console.warn(`Signature ${full} ignorée : plateforme non reconnue pour "${artifactName}".`);
      continue;
    }
    if (!(await stat(artifactPath).catch(() => null))) {
      console.warn(`Installeur introuvable pour la signature ${full} (attendu : ${artifactPath}).`);
      continue;
    }
    const signature = (await readFile(full, "utf8")).trim();
    results.push({ platform: match.platform, url: `${baseUrl.replace(/\/$/, "")}/${artifactName}`, signature });
  }
  return results;
}

async function main() {
  const artifacts = await findArtifacts(bundleDir);
  if (artifacts.length === 0) {
    console.error(`Aucun artefact signé trouvé sous ${bundleDir}. As-tu lancé "tauri build" avant ?`);
    process.exit(1);
  }

  const outPath = path.join(root, "latest.json");
  let manifest = {
    version,
    notes: `Mise à jour Jeccam Edu ${version}`,
    pub_date: new Date().toISOString(),
    platforms: {},
  };
  const existing = await readFile(outPath, "utf8").catch(() => null);
  if (existing) manifest = { ...manifest, ...JSON.parse(existing) };

  for (const a of artifacts) manifest.platforms[a.platform] = { signature: a.signature, url: a.url };

  await writeFile(outPath, JSON.stringify(manifest, null, 2));
  console.log(`Écrit : ${outPath}`);
  console.log("Plateformes présentes :", Object.keys(manifest.platforms).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
