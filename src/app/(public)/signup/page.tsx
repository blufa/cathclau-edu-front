import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/public/signup-form";
import { FullPageSpinner } from "@/components/ui/spinner";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";

export const metadata: Metadata = {
  title: "Créer mon école — CathClau Edu",
  description: "Inscrivez votre établissement et démarrez 30 jours d'essai gratuit.",
};

/**
 * Page d'inscription — en-tête/pied de page Tailwind simples (PublicHeader/PublicFooter), cohérents
 * avec le reste du site public. Le formulaire (`SignupForm`) reste hors de tout scope Bootstrap :
 * il utilise le kit Tailwind partagé (Field/Label/Input/Stepper...) via des balises brutes qu'un CSS
 * Vankine scopé pourrait autrement re-styler avec une spécificité plus forte.
 */
export default function SignupPage() {
  return (
    <>
      <PublicHeader />

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

      <PublicFooter />
    </>
  );
}
