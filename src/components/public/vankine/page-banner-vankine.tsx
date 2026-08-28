import Link from "next/link";

interface Crumb {
  label: string;
  href?: string;
}

/** Bandeau titre des pages internes (mêmes classes CSS que Breadcrumb.js du template) — fond avec
 * une vraie photo de l'établissement plutôt que la photo de famille générique (stock, sans lien
 * avec CathClau Edu) utilisée par le template original. */
export function PageBannerVankine({ title, crumbs, background = "/images/school-4.jpg" }: {
  title: string;
  crumbs: Crumb[];
  background?: string;
}) {
  return (
    <section className="page_header_default pg_bg_cover alignment_center">
      <div className="bakground_cover" style={{ backgroundImage: `url(${background})` }} />
      <div className="page_header_content">
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <div className="banner_title_inner">
                <div className="title"><span className="main_tit">{title}</span></div>
              </div>
            </div>
            <div className="col-lg-12 vankine">
              <ul className="breadcrumb m-auto">
                {crumbs.map((c, i) => (
                  <li key={c.label} className={i === crumbs.length - 1 ? "active" : ""}>
                    {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
