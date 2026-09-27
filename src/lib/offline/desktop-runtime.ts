/**
 * Détecte si le code tourne dans l'application desktop (Tauri) plutôt que dans un navigateur web.
 * Sert de seul point de bascule entre les deux mécanismes hors-ligne : IndexedDB/Dexie (web, voir
 * `db.ts`/`sync-engine.ts`, inchangés) et SQLite (desktop, voir `desktop-db.ts`) — jamais les deux en
 * même temps dans le même environnement d'exécution.
 */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
