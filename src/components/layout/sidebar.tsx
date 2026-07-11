"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea, Tooltip } from "@mantine/core";
import { ChevronDown, Lock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAVIGATION, type NavItem, type NavSection } from "@/config/navigation";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getActiveModules } from "@/lib/api/modules";
import { getLatestSubscription } from "@/lib/api/platform";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onNavigate?: () => void;
  compact?: boolean;
  onToggleCompact?: () => void;
}

export function Sidebar({ onNavigate, compact = false, onToggleCompact }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();

  const isActive = (href?: string) =>
    !!href && (pathname === href || pathname.startsWith(`${href}/`));
  const isItemActive = (item: NavItem): boolean =>
    isActive(item.href) || (item.children?.some((c) => isActive(c.href)) ?? false);

  // SUPER_ADMIN sees the full navigation (every module/menu) for testing & oversight;
  // other roles see only the sections their roles grant. Empty sections are dropped.
  const isSuperAdmin = hasRole(user, "SUPER_ADMIN");
  // Filter by role recursively: a parent is kept only if it (and at least one visible child) is allowed.
  const filterItem = (item: NavItem): NavItem | null => {
    if (!isSuperAdmin && item.roles && !hasRole(user, ...item.roles)) return null;
    if (item.children?.length) {
      const kids = item.children.map(filterItem).filter((c): c is NavItem => c !== null);
      if (kids.length === 0) return null;
      return { ...item, children: kids };
    }
    return item;
  };
  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.map(filterItem).filter((i): i is NavItem => i !== null),
  })).filter((section) => section.items.length > 0);

  // Module-gated items are greyed out when their module is not active for the tenant (e.g. trial ended).
  const modulesQuery = useQuery(() => getActiveModules(), []);
  const activeModules = modulesQuery.data ? new Set(modulesQuery.data) : null;

  // A PENDING (unpaid) subscription locks every functional module until payment is completed.
  const subQuery = useQuery(() => getLatestSubscription(), []);
  const paymentRequired = subQuery.data?.status === "PENDING";

  const isDisabled = (item: NavItem) => {
    if (!item.module) return false;
    if (paymentRequired) return true; // locked until the subscription is paid
    // Not loaded yet, or no module provisioned at all (e.g. seed without module rows): show the menus
    // rather than locking the whole app — only grey out when we positively know the active set.
    if (activeModules === null || activeModules.size === 0) return false;
    return !activeModules.has(item.module);
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea type="scroll" className="flex-1">
        <nav className="space-y-1.5 pb-2">
          {sections.map((section) => (
            <SidebarSection
              key={section.title}
              section={section}
              compact={compact}
              isActive={isActive}
              isItemActive={isItemActive}
              isDisabled={isDisabled}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Compact toggle (desktop only) */}
      {onToggleCompact && (
        <button
          type="button"
          onClick={onToggleCompact}
          className={cn(
            "mt-2 hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 sm:flex",
            compact && "justify-center px-0",
          )}
        >
          {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!compact && <span>Réduire</span>}
        </button>
      )}
    </div>
  );
}

/** A collapsible navigation section (accordion). In compact mode it renders icons only, no header. */
function SidebarSection({
  section,
  compact,
  isActive,
  isItemActive,
  isDisabled,
  onNavigate,
}: {
  section: NavSection;
  compact: boolean;
  isActive: (href?: string) => boolean;
  isItemActive: (item: NavItem) => boolean;
  isDisabled: (item: NavItem) => boolean;
  onNavigate?: () => void;
}) {
  // Seule la section active est ouverte par défaut (moins de menus visibles d'un coup) ; les autres
  // sont repliées et dépliables à la demande. Une section s'ouvre automatiquement quand on y navigue.
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
          disabled={isDisabled(item)}
          isDisabled={isDisabled}
          isActive={isActive}
          isItemActive={isItemActive}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );

  if (compact) return <div className="pb-1">{items}</div>;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600"
      >
        <span>{section.title}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && items}
    </div>
  );
}

function SidebarNode({
  item,
  compact,
  disabled = false,
  isDisabled,
  isActive,
  isItemActive,
  onNavigate,
}: {
  item: NavItem;
  compact: boolean;
  disabled?: boolean;
  isDisabled: (item: NavItem) => boolean;
  isActive: (href?: string) => boolean;
  isItemActive: (item: NavItem) => boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isItemActive(item);
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = useState(active);

  // Module not available (e.g. trial ended): render a greyed, non-clickable entry.
  if (disabled && !hasChildren) {
    return <DisabledLink label={item.label} Icon={Icon} compact={compact} />;
  }

  // Parent with children: collapsible group (or, in compact mode, link to first child).
  if (hasChildren) {
    if (compact) {
      const firstHref = item.children!.find((c) => c.href)?.href ?? "#";
      return (
        <IconLink href={firstHref} label={item.label} Icon={Icon} active={active} onNavigate={onNavigate} compact />
      );
    }
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {Icon && <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand-600" : "text-slate-400")} strokeWidth={1.8} />}
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mt-0.5 space-y-0.5 pl-8">
            {item.children!.map((child) =>
              isDisabled(child) ? (
                <Tooltip key={child.label} label="Indisponible — période d'essai terminée ou module non inclus dans votre plan" position="right" withArrow multiline w={240}>
                  <span className="block cursor-not-allowed rounded-lg px-3 py-1.5 text-sm text-slate-300">{child.label}</span>
                </Tooltip>
              ) : (
                <Link
                  key={child.label}
                  href={child.href ?? "#"}
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                    isActive(child.href)
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                  )}
                >
                  {child.label}
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    );
  }

  // Leaf item.
  return (
    <IconLink href={item.href ?? "#"} label={item.label} Icon={Icon} active={active} onNavigate={onNavigate} compact={compact} />
  );
}

function IconLink({
  href,
  label,
  Icon,
  active,
  onNavigate,
  compact,
}: {
  href: string;
  label: string;
  Icon?: NavItem["icon"];
  active: boolean;
  onNavigate?: () => void;
  compact: boolean;
}) {
  const content = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        compact && "justify-center px-0",
        active
          ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-600/20"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {Icon && (
        <Icon
          className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-slate-400")}
          strokeWidth={1.8}
        />
      )}
      {!compact && <span>{label}</span>}
    </Link>
  );

  return compact ? (
    <Tooltip label={label} position="right" withArrow>
      {content}
    </Tooltip>
  ) : (
    content
  );
}

/** A module-gated entry that is not available (e.g. trial ended): greyed and non-clickable. */
function DisabledLink({ label, Icon, compact }: { label: string; Icon?: NavItem["icon"]; compact: boolean }) {
  const content = (
    <div
      aria-disabled
      className={cn(
        "relative flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 select-none",
        compact && "justify-center px-0",
      )}
    >
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />}
      {!compact && <span className="flex-1">{label}</span>}
      {!compact && <Lock className="h-3.5 w-3.5 shrink-0" />}
    </div>
  );
  return (
    <Tooltip label="Indisponible — période d'essai terminée ou module non inclus dans votre plan" position="right" withArrow multiline w={240}>
      {content}
    </Tooltip>
  );
}
