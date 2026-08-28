import type { Metadata } from "next";
import Link from "next/link";
import { VankinePage } from "@/components/public/vankine/vankine-page";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";
import { FaqAccordionVankine } from "@/components/public/vankine/faq-accordion-vankine";

export const metadata: Metadata = {
  title: "Tarifs — CathClau Edu",
  description:
    "Une seule offre, toutes les fonctionnalités incluses. Le tarif s'adapte à la taille de votre établissement, avec la périodicité de facturation de votre choix.",
};

const INCLUDED = [
  "Tous les modules métier : scolarité, présences, notes & bulletins, emploi du temps",
  "Communication illimitée aux familles : SMS, e-mail et WhatsApp",
  "Facturation, échéanciers et paiements mobile money en ligne",
  "Comptabilité, dépenses et rapprochement bancaire",
  "Rôles & permissions (RBAC) pour toute votre équipe",
  "Maintenance, mises à jour et sauvegardes assurées par notre équipe",
];

const FAQ_LEFT = [
  {
    q: "Pourquoi il n'y a pas de formules Starter/Standard/Premium ?",
    a: "Parce que nous pensons qu'un établissement ne devrait jamais être privé d'une fonctionnalité utile faute d'avoir choisi le \"bon\" palier. Chez CathClau Edu, chaque école accède à l'intégralité de la plateforme dès le premier jour.",
  },
  {
    q: "Comment le tarif est-il déterminé ?",
    a: "Il est adapté à la taille de votre établissement (nombre d'élèves, nombre de sites). Créez votre compte ou contactez-nous pour obtenir un devis précis, sans engagement.",
  },
  {
    q: "L'essai gratuit nécessite-t-il une carte bancaire ?",
    a: "Non. Vous bénéficiez de 30 jours d'essai gratuit sans aucune carte bancaire.",
  },
];

const FAQ_RIGHT = [
  {
    q: "Puis-je changer la périodicité de facturation en cours d'année ?",
    a: "Oui, vous pouvez passer d'une facturation mensuelle à trimestrielle ou annuelle (et inversement) au renouvellement de votre échéance en cours.",
  },
  {
    q: "Quels moyens de paiement acceptez-vous ?",
    a: "Orange Money, MTN MoMo, Wave et cartes Visa/MasterCard — adaptés aux usages réels des établissements en Guinée.",
  },
  {
    q: "La maintenance et le support sont-ils inclus ?",
    a: "Oui, la maintenance, les mises à jour, les sauvegardes et un support disponible 24h/24 et 7j/7 sont inclus, sans surcoût.",
  },
];

function CheckIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0C4.48578 0 0 4.48578 0 10C0 15.5142 4.48578 20 10 20C15.5142 20 20 15.5142 20 10C20 4.48578 15.5142 0 10 0Z" fill="#2196F3" />
      <path d="M15.0692 7.88074L9.6525 13.2973C9.48999 13.4598 9.27667 13.5416 9.06335 13.5416C8.85004 13.5416 8.63672 13.4598 8.47421 13.2973L5.76593 10.589C5.44 10.2632 5.44 9.73651 5.76593 9.41074C6.09171 9.08481 6.61829 9.08481 6.94421 9.41074L9.06335 11.5299L13.8909 6.70245C14.2167 6.37653 14.7433 6.37653 15.0692 6.70245C15.395 7.02823 15.395 7.55481 15.0692 7.88074Z" fill="#FAFAFA" />
    </svg>
  );
}

/**
 * Page "Tarifs" — reproduction fidèle de "pricing" du template Vankine (mêmes classes CSS,
 * `.price_box.type_one`), mais avec une seule offre (décision actée : pas de faux paliers
 * Starter/Standard/Premium, tarif réel adapté à la taille de l'établissement) et un accordéon FAQ
 * 2 colonnes reprenant les vraies questions déjà validées côté produit.
 */
export default function TarifsPage() {
  return (
    <VankinePage>
      <PageBannerVankine title="Tarifs" crumbs={[{ label: "Accueil", href: "/" }, { label: "Tarifs" }]} background="/images/school-3.jpg" />

      <section className="pricing-section bg_light_1">
        <div className="pd_top_90" />
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="section_title text-center type_one">
                <h4 className="sm_title">Une offre unique</h4>
                <div className="title_whole">
                  <h2 className="title">Toutes les fonctionnalités incluses, dès le premier jour</h2>
                </div>
                <p>
                  Aucune fonctionnalité n&apos;est réservée à un palier supérieur : votre établissement
                  utilise la plateforme dans son intégralité. Le tarif s&apos;adapte à la taille de
                  votre école — mensuel, trimestriel ou annuel, à votre choix.
                </p>
              </div>
            </div>
          </div>
          <div className="pd_bottom_40" />
          <div className="row justify-content-center">
            <div className="col-lg-6 col-md-8 col-sm-10 col-xs-12">
              <div className="price_box type_one trans">
                <div className="top">
                  <h4 className="title_24">Offre CathClau Edu</h4>
                  <div className="price">
                    Sur devis <small>/ selon effectif</small>
                  </div>
                </div>
                <div className="center">
                  {INCLUDED.map((item) => (
                    <div key={item} className="d-flex align-items-center">
                      <CheckIcon />
                      <small>{item}</small>
                    </div>
                  ))}
                </div>
                <div className="bottom text-center">
                  <Link className="theme_btn" href="/signup">
                    Créer mon école
                    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 11L11 1M11 1H3.5M11 1V8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="pd_top_30 text-center">
            <p>
              Vous préférez en discuter directement ?{" "}
              <Link href="/contact" className="links" style={{ fontWeight: 600 }}>Demandez un devis</Link>
            </p>
          </div>
        </div>
        <div className="pd_bottom_70" />
      </section>

      <section className="faq-section">
        <div className="pd_top_90" />
        <div className="container">
          <div className="row">
            <div className="col-lg-7 m-auto text-center">
              <div className="section_title type_one">
                <h4 className="sm_title">FAQ</h4>
                <div className="title_whole"><h2 className="title">Questions fréquentes</h2></div>
                <p>Tout ce qu&apos;il faut savoir avant de créer votre école sur CathClau Edu.</p>
              </div>
              <div className="pd_bottom_40" />
            </div>
          </div>
          <div className="row">
            <div className="col-lg-6">
              <FaqAccordionVankine items={FAQ_LEFT} />
            </div>
            <div className="col-lg-6">
              <FaqAccordionVankine items={FAQ_RIGHT} defaultOpen={-1} />
            </div>
          </div>
        </div>
        <div className="pd_bottom_80" />
      </section>
    </VankinePage>
  );
}
