"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { AppShell } from "@/components/layout/app-shell";
import { FullPageSpinner } from "@/components/ui/spinner";
import { isPathAllowedForUser, roleHome } from "@/lib/auth/role-access";

/**
 * Guards every page under (app): unauthenticated users are redirected to /login, and a user whose
 * role isn't allowed on the current route (see NAVIGATION in config/navigation.ts) is redirected
 * to their own space instead of rendering the admin page they navigated to directly — the sidebar
 * already hides these links, but a direct URL must be blocked too (RBAC §1).
 */
export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = status === "authenticated" && isPathAllowedForUser(user, pathname);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    else if (status === "authenticated" && !allowed) router.replace(roleHome(user));
  }, [status, allowed, user, router]);

  if (!allowed) return <FullPageSpinner />;

  return <AppShell>{children}</AppShell>;
}
