import type { Metadata } from "next";
import { PageHero } from "@/components/public/page-hero";

export const metadata: Metadata = {
  title: "Confidentialité — CathClau Edu",
  description: "Politique de confidentialité de CathClau Edu : données collectées, usage, conservation et droits des utilisateurs.",
  alternates: { canonical: "/confidentialite" },
};

const SECTIONS = [
  {
    h: "Données collectées",
    p: "CathClau Edu traite les données nécessaires à la gestion scolaire (élèves, parents, personnel, scolarité, paiements). Chaque établissement reste responsable des données de ses utilisateurs.",
  },
  {
    h: "Finalités",
    p: "Les données sont utilisées uniquement pour fournir le service : inscriptions, notes, communication aux familles et facturation. Elles ne sont pas revendues.",
  },
  {
    h: "Isolation par établissement",
    p: "L'architecture multi-tenant isole les données de chaque école. Les accès sont strictement contrôlés par rôles et permissions (RBAC).",
  },
  {
    h: "Conservation & sécurité",
    p: "Les données sont conservées pour la durée d'utilisation du service et sauvegardées. Les actions sensibles sont journalisées à des fins de traçabilité.",
  },
  {
    h: "Vos droits",
    p: "Vous pouvez demander l'accès, la rectification ou la suppression de vos données en écrivant à contact@cathclau.edu.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Confidentialité" title="Politique de confidentialité" />
      <section className="mx-auto max-w-3xl px-4 py-16">
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.h}>
              <h2 className="text-lg font-semibold text-slate-900">{s.h}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.p}</p>
            </div>
          ))}
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Modèle à personnaliser : adaptez cette politique à votre cadre réglementaire avant la mise en
            production.
          </p>
        </div>
      </section>
    </>
  );
}
