import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdjacentPosts, getPublicPost, listPublicCategories, listPublicComments } from "@/lib/api/blog";
import { VankinePage } from "@/components/public/vankine/vankine-page";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";
import { BlogSidebarVankine } from "@/components/public/vankine/blog-sidebar-vankine";
import { CommentForm } from "@/components/public/vankine/comment-form";
import { SITE_URL } from "@/lib/site";
import { formatDate } from "@/lib/format";

/** URLs de partage — construites côté serveur depuis l'URL canonique de l'article (déterministe,
 * plus besoin de dépendre de window.location comme avant le passage en Server Component). */
function shareUrl(network: "facebook" | "twitter" | "whatsapp", url: string, title: string) {
  const targets = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  };
  return targets[network];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await getPublicPost(slug);
    const description = post.excerpt ?? undefined;
    return {
      title: `${post.title} — CathClau Edu`,
      description,
      alternates: { canonical: `/blog/${slug}` },
      openGraph: {
        title: post.title,
        description,
        type: "article",
        publishedTime: post.publishedAt ?? undefined,
        images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
      },
    };
  } catch {
    return { title: "Article introuvable — CathClau Edu" };
  }
}

/**
 * Page détail d'un article — reproduction fidèle de "blog-details-right-sidebar" du template
 * Vankine (mêmes classes CSS) : miniature, contenu réel de l'article, encart auteur (identité
 * éditoriale d'équipe, pas de faux nom individuel), partage social fonctionnel, navigation
 * précédent/suivant, commentaires (lecture côté serveur + envoi via CommentForm), colonne latérale.
 * Server Component : le contenu de l'article est présent dans le HTML initial (référencement),
 * seul l'envoi d'un commentaire reste interactif côté client.
 */
export default async function BlogPostDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let post;
  try {
    post = await getPublicPost(slug);
  } catch {
    notFound();
  }

  const [adjacent, categories, comments] = await Promise.all([
    getAdjacentPosts(slug).catch(() => undefined),
    listPublicCategories().catch(() => []),
    listPublicComments(post.id).catch(() => []),
  ]);

  const categoryLabel = post.categoryId != null
    ? categories.find((c) => c.id === post.categoryId)?.label
    : undefined;
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.coverImageUrl ?? undefined,
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt ?? post.publishedAt ?? post.createdAt,
    author: { "@type": "Organization", name: "CathClau Edu" },
    publisher: { "@type": "Organization", name: "CathClau Edu", logo: { "@type": "ImageObject", url: `${SITE_URL}/images/logo.png` } },
    mainEntityOfPage: canonicalUrl,
  };

  return (
    <VankinePage>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageBannerVankine
        title="Blog"
        crumbs={[{ label: "Accueil", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.title }]}
        background={post.coverImageUrl || "/images/school-2.jpg"}
      />

      <section className="blog-detail-section">
        <div className="pd_top_90" />
        <div className="container">
          <div className="row">
            <div className="col-lg-8">
              <div className="blog_single_content">
                {post.coverImageUrl && (
                  <div className="single-thumbnail">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.coverImageUrl} className="img-fluid" alt={post.title} />
                  </div>
                )}
                <div className="single_content_upper">
                  <div className="post_single_content">
                    <div className="section_title small type_one mr_bottom_25">
                      <div className="title_whole"><h1 className="title">{post.title}</h1></div>
                    </div>
                    <div className="d-flex align-items-center mr_bottom_20" style={{ gap: 16 }}>
                      <span className="date_tm"><i className="fi-rr-calendar" /> <time className="date published">{formatDate(post.publishedAt ?? post.createdAt)}</time></span>
                      {categoryLabel && <Link href={`/blog?categorie=${post.categoryId}`} className="cats">{categoryLabel}</Link>}
                    </div>
                    <div
                      className="position-relative mr_bottom_20"
                      dangerouslySetInnerHTML={{ __html: post.contentHtml }}
                    />
                    <div className="clearfix" />
                  </div>
                  <div className="single_content_lower">
                    {post.tags.length > 0 && (
                      <div className="tags_and_cat yes_tags">
                        <div className="d-flex">
                          <div className="left_one d-flex">
                            <div className="title">Tags</div>
                            {post.tags.map((tag) => (
                              <Link key={tag} className="tags" href={`/blog?tag=${encodeURIComponent(tag)}`}># {tag}</Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="social-icons single-share">
                      <h6>Partager :</h6>
                      <ul className="text-grey-5 d-inline-block">
                        <li className="social-mds">
                          <a className="m_icon" href={shareUrl("facebook", canonicalUrl, post.title)} target="_blank" rel="noreferrer" aria-label="Partager sur Facebook">
                            <i className="fab fa-facebook" />
                          </a>
                        </li>
                        <li className="social-mds">
                          <a className="m_icon" href={shareUrl("twitter", canonicalUrl, post.title)} target="_blank" rel="noreferrer" aria-label="Partager sur X">
                            <i className="fab fa-twitter" />
                          </a>
                        </li>
                        <li className="social-mds">
                          <a className="m_icon" href={shareUrl("whatsapp", canonicalUrl, post.title)} target="_blank" rel="noreferrer" aria-label="Partager sur WhatsApp">
                            <i className="fab fa-whatsapp" />
                          </a>
                        </li>
                        <li className="social-mds">
                          <a className="m_icon" href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(canonicalUrl)}`} aria-label="Partager par e-mail">
                            <i className="fas fa-envelope" />
                          </a>
                        </li>
                      </ul>
                    </div>

                    <div className="same_authour">
                      <div
                        className="image d-flex align-items-center justify-content-center"
                        style={{ background: "linear-gradient(135deg,#3b82f6,#1e4fa8)", color: "#fff", fontWeight: 700, borderRadius: "50%", width: 70, height: 70 }}
                      >
                        CE
                      </div>
                      <div className="content">
                        <h4 className="title_no_a_22">Rédigé par l&apos;équipe CathClau Edu</h4>
                        <p>Actualités et conseils sur la gestion scolaire, écrits par l&apos;équipe produit.</p>
                      </div>
                    </div>

                    {(adjacent?.previous || adjacent?.next) && (
                      <div className="previouse_next_post entry-bottom">
                        {adjacent?.previous ? (
                          <div className="prev_post nav_post">
                            <Link href={`/blog/${adjacent.previous.slug}`} className="linked_prev_next">
                              <div className="text">
                                <h2 className="title_no_a_22">{adjacent.previous.title}</h2>
                                <div className="down_content"><small><i className="fas fa-arrow-left" /> Article précédent</small></div>
                              </div>
                            </Link>
                          </div>
                        ) : <div />}
                        {adjacent?.next ? (
                          <div className="next_post nav_post">
                            <Link href={`/blog/${adjacent.next.slug}`} className="linked_prev_next">
                              <div className="text">
                                <h2 className="title_no_a_22">{adjacent.next.title}</h2>
                                <div className="down_content"><small>Article suivant <i className="fas fa-arrow-right" /></small></div>
                              </div>
                            </Link>
                          </div>
                        ) : <div />}
                      </div>
                    )}

                    <div className="sec_comments comment-form" id="comment">
                      <div className="container_no">
                        <div className="row justify-content-center">
                          <div className="col-lg-12">
                            <div id="respond" className="comment-respond">
                              <h3 id="reply-title" className="comment-reply-title">Commentaires ({comments.length})</h3>
                              <ul style={{ listStyle: "none", padding: 0, margin: "20px 0" }}>
                                {comments.map((c) => (
                                  <li key={c.id} style={{ marginBottom: 16 }}>
                                    <div className="d-flex align-items-center" style={{ justifyContent: "space-between" }}>
                                      <strong>{c.authorName}</strong>
                                      <span className="date_tm">{formatDate(c.createdAt)}</span>
                                    </div>
                                    <p>{c.content}</p>
                                  </li>
                                ))}
                                {comments.length === 0 && <li>Soyez le premier à commenter cet article.</li>}
                              </ul>

                              <CommentForm postId={post.id} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-4 col-md-12 pd_left_30">
              <BlogSidebarVankine activeCategoryId={post.categoryId ?? undefined} excludeSlug={post.slug} />
              <div className="pd_bottom_30" />
            </div>
          </div>
        </div>
        <div className="pd_bottom_70" />
      </section>
    </VankinePage>
  );
}
