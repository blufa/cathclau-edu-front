import type { Metadata } from "next";
import { VankinePage } from "@/components/public/vankine/vankine-page";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";
import { AboutTabs } from "@/components/public/vankine/about-tabs";
import { StatCounter } from "@/components/public/stat-counter";
import { Cta2 } from "@/components/public/vankine/cta2";

export const metadata: Metadata = {
  title: "À propos — CathClau Edu",
  description:
    "Notre histoire, notre mission et les valeurs qui portent CathClau Edu, la suite de gestion scolaire pensée pour les établissements d'Afrique de l'Ouest.",
};

const SERVICES = [
  { icon: "flaticon-dashboard", title: "Pilotage complet", text: "Tableaux de bord par rôle, effectifs, assiduité et recouvrement en un coup d'œil." },
  { icon: "flaticon-management", title: "Gestion centralisée", text: "Élèves, classes, notes et frais scolaires réunis dans un seul outil, pensé pour le terrain." },
  { icon: "flaticon-cyber-security", title: "Données sécurisées", text: "Chaque établissement est isolé, chaque action sensible est tracée et auditable." },
];

const STATS = [
  { icon: "flaticon-dashboard", value: 11, suffix: "+", label: "Modules métier intégrés" },
  { icon: "flaticon-growth", value: 3, suffix: "", label: "Canaux : SMS, e-mail, WhatsApp" },
  { icon: "flaticon-cyber-security", value: 8, suffix: "", label: "Rôles & permissions (RBAC)" },
  { icon: "flaticon-reviews", value: 100, suffix: "%", label: "Web, multi-établissements" },
];

/**
 * Page "À propos" — reproduction fidèle de "about-us" du template Vankine (mêmes classes CSS) :
 * bandeau titre, présentation + onglets À propos/Mission/Vision, 3 services clés, notre histoire,
 * mot du fondateur, statistiques, CTA finale.
 * Sections "Équipe"/"Clients"/"Témoignages" de l'original omises (aucune fausse identité/logo/avis
 * fictif à afficher).
 */
export default function AboutPage() {
  return (
    <VankinePage>
      <PageBannerVankine title="À propos" crumbs={[{ label: "Accueil", href: "/" }, { label: "À propos" }]} background="/images/school-5.jpg" />

      {/* 1. Présentation + onglets */}
      <section className="about-section position-relative">
        <div className="pd_top_90" />
        <div className="auto-container">
          <div className="row align-items-start">
            <div className="col-lg-6 col-md-12">
              <div className="image_box_only type_seven">
                <div className="icon_box_only type_four inline_box trans">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="icon"><img src="/vankine/images/icon-image-1.png" alt="" className="img-fluid" /></div>
                  <div className="content"><div className="title_18">Scolarité</div></div>
                </div>
                <div className="icon_box_only type_four position_two trans">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="icon"><img src="/vankine/images/icon-image-2.png" alt="" className="img-fluid" /></div>
                  <div className="content"><div className="title_18">Communication</div></div>
                </div>
                <div className="fun_facts type_two">
                  <h4><StatCounter value={11} /><small>+</small></h4>
                  <h6 className="title_no_a_26">Modules métier intégrés</h6>
                </div>
                <div className="m_image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/school-1.jpg" alt="Vie scolaire à l'établissement" className="img-fluid" />
                </div>
              </div>
            </div>
            <div className="col-lg-6 col-md-6 col-sm-12 pd_left_30">
              <div className="section_title type_one">
                <h4 className="sm_title">Notre entreprise</h4>
                <div className="title_whole">
                  <h2 className="title">Une plateforme de confiance, pensée pour les écoles</h2>
                </div>
              </div>
              <div className="mr_bottom_20" />
              <AboutTabs />
              <div className="pd_bottom_70" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. 3 services clés */}
      <section className="service-section">
        <div className="pd_top_60" />
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="section_title text-center type_one">
                <h4 className="sm_title">Pourquoi nous choisir</h4>
                <div className="title_whole"><h2 className="title">Ce qui distingue CathClau Edu</h2></div>
              </div>
              <div className="pd_top_40" />
            </div>
          </div>
          <div className="row">
            {SERVICES.map((s) => (
              <div key={s.title} className="col-lg-4 col-md-6 col-sm-6 col-xs-12">
                <div className="icon_box_only border_color_1 bg_light_1 type_seven">
                  <div className="icon"><i className={s.icon} /></div>
                  <div className="title_24">{s.title}</div>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="pd_bottom_60" />
      </section>

      {/* 3. Notre histoire */}
      <section className="content-section">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="section_title type_one">
                <h4 className="sm_title">Le constat de départ</h4>
                <div className="title_whole">
                  <h2 className="title">Trop de temps perdu dans l&apos;administratif</h2>
                </div>
                <p>
                  Dans la plupart des établissements, les bulletins se calculent encore à la main le
                  week-end, les frais scolaires se suivent sur papier et les parents apprennent une
                  absence des jours après qu&apos;elle a eu lieu. Ce constat, observé directement auprès
                  de directeurs, censeurs et comptables d&apos;écoles, est à l&apos;origine de CathClau
                  Edu.
                </p>
              </div>
              <div className="pd_bottom_40" />
            </div>
            <div className="col-lg-6">
              <div className="image_box_only type_one">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/school-6.jpg" alt="Équipe pédagogique au quotidien" className="img-fluid" style={{ borderRadius: 16 }} />
              </div>
            </div>
          </div>
        </div>
        <div className="pd_bottom_60" />
      </section>

      {/* 4. Mot du fondateur */}
      <section className="content-section bg_light_1">
        <div className="pd_top_60" />
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8 text-center">
              <div className="position-relative" style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.6 }}>
                « Chaque fonctionnalité de CathClau Edu répond à une frustration réelle que j&apos;ai vue
                chez des directeurs et des comptables d&apos;écoles. Notre ambition n&apos;est pas de
                vendre un logiciel de plus, mais de rendre à chaque établissement le temps qu&apos;il
                perd aujourd&apos;hui dans des tâches qui pourraient être automatisées. »
              </div>
              <div className="pd_bottom_25" />
              <div className="d-flex align-items-center justify-content-center authour_box">
                <span
                  style={{
                    display: "inline-flex", height: 48, width: 48, borderRadius: "50%", alignItems: "center",
                    justifyContent: "center", background: "linear-gradient(135deg,#3b82f6,#1e4fa8)", color: "#fff",
                    fontSize: 16, fontWeight: 700, marginRight: 12,
                  }}
                >
                  JC
                </span>
                <div className="text-start">
                  <h6 className="title_no_a_18">Jean Claude Camara</h6>
                  <p style={{ margin: 0 }}>Fondateur, CathClau Edu</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="pd_bottom_60" />
      </section>

      {/* 5. Statistiques */}
      <section className="analysis-section position-relative bg_1 overflow-hidden">
        <div className="pd_top_90" />
        <div className="medium-container-two">
          <div className="row">
            <div className="col-lg-12">
              <div className="section_title text-center color_white type_one">
                <h4 className="sm_title">Chiffres clés</h4>
                <div className="title_whole"><h2 className="title">Une suite déjà complète</h2></div>
              </div>
            </div>
          </div>
          <div className="pd_bottom_30" />
          <div className="row">
            {STATS.map((s) => (
              <div key={s.label} className="col-lg-3 col-md-6 col-sm-6 col-xs-12">
                <div className="fun_facts type_one color_white">
                  <div className="icon trans"><div className="icon_in trans"><i className={s.icon} /></div></div>
                  <h4><StatCounter value={s.value} suffix={s.suffix} /></h4>
                  <h6 className="title_no_a_18">{s.label}</h6>
                </div>
                <div className="pd_bottom_20" />
              </div>
            ))}
          </div>
        </div>
        <div className="pd_bottom_40" />
      </section>

      <Cta2 />
    </VankinePage>
  );
}
