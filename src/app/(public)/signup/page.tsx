import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/public/signup-form";
import { FullPageSpinner } from "@/components/ui/spinner";
import { Header5 } from "@/components/public/vankine/header5";
import { Footer5 } from "@/components/public/vankine/footer5";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";

export const metadata: Metadata = {
  title: "Créer mon école — CathClau Edu",
  description: "Inscrivez votre établissement et démarrez 30 jours d'essai gratuit.",
};

/**
 * Page d'inscription — Header5/Footer5 Vankine pour rester cohérente avec le reste du site public,
 * MAIS le formulaire (`SignupForm`) reste dans une zone séparée, hors de `.vankine-scope`.
 * Raison : `SignupForm` est un flux métier critique déjà testé qui utilise le kit Tailwind partagé
 * (Field/Label/Input/Stepper...) via des balises brutes (<label>, <h2>...) stylées par des classes
 * utilitaires Tailwind — or le CSS Vankine scopé définit ses propres règles globales sur ces mêmes
 * balises brutes (`.vankine-scope label`, `.vankine-scope h1..h6`, `.vankine-scope p`) avec une
 * spécificité qui l'emporte toujours sur une classe utilitaire Tailwind isolée, quel que soit
 * l'ordre de chargement. Le mélanger au scope casserait donc silencieusement l'apparence du
 * formulaire. Le header/footer restent scopés (aucune balise Tailwind à l'intérieur), donc sans
 * risque.
 */
export default function SignupPage() {
  return (
    <>
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
        <PageBannerVankine
          title="Créer mon école"
          crumbs={[{ label: "Accueil", href: "/" }, { label: "Créer mon école" }]}
          background="/images/school-3.jpg"
        />
      </div>

      <div className="bg-white px-4 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              Essai gratuit · 30 jours
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Créez votre école en quelques minutes
            </h2>
            <p className="mt-3 text-slate-600">
              Sans carte bancaire. Votre établissement est actif dès la création — connectez-vous aussitôt.
            </p>
          </div>
          <Suspense fallback={<FullPageSpinner />}>
            <SignupForm />
          </Suspense>
        </div>
      </div>

      <div className="vankine-scope theme-vankine">
        <Footer5 />
      </div>
    </>
  );
}
