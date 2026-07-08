import type { Metadata } from "next";
import { PageHero } from "@/components/public/page-hero";

export const metadata: Metadata = {
  title: "Mentions légales — CathClau Edu",
};

const SECTIONS = [
  {
    h: "Éditeur",
    p: "Le présent site est édité par CathClau Edu. Les informations légales complètes (raison sociale, siège, immatriculation, responsable de publication) sont à compléter par l'éditeur.",
  },
  {
    h: "Hébergement",
    p: "La plateforme est une application 100 % web. Les coordonnées de l'hébergeur sont à renseigner par l'éditeur.",
  },
  {
    h: "Propriété intellectuelle",
    p: "L'ensemble des éléments du site (marque, logo, textes, interfaces) est protégé. Toute reproduction non autorisée est interdite.",
  },
  {
    h: "Responsabilité",
    p: "L'éditeur s'efforce d'assurer l'exactitude des informations diffusées mais ne saurait être tenu responsable des erreurs ou indisponibilités temporaires du service.",
  },
  {
    h: "Contact",
    p: "Pour toute question relative aux présentes mentions, écrivez à contact@cathclau.edu.",
  },
];

export default function LegalPage() {
  return (
    <>
      <PageHero eyebrow="Informations" title="Mentions légales" />
      <section className="mx-auto max-w-3xl px-4 py-16">
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.h}>
              <h2 className="text-lg font-semibold text-slate-900">{s.h}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.p}</p>
            </div>
          ))}
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Modèle à personnaliser : remplacez les mentions par les informations réelles de votre structure
            avant la mise en production.
          </p>
        </div>
      </section>
    </>
  );
}
