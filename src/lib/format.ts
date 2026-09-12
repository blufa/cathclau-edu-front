/** Shared formatting helpers: amounts in GNF and ISO dates in fr locale. */

const NUMBER_FMT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const DATETIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Formats a BigDecimal-as-string (or number) amount as "1 234 GNF". */
export function formatGNF(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return `${NUMBER_FMT.format(n)} GNF`;
}

/** Formats an ISO date ("YYYY-MM-DD" or full ISO) as "dd/MM/yyyy". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DATE_FMT.format(d);
}

/** Formats an ISO datetime as "dd/MM/yyyy HH:mm". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DATETIME_FMT.format(d);
}

/** Trims a "HH:mm:ss" time to "HH:mm". */
export function formatTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "—";
}

/** Formate une durée en minutes en heures + minutes (ex. 399 → « 6 h 39 », 45 → « 45 min »). */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "—";
  const abs = Math.abs(minutes);
  const sign = minutes < 0 ? "-" : "";
  if (abs < 60) return `${sign}${abs} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h} h` : `${sign}${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Affiche une classe saisie au format guinéen : un nombre seul devient « Nᵉᵐᵉ » (ème en exposant),
 * « 1 » devient « 1ʳᵉ ». Toute autre saisie (CM2, Terminale…) est laissée telle quelle.
 */
export function formatClassOrdinal(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return s;
  return s === "1" ? "1ʳᵉ" : `${s}ᵉᵐᵉ`;
}

/** Classe d'inscription suggérée à partir de la dernière classe (nombre) : N+1, ou N si redoublant. */
export function nextClassOrdinal(previous: string | number | null | undefined, repeating: boolean): string {
  const s = String(previous ?? "").trim();
  if (!/^\d+$/.test(s)) return formatClassOrdinal(s);
  const n = Number(s);
  return formatClassOrdinal(repeating ? n : n + 1);
}

/** SMS : au-delà de 160 caractères purs GSM-7 (ou 70 dès qu'un accent/caractère spécial force
 * l'encodage UCS-2), le message est découpé en plusieurs segments facturés séparément — l'école doit
 * pouvoir le voir avant d'envoyer/enregistrer un texte trop long. */
export function smsSegmentInfo(text: string): { length: number; unicode: boolean; limit: number; segments: number } {
  const unicode = /[^\x00-\x7F]/.test(text);
  const limit = unicode ? 70 : 160;
  const length = text.length;
  const segments = length === 0 ? 0 : Math.ceil(length / limit);
  return { length, unicode, limit, segments };
}

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Libellé court d'un mois "YYYY-MM" (ex. "2026-04" → "avril") — mois d'une échéance/tranche. */
export function monthShortLabel(monthValue: string): string {
  const [, m] = monthValue.split("-").map(Number);
  return MONTHS_FR[m - 1] ?? monthValue;
}
