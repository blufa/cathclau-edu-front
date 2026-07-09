/**
 * Validation d'un numéro de téléphone guinéen. Mobile = 9 chiffres commençant par 6
 * (ex. « 620 00 00 00 »), avec indicatif +224 optionnel. Espaces et tirets ignorés.
 */
export function isValidGuineaPhone(raw: string): boolean {
  const digits = raw.replace(/[\s.-]/g, "");
  return /^(\+?224)?6\d{8}$/.test(digits);
}

/**
 * Règle de validation Mantine : accepte un champ vide (téléphone optionnel), sinon impose le format.
 * Usage : `validate: { phone: guineaPhoneRule }`
 */
export function guineaPhoneRule(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return isValidGuineaPhone(value) ? null : "Numéro invalide (ex. 620 00 00 00)";
}

/** Placeholder standard pour les champs téléphone. */
export const PHONE_PLACEHOLDER = "620 00 00 00";
