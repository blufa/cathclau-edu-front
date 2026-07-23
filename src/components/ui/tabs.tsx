"use client";

import { createContext, useContext, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabsCtx {
  value: string;
  setValue: (v: string) => void;
}
const TabsContext = createContext<TabsCtx | null>(null);

function useTabsContext(component: string): TabsCtx {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component} /> must be used inside <Tabs>`);
  return ctx;
}

/**
 * Onglets client-side pour des sous-vues d'une même page (ex. Transactions/Reçus, Identité/Parents
 * d'une fiche élève) — à distinguer de `route-tabs.tsx` qui, lui, bascule d'URL pour le regroupement
 * du menu sidebar. Un seul panneau est monté à la fois (comme Mantine `keepMounted={false}`).
 */
export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolled;
  const setValue = onValueChange ?? setUncontrolled;
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex gap-1 overflow-x-auto border-b border-gray-200", className)}>{children}</div>;
}

export function TabsTrigger({
  value,
  children,
  icon: Icon,
}: {
  value: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  const ctx = useTabsContext("TabsTrigger");
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
        active ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
      )}
    >
      {Icon && <Icon className="h-5 w-5" strokeWidth={2.1} />}
      {children}
    </button>
  );
}

export function TabsPanel({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useTabsContext("TabsPanel");
  if (ctx.value !== value) return null;
  return <>{children}</>;
}
