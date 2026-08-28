import Link from "next/link";
import { MODULE_DETAILS } from "@/lib/content/modules";

/** Grille de services (mêmes classes CSS que Service8.js) — nos 4 vrais modules à la place des
 * 4 types d'assurance de démonstration, mêmes vraies photos que /fonctionnalites/[module]. */
export function Service8() {
  return (
    <section className="service-section mr_bottom_minus_250 position-relative z_1">
      <div className="medium-container-two">
        <div className="row">
          <div className="col-lg-12">
            <div className="section_title text-center type_one">
              <h4 className="sm_title">Toute l&apos;expertise de l&apos;école</h4>
              <div className="title_whole">
                <h2 className="title">Nos modules métier</h2>
              </div>
            </div>
          </div>
        </div>
        <div className="pd_bottom_40" />
        <div className="service_post position-relative">
          <div className="row">
            {MODULE_DETAILS.map((m, i) => (
              <div key={m.slug} className="col-xl-3 col-lg-4 col-md-6 col-sm-6">
                <div className="service_box type_three hover_1_get">
                  <Link href={`/fonctionnalites/${m.slug}`} className="img_bx">
                    <div className="image trans hover_1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.image} className="img-fluid" alt={m.title} />
                      <div className="oh ho_1" /><div className="oh ho_2" /><div className="oh ho_3" /><div className="oh ho_4" />
                    </div>
                  </Link>
                  <div className="content_box trans">
                    <div className="content_box_in trans">
                      <div className="icon trans"><m.icon className="trans" style={{ width: 28, height: 28 }} /></div>
                      <div className="steps trans">{i + 1}</div>
                      <h4 className="title_24 trans"><Link href={`/fonctionnalites/${m.slug}`}>{m.title}</Link></h4>
                      <p className="trans">{m.lead}</p>
                      <Link href={`/fonctionnalites/${m.slug}`} className="rd_more">Lire la suite<i className="fi-rr-arrow-small-right" /></Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
