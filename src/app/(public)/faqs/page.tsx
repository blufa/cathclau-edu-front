import type { Metadata } from "next";
import Link from "next/link";
import { VankinePage } from "@/components/public/vankine/vankine-page";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";
import { FaqAccordionVankine } from "@/components/public/vankine/faq-accordion-vankine";
import { Testimonial4 } from "@/components/public/vankine/testimonial4";
import { Cta2 } from "@/components/public/vankine/cta2";

export const metadata: Metadata = {
  title: "Questions fréquentes — CathClau Edu",
  description: "Toutes les réponses sur la plateforme, l'essai gratuit, les tarifs et le paiement.",
};

/** Consolide les questions déjà posées ailleurs sur le site (accueil, tarifs) — aucune question
 * inventée pour "remplir" la page. */
const MAIN_FAQ = [
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
  {
    q: "Pourquoi il n'y a pas de formules Starter/Standard/Premium ?",
    a: "Parce qu'un établissement ne devrait jamais être privé d'une fonctionnalité utile faute d'avoir choisi le \"bon\" palier. Chaque école accède à l'intégralité de la plateforme dès le premier jour.",
  },
  {
    q: "Comment le tarif est-il déterminé ?",
    a: "Il est adapté à la taille de votre établissement (nombre d'élèves, nombre de sites). Créez votre compte ou contactez-nous pour obtenir un devis précis, sans engagement.",
  },
];

const SECONDARY_FAQ = [
  {
    q: "L'essai gratuit nécessite-t-il une carte bancaire ?",
    a: "Non. Vous bénéficiez de 30 jours d'essai gratuit sans aucune carte bancaire.",
  },
  {
    q: "Puis-je changer la périodicité de facturation en cours d'année ?",
    a: "Oui, vous pouvez passer d'une facturation mensuelle à trimestrielle ou annuelle (et inversement) au renouvellement de votre échéance en cours.",
  },
  {
    q: "Quels moyens de paiement acceptez-vous ?",
    a: "Orange Money, MTN MoMo, Wave et cartes Visa/MasterCard — adaptés aux usages réels des établissements en Guinée.",
  },
];

/**
 * Page FAQ — reproduction fidèle de "faqs" du template Vankine (mêmes classes CSS) : bloc principal
 * intro + CTA + accordéon complet, bloc secondaire accordéon paiement/essai + grille de 3 photos
 * réelles de l'établissement (remplace les photos de démonstration), témoignages (Testimonial4),
 * CTA finale.
 */
export default function FaqsPage() {
  return (
    <VankinePage>
      <PageBannerVankine title="FAQ" crumbs={[{ label: "Accueil", href: "/" }, { label: "FAQ" }]} background="/images/school-6.jpg" />

      <section className="faq-section">
        <div className="pd_top_90" />
        <div className="container">
          <div className="row">
            <div className="col-lg-5">
              <div className="section_title type_one">
                <h4 className="sm_title">FAQ</h4>
                <div className="title_whole"><h2 className="title">Questions fréquentes</h2></div>
                <p>Tout ce qu&apos;il faut savoir sur CathClau Edu, l&apos;essai gratuit et la facturation.</p>
              </div>
              <div className="pd_bottom_40" />
              <div className="theme_btn_all">
                <Link href="/contact" className="theme_btn big rotate">
                  Nous contacter <span><i className="fi-rr-arrow-small-up" /></span>
                </Link>
              </div>
              <div className="pd_bottom_30" />
            </div>
            <div className="col-lg-7">
              <FaqAccordionVankine items={MAIN_FAQ} />
            </div>
          </div>
        </div>
        <div className="pd_bottom_40" />
      </section>

      <section className="faq-section">
        <div className="pd_top_60" />
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="section_title type_one">
                <h4 className="sm_title">Paiement & essai gratuit</h4>
                <div className="title_whole"><h2 className="title">Facturation, moyens de paiement et engagement</h2></div>
                <div className="pd_bottom_20" />
              </div>
              <div className="pd_bottom_30" />
              <FaqAccordionVankine items={SECONDARY_FAQ} defaultOpen={-1} />
              <div className="pd_bottom_40" />
            </div>
            <div className="col-lg-6 col-md-6 col-sm-12 pd_left_30">
              <div className="image_box_only type_three">
                <div className="left">
                  <div className="image one">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/school-1.jpg" alt="Vie scolaire à l'établissement" className="img-fluid" />
                  </div>
                  <div className="image two">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/school-3.jpg" alt="Élèves de l'établissement" className="img-fluid" />
                  </div>
                </div>
                <div className="right">
                  <div className="image three">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/school-5.jpg" alt="Activités à l'école" className="img-fluid" />
                  </div>
                </div>
              </div>
              <div className="pd_bottom_40" />
            </div>
          </div>
        </div>
        <div className="pd_bottom_40" />
      </section>

      <Testimonial4 />

      <Cta2 />
    </VankinePage>
  );
}
