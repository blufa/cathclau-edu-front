"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Backdrop } from "./backdrop";
import { useSidebarStore } from "@/lib/store/sidebar-store";
import { SubscriptionProvider } from "@/providers/subscription-provider";
import { BrandingProvider } from "@/providers/branding-provider";
import { SubscriptionBanner } from "@/components/platform/subscription-banner";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { cn } from "@/lib/utils";

const HEADER_HEIGHT = 64;

export function AppShell({ children }: { children: React.ReactNode }) {
  const isExpanded = useSidebarStore((s) => s.isExpanded);
  const isMobileOpen = useSidebarStore((s) => s.isMobileOpen);
  const sidebarWidth = isExpanded ? 264 : 84;

  return (
    <SubscriptionProvider>
      <BrandingProvider>
        <div
          className="min-h-screen bg-gray-50/60"
          style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}
        >
          <header className="fixed inset-x-0 top-0 z-50 bg-white" style={{ height: HEADER_HEIGHT }}>
            <Header />
          </header>

          <Backdrop />

          <aside
            className={cn(
              "fixed bottom-0 left-0 z-40 w-[var(--sidebar-w)] border-r border-black/20 bg-brand-900 transition-transform duration-200 sm:translate-x-0",
              !isMobileOpen && "-translate-x-full",
            )}
            style={{ top: HEADER_HEIGHT }}
          >
            <div className="h-full overflow-y-auto p-3">
              <Sidebar />
            </div>
          </aside>

          <main
            className="ml-0 min-w-0 p-4 transition-[margin] duration-200 sm:ml-[var(--sidebar-w)] sm:p-6"
            style={{ paddingTop: HEADER_HEIGHT + 16 }}
          >
            <div className="mx-auto max-w-[1600px]">
              <SubscriptionBanner />
              <OfflineBanner />
              {children}
            </div>
          </main>
        </div>
      </BrandingProvider>
    </SubscriptionProvider>
  );
}
