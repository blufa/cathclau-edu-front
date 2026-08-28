import type { Metadata } from "next";
import { Header5 } from "@/components/public/vankine/header5";
import { HeroSlider } from "@/components/public/vankine/hero-slider";
import { About5 } from "@/components/public/vankine/about5";
import { Service8 } from "@/components/public/vankine/service8";
import { Content6 } from "@/components/public/vankine/content6";
import { Funfacts3 } from "@/components/public/vankine/funfacts3";
import { DemoForm } from "@/components/public/vankine/demo-form";
import { Testimonial4 } from "@/components/public/vankine/testimonial4";
import { Blog5 } from "@/components/public/vankine/blog5";
import { Cta2 } from "@/components/public/vankine/cta2";
import { Footer5 } from "@/components/public/vankine/footer5";

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

/**
 * Page d'accueil — reproduction fidèle de "home-5" du template Vankine (features/refont-front.md) :
 * mêmes fichiers CSS que le template (Bootstrap + theme.css + icônes), scopés sous ".vankine-scope"
 * pour ne jamais affecter l'espace applicatif authentifié (Tailwind, inchangé). Ordre des sections
 * identique à home-5 (Slider → About → Service → Content → Form → Funfacts → Testimonial → Blog →
 * Cta), sections "Team"/"Clients" de l'original omises (contenu fictif, aucune équipe/logo réel à
 * afficher). Header/Footer Vankine propres à cette page — les autres pages publiques gardent
 * PublicHeader/PublicFooter (Tailwind) tant que le rendu n'est pas validé pour généralisation.
 */
export default function LandingPage() {
  return (
    <>
      {/* Volontairement en balises <link> manuelles (pas next/font ni un import global) : React 19
          les hoiste vers <head> et les monte/démonte avec CE composant, garantissant qu'elles ne
          sont chargées QUE sur cette page — jamais sur l'espace applicatif authentifié (Tailwind). */}
      {/* eslint-disable @next/next/no-css-tags */}
      <link rel="stylesheet" href="/vankine/css/bootstrap.min.css" />
      <link rel="stylesheet" href="/vankine/css/global-settings.css" />
      <link rel="stylesheet" href="/vankine/css/theme.css" />
      <link rel="stylesheet" href="/vankine/css/animate.min.css" />
      <link rel="stylesheet" href="/vankine/css/flaticon_vankine.css" />
      <link rel="stylesheet" href="/vankine/css/font-awesome.min.css" />
      <link rel="stylesheet" href="/vankine/css/uicons-regular-rounded.css" />
      <link rel="stylesheet" href="/vankine/css/uicons-regular-straight.css" />
      {/* eslint-enable @next/next/no-css-tags */}
      <div className="vankine-scope theme-vankine">
        <Header5 />
        <HeroSlider />
        <About5 />
        <Service8 />
        <Content6 />
        <DemoForm />
        <Funfacts3 />
        <Testimonial4 />
        <Blog5 />
        <Cta2 />
        <Footer5 />
      </div>
    </>
  );
}
