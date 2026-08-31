"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { listPublicPosts } from "@/lib/api/blog";
import { LinkButton } from "@/components/ui/link-button";
import { Reveal } from "@/components/public/reveal";
import { formatDate } from "@/lib/format";

/** Aperçu des 3 derniers articles publiés (équivalent "Blog5" de Vankine) — masqué proprement tant
 * qu'aucun article n'est publié, jamais de contenu de remplissage. */
export function LatestPosts() {
  const postsQuery = useQuery(() => listPublicPosts(), []);
  const posts = (postsQuery.data ?? []).slice(0, 3);

  if (!postsQuery.loading && posts.length === 0) return null;

  return (
    <section className="border-y border-slate-100 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Blog</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Nos derniers articles</h2>
          <p className="mt-3 text-slate-600">Actualités, conseils et retours d&apos;écoles.</p>
        </Reveal>

        {postsQuery.loading && posts.length === 0 ? (
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200" />)}
          </div>
        ) : (
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {posts.map((post, i) => (
              <Reveal key={post.id} delay={i * 0.08}>
                <Link href={`/blog/${post.slug}`} className="group block h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg">
                  <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                    {post.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.coverImageUrl} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-brand-300">
                        <CalendarDays className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand-700">{post.title}</h3>
                    {post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{post.excerpt}</p>}
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                      <CalendarDays className="h-3.5 w-3.5" /> {formatDate(post.publishedAt)}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal className="mt-10 flex justify-center">
          <LinkButton href="/blog" size="md" variant="secondary" className="rounded-full" rightSection={<ArrowRight className="h-4 w-4" />}>
            Voir tous les articles
          </LinkButton>
        </Reveal>
      </div>
    </section>
  );
}
