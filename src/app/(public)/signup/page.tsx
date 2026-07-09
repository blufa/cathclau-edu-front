import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/public/signup-form";
import { FullPageSpinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";

export const metadata: Metadata = {
  title: "Créer mon école — CathClau Edu",
  description: "Inscrivez votre établissement et démarrez 30 jours d'essai gratuit.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white px-4 py-16 sm:py-20">
      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <Reveal className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
            Essai gratuit · 30 jours
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Créez votre école en quelques minutes
          </h1>
          <p className="mt-3 text-slate-600">
            Sans carte bancaire. Votre établissement est actif dès la création — connectez-vous aussitôt.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <Suspense fallback={<FullPageSpinner />}>
            <SignupForm />
          </Suspense>
        </Reveal>
      </div>
    </div>
  );
}
