import type { Metadata } from "next";
import Link from "next/link";
import { VankinePage } from "@/components/public/vankine/vankine-page";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";
import { Cta2 } from "@/components/public/vankine/cta2";

export const metadata: Metadata = {
  title: "Centre d'aide — CathClau Edu",
};

const TOPICS = [
  { icon: "flaticon-next", title: "Démarrer", text: "Créer son école, vérifier l'e-mail et inviter ses équipes.", href: "/signup" },
  { icon: "flaticon-management", title: "Scolarité", text: "Élèves, inscriptions, classes, notes et bulletins.", href: "/fonctionnalites/scolarite" },
  { icon: "flaticon-money-bag", title: "Facturation & paiements", text: "Frais, échéances et paiements mobile money.", href: "/fonctionnalites/facturation" },
  { icon: "flaticon-telephone", title: "Communication", text: "SMS, e-mail et WhatsApp aux familles.", href: "/fonctionnalites/communication" },
  { icon: "flaticon-cyber-security", title: "Sécurité & accès", text: "Rôles, permissions et confidentialité des données.", href: "/a-propos" },
  { icon: "flaticon-black-back-closed-envelope-shape", title: "Nous contacter", text: "Une question ? Notre équipe vous répond.", href: "/contact" },
];

/**
 * Centre d'aide — hub de 6 cartes vers les rubriques d'assistance, reconstruit en Vankine natif
 * (mêmes classes CSS que le service-section de about-us.js, `.icon_box_only.type_seven`), sans
 * équivalent direct dans le template (site d'assurance) : structure de carte réutilisée, contenu
 * propre à CathClau Edu.
 */
export default function HelpPage() {
  return (
    <VankinePage>
      <PageBannerVankine title="Centre d'aide" crumbs={[{ label: "Accueil", href: "/" }, { label: "Centre d'aide" }]} background="/images/school-2.jpg" />

      <section className="service-section">
        <div className="pd_top_90" />
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="section_title text-center type_one">
                <h4 className="sm_title">Support</h4>
                <div className="title_whole"><h2 className="title">Trouvez rapidement des réponses</h2></div>
              </div>
              <div className="pd_top_40" />
            </div>
          </div>
          <div className="row">
            {TOPICS.map((t) => (
              <div key={t.title} className="col-lg-4 col-md-6 col-sm-6 col-xs-12">
                <Link href={t.href} className="icon_box_only border_color_1 bg_light_1 type_seven" style={{ display: "block" }}>
                  <div className="icon"><i className={t.icon} /></div>
                  <div className="title_24">{t.title}</div>
                  <p>{t.text}</p>
                  <span className="rd_more">En savoir plus <i className="icontb fi-rs-arrow-small-right" /></span>
                </Link>
                <div className="pd_bottom_20" />
              </div>
            ))}
          </div>
        </div>
        <div className="pd_bottom_60" />
      </section>

      <Cta2 />
    </VankinePage>
  );
}
