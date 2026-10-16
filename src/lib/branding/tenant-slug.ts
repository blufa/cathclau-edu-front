/** Resolves the current school's slug for public pages (login), from the subdomain or a query param. */

const RESERVED = new Set(["www", "app", "localhost", "127", "0", "staging", "preprod", "demo"]);

export function resolveTenantSlug(): string | null {
  if (typeof window === "undefined") return null;

  // 1) Explicit override: ?ecole=slug or ?school=slug
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("ecole") ?? params.get("school");
  if (fromQuery) return fromQuery.trim().toLowerCase();

  // 2) Subdomain: <slug>.domain.tld (ignore reserved hosts and bare/local hosts)
  const host = window.location.hostname;
  if (!host || host.endsWith(".localhost")) {
    const label = host.split(".")[0];
    return label && !RESERVED.has(label) ? label : null;
  }
  const parts = host.split(".");
  if (parts.length >= 3) {
    const label = parts[0].toLowerCase();
    if (!RESERVED.has(label)) return label;
  }
  return null;
}
