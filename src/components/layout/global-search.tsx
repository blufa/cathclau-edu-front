"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@mantine/core";
import { CornerDownLeft, Search } from "lucide-react";
import { NAVIGATION, flattenNav } from "@/config/navigation";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";

interface Entry {
  label: string;
  href: string;
  section: string;
}

/**
 * Global search / command palette (⌘K). Filters the role-visible navigation and jumps to a page.
 * Self-contained (no backend) — a fast way to navigate the dashboard.
 */
export function GlobalSearch() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const section of NAVIGATION) {
      const visible = section.items.filter((item) => !item.roles || hasRole(user, ...item.roles));
      for (const leaf of flattenNav(visible)) {
        out.push({ label: leaf.label, href: leaf.href, section: section.title });
      }
    }
    return out;
  }, [user]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 8);
    return entries.filter((e) => e.label.toLowerCase().includes(q) || e.section.toLowerCase().includes(q));
  }, [entries, query]);

  // ⌘K / Ctrl+K to open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      {/* Trigger — looks like a search field */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 transition hover:border-brand-300 hover:bg-white"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="hidden rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline">
          ⌘K
        </kbd>
      </button>

      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        withCloseButton={false}
        padding={0}
        radius="lg"
        size="lg"
        yOffset="12vh"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              if (e.key === "Enter" && results[active]) go(results[active].href);
            }}
            placeholder="Rechercher une page…"
            className="h-12 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Aucun résultat.</p>
          ) : (
            results.map((e, i) => (
              <button
                key={e.href}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(e.href)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${
                  i === active ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>
                  <span className="font-medium">{e.label}</span>
                  <span className="ml-2 text-xs text-slate-400">{e.section}</span>
                </span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" />}
              </button>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
