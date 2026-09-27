// Build statique pour l'appli desktop (Tauri) : exécute `next build` avec `output: "export"` (voir
// next.config.ts, DESKTOP_BUILD) APRÈS avoir écarté temporairement le site public/marketing
// (src/app/(public)) — ces pages (blog, tarifs, pagination par searchParams...) n'ont aucune place
// dans un ERP installé localement et ne valent pas la peine d'être rendues compatibles avec l'export
// statique une par une. Le dossier est toujours restauré à la fin, succès ou échec (voir `finally`).
// Usage : appelé par `npm run build:desktop` (voir package.json) — jamais à la main directement.
import { rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const publicGroup = path.join(root, "src/app/(public)");
const publicGroupParked = path.join(root, "src/app/_public-parked-for-desktop-build");

// L'appli installée chez les écoles doit TOUJOURS pointer sur une vraie API en ligne (jamais
// localhost:8284, valeur de développement lue par défaut dans .env.local) — contrairement au web/Docker,
// où NEXT_PUBLIC_API_BASE_URL est fourni par le pipeline de déploiement à chaque build, un poste école
// n'a pas de pipeline : l'URL est figée une fois pour toutes à la compilation de l'export statique.
// Prod par défaut ; `DESKTOP_ENV=dev npm run build:desktop` bascule sur le sous-domaine de dev/staging
// pour tester une version desktop sans toucher aux données de production.
const DESKTOP_ENV = process.env.DESKTOP_ENV === "dev" ? "dev" : "prod";
const ENV_URLS = {
  prod: { api: "https://api.ecole.jeccamtech.com/api/v1", site: "https://ecole.jeccamtech.com" },
  dev: { api: "https://api-dev.ecole.jeccamtech.com/api/v1", site: "https://dev.ecole.jeccamtech.com" },
};

async function main() {
  const hadPublicGroup = existsSync(publicGroup);
  if (hadPublicGroup) await rename(publicGroup, publicGroupParked);

  try {
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn("npx", ["next", "build", "--webpack"], {
        cwd: root,
        stdio: "inherit",
        env: {
          ...process.env,
          NEXT_OUTPUT_EXPORT: "1",
          NEXT_PUBLIC_API_BASE_URL: ENV_URLS[DESKTOP_ENV].api,
          NEXT_PUBLIC_SITE_URL: ENV_URLS[DESKTOP_ENV].site,
        },
        shell: process.platform === "win32",
      });
      child.on("error", reject);
      child.on("exit", (code) => resolve(code ?? 1));
    });
    process.exitCode = exitCode;
    if (exitCode === 0) {
      console.log(`\nBuild desktop terminé — cible : ${DESKTOP_ENV} (${ENV_URLS[DESKTOP_ENV].api})`);
    }
  } finally {
    if (hadPublicGroup) await rename(publicGroupParked, publicGroup);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
