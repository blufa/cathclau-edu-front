"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBranding } from "@/lib/branding";

const NAV = [
  { label: "À propos", href: "/a-propos" },
  { label: "Fonctionnalités", href: "/fonctionnalites" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/faqs" },
];

/** Reproduit la structure du header "style 5" de Vankine : bandeau clair (coordonnées) au-dessus
 * d'une barre de navigation bleue pleine largeur avec liens en pilules et CTA blanc en pilule. */
export function PublicHeader() {
  const branding = getBranding();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50">
      {/* Bandeau coordonnées (clair) */}
      <div className="hidden bg-brand-50 sm:block">
        <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-4 text-xs text-brand-900">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-brand-600" />
            <span className="text-slate-500">Nos écoles :</span>
            <span className="font-medium">Guinée, toutes régions</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="mailto:contact@cathclau.edu" className="flex items-center gap-2 transition hover:text-brand-600">
              <Mail className="h-3.5 w-3.5 text-brand-600" /> contact@cathclau.edu
            </a>
            <a href="tel:+224614324299" className="flex items-center gap-2 transition hover:text-brand-600">
              <Phone className="h-3.5 w-3.5 text-brand-600" /> +224 614 32 42 99
            </a>
          </div>
        </div>
      </div>

      {/* Barre de navigation bleue */}
      <div className="bg-brand-600 shadow-md shadow-brand-900/10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 py-2.5 md:h-[4.5rem]">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-bold text-brand-700 shadow-sm">
              {branding.logoLetter}
            </span>
            <span className="text-lg font-bold tracking-tight text-white">{branding.appName}</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white lg:px-4"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button component={Link} href="/login" size="sm" className="rounded-full bg-white text-brand-700 hover:bg-brand-50">
              Connexion
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-gray-900/50 md:hidden" onClick={close} />
          <div className="fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-white p-6 shadow-xl md:hidden">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Menu</span>
              <button type="button" onClick={close} aria-label="Fermer" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} onClick={close} className="text-sm font-medium text-gray-700">
                  {n.label}
                </Link>
              ))}
              <Button component={Link} href="/login" onClick={close} fullWidth className="rounded-full">
                Connexion
              </Button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
