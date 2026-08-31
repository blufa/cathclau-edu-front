"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@/hooks/use-query";
import { listPublicCategories, listPublicPosts } from "@/lib/api/blog";
import { VankinePage } from "@/components/public/vankine/vankine-page";
import { PageBannerVankine } from "@/components/public/vankine/page-banner-vankine";
import { BlogSidebarVankine } from "@/components/public/vankine/blog-sidebar-vankine";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/format";

export default function BlogListPage() {
  return (
    <VankinePage>
      <Suspense fallback={<div className="d-flex justify-content-center" style={{ padding: "120px 0" }}><Spinner /></div>}>
        <BlogList />
      </Suspense>
    </VankinePage>
  );
}

/**
 * Liste des articles — reproduction fidèle de "blog" du template Vankine (mêmes classes CSS que
 * blog.js/BlogCard1.js) : cartes pleine largeur avec image, catégorie, auteur (identité éditoriale
 * d'équipe), titre, lien "Lire la suite". Filtres catégorie/tag/recherche déjà existants conservés.
 */
function BlogList() {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categorie") ? Number(searchParams.get("categorie")) : undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const postsQuery = useQuery(() => listPublicPosts({ categoryId, tag, search }), [categoryId, tag, search]);
  const categoriesQuery = useQuery(() => listPublicCategories(), []);

  const categoryLabel = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of categoriesQuery.data ?? []) map.set(c.id, c.label);
    return map;
  }, [categoriesQuery.data]);

  const posts = postsQuery.data ?? [];

  return (
    <>
      <PageBannerVankine title="Blog" crumbs={[{ label: "Accueil", href: "/" }, { label: "Blog" }]} background="/images/school-4.jpg" />

      <div className="blog-section">
        <div className="pd_top_90" />
        <div className="container">
          <div className="row">
            <div className="col-lg-8 col-md-12 col-sm-12 col-xs-12">
              {(categoryId || tag || search) && (
                <p className="mb_20">
                  Filtré par {categoryId ? <strong>{categoryLabel.get(categoryId) ?? "catégorie"}</strong> : null}
                  {tag ? <strong># {tag}</strong> : null}
                  {search ? <strong>« {search} »</strong> : null} — <Link href="/blog">réinitialiser</Link>
                </p>
              )}

              <div className="row loop-grid">
                {postsQuery.loading && posts.length === 0 && (
                  <div className="col-xl-12"><Spinner /></div>
                )}
                {!postsQuery.loading && posts.length === 0 && (
                  <div className="col-xl-12"><p>Aucun article pour l&apos;instant.</p></div>
                )}
                {posts.map((post) => (
                  <div key={post.id} className="col-xl-12">
                    <article className="blog_style one has_images">
                      <div className="image_box">
                        <Link href={`/blog/${post.slug}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={post.coverImageUrl || "/images/school-2.jpg"} alt={post.title} className="img-fluid" />
                        </Link>
                      </div>
                      <div className="content_box">
                        <div className="d-flex top align-items-center">
                          {post.categoryId != null && (
                            <Link href={`/blog?categorie=${post.categoryId}`} className="cat_gry">
                              {categoryLabel.get(post.categoryId) ?? "Article"}
                            </Link>
                          )}
                          <span className="date_tm">
                            <i className="fi-rr-calendar" />
                            <time className="date published">{formatDate(post.publishedAt)}</time>
                          </span>
                        </div>
                        <div className="d-flex authour align-items-center">
                          <span
                            style={{
                              display: "inline-flex", height: 24, width: 24, borderRadius: "50%", alignItems: "center",
                              justifyContent: "center", background: "linear-gradient(135deg,#3b82f6,#1e4fa8)", color: "#fff",
                              fontSize: 10, fontWeight: 700, marginRight: 8,
                            }}
                          >
                            CE
                          </span>
                          Équipe CathClau Edu
                        </div>
                        <h2 className="tit_ho title_28">
                          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                        </h2>
                        {post.excerpt && <p>{post.excerpt}</p>}
                        <div className="bottom d-flex align-items-center">
                          <Link href={`/blog/${post.slug}`} className="rd_more">
                            Lire la suite <i className="fi-rr-arrow-small-right" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
              <div className="pd_bottom_30" />
            </div>

            <div className="col-lg-4 col-md-12 pd_left_30">
              <BlogSidebarVankine activeCategoryId={categoryId} />
              <div className="pd_bottom_30" />
            </div>
          </div>
        </div>
        <div className="pd_bottom_60" />
      </div>
    </>
  );
}
