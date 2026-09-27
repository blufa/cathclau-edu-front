/**
 * Accès à la base SQLite locale de l'application desktop (Tauri). Import dynamique uniquement :
 * `@tauri-apps/plugin-sql` échoue au chargement dans un navigateur classique (web), donc ce module ne
 * doit jamais être importé au niveau racine d'un fichier partagé — toujours via `getDesktopDb()`, et
 * seulement après avoir vérifié `isDesktop()` (voir `desktop-runtime.ts`).
 */
let dbPromise: Promise<import("@tauri-apps/plugin-sql").default> | null = null;

export function getDesktopDb() {
  if (!dbPromise) {
    dbPromise = import("@tauri-apps/plugin-sql").then((mod) => mod.default.load("sqlite:jeccam-ecole.db"));
  }
  return dbPromise;
}
