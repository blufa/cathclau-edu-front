/**
 * Compatibilité : l'implémentation vit désormais dans `http.ts` (client Axios). Ce fichier reste
 * en place tel quel — chemin d'import inchangé — pour que les ~38 modules de `lib/api/*.ts` n'aient
 * rien à modifier.
 */
export { api, apiBlobUrl, apiFetch, setSessionExpiredHandler, type RequestOptions } from "./http";
