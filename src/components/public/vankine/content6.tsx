import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const POINTS = [
  { title: "Tout inclus", text: "Aucune fonctionnalité verrouillée derrière un palier supérieur." },
  { title: "Facturation flexible", text: "Mensuelle, trimestrielle ou annuelle, à votre choix." },
  { title: "Support réactif", text: "Notre équipe disponible 24h/24 et 7j/7." },
  { title: "Prix adapté", text: "Un tarif qui suit la taille réelle de votre établissement." },
];

/** Section "Content" du template (mêmes classes CSS que Content6.js) — contenu réel CathClau Edu,
 * badge pivoté texte à la place d'un faux témoignage client. */
export function Content6() {
  return (
    <section className="content-section bg_light_1 position-relative overflow-hidden">
      <div className="ab_img_left_top z_0 mr_top_minus_150">
        <img src="/vankine/images/line-st-2.png" className="img-fluid" alt="" />
      </div>
      <div className="pd_top_320" />
      <div className="container">
        <div className="row">
          <div className="col-lg-7 col-md-12">
            <div className="section_title type_one">
              <h4 className="sm_title">Pourquoi nous choisir</h4>
              <div className="title_whole">
                <h2 className="title">Une plateforme complète, sans les mauvaises surprises</h2>
              </div>
            </div>
            <div className="pd_bottom_20" />
            <div className="position-relative border_left_abolute_5px_two pd_left_40">
              Pas de fonctionnalités verrouillées derrière un palier supérieur, pas de support
              introuvable une fois le contrat signé : tout est inclus, et notre équipe reste
              disponible tout au long de votre utilisation de la plateforme.
            </div>
            <div className="pd_bottom_30" />
            <div className="row">
              {POINTS.map((p) => (
                <div key={p.title} className="col-lg-6">
                  <div className="icon_box_only type_five d-flex color_two trans">
                    <div className="icon"><CheckCircle2 className="fas" style={{ width: 20, height: 20 }} /></div>
                    <div className="content">
                      <div className="title_22"><Link href="/a-propos">{p.title}</Link></div>
                      <p>{p.text}</p>
                    </div>
                  </div>
                  <div className="pd_bottom_20" />
                </div>
              ))}
            </div>
          </div>
          <div className="col-lg-5 col-md-12">
            <div className="image_box_only type_four">
              <div className="image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/school-6.jpg" alt="Équipe pédagogique au quotidien" className="img-fluid" />
              </div>
              <div className="abso_content">
                <div
                  style={{
                    display: "inline-block", background: "#2D947A", color: "#fff", fontWeight: 700,
                    padding: "6px 14px", borderRadius: 6, transform: "rotate(-8deg)", fontSize: 13,
                  }}
                >
                  CathClau Edu
                </div>
                <div className="authour_box">
                  <div className="d-flex align-items-center">
                    <span
                      style={{
                        display: "inline-flex", height: 32, width: 32, borderRadius: "50%", alignItems: "center",
                        justifyContent: "center", background: "linear-gradient(135deg,#3b82f6,#1e4fa8)", color: "#fff",
                        fontSize: 12, fontWeight: 700,
                      }}
                    >
                      JC
                    </span>
                    <h6 className="title_no_a_18">Jean Claude Camara</h6>
                  </div>
                  <h6 className="title_no_a_26">Fondateur, CathClau Edu</h6>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pd_bottom_80" />
      <div className="ab_img_right_bottom z_0">
        <img src="/vankine/images/bg-2-2.png" className="img-fluid" alt="" />
      </div>
    </section>
  );
}
