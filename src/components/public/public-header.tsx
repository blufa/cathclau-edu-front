"use client";

import Link from "next/link";
import { Burger, Drawer, Group, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
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
  const [opened, { toggle, close }] = useDisclosure(false);

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

        <Group gap="lg" visibleFrom="sm">
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
        </Group>

        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
      </div>

      <Drawer opened={opened} onClose={close} title="Menu" size="xs" position="right">
        <Stack>
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
        </Stack>
      </Drawer>
    </header>
  );
}
