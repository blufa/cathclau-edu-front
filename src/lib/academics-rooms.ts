/**
 * Aide à la codification des salles. La plupart des écoles guinéennes ont un seul bâtiment de
 * plusieurs étages : on propose une numérotation « étage + numéro » (ex. « Salle 101 » = 1er étage,
 * salle 01), tout en laissant la saisie libre. Partagé entre le formulaire de salle et l'assistant.
 */

/** Bâtiments proposés (défaut : un seul bâtiment principal). */
export const BUILDINGS = ["Bâtiment principal", "Bâtiment A", "Bâtiment B", "Annexe"];

/** Étages proposés ; la valeur est le chiffre utilisé dans la numérotation des salles. */
export const FLOORS: { value: string; label: string }[] = [
  { value: "0", label: "Rez-de-chaussée" },
  { value: "1", label: "1er étage" },
  { value: "2", label: "2e étage" },
  { value: "3", label: "3e étage" },
  { value: "4", label: "4e étage" },
];

/** Code d'une salle : « Salle <étage><numéro sur 2 chiffres> » (ex. « Salle 103 »). */
export function roomCode(floorDigit: string, n: number): string {
  return `Salle ${floorDigit}${String(n).padStart(2, "0")}`;
}

/** Suggestions de salles pour un étage donné (ex. « Salle 101 » … « Salle 112 »). */
export function roomSuggestions(floorDigit: string, count = 12): string[] {
  return Array.from({ length: count }, (_, i) => roomCode(floorDigit, i + 1));
}
