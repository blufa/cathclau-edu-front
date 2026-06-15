"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?"
    : "?";

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            {user ? `${user.firstName} ${user.lastName}` : ""}
          </p>
          <p className="text-xs text-gray-500">{user?.roles.join(", ")}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
          {initials}
        </div>
        <Button variant="secondary" size="sm" loading={busy} onClick={handleLogout}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
