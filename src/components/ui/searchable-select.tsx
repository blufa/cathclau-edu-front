"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  // Bascule le menu au-dessus du champ quand il n'y a pas assez de place en dessous (ex. dernier champ
  // d'une carte proche du bas de l'écran) — sans ça, un ancêtre `overflow-hidden` (ex. Card) peut rogner
  // le menu qui déborde vers le bas, le rendant invisible plutôt que de simplement s'ouvrir vers le
  // haut comme n'importe quel menu déroulant "intelligent". PANEL_HEIGHT_ESTIMATE ~ hauteur réelle du
  // panneau (recherche + max-h-72) : pas besoin de la mesurer après coup, une petite marge suffit.
  const PANEL_HEIGHT_ESTIMATE = 300;
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDropUp(spaceBelow < PANEL_HEIGHT_ESTIMATE && spaceAbove > spaceBelow);
    }
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.searchText.toLowerCase().includes(q));
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

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
      {open && (
        <div
          className={cn(
            "absolute z-50 max-h-72 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg",
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
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
        </div>
      )}
    </div>
  );
}
