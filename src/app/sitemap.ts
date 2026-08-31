import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { MODULE_DETAILS } from "@/lib/content/modules";
import { listPublicPosts } from "@/lib/api/blog";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/a-propos", priority: 0.6, changeFrequency: "monthly" },
  { path: "/tarifs", priority: 0.9, changeFrequency: "monthly" },
  { path: "/fonctionnalites", priority: 0.8, changeFrequency: "monthly" },
  { path: "/faqs", priority: 0.6, changeFrequency: "monthly" },
  { path: "/aide", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
  { path: "/signup", priority: 0.8, changeFrequency: "yearly" },
  { path: "/blog", priority: 0.7, changeFrequency: "daily" },
  { path: "/confidentialite", priority: 0.3, changeFrequency: "yearly" },
  { path: "/mentions-legales", priority: 0.3, changeFrequency: "yearly" },
];

/**
 * Sitemap dynamique : pages statiques + fiches fonctionnalités (une par module) + articles de blog
 * publiés. Les pages transactionnelles (signup/verify-email, resend-verification, reset-password,
 * maintenance) et tout l'espace applicatif authentifié en sont volontairement exclus — voir
 * src/app/robots.ts pour l'espace applicatif.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const moduleEntries: MetadataRoute.Sitemap = MODULE_DETAILS.map((m) => ({
    url: `${SITE_URL}/fonctionnalites/${m.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = await listPublicPosts();
    blogEntries = posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.publishedAt ? new Date(p.publishedAt) : new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  } catch {
    // Backend injoignable au moment de la génération du sitemap (ex. build hors ligne) : on publie
    // quand même les pages statiques plutôt que faire échouer tout le build.
  }

  return [...staticEntries, ...moduleEntries, ...blogEntries];
}
