/**
 * Aide à la codification des salles : numérotation <b>continue</b> à travers tout le bâtiment
 * (« Salle 001 », « Salle 002 »… « Salle 010 »…), sans repartir à chaque étage. L'assistant reprend
 * automatiquement après la dernière salle existante. Saisie libre toujours possible.
 */

/** Bâtiments proposés (défaut : un seul bâtiment principal). */
export const BUILDINGS = ["Bâtiment principal", "Bâtiment A", "Bâtiment B", "Annexe"];

/** Code d'une salle : « Salle <numéro sur 3 chiffres> » (ex. « Salle 007 »). */
export function roomCode(n: number): string {
  return `Salle ${String(n).padStart(3, "0")}`;
}

/** Suggestions de salles à partir d'un numéro de départ (ex. « Salle 004 » … « Salle 015 »). */
export function roomSuggestions(start = 1, count = 12): string[] {
  return Array.from({ length: count }, (_, i) => roomCode(start + i));
}

/** Prochain numéro libre = plus grand numéro déjà utilisé + 1 (pour enchaîner la numérotation). */
export function nextRoomNumber(existingLabels: string[]): number {
  let max = 0;
  for (const label of existingLabels) {
    const m = String(label).match(/(\d{1,4})/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}
