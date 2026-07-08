import { api } from "@/lib/api/client";

/** Active module codes for the current tenant (full set during an active trial). */
export function getActiveModules(): Promise<string[]> {
  return api.get<string[]>("/modules/active");
}
