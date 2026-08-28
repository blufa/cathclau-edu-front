"use client";

import { useState } from "react";

interface Tab {
  label: string;
  text: string;
  points: string[];
}

const TABS: Tab[] = [
  {
    label: "Qui sommes-nous",
    text: "CathClau Edu est une suite de gestion scolaire pensée pour les établissements francophones d'Afrique de l'Ouest, du petit établissement privé au groupe scolaire multi-sites.",
    points: ["Plateforme 100 % web", "Pensée pour le terrain", "Support réactif", "Données sécurisées", "Multi-établissements", "Évolutive chaque semaine"],
  },
  {
    label: "Mission",
    text: "Libérer les équipes pédagogiques et administratives des tâches répétitives — bulletins, relances de frais, suivi des présences — pour qu'elles se consacrent à l'accompagnement des élèves.",
    points: ["Automatiser l'administratif", "Fiabiliser les résultats", "Accélérer le recouvrement", "Informer les familles", "Simplifier le quotidien", "Réduire la charge mentale"],
  },
  {
    label: "Vision",
    text: "Devenir la référence de la gestion scolaire pour les établissements francophones d'Afrique de l'Ouest, avec une plateforme aussi simple à utiliser qu'elle est complète.",
    points: ["Référence régionale", "Simplicité d'usage", "Couverture complète", "Ouverture multi-canal", "Confiance durable", "Amélioration continue"],
  },
];

function CheckBullet() {
  return (
    <svg width={25} height={25} viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12.5" cy="12.5" r="12.5" fill="#36DB9F" />
      <path d="M11.8363 18.7066C12.2244 19.0994 13.0886 18.9692 13.1817 18.3516C13.7607 14.5175 16.6577 11.2829 18.85 8.23494C19.4579 7.39031 18.0602 6.58795 17.4602 7.42252C15.4568 10.2075 12.9317 13.138 11.9439 16.5174C10.815 15.3637 9.68161 14.221 8.41548 13.2072C7.61364 12.5649 6.46665 13.6965 7.27713 14.3455C8.92674 15.6668 10.3523 17.2076 11.8363 18.7066Z" fill="white" />
    </svg>
  );
}

/** Onglets "À propos / Mission / Vision" (mêmes classes CSS que le bloc fom_tab_box de about-us.js),
 * contenu réel CathClau Edu à la place du texte de démonstration. */
export function AboutTabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = TABS[activeIndex];
  const left = active.points.slice(0, 3);
  const right = active.points.slice(3);

  return (
    <div className="fom_tab_box custom_tabs only_tab_content">
      <ul className="nav nav-tabs links trans" role="tablist">
        {TABS.map((tab, i) => (
          <li key={tab.label} className="nav-item" onClick={() => setActiveIndex(i)}>
            <button type="button" className={i === activeIndex ? "nav-link active" : "nav-link"}>
              {tab.label}
              <span>
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 11L11 1M11 1H3.5M11 1V8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="s_tabs_content tab-content">
        <div className="tab-pane active">
          <div className="tab_content_box">
            <div className="content">{active.text}</div>
            <div className="d-flex">
              <ul>
                {left.map((p) => (
                  <li key={p}><CheckBullet /><span>{p}</span></li>
                ))}
              </ul>
              <ul>
                {right.map((p) => (
                  <li key={p}><CheckBullet /><span>{p}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
