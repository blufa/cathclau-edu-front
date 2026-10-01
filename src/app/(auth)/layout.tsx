"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { FullPageSpinner } from "@/components/ui/spinner";
import { getBranding } from "@/lib/branding";
import { getSchoolBranding } from "@/lib/api/platform";
import { resolveTenantSlug } from "@/lib/branding/tenant-slug";
import { applyBrandColor } from "@/lib/branding/palette";
import type { SchoolBranding } from "@/lib/types/platform";
import { Reveal } from "@/components/public/reveal";
import { roleHome } from "@/lib/auth/role-access";
import { isDesktop } from "@/lib/offline/desktop-runtime";

/** Layout for unauthenticated pages: already-authenticated users are bounced to their own space. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const branding = getBranding();
  const [school, setSchool] = useState<SchoolBranding | null>(null);
  // "/" (site public) n'existe pas dans le bundle desktop (export statique des seules routes de
  // l'app) — y renvoyer depuis l'écran de connexion y affiche une page blanche/erreur. Calculé après
  // montage (jamais au rendu initial) pour éviter un flash incohérent serveur/client.
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    // Détection d'environnement one-shot, volontairement après le montage pour que le HTML pré-rendu
    // (export statique, sans window) et le premier rendu client restent identiques.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesktop(isDesktop());
  }, []);

  useEffect(() => {
    if (status === "authenticated") router.replace(roleHome(user));
  }, [status, user, router]);

  // Apply the tenant's public branding (logo + colour) on the login/signup screens.
  useEffect(() => {
    const slug = resolveTenantSlug();
    if (!slug) return;
    let active = true;
    void (async () => {
      try {
        const b = await getSchoolBranding(slug);
        if (!active) return;
        setSchool(b);
        if (b.brandColor) applyBrandColor(b.brandColor);
      } catch {
        /* unknown school → default branding */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading" || status === "authenticated") return <FullPageSpinner />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white px-4 py-12">
      {/* Back to public home — the auth screens are full-screen with no header. Absent en desktop :
          "/" n'existe pas dans le bundle (export statique des seules routes de l'app). */}
      {!desktop && (
        <Link
          href="/"
          className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
      )}

      <Reveal className="relative z-10 w-full max-w-md">
        {(() => {
          const logo = (
            <>
              {school?.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={school.logo} alt="logo" className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-brand-500/20" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white shadow-lg shadow-brand-500/30">
                  {branding.logoLetter}
                </div>
              )}
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">{school?.schoolName ?? branding.appName}</h1>
            </>
          );
          return desktop ? (
            <div className="mb-8 flex flex-col items-center gap-2">{logo}</div>
          ) : (
            <Link href="/" className="mb-8 flex flex-col items-center gap-2">{logo}</Link>
          );
        })()}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-slate-900/[0.03]">
          {children}
        </div>
      </Reveal>
    </div>
  );
}
