/**
 * Token storage. Kept in localStorage so the session survives reloads; access via these helpers
 * only (never read localStorage directly) so the storage strategy stays swappable.
 */
const ACCESS_KEY = "laca.accessToken";
const REFRESH_KEY = "laca.refreshToken";

const isBrowser = typeof window !== "undefined";

export function getAccessToken(): string | null {
  return isBrowser ? window.localStorage.getItem(ACCESS_KEY) : null;
}

export function getRefreshToken(): string | null {
  return isBrowser ? window.localStorage.getItem(REFRESH_KEY) : null;
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser) return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

/** ID de l'utilisateur actuellement connecté, extrait du claim `sub` de l'access token (même logique
 * que le backend : `Long.valueOf(jwt.getSubject())`). Pas de vérification de signature ici — ce n'est
 * pas un contrôle de sécurité (le serveur revalide toujours le token), juste un moyen pour le code
 * hors-ligne (file d'attente locale) de savoir QUI encaisse réellement, sans dépendre du contexte React
 * (`useAuth()`), inutilisable dans une fonction utilitaire pure comme `submitGroupPaymentOfflineAware`. */
export function getCurrentUserId(): number | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const id = Number(json.sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}
