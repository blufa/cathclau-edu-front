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
