"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@/hooks/use-query";
import { listPublicCategories, listPublicPosts, listPublicTags } from "@/lib/api/blog";
import { formatDate } from "@/lib/format";

interface BlogSidebarVankineProps {
  activeCategoryId?: number;
  excludeSlug?: string;
}

/** Colonne latérale du blog (mêmes classes CSS que le widget-area de blog-details-right-sidebar.js) :
 * recherche, articles récents, catégories (à la place du nuage de tags fictif), widget contact réel
 * (remplace l'encart "Find An Insurance Agent" du template). */
export function BlogSidebarVankine({ activeCategoryId, excludeSlug }: BlogSidebarVankineProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const recentQuery = useQuery(() => listPublicPosts(), []);
  const categoriesQuery = useQuery(() => listPublicCategories(), []);
  const tagsQuery = useQuery(() => listPublicTags(), []);

  const recent = (recentQuery.data ?? []).filter((p) => p.slug !== excludeSlug).slice(0, 4);
  const categories = categoriesQuery.data ?? [];
  const tags = tagsQuery.data ?? [];

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(search.trim() ? `/blog?search=${encodeURIComponent(search.trim())}` : "/blog");
  }

  return (
    <div className="widget-area">
      <div className="blog_siderbar side_bar">
        <div className="sidebar-widget mb-50">
          <div className="widget_search">
            <form onSubmit={handleSearchSubmit} className="wp-block-search__button-inside wp-block-search__icon-button wp-block-search">
              <label>Rechercher</label>
              <div className="wp-block-search__inside-wrapper">
                <input
                  type="search"
                  className="wp-block-search__input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un article…"
                />
                <button type="submit" className="wp-block-search__button has-icon wp-element-button" aria-label="Rechercher">
                  <svg className="search-icon" viewBox="0 0 24 24" width={24} height={24}>
                    <path fill="#fff" d="M13.5 6C10.5 6 8 8.5 8 11.5c0 1.1.3 2.1.9 3l-3.4 3 1 1.1 3.4-2.9c1 .9 2.2 1.4 3.6 1.4 3 0 5.5-2.5 5.5-5.5C19 8.5 16.5 6 13.5 6zm0 9.5c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>

        {recent.length > 0 && (
          <div className="sidebar-widget mb-50">
            <div className="widget widget_box vankine_widget_recented_entries">
              <h4 className="widget-title">Articles récents</h4>
              <div className="post_foo_box">
                {recent.map((post) => (
                  <div key={post.id} className="foo_post_content">
                    <Link className="image_box trans" href={`/blog/${post.slug}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.coverImageUrl || "/images/school-2.jpg"} className="img-fluid" alt={post.title} />
                      <svg className="trans" width={55} height={55} viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx={28} cy={27} r={20} fill="white" />
                        <circle cx="27.5" cy="27.5" r="27.5" fill="white" fillOpacity="0.1" />
                        <path d="M22 33.25L33.25 22M33.25 22H24.8125M33.25 22V30.4375" stroke="#2D947A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                    <div className="content">
                      <h4 className="title_18"><Link href={`/blog/${post.slug}`}>{post.title}</Link></h4>
                      <span className="date_tm">
                        <i className="fi-rr-calendar" />
                        <time className="date published">{formatDate(post.publishedAt)}</time>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <div className="sidebar-widget mb-50">
            <div className="widget widget_box widget_block">
              <h4 className="widget-title">Catégories</h4>
              <div className="wp-widget-group__inner-blocks">
                <p className="wp-block-tag-cloud">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/blog?categorie=${c.id}`}
                      className="tag-cloud-link"
                      style={{ fontSize: activeCategoryId === c.id ? "16pt" : "11pt" }}
                    >
                      {c.label}
                    </Link>
                  ))}
                </p>
              </div>
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div className="sidebar-widget mb-50">
            <div className="widget widget_box widget_block">
              <h4 className="widget-title">Tags populaires</h4>
              <div className="wp-widget-group__inner-blocks">
                <p className="wp-block-tag-cloud">
                  {tags.map((tag) => (
                    <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="tag-cloud-link" style={{ fontSize: "11pt" }}>
                      {tag}
                    </Link>
                  ))}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-widget mb-50">
          <div className="widget widget_box widget_about_vankine">
            <div className="avout_us_widgets widget_box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/school-3.jpg" alt="" className="bg_images img-fluid" />
              <div className="widget_content">
                <div className="cont">
                  <div className="title_no_a_26">Une question <br /> sur la <br /> plateforme ?</div>
                  <Link className="theme_btn" href="/contact">
                    Nous contacter
                    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 11L11 1M11 1H3.5M11 1V8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
