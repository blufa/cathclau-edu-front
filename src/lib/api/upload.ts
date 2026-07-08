import { getAccessToken } from "@/lib/auth/tokens";
import { getImpersonatedTenantId } from "@/lib/auth/impersonation";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8284/api/v1";

/** Uploads a file to Cloudinary via the backend and returns its secure URL. */
export async function uploadFile(file: File, folder?: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  if (folder) form.append("folder", folder);

  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const impersonated = getImpersonatedTenantId();
  if (impersonated != null) headers.set("X-Tenant-Id", String(impersonated));

  const res = await fetch(`${BASE_URL}/uploads${folder ? "" : ""}`, { method: "POST", headers, body: form });
  if (!res.ok) {
    let detail = "Échec de l'envoi du fichier";
    try { const j = await res.json(); detail = j.detail ?? j.message ?? detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}
