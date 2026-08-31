import Link from "next/link";
import { StatCounter } from "@/components/public/stat-counter";

/** Section statistiques (mêmes classes CSS que Funfacts3.js) — chiffres réels, pas de fausse
 * vidéo promotionnelle (VideoBox de l'original retiré, remplacé par une vraie photo cliquable). */
export function Funfacts3() {
  return (
    <section className="fun-fact-video">
      <div className="d-flex flex-wrap">
        <div className="video-section w_50">
          <div className="pd_top_70 d_md_none" />
          <div className="image_video_box_only type_one">
            <div className="image one">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/school-4.jpg" alt="Vie scolaire à l'établissement" className="img-fluid" />
              <div className="video_box video-inner text-center">
                <Link href="/signup" className="theme_btn">Essai gratuit</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="fun-facts-section bg_op_4 bg_2 w_50 pd_top_90 pd_left_90 pd_right_90 pd_bottom_90 md_pd_left_15 md_pd_right_15">
          <div className="row">
            <div className="col-lg-8">
              <div className="section_title color_white type_one">
                <h4 className="sm_title">Une suite déjà complète</h4>
                <div className="title_whole">
                  <h2 className="title">En constante évolution</h2>
                </div>
              </div>
              <div className="pd_bottom_40" />
              <div className="row">
                <div className="col-lg-6">
                  <div className="fun_facts type_four color_two">
                    <div className="icon trans"><i className="fi-rr-calendar" /></div>
                    <h4><StatCounter value={11} /></h4>
                    <h6 className="title_no_a_18">Modules métier intégrés</h6>
                  </div>
                  <div className="pd_bottom_30" />
                  <div className="fun_facts type_four color_three">
                    <div className="icon trans"><i className="fi-rr-envelope" /></div>
                    <h4><StatCounter value={3} /></h4>
                    <h6 className="title_no_a_18">Canaux de communication</h6>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="pd_top_30" />
                  <div className="fun_facts type_four color_three">
                    <div className="icon trans"><i className="fi-rr-marker" /></div>
                    <h4><StatCounter value={100} suffix="%" /></h4>
                    <h6 className="title_no_a_18">Web, multi-établissements</h6>
                  </div>
                  <div className="pd_top_30" />
                  <div className="fun_facts type_four color_three">
                    <div className="icon trans"><i className="fi-rr-phone-call" /></div>
                    <h4><StatCounter value={8} /></h4>
                    <h6 className="title_no_a_18">Rôles & permissions</h6>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
