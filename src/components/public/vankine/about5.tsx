import Link from "next/link";
import { StatCounter } from "@/components/public/stat-counter";

/** Section "About" du template (mêmes classes CSS que About5.js) — contenu réel CathClau Edu à la
 * place du texte de démonstration, vraie photo d'établissement à la place d'une photo de famille. */
export function About5() {
  return (
    <section className="about-section">
      <div className="pd_top_80" />
      <div className="container">
        <div className="row align-items-center">
          <div className="col-lg-6 col-md-12">
            <div className="image_box_only type_seven">
              <div className="icon_box_only type_four inline_box trans">
                <div className="icon">
                  <img src="/vankine/images/icon-image-1.png" alt="" className="img-fluid" />
                </div>
                <div className="content">
                  <div className="title_18"><Link href="/fonctionnalites/scolarite">Scolarité</Link></div>
                </div>
              </div>
              <div className="icon_box_only type_four position_two trans">
                <div className="icon">
                  <img src="/vankine/images/icon-image-2.png" alt="" className="img-fluid" />
                </div>
                <div className="content">
                  <div className="title_18"><Link href="/fonctionnalites/communication">Communication</Link></div>
                </div>
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
          <div className="col-lg-6 col-md-12 pd_left_80">
            <div className="section_title type_one">
              <h4 className="sm_title">Notre histoire</h4>
              <div className="title_whole">
                <h2 className="title">Née d&apos;un constat simple : trop de temps perdu dans l&apos;administratif</h2>
              </div>
            </div>
            <div className="pd_bottom_20" />
            <div className="position-relative">
              Bulletins calculés à la main le week-end, frais scolaires suivis sur papier, absences
              communiquées aux parents avec retard : ce constat, observé directement auprès de
              directeurs et de comptables d&apos;écoles, est à l&apos;origine de CathClau Edu.
            </div>
            <div className="pd_bottom_40" />
            <div className="row">
              <div className="col-lg-5 col-md-12">
                <div className="theme_btn_all">
                  <Link href="/a-propos" className="theme_btn rotate big">
                    En savoir plus <span><i className="fi-rr-arrow-small-up" /></span>
                  </Link>
                </div>
                <div className="pd_bottom_20" />
              </div>
              <div className="col-lg-7 col-md-12">
                <div className="d-flex align-items-center contact_header_one color_three">
                  <div className="icon_s"><i className="fi-rr-headphones" /></div>
                  <div className="content">
                    <h6 className="tite">Besoin d&apos;aide ?</h6>
                    <div className="title_20"><Link href="tel:+224620000000">+224 620 00 00 00</Link></div>
                  </div>
                </div>
                <div className="pd_bottom_20" />
              </div>
            </div>
            <div className="pd_bottom_20" />
            <div className="divider" />
            <div className="pd_bottom_40" />
            <div className="row align-items-center">
              <div className="col-lg-6 col-md-12">
                <div className="fun_facts type_one with_box_shadow">
                  <h4><StatCounter value={100} suffix="%" /></h4>
                  <h6 className="title_no_a_18">Web, sans installation</h6>
                </div>
                <div className="pd_bottom_20" />
              </div>
              <div className="col-lg-6 col-md-12">
                <div className="fun_facts type_one">
                  <h4><StatCounter value={8} /></h4>
                  <h6 className="title_no_a_18">Rôles & permissions (RBAC)</h6>
                </div>
                <div className="pd_bottom_20" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pd_bottom_80" />
    </section>
  );
}
