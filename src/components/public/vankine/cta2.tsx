import Link from "next/link";

/** Bandeau CTA final (mêmes classes CSS que Cta2.js) — contenu réel CathClau Edu. */
export function Cta2() {
  return (
    <section className="position-relative z_99 mr_bottom_minus_80">
      <div className="container">
        <div className="call_to_action style_one">
          <div className="section_title type_one">
            <div className="title_whole">
              <h2 className="title">Prêt à moderniser la gestion de votre établissement ?</h2>
            </div>
          </div>
          <div className="theme_btn_all">
            <Link href="/login" className="theme_btn">
              Connexion <span><i className="fi-rr-arrow-small-up" /></span>
            </Link>
          </div>
          <div className="d-flex align-items-center contact_header_one">
            <div className="icon_s"><i className="fi-rr-headphones" /></div>
            <div className="content">
              <h6 className="tite">Besoin d&apos;aide ?</h6>
              <div className="title_20"><Link href="tel:+224614324299">+224 614 32 42 99</Link></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
