"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  /** Libellé affiché une fois l'option choisie (trigger replié). */
  trigger: React.ReactNode;
  /** Contenu affiché dans la liste déroulante. */
  label: React.ReactNode;
  /** Texte utilisé pour le filtrage (nom, indicatif, code…). */
  searchText: string;
}

/**
 * Menu déroulant recherchable générique (liste fermée, filtrage client) — remplace le pattern
 * Mantine `Select searchable` + `renderOption`. Utilisé par ex. par le sélecteur de pays du
 * téléphone. Voir aussi `combobox.tsx` pour la recherche asynchrone avec texte libre.
 */
export function SearchableSelect({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
  triggerClassName,
  panelClassName,
  noResultsLabel = "Aucun résultat",
}: {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  panelClassName?: string;
  noResultsLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Panneau rendu dans un portail (document.body) en position fixe, calculée depuis le bouton —
  // jamais rogné par un ancêtre overflow-hidden/overflow-y-auto (ex. le corps défilant d'un Modal,
  // §retour comptable : "le dropdown est caché" sur le modal de transfert de classe). L'ancienne
  // position "absolute" relative au bouton se faisait couper net par ce genre d'ancêtre, quel que
  // soit le sens d'ouverture (dropUp ne suffisait pas : les DEUX sens restent dans le même ancêtre
  // rogné).
  const PANEL_HEIGHT_ESTIMATE = 300;
  const [rect, setRect] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  function measure() {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    setRect({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
  }

  useEffect(() => {
    if (!open) return;
    measure();
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // capture: true — attrape aussi le défilement d'un ancêtre scrollable (ex. le corps d'un Modal),
    // qui ne fait pas remonter d'événement "scroll" jusqu'à window autrement.
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.searchText.toLowerCase().includes(q));
  }, [options, query]);

  const selected = options.find((o) => o.value === value);
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  const spaceAbove = rect ? rect.top : 0;
  const dropUp = rect != null && spaceBelow < PANEL_HEIGHT_ESTIMATE && spaceAbove > spaceBelow;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-2 text-sm shadow-theme-xs transition",
          "hover:border-gray-400",
          open && "border-brand-300 ring-3 ring-brand-500/10",
          disabled && "cursor-not-allowed bg-gray-50 text-gray-400",
          triggerClassName,
        )}
      >
        {selected?.trigger ?? <span className="text-gray-400">—</span>}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: rect.left,
            ...(dropUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
          }}
          className={cn(
            // w-60 par défaut (comme avant ce correctif) — seule la POSITION passe en portail/fixed,
            // la largeur par défaut ne change pas (panelClassName peut toujours la surcharger).
            "z-[9999] max-h-72 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg",
            panelClassName,
          )}
        >
          <div className="border-b border-gray-100 p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="h-8 w-full rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">{noResultsLabel}</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
                >
                  {o.label}
                  {o.value === value && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
