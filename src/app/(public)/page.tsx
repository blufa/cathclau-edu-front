import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  Headset,
  HeartPulse,
  LineChart,
  Lock,
  MessagesSquare,
  Rocket,
  Server,
  Settings2,
  ShieldCheck,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { LandingFaq } from "@/components/public/landing-faq";
import { Reveal } from "@/components/public/reveal";
import { HeroBgCarousel } from "@/components/public/hero-bg-carousel";
import { SegmentsShowcase } from "@/components/public/segments-showcase";
import { IMAGES } from "@/lib/images";
import { InfiniteMovingCards, WobbleCard } from "@/components/ui/aceternity";

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

const EXPERTISE = [
  {
    icon: ClipboardCheck,
    title: "Vie scolaire & présences",
    text: "Suivi des comportements, appels en classe, retards et absences notifiés en temps réel aux familles.",
  },
  {
    icon: CalendarDays,
    title: "Organisation au quotidien",
    text: "Emplois du temps, salles, évaluations, notes et bulletins automatisés à la clôture de période.",
  },
  {
    icon: MessagesSquare,
    title: "Communication & collaboration",
    text: "Messages SMS, e-mail et WhatsApp ciblés : absences, résultats, échéances et réunions.",
  },
  {
    icon: Wallet,
    title: "Administration & facturation",
    text: "Inscriptions, frais scolaires, échéanciers, factures et paiements mobile money en ligne.",
  },
  {
    icon: Calculator,
    title: "Finances & comptabilité",
    text: "Budget annuel, dépenses, petite caisse, subventions, rapprochement bancaire et comptabilité en partie double.",
  },
  {
    icon: HeartPulse,
    title: "Santé & vie scolaire",
    text: "Fiches santé (allergies, PAI), passages à l'infirmerie, discipline graduée et contacts d'urgence.",
  },
  {
    icon: UtensilsCrossed,
    title: "Activités & cantine",
    text: "Transport, restauration et activités extrascolaires gérés et facturés au même endroit.",
  },
];

const STEPS = [
  {
    icon: Rocket,
    step: "01",
    title: "Créez votre établissement",
    text: "Inscrivez votre école en quelques minutes et démarrez votre essai gratuit, sans installation ni carte bancaire.",
  },
  {
    icon: Settings2,
    step: "02",
    title: "Configurez classes & frais",
    text: "Importez vos élèves, paramétrez niveaux, classes, matières et grilles de frais scolaires à votre rythme.",
  },
  {
    icon: LineChart,
    step: "03",
    title: "Pilotez au quotidien",
    text: "Présences, notes, bulletins, paiements et communication aux familles, centralisés dans un tableau de bord.",
  },
];

const CAPABILITIES = [
  { n: "11", l: "modules métier intégrés" },
  { n: "3", l: "canaux : SMS · Email · WhatsApp" },
  { n: "8", l: "rôles & permissions (RBAC)" },
  { n: "100%", l: "web, multi-établissements" },
];

const TESTIMONIALS = [
  {
    quote: "Le recouvrement des frais a bondi de 40 % en un trimestre, et les relances se font toutes seules.",
    name: "Mariam Diallo",
    role: "Directrice — Groupe Scolaire Espoir, Conakry",
  },
  {
    quote: "Les bulletins se génèrent automatiquement à la clôture. Fini les week-ends entiers de calcul.",
    name: "Ibrahima Bah",
    role: "Proviseur — Collège Les Lauriers, Kindia",
  },
  {
    quote: "Les parents reçoivent les absences en temps réel par WhatsApp. La relation famille a changé.",
    name: "Aïssata Camara",
    role: "Censeure — Lycée Sainte-Marie, Labé",
  },
];

const LOGOS = [
  { name: "Groupe Scolaire Espoir", title: "Conakry" },
  { name: "Collège Les Lauriers", title: "Kindia" },
  { name: "Lycée Sainte-Marie", title: "Labé" },
  { name: "École Avenir", title: "Kankan" },
  { name: "Institut Lumière", title: "Nzérékoré" },
  { name: "Complexe Le Savoir", title: "Boké" },
];

const SUPPORT = [
  { title: "Assistance dédiée", text: "Une équipe d'experts qui connaît le métier de l'école, joignable quand vous en avez besoin." },
  { title: "Service continu", text: "Plateforme 100 % web, accessible partout, sans installation ni maintenance de votre côté." },
  { title: "Formation & accompagnement", text: "Prise en main guidée, ressources et accompagnement au déploiement pour vos équipes." },
];

const SECURITY = [
  { icon: Server, title: "Hébergement maîtrisé", text: "Données isolées par établissement (multi-tenant) et sauvegardées." },
  { icon: Lock, title: "Confidentialité", text: "Accès strictement contrôlés par rôles et permissions (RBAC)." },
  { icon: ShieldCheck, title: "Conformité", text: "Journalisation des actions sensibles et traçabilité complète." },
];

export default function LandingPage() {
  return (
    <>
      {/* 1. HERO — full-bleed image carousel */}
      <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden px-4 py-28">
        <HeroBgCarousel />
        <div className="relative z-10 mx-auto w-full max-w-5xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
              Suite de gestion scolaire · 100 % web
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-sm sm:text-6xl lg:text-7xl">
              Gagnez du temps pour ce qui compte vraiment :
              <span className="bg-gradient-to-r from-brand-200 to-cyan-200 bg-clip-text text-transparent"> vos élèves</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
              Une suite logicielle complète qui centralise la gestion et la communication de votre
              établissement, de l&apos;inscription de l&apos;élève jusqu&apos;à l&apos;encaissement des frais.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <LinkButton href="/signup" size="md" rightSection={<ArrowRight className="h-4 w-4" />}>
                Demander une démo
              </LinkButton>
              <a
                href="#modules"
                className="rounded-full border border-white/30 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Découvrir les modules
              </a>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-white/85">
              {[
                { n: "100%", l: "Web, sans installation" },
                { n: "30 j", l: "d'essai gratuit" },
                { n: "SMS · Email · WhatsApp", l: "communication parents" },
              ].map((s) => (
                <div key={s.l} className="text-center">
                  <p className="text-xl font-bold text-white">{s.n}</p>
                  <p className="text-xs text-white/70">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 1b. TRUST STRIP */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-5 text-sm text-slate-600">
          {[
            "Sans installation, 100 % web",
            "Données isolées par établissement",
            "Mobile money & paiement en ligne",
            "Support en français",
          ].map((t) => (
            <span key={t} className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand-600" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* 2. MARKET COVERAGE — interactive segments */}
      <section className="border-y border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              Pour chaque établissement
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Une plateforme qui s&apos;adapte à votre réalité
            </h2>
            <p className="mt-3 text-slate-600">
              Du primaire à l&apos;enseignement supérieur, choisissez votre profil pour voir ce que
              CathClau Edu change concrètement.
            </p>
          </Reveal>
          <Reveal className="mt-10">
            <SegmentsShowcase />
          </Reveal>
        </div>
      </section>

      {/* 3. EXPERTISE GRID (5 cards + CTA tile) */}
      <section id="modules" className="mx-auto max-w-6xl px-4 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Modules</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            Toute l&apos;expertise de l&apos;école, réunie
          </h2>
          <p className="mt-3 text-slate-600">
            Des modules pensés ensemble pour couvrir l&apos;intégralité de la vie de l&apos;établissement.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {EXPERTISE.map((e, i) => {
            const Icon = e.icon;
            return (
              <Reveal key={e.title} delay={i * 0.07}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                    <Icon className="h-6 w-6" strokeWidth={1.6} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">{e.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{e.text}</p>
                </div>
              </Reveal>
            );
          })}
          <Reveal delay={EXPERTISE.length * 0.07}>
            <div className="flex h-full flex-col justify-center gap-4 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
              <Globe2 className="h-8 w-8 text-brand-100" strokeWidth={1.5} />
              <h3 className="text-lg font-semibold">Une suite modulaire</h3>
              <p className="text-sm text-brand-100">Activez uniquement les modules dont votre école a besoin.</p>
              <LinkButton href="/fonctionnalites" size="sm" variant="secondary">
                Tous les modules
              </LinkButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 3b. HOW IT WORKS — 3 steps */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Mise en route</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Opérationnel en 3 étapes</h2>
            <p className="mt-3 text-slate-600">De la création de votre école au pilotage quotidien, sans rupture.</p>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal key={s.step} delay={i * 0.1}>
                  <div className="relative h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <span className="absolute right-5 top-4 text-4xl font-extrabold text-slate-100">{s.step}</span>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon className="h-6 w-6" strokeWidth={1.6} />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-slate-900">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. CAPABILITIES CALLOUT */}
      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Une suite complète, <span className="text-brand-300">prête à l&apos;emploi</span>
            </h2>
            <p className="mt-3 text-slate-300">
              Tout ce dont un établissement a besoin pour fonctionner, sans assembler plusieurs outils.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
            {CAPABILITIES.map((c, i) => (
              <Reveal key={c.l} delay={i * 0.08}>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                  <p className="text-3xl font-extrabold text-white sm:text-4xl">{c.n}</p>
                  <p className="mt-2 text-sm text-slate-300">{c.l}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10 flex justify-center">
            <LinkButton href="/signup" size="md" rightSection={<ArrowRight className="h-4 w-4" />}>
              Demander une démo
            </LinkButton>
          </Reveal>
        </div>
      </section>

      {/* 5. TESTIMONIALS */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Témoignages</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            Ils parlent de nous
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <figure className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <blockquote className="flex-1 text-sm leading-relaxed text-slate-700">“{t.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                    {t.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{t.name}</span>
                    <span className="block text-xs text-slate-500">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 6. SUPPORT PHILOSOPHY (with image) */}
      <section id="support" className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
          <Reveal className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-xl">
            <Image
              src={IMAGES.support}
              alt="Équipe d'accompagnement CathClau Edu"
              fill
              sizes="(max-width: 1024px) 100vw, 32rem"
              className="object-cover"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
              <Headset className="h-3.5 w-3.5" /> Accompagnement
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Un support qui connaît votre métier
            </h2>
            <p className="mt-4 text-slate-600">
              Au-delà du logiciel, une équipe vous accompagne à chaque étape, de la mise en route à
              l&apos;usage quotidien, pour que la plateforme serve réellement votre établissement.
            </p>
            <div className="mt-6 space-y-4">
              {SUPPORT.map((s) => (
                <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-base font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.text}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 7. CREDENTIALS / LOGOS */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <Reveal>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            La confiance d&apos;établissements engagés
          </h2>
        </Reveal>
        <div className="mt-10 flex justify-center">
          <InfiniteMovingCards items={LOGOS} direction="left" speed="slow" />
        </div>
      </section>

      {/* 8. DATA SECURITY */}
      <section id="securite" className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">Vos données, en sécurité</h2>
            <p className="mt-3 text-slate-300">
              La protection des informations de votre école est au cœur de la plateforme.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {SECURITY.map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal key={s.title} delay={i * 0.1}>
                  <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6">
                    <Icon className="h-8 w-8 text-brand-300" strokeWidth={1.5} />
                    <h3 className="mt-4 text-lg font-semibold text-white">{s.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{s.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
        <Reveal>
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            Questions fréquentes
          </h2>
          <div className="mt-10">
            <LandingFaq />
          </div>
        </Reveal>
      </section>

      {/* 10. FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <Reveal>
          <WobbleCard
            containerClassName="bg-gradient-to-br from-brand-600 to-brand-800"
            className="flex flex-col items-center gap-5 text-center"
          >
            <Building2 className="h-10 w-10 text-brand-100" strokeWidth={1.5} />
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-white">
              Prêt à moderniser la gestion de votre école ?
            </h2>
            <p className="max-w-xl text-brand-100">
              Lancez votre essai gratuit de 30 jours dès aujourd&apos;hui — aucune carte bancaire requise.
            </p>
            <LinkButton href="/signup" size="md" variant="secondary">
              Créer mon école
            </LinkButton>
          </WobbleCard>
        </Reveal>
      </section>
    </>
  );
}
