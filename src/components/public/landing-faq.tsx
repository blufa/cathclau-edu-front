"use client";

import { Accordion } from "@mantine/core";

const FAQ = [
  {
    q: "Qu'est-ce que CathClau Edu ?",
    a: "CathClau Edu est une suite logicielle web tout-en-un qui centralise la gestion de votre établissement : élèves, scolarité, vie scolaire, communication aux familles et facturation des frais — le tout depuis une seule plateforme.",
  },
  {
    q: "En quoi la plateforme simplifie-t-elle le quotidien ?",
    a: "Les tâches répétitives sont automatisées : génération des bulletins à la clôture de période, relances de paiement, notifications d'absence aux parents par SMS/WhatsApp, et tableaux de bord en temps réel pour piloter effectifs, assiduité et recouvrement.",
  },
  {
    q: "À qui s'adresse CathClau Edu ?",
    a: "Aux écoles primaires, collèges, lycées, établissements supérieurs et centres de formation, ainsi qu'aux groupes pilotant plusieurs établissements depuis une console unique.",
  },
  {
    q: "Comment démarrer ?",
    a: "Aucune installation : la plateforme est 100 % web. Créez le compte de votre école en quelques minutes, vérifiez l'e-mail du directeur, et profitez de 30 jours d'essai gratuit sans carte bancaire.",
  },
];

export function LandingFaq() {
  return (
    <Accordion
      variant="separated"
      radius="lg"
      chevronPosition="right"
      classNames={{ control: "text-slate-900", item: "border border-slate-200 bg-white" }}
    >
      {FAQ.map((item) => (
        <Accordion.Item key={item.q} value={item.q}>
          <Accordion.Control>
            <span className="text-base font-semibold text-slate-900">{item.q}</span>
          </Accordion.Control>
          <Accordion.Panel>
            <p className="text-sm leading-relaxed text-slate-600">{item.a}</p>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
