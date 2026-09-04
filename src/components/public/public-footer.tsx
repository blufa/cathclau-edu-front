import Link from "next/link";
import { getBranding } from "@/lib/branding";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.74V1.74C24 .78 23.2 0 22.22 0z" />
    </svg>
  );
}

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Modules", href: "/#modules" },
      { label: "Sécurité", href: "/#securite" },
      { label: "Tarifs", href: "/tarifs" },
      { label: "Fonctionnalités", href: "/fonctionnalites" },
      { label: "À propos", href: "/a-propos" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "FAQ", href: "/faqs" },
      { label: "Centre d'aide", href: "/aide" },
      { label: "Contact", href: "/contact" },
      { label: "Demander une démo", href: "/signup" },
    ],
  },
  {
    title: "Compte",
    links: [
      { label: "Créer mon école", href: "/signup" },
      { label: "Connexion", href: "/login" },
    ],
  },
];

/** Reproduit le footer "style 5" de Vankine : fond bleu marine (identique à la barre de nav),
 * logo + newsletter + réseaux sociaux, colonnes de liens, barre inférieure encore plus sombre. */
export function PublicFooter() {
  const branding = getBranding();
  return (
    <footer className="bg-brand-800 text-white/80">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-16">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Brand + newsletter */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-bold text-brand-700 shadow-sm">
                {branding.logoLetter}
              </span>
              <span className="text-lg font-bold tracking-tight text-white">{branding.appName}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-white/60">
              La suite tout-en-un pour gérer votre établissement scolaire et garder du temps pour
              l&apos;essentiel : vos élèves.
            </p>
            <form className="mt-5 flex max-w-sm flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                placeholder="Votre e-mail"
                aria-label="Votre e-mail"
                className="h-11 flex-1 rounded-full border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-brand-300 focus:ring-2 focus:ring-white/20"
              />
              <button
                type="submit"
                className="h-11 shrink-0 rounded-full bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-400"
              >
                S&apos;abonner
              </button>
            </form>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-brand-500 hover:text-white"
              >
                <LinkedinIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-base font-bold text-white">{col.title}</h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-white/60 transition hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-brand-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {branding.appName}. Tous droits réservés.</span>
          <div className="flex items-center gap-5">
            <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
