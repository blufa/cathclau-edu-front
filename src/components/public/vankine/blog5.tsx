"use client";

import Link from "next/link";
import { useQuery } from "@/hooks/use-query";
import { listPublicPosts } from "@/lib/api/blog";
import { formatDate } from "@/lib/format";

/** Aperçu du blog (mêmes classes CSS que Blog5.js) — nos vrais articles publiés, jamais de
 * contenu de remplissage si aucun article n'existe encore. */
export function Blog5() {
  const postsQuery = useQuery(() => listPublicPosts(), []);
  const posts = (postsQuery.data ?? []).slice(0, 3);

  if (!postsQuery.loading && posts.length === 0) return null;

  return (
    <section className="blog-section">
      <div className="pd_top_90" />
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="section_title text-center type_one">
              <h4 className="sm_title">Blog</h4>
              <div className="title_whole"><h2 className="title">Nos derniers articles</h2></div>
            </div>
            <div className="pd_bottom_40" />
          </div>
        </div>
        <section className="blog_post position-relative">
          <div className="row">
            {posts.map((post) => (
              <div key={post.id} className="col-xl-4 col-lg-4 col-md-6 col-sm-6">
                <div className="blog_box type_two type_three trans hover_1_get">
                  <div className="blog_inner trans">
                    <div className="image_box trans hover_1">
                      <Link href={`/blog/${post.slug}`}>
                        {post.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.coverImageUrl} className="img-fluid" alt={post.title} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src="/images/school-2.jpg" className="img-fluid" alt={post.title} />
                        )}
                      </Link>
                      <div className="oh ho_1" /><div className="oh ho_2" /><div className="oh ho_3" /><div className="oh ho_4" />
                    </div>
                    <div className="content">
                      <span className="date_tm"><i className="fi-rr-calendar" /> <time className="date published">{formatDate(post.publishedAt)}</time></span>
                      <h4 className="title_22"><Link href={`/blog/${post.slug}`}>{post.title}</Link></h4>
                      {post.excerpt && <p className="descs">{post.excerpt}</p>}
                      <div className="bottm_contet d-flex align-items-center">
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
                        <Link href={`/blog/${post.slug}`} className="rd_more">Lire <i className="fi-rr-arrow-small-right" /></Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="pd_top_70" />
    </section>
  );
}
