/** SUPER_ADMIN tenant impersonation: operate within a chosen school for testing/support. */
const KEY = "impersonatedTenantId";

export function getImpersonatedTenantId(): number | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v ? Number(v) : null;
}

export function setImpersonatedTenantId(id: number | null): void {
  if (typeof window === "undefined") return;
  if (id == null) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, String(id));
}
