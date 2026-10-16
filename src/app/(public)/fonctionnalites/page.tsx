import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { Reveal } from "@/components/public/reveal";
import { AuroraBackground, Spotlight } from "@/components/ui/aceternity";
import { MODULE_DETAILS as MODULES } from "@/lib/content/modules";

export const metadata: Metadata = {
  title: "Fonctionnalités — CathClau Edu",
  description: "Découvrez tous les modules : scolarité, communication, facturation et plus.",
};

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <AuroraBackground className="px-4 py-24 text-center">
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#99f6e4" />
        <Reveal className="relative z-10 mx-auto max-w-3xl">
          <span className="inline-block rounded-full border border-brand-200 bg-white/70 px-4 py-1.5 text-xs font-medium text-brand-700 backdrop-blur">
            Modules
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Une plateforme complète, pensée pour l&apos;école
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Tous les outils pour gérer votre établissement au quotidien — réunis et connectés
            entre eux.
          </p>
        </Reveal>
      </AuroraBackground>

      {/* Alternating modules */}
      <div className="mx-auto max-w-6xl px-4 py-16">
        {MODULES.map((m, i) => {
          const Icon = m.icon;
          const reversed = i % 2 === 1;
          return (
            <section
              key={m.title}
              className="grid items-center gap-12 border-b border-slate-100 py-16 last:border-0 lg:grid-cols-2"
            >
              <Reveal className={reversed ? "lg:order-2" : ""}>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-6 w-6" strokeWidth={1.6} />
                </span>
                <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{m.title}</h2>
                <p className="mt-2 text-slate-600">{m.lead}</p>
                <ul className="mt-6 space-y-3">
                  {m.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <LinkButton href={`/fonctionnalites/${m.slug}`} size="sm" variant="secondary" className="mt-6" rightSection={<ArrowRight className="h-4 w-4" />}>
                  En savoir plus
                </LinkButton>
              </Reveal>
              <Reveal
                delay={0.1}
                className={`relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-xl ${
                  reversed ? "lg:order-1" : ""
                }`}
              >
                <Image
                  src={m.image}
                  alt={m.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 32rem"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-900/25 to-transparent" />
              </Reveal>
            </section>
          );
        })}
      </div>

      {/* CTA */}
      <section className="bg-slate-50">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Envie de voir la plateforme en action ?
          </h2>
          <p className="text-slate-600">Connectez-vous à votre espace école pour explorer tous les modules.</p>
          <LinkButton href="/login" size="md">
            Connexion
          </LinkButton>
        </Reveal>
      </section>
    </>
  );
}
