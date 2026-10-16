"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
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

const AUTH_HIGHLIGHTS = [
  "Tout inclus, aucun palier verrouillé",
  "Facturation mensuelle, trimestrielle ou annuelle",
  "Support réactif",
  "Tarif adapté à la taille de votre école",
];

/** Layout for unauthenticated pages: already-authenticated users are bounced to their own space. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const branding = getBranding();
  const [school, setSchool] = useState<SchoolBranding | null>(null);
  // "/" (site public) n'existe pas dans le bundle desktop (export statique des seules routes de
  // l'app) — y renvoyer depuis l'écran de connexion y affiche une page blanche/erreur. Calculé après
  // montage (jamais au rendu initial) pour éviter un flash incohérent serveur/client. Sert aussi à
  // masquer le panneau de présentation ci-dessous (aucun site public à mettre en avant dans l'app).
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

  // Apply the tenant's public branding (logo + colour) on the login screen.
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
  // En navigateur (pas l'app desktop), le panneau de présentation ci-dessous reprend déjà le logo —
  // ce bloc ne reste utile qu'en dessous de lg (où le panneau est masqué) ou dans l'app desktop (où
  // il n'existe pas du tout).
  const logoBlockClassName = desktop ? "mb-8 flex flex-col items-center gap-2" : "mb-8 flex flex-col items-center gap-2 lg:hidden";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Panneau de présentation — grand écran uniquement, absent de l'app desktop (pas de site public
          à mettre en avant dans ce contexte, voir note sur `desktop` plus haut). */}
      {!desktop && (
        <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <Link href="/" className="relative z-10 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold text-white backdrop-blur-sm">
              {branding.logoLetter}
            </div>
            <span className="text-lg font-semibold text-white">{branding.appName}</span>
          </Link>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold leading-snug text-white xl:text-3xl">
              Pilotez votre établissement, sans jongler entre dix outils.
            </h2>
            <ul className="mt-6 space-y-3">
              {AUTH_HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-center gap-2.5 text-sm text-white/85">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-white" /> {h}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative z-10 text-xs text-white/60">Besoin d&apos;aide ? +224 614 32 42 99</p>
        </div>
      )}

      {/* Formulaire */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white px-4 py-12">
        {!desktop && (
          <Link
            href="/"
            className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-brand-300 hover:text-brand-700 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
        )}

        <Reveal className="relative z-10 w-full max-w-md">
          {desktop ? (
            <div className={logoBlockClassName}>{logo}</div>
          ) : (
            <Link href="/" className={logoBlockClassName}>{logo}</Link>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-slate-900/[0.03] sm:p-8">
            {children}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
