import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Reveal } from "@/components/public/reveal";

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Bandeau titre des pages secondaires (fil d'Ariane + titre + sous-titre), dans le même style que le
 * bandeau déjà utilisé sur /a-propos — pour que toutes les pages secondaires partagent une même
 * identité, sans dupliquer un hero complet à chaque fois.
 */
export function PageBanner({
  eyebrow,
  title,
  description,
  crumbs,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  crumbs: Crumb[];
}) {
  return (
    <section className="bg-slate-900 py-20">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <Reveal>
          <nav aria-label="Fil d'Ariane" className="mb-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            {crumbs.map((c, i) => (
              <span key={c.label} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {c.href ? (
                  <Link href={c.href} className="transition hover:text-white">{c.label}</Link>
                ) : (
                  <span className="text-white/80">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
          {eyebrow && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80">
              {eyebrow}
            </span>
          )}
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{title}</h1>
          {description && <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">{description}</p>}
        </Reveal>
      </div>
    </section>
  );
}
