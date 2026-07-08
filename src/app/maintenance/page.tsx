import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { AuroraBackground, Spotlight } from "@/components/ui/aceternity";
import { getBranding } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Maintenance — CathClau Edu",
  robots: { index: false },
};

export default function MaintenancePage() {
  const branding = getBranding();
  return (
    <AuroraBackground className="min-h-screen px-4 py-20 text-center">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#99f6e4" />
      <div className="relative z-10 mx-auto max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white shadow-lg shadow-brand-500/30">
            {branding.logoLetter}
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">{branding.appName}</span>
        </div>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Wrench className="h-7 w-7" strokeWidth={1.6} />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">Maintenance en cours</h1>
        <p className="mt-3 text-slate-600">
          La plateforme est temporairement indisponible le temps d&apos;une mise à jour. Merci de votre
          patience — nous revenons très vite.
        </p>
        <p className="mt-6 text-sm text-slate-400">
          Besoin d&apos;aide ?{" "}
          <a href="mailto:contact@cathclau.edu" className="font-medium text-brand-700 hover:underline">
            contact@cathclau.edu
          </a>
        </p>
      </div>
    </AuroraBackground>
  );
}
