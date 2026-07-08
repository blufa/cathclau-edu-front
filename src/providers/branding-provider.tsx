"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { getTenantBranding, type TenantBranding } from "@/lib/api/branding";
import { applyBrandColor, clearBrandColor } from "@/lib/branding/palette";

interface BrandingContextValue {
  branding: TenantBranding | null;
  refresh: () => void;
}

const BrandingContext = createContext<BrandingContextValue>({ branding: null, refresh: () => {} });

/**
 * Loads the current school's branding (logo + colour) and applies the colour to the whole UI
 * (CSS variables) so buttons and accents adopt it. Falls back to the default theme otherwise.
 */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  const load = useCallback(async () => {
    if (tenantId == null) {
      setBranding(null);
      clearBrandColor();
      return;
    }
    try {
      const b = await getTenantBranding();
      setBranding(b);
      if (b.brandColor) applyBrandColor(b.brandColor);
      else clearBrandColor();
    } catch {
      /* keep default theme on error */
    }
  }, [tenantId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  return <BrandingContext.Provider value={{ branding, refresh: load }}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
