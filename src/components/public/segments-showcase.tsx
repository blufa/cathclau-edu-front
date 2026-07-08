"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

const SEGMENTS = [
  {
    key: "primaire",
    label: "Primaire",
    headline: "Le quotidien de l'école maternelle et primaire, simplifié",
    text: "Suivi des présences, communication avec les familles et gestion de la cantine, dans une interface pensée pour les petites équipes.",
    points: ["Appel et présences par classe", "Notifications aux parents", "Cantine & activités"],
    image: "/images/school-1.jpg",
  },
  {
    key: "secondaire",
    label: "Collège & Lycée",
    headline: "Toute la scolarité du secondaire, de la note au bulletin",
    text: "Évaluations, moyennes pondérées, rangs et bulletins générés automatiquement à la clôture de chaque période.",
    points: ["Notes, examens & bulletins", "Emploi du temps sans conflit", "Conseils de classe"],
    image: "/images/school-3.jpg",
  },
  {
    key: "superieur",
    label: "Enseignement supérieur",
    headline: "Gérez vos effectifs et votre scolarité à grande échelle",
    text: "Inscriptions, suivi des parcours et facturation pour les établissements aux effectifs importants.",
    points: ["Inscriptions & réinscriptions", "Scolarité et facturation", "Tableaux de bord détaillés"],
    image: "/images/school-4.jpg",
  },
  {
    key: "pro",
    label: "Formation professionnelle",
    headline: "Pilotez vos sessions et le suivi des apprenants",
    text: "Organisez les sessions, suivez l'assiduité et facturez les frais de formation au même endroit.",
    points: ["Sessions & assiduité", "Frais et paiements en ligne", "Attestations & documents"],
    image: "/images/school-5.jpg",
  },
  {
    key: "groupes",
    label: "Groupes multi-établissements",
    headline: "Une console unique pour tous vos établissements",
    text: "Pilotez plusieurs écoles depuis un seul compte, avec des quotas par plan et une vue consolidée.",
    points: ["Vue consolidée multi-écoles", "Quotas et droits par site", "Comparatif inter-établissements"],
    image: "/images/school-6.jpg",
  },
];

export function SegmentsShowcase() {
  const [active, setActive] = useState(0);
  const seg = SEGMENTS[active];

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        {SEGMENTS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setActive(i)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              i === active
                ? "bg-brand-600 text-white shadow-sm shadow-brand-500/30"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${seg.key}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.35 }}
          >
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">{seg.headline}</h3>
            <p className="mt-3 text-slate-600">{seg.text}</p>
            <ul className="mt-6 space-y-3">
              {seg.points.map((p) => (
                <li key={p} className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={`img-${seg.key}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl shadow-xl lg:order-last"
          >
            <Image src={seg.image} alt={seg.label} fill sizes="(max-width: 1024px) 100vw, 24rem" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-900/35 via-transparent to-transparent" />
            <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur">
              {seg.label}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
