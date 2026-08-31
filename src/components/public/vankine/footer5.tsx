import Link from "next/link";
import { MODULE_DETAILS } from "@/lib/content/modules";

const GALLERY = ["/images/school-1.jpg", "/images/school-2.jpg", "/images/school-3.jpg", "/images/school-4.jpg", "/images/school-5.jpg", "/images/school-6.jpg"];

/** Footer "style 5" du template (mêmes classes CSS que Footer5.js) — contenu réel CathClau Edu,
 * vraies photos d'établissement pour la galerie, pas de faux formulaire newsletter non fonctionnel. */
export function Footer5() {
  return (
    <footer className="footer style_one style_five">
      <section className="md_content position-relative z_99">
        <div className="pd_top_160" />
        <div className="container">
          <div className="row">
            <div className="col-lg-3 col-md-6 col-sm-6 col-xs-12">
              <div className="footer_widgets_box pd_bottom_30">
                <div className="logo_box">
                  <Link href="/" className="logo navbar-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/logo.png" alt="CathClau Edu" className="logo_default" style={{ maxHeight: 40 }} />
                  </Link>
                </div>
                <div className="pd_bottom_35" />
                <div className="position-relative color_white">
                  La suite tout-en-un pour gérer votre établissement scolaire et garder du temps
                  pour l&apos;essentiel : vos élèves.
                </div>
                <div className="pd_bottom_25" />
                <div className="social-icons">
                  <ul>
                    <li><a className="m_icon" href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><i className="fab fa-linkedin" /></a></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-lg-3 pd_left_40">
              <div className="footer_widgets_box pd_bottom_30">
                <div className="fwidget_title">
                  <h2 className="title color_white">Modules</h2>
                  <div className="pd_bottom_25" />
                </div>
                <div className="position-relative">
                  <ul className="list_box list">
                    {MODULE_DETAILS.map((m) => (
                      <li key={m.slug}>
                        <div className="d-flex align-items-center">
                          <div className="icon trans"><i className="fi-rr-arrow-small-right color_white" /></div>
                          <Link className="links color_white" href={`/fonctionnalites/${m.slug}`}>{m.title}</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-lg-3">
              <div className="footer_widgets_box pd_bottom_30">
                <div className="fwidget_title">
                  <h2 className="title color_white">Ressources</h2>
                  <div className="pd_bottom_25" />
                </div>
                <div className="position-relative">
                  <ul className="list_box list">
                    {[
                      { label: "Blog", href: "/blog" },
                      { label: "FAQ", href: "/faqs" },
                      { label: "Centre d'aide", href: "/aide" },
                      { label: "Contact", href: "/contact" },
                    ].map((l) => (
                      <li key={l.href}>
                        <div className="d-flex align-items-center">
                          <div className="icon trans"><i className="fi-rr-arrow-small-right color_white" /></div>
                          <Link className="links color_white" href={l.href}>{l.label}</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 col-sm-6 col-xs-12">
              <div className="footer_widgets_box pd_bottom_30">
                <div className="fwidget_title">
                  <h2 className="title color_white">Notre établissement</h2>
                  <div className="pd_bottom_25" />
                </div>
                <div className="g_box d-flex">
                  {GALLERY.map((src) => (
                    <Link key={src} className="trans" href="/a-propos">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="img-fluid" />
                      <svg className="trans" width={30} height={30} viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx={28} cy={27} r={20} fill="white" />
                        <circle cx="27.5" cy="27.5" r="27.5" fill="white" fillOpacity="0.1" />
                        <path d="M22 33.25L33.25 22M33.25 22H24.8125M33.25 22V30.4375" stroke="#2D947A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="pd_bottom_40" />
      </section>
      <section className="mottom_content position-relative z_99">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="position-relative">
                <ul className="list_box linline">
                  <li>
                    <div className="d-flex align-items-center">
                      <Link className="links color_white" href="/">
                        © {new Date().getFullYear()}, CathClau Edu. Tous droits réservés.
                      </Link>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-6 col-md-6 col-sm-12 text-md-end">
              <div className="position-relative">
                <ul className="list_box linline">
                  <li><div className="d-flex align-items-center"><div className="icon trans"><i className="fi-rr-arrow-small-right" /></div><Link className="links color_white" href="/a-propos">À propos</Link></div></li>
                  <li><div className="d-flex align-items-center"><div className="icon trans"><i className="fi-rr-arrow-small-right" /></div><Link className="links color_white" href="/fonctionnalites">Fonctionnalités</Link></div></li>
                  <li><div className="d-flex align-items-center"><div className="icon trans"><i className="fi-rr-arrow-small-right" /></div><Link className="links color_white" href="/faqs">FAQ</Link></div></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="pd_bottom_40" />
    </footer>
  );
}
