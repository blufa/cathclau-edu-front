import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VankinePage } from "@/components/public/vankine/vankine-page";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";
import { FaqAccordionVankine } from "@/components/public/vankine/faq-accordion-vankine";
import { Cta2 } from "@/components/public/vankine/cta2";
import { MODULE_DETAILS, findModuleBySlug } from "@/lib/content/modules";

export function generateStaticParams() {
  return MODULE_DETAILS.map((m) => ({ module: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const { module } = await params;
  const mod = findModuleBySlug(module);
  if (!mod) return {};
  return {
    title: `${mod.title} — CathClau Edu`,
    description: mod.lead,
  };
}

/**
 * Page détail d'un module — reproduction fidèle de "service-details" du template Vankine (mêmes
 * classes CSS que service-details.js) : bandeau titre, image + liste de fonctionnalités clés en 2
 * colonnes, bénéfices + image en chevauchement, grille de 4 avantages, accordéon FAQ + image, CTA
 * finale (remplace l'onglet "devis assurance" fictif de l'original, aucun formulaire non fonctionnel).
 */
export default async function ModuleDetailPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const mod = findModuleBySlug(module);
  if (!mod) notFound();

  const pointsLeft = mod.points.slice(0, Math.ceil(mod.points.length / 2));
  const pointsRight = mod.points.slice(Math.ceil(mod.points.length / 2));

  return (
    <VankinePage>
      <PageBannerVankine
        title={mod.title}
        crumbs={[
          { label: "Accueil", href: "/" },
          { label: "Fonctionnalités", href: "/fonctionnalites" },
          { label: mod.title },
        ]}
        background={mod.image}
      />

      {/* 1. Image + fonctionnalités clés (2 colonnes) */}
      <section className="content-section">
        <div className="pd_top_90" />
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 col-md-6 col-sm-6 col-xs-12">
              <div className="image_box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mod.image} className="img-fluid" alt={mod.title} />
              </div>
              <div className="pd_bottom_20" />
            </div>
            <div className="col-lg-6 col-md-6 col-sm-6 col-xs-12 pd_left_30">
              <div className="pd_top_30" />
              <div className="section_title type_one">
                <h4 className="sm_title">Ce que vous obtenez</h4>
                <div className="title_whole">
                  <h2 className="title">Fonctionnalités clés du module {mod.title}</h2>
                </div>
                <p>{mod.lead}</p>
                <div className="pd_bottom_30" />
              </div>
              <div className="row">
                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="position-relative">
                    <ul className="list_box weight_500 list">
                      {pointsLeft.map((p) => (
                        <li key={p}>
                          <div className="d-flex align-items-center">
                            <div className="icon trans"><i className="fi-rs-shield-check" /></div>
                            <span className="links">{p}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="pd_bottom_20" />
                  </div>
                </div>
                <div className="col-lg-6 col-md-6 col-sm-12">
                  <div className="position-relative">
                    <ul className="list_box weight_500 list">
                      {pointsRight.map((p) => (
                        <li key={p}>
                          <div className="d-flex align-items-center">
                            <div className="icon trans"><i className="fi-rs-shield-check" /></div>
                            <span className="links">{p}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="pd_bottom_20" />
                  </div>
                </div>
              </div>
              <div className="pd_bottom_20" />
            </div>
          </div>
        </div>
        <div className="pd_bottom_50" />
      </section>

      {/* 2. Bénéfices + image en chevauchement */}
      <section className="content-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 col-md-6 col-sm-6 col-xs-12 pd_right_70">
              <div className="section_title type_one">
                <h4 className="sm_title">Bénéfices</h4>
                <div className="title_whole">
                  <h2 className="title">Ce que ce module change concrètement</h2>
                </div>
              </div>
              <div className="pd_bottom_40" />
              {mod.benefits.map((b, i) => {
                const BIcon = b.icon;
                return (
                  <div key={b.title}>
                    <div className="icon_box_only type_five color_two d-flex trans">
                      <div className="icon"><BIcon className="fas" style={{ width: 20, height: 20 }} /></div>
                      <div className="content">
                        <div className="title_22">{b.title}</div>
                        <p>{b.text}</p>
                      </div>
                    </div>
                    <div className="pd_top_15" />
                    {i < mod.benefits.length - 1 ? <div className="divider" /> : null}
                    <div className="pd_bottom_25" />
                  </div>
                );
              })}
            </div>
            <div className="col-lg-6 col-md-6 col-sm-6 col-xs-12">
              <div className="image_box mr_bottom_minus_200 position-relative z_2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mod.secondaryImage} className="img-fluid" alt="" />
              </div>
              <div className="pd_bottom_20" />
            </div>
          </div>
        </div>
        <div className="pd_bottom_50" />
      </section>

      {/* 3. Grille de 4 avantages */}
      <section className="service-section position-relative bg_op_1 overflow-hidden" style={{ backgroundImage: "url(/vankine/images/bg-1.png)" }}>
        <div className="pd_top_140" />
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="section_title text-center type_one">
                <h4 className="sm_title">Avantages</h4>
                <div className="title_whole">
                  <h2 className="title">Pourquoi les écoles adoptent ce module</h2>
                </div>
              </div>
            </div>
          </div>
          <div className="pd_bottom_40" />
          <div className="row">
            {mod.advantages.map((a) => {
              const AIcon = a.icon;
              return (
                <div key={a.title} className="col-lg-3 col-md-6 col-sm-6 col-xs-12">
                  <div className="icon_box_only type_one color_two">
                    <div className="icon_box_in trans">
                      <div className="shape_image">
                        <svg width={116} height={121} viewBox="0 0 116 121" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19.8056 39.6223L0.500244 0H17.5002L36.1734 36.0124L19.8056 39.6223Z" fill="var(--color-set-one-1)" />
                          <path className="two" d="M36.8216 44.7789L19.8086 39.6339L41.3565 29.0508L58.4829 34.1875L36.8216 44.7789Z" fill="var(--color-set-one-2)" />
                          <path className="two" d="M75.3704 66.1668L58.0938 61.0318L80.9934 52.772L98.1198 57.9087L75.3704 66.1668Z" fill="var(--color-set-one-2)" />
                          <path d="M41.3564 29.0508L58.0936 61.0319L71.4346 56.223L60.3526 34.7522L41.3564 29.0508Z" fill="var(--color-set-one-1)" />
                          <path d="M80.9629 52.792L116 121V91.5L99.9591 58.4917" fill="var(--color-set-one-1)" />
                        </svg>
                      </div>
                      <div className="after" />
                      <div className="icon"><AIcon style={{ width: 32, height: 32 }} /></div>
                      <div className="title_22"><span>{a.title}</span></div>
                      <p>{a.text}</p>
                    </div>
                  </div>
                  <div className="pd_bottom_20" />
                </div>
              );
            })}
          </div>
        </div>
        <div className="pd_bottom_50" />
      </section>

      {/* 4. FAQ + image */}
      <section className="faq-section">
        <div className="pd_top_80" />
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="image_box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mod.image} alt="" className="img-fluid" />
              </div>
              <div className="pd_bottom_40" />
            </div>
            <div className="col-lg-6 col-md-6 col-sm-12 pd_left_30">
              <div className="section_title type_one">
                <h4 className="sm_title">Questions fréquentes</h4>
                <div className="title_whole">
                  <h2 className="title">Tout savoir sur le module {mod.title}</h2>
                </div>
                <div className="pd_bottom_20" />
              </div>
              <div className="pd_bottom_30" />
              <FaqAccordionVankine items={mod.faqs} />
              <div className="pd_bottom_40" />
            </div>
          </div>
        </div>
        <div className="pd_bottom_40" />
      </section>

      {/* 5. Autres modules */}
      <section className="content-section bg_light_1">
        <div className="pd_top_80" />
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="section_title text-center type_one">
                <h4 className="sm_title">Et aussi</h4>
                <div className="title_whole"><h2 className="title">Les autres modules</h2></div>
              </div>
            </div>
          </div>
          <div className="pd_bottom_40" />
          <div className="row">
            {MODULE_DETAILS.filter((m) => m.slug !== mod.slug).map((m) => {
              const OIcon = m.icon;
              return (
                <div key={m.slug} className="col-lg-4 col-md-6 col-sm-6 col-xs-12">
                  <Link href={`/fonctionnalites/${m.slug}`} className="icon_box_only type_five color_two d-flex trans">
                    <div className="icon"><OIcon className="fas" style={{ width: 20, height: 20 }} /></div>
                    <div className="content">
                      <div className="title_22">{m.title}</div>
                      <p>{m.lead}</p>
                    </div>
                  </Link>
                  <div className="pd_bottom_20" />
                </div>
              );
            })}
          </div>
        </div>
        <div className="pd_bottom_80" />
      </section>

      <Cta2 />
    </VankinePage>
  );
}
