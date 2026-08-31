import type { Metadata } from "next";
import { VankinePage } from "@/components/public/vankine/vankine-page";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";
import { ContactForm } from "@/components/public/vankine/contact-form";

export const metadata: Metadata = {
  title: "Contact — CathClau Edu",
  description: "Une question, une démo, un devis pour votre établissement ? Contactez l'équipe CathClau Edu.",
  alternates: { canonical: "/contact" },
};

const COORDS = [
  { icon: "fi-rr-marker", title: "Adresse", lines: ["Conakry, Guinée"] },
  { icon: "fi-rr-envelope", title: "E-mail", lines: ["contact@cathclau.edu"], href: "mailto:contact@cathclau.edu" },
  { icon: "fi-rr-phone-call", title: "Téléphone", lines: ["+224 620 00 00 00"], href: "tel:+224620000000" },
];

/**
 * Page Contact — reproduction fidèle de "contact" du template Vankine (mêmes classes CSS) :
 * 3 blocs coordonnées, carte, formulaire réel (ContactForm, client component isolé pour que cette
 * page reste un Server Component indexable avec ses propres metadata).
 */
export default function ContactPage() {
  return (
    <VankinePage>
      <PageBannerVankine title="Contact" crumbs={[{ label: "Accueil", href: "/" }, { label: "Contact" }]} background="/images/school-1.jpg" />

      <section className="contact-section">
        <div className="pd_top_80" />
        <div className="container">
          <div className="row">
            {COORDS.map((c) => (
              <div key={c.title} className="col-lg-4 col-md-6 col-sm-12">
                <div className="contact_box_content">
                  <div className="icon trans"><i className={c.icon} /></div>
                  <div className="contact-infor">
                    <h6 className="title_no_a_24">{c.title}</h6>
                    {c.lines.map((line) => (
                      c.href ? (
                        <a key={line} href={c.href}>{line}</a>
                      ) : (
                        <span key={line}>{line}</span>
                      )
                    ))}
                  </div>
                </div>
                <div className="pd_bottom_30" />
              </div>
            ))}
          </div>
        </div>
        <div className="pd_bottom_40" />
      </section>

      <section className="contact-map-section">
        <div className="container-no">
          <div className="row">
            <div className="col-lg-12">
              <section className="map-section">
                <div className="map-outer">
                  <iframe
                    title="Localisation CathClau Edu — Conakry, Guinée"
                    src="https://www.google.com/maps?q=Conakry,Guin%C3%A9e&output=embed"
                    height={420}
                    style={{ border: 0, width: "100%" }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="form-section bg_light_1 position-relative">
        <div className="pd_top_90" />
        <div className="container">
          <div className="row">
            <div className="col-lg-4 col-md-12">
              <div className="section_title type_one">
                <h4 className="sm_title">Nous contacter</h4>
                <div className="title_whole"><h2 className="title">Parlons de votre établissement</h2></div>
                <p>Une question, une démo, un devis ? Écrivez-nous, on vous répond vite.</p>
              </div>
              <div className="pd_bottom_40" />
              <div className="social-icons">
                <ul>
                  <li>
                    <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" className="m_icon" aria-label="LinkedIn">
                      <i className="fab fa-linkedin" />
                    </a>
                  </li>
                </ul>
              </div>
              <div className="pd_bottom_20" />
            </div>
            <div className="col-lg-8 col-md-12">
              <section className="contact_form_box_all style_one">
                <div className="contact_form_shortcode">
                  <ContactForm />
                </div>
              </section>
            </div>
          </div>
        </div>
        <div className="pd_bottom_90" />
      </section>
    </VankinePage>
  );
}
