"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Lock, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import type { NavItem, NavSection } from "@/config/navigation";
import { useNavGating } from "@/hooks/use-nav-gating";
import { useSidebarStore } from "@/lib/store/sidebar-store";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Couleur d'accent d'une section : "violet" pour l'Administration (mise en avant), "brand" ailleurs. */
type Accent = "brand" | "violet";

export function Sidebar() {
  const { sections, isItemActive, isDisabled } = useNavGating();
  const isExpanded = useSidebarStore((s) => s.isExpanded);
  const toggleExpanded = useSidebarStore((s) => s.toggleExpanded);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const compact = !isExpanded;
  const onNavigate = () => setMobileOpen(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <nav className="space-y-1.5 pb-2">
          {sections.map((section) => (
            <SidebarSection
              key={section.title}
              section={section}
              compact={compact}
              isItemActive={isItemActive}
              isDisabled={isDisabled}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      {/* Compact toggle (desktop only) */}
      <button
        type="button"
        onClick={() => toggleExpanded()}
        className={cn(
          "mt-2 hidden items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-brand-200 transition hover:border-brand-300 hover:bg-white/10 hover:text-white sm:flex",
          compact && "justify-center px-0",
        )}
      >
        {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        {!compact && <span>Réduire</span>}
      </button>
    </div>
  );
}

/** A collapsible navigation section (accordion). In compact mode it renders icons only, no header. */
function SidebarSection({
  section,
  compact,
  isItemActive,
  isDisabled,
  onNavigate,
}: {
  section: NavSection;
  compact: boolean;
  isItemActive: (item: NavItem) => boolean;
  isDisabled: (item: NavItem) => boolean;
  onNavigate?: () => void;
}) {
  // Section « Administration » : accès sensible (utilisateurs, rôles, paramètres…), mise en avant
  // avec un habillage violet — mais repliée par défaut comme les autres (voir ci-dessous) pour ne
  // pas surcharger le menu.
  const isAdmin = section.title === "Administration";
  const accent: Accent = isAdmin ? "violet" : "brand";

  // Seule la section active est ouverte par défaut : une seule à la fois visible dans le détail,
  // pour que l'utilisateur ne se perde pas dans un menu trop chargé. Les autres sont repliées et se
  // déplient à la demande (ou automatiquement dès qu'on y navigue).
  const sectionActive = section.items.some((it) => isItemActive(it));
  const [open, setOpen] = useState(sectionActive);
  const [prevActive, setPrevActive] = useState(sectionActive);
  if (sectionActive !== prevActive) {
    setPrevActive(sectionActive);
    if (sectionActive) setOpen(true);
  }

  const items = (
    <div className="space-y-0.5">
      {section.items.map((item) => (
        <SidebarNode
          key={item.label}
          item={item}
          compact={compact}
          accent={accent}
          disabled={isDisabled(item)}
          isDisabled={isDisabled}
          isItemActive={isItemActive}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className={cn("rounded-xl pb-1", isAdmin && "bg-violet-500/15 py-1 ring-1 ring-violet-400/40")}>
        {items}
      </div>
    );
  }

  return (
    <div className={cn(isAdmin && "rounded-xl border-2 border-violet-400/30 bg-violet-500/10 p-1.5 shadow-sm")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider transition-colors",
          isAdmin ? "text-violet-200 hover:text-white" : "text-brand-300 hover:text-white",
        )}
      >
        <span className="flex items-center gap-1.5">
          {isAdmin && <ShieldCheck className="h-3.5 w-3.5" />}
          {section.title}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && items}
    </div>
  );
}

function SidebarNode({
  item,
  compact,
  accent,
  disabled = false,
  isDisabled,
  isItemActive,
  onNavigate,
}: {
  item: NavItem;
  compact: boolean;
  accent: Accent;
  disabled?: boolean;
  isDisabled: (item: NavItem) => boolean;
  isItemActive: (item: NavItem) => boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isItemActive(item);

  // Module not available (e.g. trial ended): render a greyed, non-clickable entry.
  if (disabled) {
    return <DisabledLink label={item.label} Icon={Icon} compact={compact} />;
  }

  // Un groupe (ex. « Facturation ») est un lien plat unique — les sous-pages se choisissent via les
  // onglets de la page cible (route-tabs.tsx), pas via un sous-menu dépliable dans la sidebar : on
  // pointe donc vers le premier enfant accessible (non grisé) du groupe pour ce rôle.
  const href = item.href ?? item.children?.find((c) => c.href && !isDisabled(c))?.href ?? item.children?.find((c) => c.href)?.href ?? "#";

  return (
    <IconLink href={href} label={item.label} Icon={Icon} active={active} accent={accent} onNavigate={onNavigate} compact={compact} />
  );
}

function IconLink({
  href,
  label,
  Icon,
  active,
  accent,
  onNavigate,
  compact,
}: {
  href: string;
  label: string;
  Icon?: NavItem["icon"];
  active: boolean;
  accent: Accent;
  onNavigate?: () => void;
  compact: boolean;
}) {
  const violet = accent === "violet";
  const content = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        compact && "justify-center px-0",
        active
          ? violet
            ? "bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-sm shadow-violet-900/40"
            : "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-900/40"
          : "text-brand-100 hover:bg-white/10 hover:text-white",
      )}
    >
      {Icon && (
        <Icon
          className={cn("h-6 w-6 shrink-0", active ? "text-white" : "text-brand-300")}
          strokeWidth={2.1}
        />
      )}
      {!compact && <span>{label}</span>}
    </Link>
  );

  return compact ? <Tooltip label={label}>{content}</Tooltip> : content;
}

/** A module-gated entry that is not available (e.g. trial ended): greyed and non-clickable. */
function DisabledLink({ label, Icon, compact }: { label: string; Icon?: NavItem["icon"]; compact: boolean }) {
  const content = (
    <div
      aria-disabled
      className={cn(
        "relative flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/30 select-none",
        compact && "justify-center px-0",
      )}
    >
      {Icon && <Icon className="h-6 w-6 shrink-0" strokeWidth={2.1} />}
      {!compact && <span className="flex-1">{label}</span>}
      {!compact && <Lock className="h-3.5 w-3.5 shrink-0" />}
    </div>
  );
  return (
    <Tooltip label="Indisponible — période d'essai terminée ou module non inclus dans votre plan">{content}</Tooltip>
  );
}
