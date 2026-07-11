/**
 * Téléphones internationaux basés sur les métadonnées officielles (libphonenumber-js) : liste complète
 * des pays, formatage « as-you-type » et longueur maximale par pays. Le numéro est stocké au format
 * international E.164 (`+224620000000`). Voir le composant `PhoneInput`.
 */
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js";

export type { CountryCode };

/** Pays par défaut (Guinée). */
export const DEFAULT_COUNTRY: CountryCode = "GN";

// Noms de pays localisés en français, sans dépendance supplémentaire.
const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["fr"], { type: "region" })
    : null;

/** Emoji drapeau à partir du code ISO-2 (indicateurs régionaux Unicode). */
export function flagOf(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export interface CountryOption {
  code: CountryCode;
  name: string;
  dial: string;
  flag: string;
}

/** Tous les pays, triés par nom (FR), avec indicatif et drapeau. */
export const COUNTRY_OPTIONS: CountryOption[] = getCountries()
  .map((code) => ({
    code,
    dial: getCountryCallingCode(code),
    name: regionNames?.of(code) ?? code,
    flag: flagOf(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

function digitsOnly(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Décompose un E.164 (ou un numéro brut) en { country, national }. */
export function parsePhone(
  value: string | null | undefined,
  fallback: CountryCode = DEFAULT_COUNTRY,
): { country: CountryCode; national: string } {
  const raw = (value ?? "").trim();
  // Uniquement avec un indicatif explicite (+ ou 00) on détecte le pays ; sinon on traite le numéro
  // comme national du pays par défaut (évite de « deviner » un pays sur un numéro local existant).
  if (raw.startsWith("+") || raw.startsWith("00")) {
    const normalized = raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
    const parsed = parsePhoneNumberFromString(`+${digitsOnly(normalized)}`);
    if (parsed?.country) {
      return { country: parsed.country, national: parsed.nationalNumber };
    }
  }
  return { country: fallback, national: digitsOnly(value) };
}

/** Formate le numéro local selon le pays (ex. GN « 620000000 » → « 620 00 00 00 »). */
export function formatNational(country: CountryCode, national: string): string {
  return new AsYouType(country).input(digitsOnly(national));
}

/** Retire les chiffres en trop pour respecter la longueur maximale du pays. */
export function capNational(country: CountryCode, national: string): string {
  let d = digitsOnly(national);
  while (d.length > 0 && validatePhoneNumberLength(d, country) === "TOO_LONG") {
    d = d.slice(0, -1);
  }
  return d;
}

/** Numéro local + pays → E.164 (`+<indicatif><national>`) ; chaîne vide si le local est vide. */
export function toE164(country: CountryCode, national: string): string {
  const d = digitsOnly(national);
  return d ? `+${getCountryCallingCode(country)}${d}` : "";
}

/** Règle Mantine : téléphone facultatif, sinon numéro international valide requis. */
export function phoneRule(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const raw = value.trim();
  return isValidPhoneNumber(raw.startsWith("+") ? raw : `+${digitsOnly(raw)}`)
    ? null
    : "Numéro invalide pour le pays choisi";
}

/** @deprecated Utiliser {@link phoneRule}. Conservé pour compatibilité. */
export const guineaPhoneRule = phoneRule;
export const PHONE_PLACEHOLDER = "620 00 00 00";
