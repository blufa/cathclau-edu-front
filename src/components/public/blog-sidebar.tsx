"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { listPublicCategories, listPublicPosts, listPublicTags } from "@/lib/api/blog";
import { formatDate } from "@/lib/format";

interface BlogSidebarProps {
  defaultSearch?: string;
  activeCategoryId?: number;
  activeTag?: string;
}

/** Colonne latérale du blog : recherche, articles récents, catégories, tags — reproduit la
 * composition de "Blog Details Right Sidebar" du template de référence. La recherche navigue
 * toujours vers la liste (utilisable depuis la page détail comme depuis la liste elle-même). */
export function BlogSidebar({ defaultSearch = "", activeCategoryId, activeTag }: BlogSidebarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(defaultSearch);
  const recentQuery = useQuery(() => listPublicPosts(), []);
  const categoriesQuery = useQuery(() => listPublicCategories(), []);
  const tagsQuery = useQuery(() => listPublicTags(), []);

  const recent = (recentQuery.data ?? []).slice(0, 4);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(search.trim() ? `/blog?search=${encodeURIComponent(search.trim())}` : "/blog");
  }

  return (
    <aside className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Rechercher</h3>
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un article…"
            className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
          />
        </form>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Articles récents</h3>
        <ul className="space-y-4">
          {recent.map((p) => (
            <li key={p.id}>
              <Link href={`/blog/${p.slug}`} className="group flex gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {p.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium text-slate-700 group-hover:text-brand-600">{p.title}</p>
                  <p className="text-xs text-slate-400">{formatDate(p.publishedAt)}</p>
                </div>
              </Link>
            </li>
          ))}
          {recent.length === 0 && !recentQuery.loading && <p className="text-sm text-slate-400">Aucun article pour l&apos;instant.</p>}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Catégories</h3>
        <ul className="space-y-2">
          {(categoriesQuery.data ?? []).map((c) => (
            <li key={c.id}>
              <Link
                href={`/blog?categorie=${c.id}`}
                className={`text-sm transition hover:text-brand-600 ${activeCategoryId === c.id ? "font-semibold text-brand-600" : "text-slate-600"}`}
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Tags populaires</h3>
        <div className="flex flex-wrap gap-2">
          {(tagsQuery.data ?? []).map((tag) => (
            <Link
              key={tag}
              href={`/blog?tag=${encodeURIComponent(tag)}`}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                activeTag === tag
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600 hover:border-brand-200 hover:text-brand-600"
              }`}
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>

      {/* Widget contact — remplace l'encart "trouvez un agent" du template par un CTA honnête. */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/school-3.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-900/70" />
        <div className="relative p-6 text-center">
          <h3 className="text-base font-semibold text-white">Une question sur la plateforme ?</h3>
          <p className="mt-2 text-xs text-slate-200">
            Notre équipe vous répond rapidement, du choix du module à la mise en route.
          </p>
          <Link
            href="/contact"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            Nous contacter <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
