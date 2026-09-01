"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery } from "@/hooks/use-query";
import { listPrefectures } from "@/lib/api/platform";
import { Select } from "@/components/ui/select";

/**
 * Sélecteur de préfecture/commune affiché uniquement pour SUPER_ADMIN sur les pages /dpe/* :
 * un compte DPE_ADMIN a toujours son propre périmètre résolu côté backend et n'a jamais besoin de
 * ce sélecteur (voir DpeScopeResolver). SUPER_ADMIN, lui, doit explicitement choisir quelle
 * préfecture/commune prévisualiser — sans ce composant, les pages /dpe/* échouent pour lui avec
 * « prefectureId requis ».
 */
export function DpePrefectureBanner() {
  const { isSuperAdmin } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefecturesQuery = useQuery(() => listPrefectures(), []);

  if (!isSuperAdmin) return null;

  const currentId = searchParams.get("prefectureId") ?? "";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("prefectureId", value);
    else params.delete("prefectureId");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
      <span className="text-sm font-medium text-brand-800">Aperçu SUPER_ADMIN — Préfecture/commune :</span>
      <Select
        aria-label="Choisir une préfecture/commune"
        className="max-w-xs"
        value={currentId}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Choisir —</option>
        {(prefecturesQuery.data ?? []).map((p) => (
          <option key={p.id} value={p.id}>{p.nom} ({p.type})</option>
        ))}
      </Select>
    </div>
  );
}
