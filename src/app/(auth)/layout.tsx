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
import { AuroraBackground, Spotlight } from "@/components/ui/aceternity";
import { Reveal } from "@/components/public/reveal";

/** Layout for unauthenticated pages: already-authenticated users are bounced to the dashboard. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const branding = getBranding();
  const [school, setSchool] = useState<SchoolBranding | null>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

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
    <AuroraBackground className="min-h-screen px-4 py-12">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#99f6e4" />

      {/* Back to public home — the auth screens are full-screen with no header. */}
      <Link
        href="/"
        className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-600 backdrop-blur transition hover:border-brand-300 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Accueil
      </Link>

      <Reveal className="relative z-10 w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center gap-2">
          {school?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logo} alt="logo" className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-brand-500/20" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white shadow-lg shadow-brand-500/30">
              {branding.logoLetter}
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{school?.schoolName ?? branding.appName}</h1>
        </Link>
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-xl ring-1 ring-slate-900/[0.03] backdrop-blur">
          {children}
        </div>
      </Reveal>
    </AuroraBackground>
  );
}
