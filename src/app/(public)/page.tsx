import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Headset } from "lucide-react";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { Button } from "@/components/ui/button";
import { MODULE_DETAILS } from "@/lib/content/modules";

export const metadata: Metadata = {
  title: "CathClau Edu — La suite tout-en-un pour gérer votre établissement",
  description:
    "Centralisez la gestion de votre école : élèves, scolarité, vie scolaire, communication aux familles et facturation. 100 % web, essai gratuit de 30 jours.",
  openGraph: {
    title: "CathClau Edu — Gestion scolaire SaaS",
    description: "La plateforme tout-en-un pour piloter votre établissement.",
    type: "website",
  },
};

const HIGHLIGHTS = [
  "Tout inclus, aucun palier verrouillé",
  "Facturation mensuelle, trimestrielle ou annuelle",
  "Support réactif",
  "Tarif adapté à la taille de votre école",
];

/**
 * Page d'accueil — version Tailwind simple et mobile-first (l'ancienne composition Bootstrap/Vankine,
 * plus chargée et sujette à des sauts de mise en page sur mobile, a été retirée). Contenu volontairement
 * réduit à l'essentiel pour une plateforme de gestion scolaire : proposition de valeur, modules réels,
 * pourquoi choisir la plateforme, appel à l'action. Pas de témoignages ni statistiques inventés.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              Bienvenue sur CathClau Edu
            </p>
            <h1 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Gagnez du temps pour ce qui compte : vos élèves
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600 sm:text-lg">
              Élèves, scolarité, présences, notes, facturation et communication aux familles,
              réunis dans une seule plateforme, 100&nbsp;% web.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button component={Link} href="/signup" size="lg" className="rounded-full px-6">
                Essai gratuit 30 jours
              </Button>
              <Button component={Link} href="/tarifs" variant="outline" size="lg" className="rounded-full px-6">
                Voir les tarifs
              </Button>
            </div>
          </div>
        </section>

        {/* Modules */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Nos modules métier</h2>
            <p className="mt-2 text-sm text-gray-500">Toute l&apos;expertise de l&apos;école, réunie.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE_DETAILS.map((m) => (
              <Link
                key={m.slug}
                href={`/fonctionnalites/${m.slug}`}
                className="group rounded-2xl border border-gray-200 p-6 shadow-sm transition hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <m.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900 group-hover:text-brand-700">
                  {m.title}
                </h3>
                <p className="mt-1.5 text-sm text-gray-600">{m.lead}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Pourquoi nous choisir */}
        <section className="bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Une plateforme complète, sans les mauvaises surprises
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-600">
                Pas de fonctionnalités verrouillées derrière un palier supérieur, pas de support
                introuvable une fois le contrat signé.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {HIGHLIGHTS.map((h) => (
                <div key={h} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />
                  <span className="text-sm font-medium text-gray-800">{h}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-brand-600 px-6 py-10 text-center sm:flex-row sm:px-10 sm:text-left">
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                Prêt à moderniser la gestion de votre établissement ?
              </h2>
              <div className="mt-2 flex items-center justify-center gap-2 text-sm text-white/80 sm:justify-start">
                <Headset className="h-4 w-4" />
                <a href="tel:+224620000000" className="hover:text-white">+224 620 00 00 00</a>
              </div>
            </div>
            <Button component={Link} href="/signup" size="lg" className="rounded-full bg-white px-6 text-brand-700 hover:bg-brand-50">
              Créer mon école
            </Button>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
