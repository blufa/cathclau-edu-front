import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { AuroraBackground, Spotlight } from "@/components/ui/aceternity";

export default function NotFound() {
  return (
    <AuroraBackground className="min-h-screen px-4 py-20 text-center">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#99f6e4" />
      <div className="relative z-10 mx-auto max-w-md">
        <p className="bg-gradient-to-br from-brand-500 to-brand-700 bg-clip-text text-7xl font-extrabold tracking-tight text-transparent">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Page introuvable</h1>
        <p className="mt-3 text-slate-600">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <LinkButton href="/">Retour à l&apos;accueil</LinkButton>
          <Link
            href="/dashboard"
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            Mon tableau de bord
          </Link>
        </div>
      </div>
    </AuroraBackground>
  );
}
