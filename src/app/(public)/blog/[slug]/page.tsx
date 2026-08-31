"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@/hooks/use-query";
import { getAdjacentPosts, getPublicPost, listPublicCategories, listPublicComments, submitComment } from "@/lib/api/blog";
import { VankinePage } from "@/components/public/vankine/vankine-page";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";
import { BlogSidebarVankine } from "@/components/public/vankine/blog-sidebar-vankine";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate } from "@/lib/format";

/** Construit les URLs de partage au moment du clic (jamais pendant le rendu, pour rester sûr côté SSR). */
function shareUrl(network: "facebook" | "twitter" | "whatsapp", url: string, title: string) {
  const targets = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  };
  return targets[network];
}

/**
 * Page détail d'un article — reproduction fidèle de "blog-details-right-sidebar" du template
 * Vankine (mêmes classes CSS) : miniature, contenu réel de l'article, encart auteur (identité
 * éditoriale d'équipe, pas de faux nom individuel), partage social fonctionnel, navigation
 * précédent/suivant, commentaires, colonne latérale (recherche/récents/catégories/tags/contact).
 */
export default function BlogPostDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const postQuery = useQuery(() => getPublicPost(slug), [slug]);
  const adjacentQuery = useQuery(() => getAdjacentPosts(slug), [slug]);
  const categoriesQuery = useQuery(() => listPublicCategories(), []);
  const commentsQuery = useQuery(() => (postQuery.data ? listPublicComments(postQuery.data.id) : Promise.resolve([])), [postQuery.data?.id]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const post = postQuery.data;
  const comments = commentsQuery.data ?? [];
  const adjacent = adjacentQuery.data;
  const categoryLabel = post?.categoryId != null
    ? categoriesQuery.data?.find((c) => c.id === post.categoryId)?.label
    : undefined;

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!post) return;
    setSending(true);
    try {
      await submitComment(post.id, { authorName: name, authorEmail: email, website: website || undefined, content });
      notifySuccess("Commentaire envoyé — il sera visible après validation.");
      setName(""); setEmail(""); setWebsite(""); setContent("");
      setSubmitted(true);
    } catch (err) {
      notifyError(err);
    } finally {
      setSending(false);
    }
  }

  if (postQuery.loading && !post) {
    return (
      <VankinePage>
        <div className="d-flex justify-content-center" style={{ padding: "120px 0" }}><Spinner /></div>
      </VankinePage>
    );
  }

  if (postQuery.error || !post) {
    return (
      <VankinePage>
        <div className="text-center" style={{ padding: "120px 0" }}>
          <h1 className="title_no_a_26">Article introuvable</h1>
          <p>Cet article n&apos;existe pas ou n&apos;est plus disponible.</p>
          <Link href="/blog" className="theme_btn" style={{ marginTop: 20, display: "inline-flex" }}>Retour au blog</Link>
        </div>
      </VankinePage>
    );
  }

  const shareTargetUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <VankinePage>
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
                          <a className="m_icon" href={shareUrl("facebook", shareTargetUrl, post.title)} target="_blank" rel="noreferrer" aria-label="Partager sur Facebook">
                            <i className="fab fa-facebook" />
                          </a>
                        </li>
                        <li className="social-mds">
                          <a className="m_icon" href={shareUrl("twitter", shareTargetUrl, post.title)} target="_blank" rel="noreferrer" aria-label="Partager sur X">
                            <i className="fab fa-twitter" />
                          </a>
                        </li>
                        <li className="social-mds">
                          <a className="m_icon" href={shareUrl("whatsapp", shareTargetUrl, post.title)} target="_blank" rel="noreferrer" aria-label="Partager sur WhatsApp">
                            <i className="fab fa-whatsapp" />
                          </a>
                        </li>
                        <li className="social-mds">
                          <a className="m_icon" href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(shareTargetUrl)}`} aria-label="Partager par e-mail">
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

                              {submitted ? (
                                <p className="title_para">Merci, votre commentaire a bien été envoyé et sera publié après modération.</p>
                              ) : (
                                <form onSubmit={handleSubmitComment} id="commentform" className="comment-form">
                                  <p className="title_para">Votre adresse e-mail ne sera pas publiée.</p>
                                  <p className="comment-form-comment">
                                    <label>Laisser un commentaire</label>
                                    <textarea
                                      placeholder="Écrivez votre commentaire ici…" rows={12} required
                                      value={content} onChange={(e) => setContent(e.target.value)}
                                    />
                                  </p>
                                  <p className="comment-form-author">
                                    <label>Nom complet</label>
                                    <input placeholder="ex. Aïssatou Diallo" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
                                  </p>
                                  <p className="comment-form-email">
                                    <label>Adresse e-mail</label>
                                    <input placeholder="ex. contact@ecole.gn" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                                  </p>
                                  <p className="comment-form-url">
                                    <label>Site web (optionnel)</label>
                                    <input placeholder="ex. www.exemple.com" type="text" value={website} onChange={(e) => setWebsite(e.target.value)} />
                                  </p>
                                  <div className="clearfix" />
                                  <p className="form-submit">
                                    <input type="submit" className="submit" value={sending ? "Envoi…" : "Publier le commentaire"} disabled={sending} />
                                  </p>
                                </form>
                              )}
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
