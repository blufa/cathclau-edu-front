"use client";

import { useState } from "react";
import { AppShell as MantineAppShell } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { SubscriptionProvider } from "@/providers/subscription-provider";
import { BrandingProvider } from "@/providers/branding-provider";
import { SubscriptionBanner } from "@/components/platform/subscription-banner";

const COMPACT_KEY = "cathclau.sidebar.compact";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure(false);
  // Restore the user's compact-sidebar preference (desktop only).
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(COMPACT_KEY) === "1",
  );

  function toggleCompact() {
    setCompact((c) => {
      const next = !c;
      localStorage.setItem(COMPACT_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <SubscriptionProvider>
      <BrandingProvider>
      <MantineAppShell
        header={{ height: 60 }}
        navbar={{ width: compact ? 84 : 264, breakpoint: "sm", collapsed: { mobile: !opened } }}
        padding="md"
      >
        <MantineAppShell.Header>
          <Header navOpened={opened} onToggleNav={toggle} />
        </MantineAppShell.Header>
        <MantineAppShell.Navbar p="sm" className="bg-white">
          <Sidebar onNavigate={close} compact={compact} onToggleCompact={toggleCompact} />
        </MantineAppShell.Navbar>
        <MantineAppShell.Main className="bg-slate-50/60">
          <SubscriptionBanner />
          {children}
        </MantineAppShell.Main>
      </MantineAppShell>
      </BrandingProvider>
    </SubscriptionProvider>
  );
}
