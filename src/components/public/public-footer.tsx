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
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "FAQ", href: "/#faq" },
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

export function PublicFooter() {
  const branding = getBranding();
  return (
    <footer className="relative overflow-hidden bg-slate-950 text-slate-300">
      {/* top accent line */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-500 via-cyan-400 to-brand-600" />
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Brand + newsletter */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-bold text-white shadow-lg shadow-brand-500/30">
                {branding.logoLetter}
              </span>
              <span className="text-lg font-semibold tracking-tight text-white">{branding.appName}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-slate-400">
              La suite tout-en-un pour gérer votre établissement scolaire et garder du temps pour
              l&apos;essentiel : vos élèves.
            </p>
            <form className="mt-5 flex max-w-sm gap-2">
              <input
                type="email"
                required
                placeholder="Votre e-mail"
                aria-label="Votre e-mail"
                className="h-10 flex-1 rounded-full border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30"
              />
              <button
                type="submit"
                className="h-10 shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 px-5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                S&apos;abonner
              </button>
            </form>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-white">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-slate-400 transition hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {branding.appName}. Tous droits réservés.</span>
          <div className="flex items-center gap-4">
            <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <a
              href="https://www.linkedin.com"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-slate-400 transition hover:border-brand-400 hover:text-white"
            >
              <LinkedinIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
