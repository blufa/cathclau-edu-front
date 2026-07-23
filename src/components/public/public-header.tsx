"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBranding } from "@/lib/branding";

const NAV = [
  { label: "Modules", href: "/#modules" },
  { label: "Pourquoi nous", href: "/#support" },
  { label: "Sécurité", href: "/#securite" },
  { label: "Tarifs", href: "/tarifs" },
];

export function PublicHeader() {
  const branding = getBranding();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm shadow-slate-900/[0.04] backdrop-blur">
      {/* Utility top bar */}
      <div className="hidden bg-slate-950 sm:block">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-4 text-xs text-slate-400">
          <a href="tel:+224620000000" className="transition hover:text-white">
            ☎ +224 620 00 00 00
          </a>
          <div className="flex items-center gap-4">
            <a href="mailto:contact@cathclau.edu" className="transition hover:text-white">
              contact@cathclau.edu
            </a>
            <span className="text-slate-600">|</span>
            <span className="font-medium text-white">FR</span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white shadow-sm shadow-brand-500/30">
            {branding.logoLetter}
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">{branding.appName}</span>
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-gray-600 hover:text-gray-900">
              {n.label}
            </Link>
          ))}
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Connexion
          </Link>
          <Button component={Link} href="/signup" size="sm">
            Essai gratuit
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 sm:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-gray-900/50 sm:hidden" onClick={close} />
          <div className="fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-white p-6 shadow-xl sm:hidden">
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
              <Link href="/login" onClick={close} className="text-sm font-medium text-gray-700">
                Connexion
              </Link>
              <Button component={Link} href="/signup" onClick={close} fullWidth>
                Essai gratuit
              </Button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
