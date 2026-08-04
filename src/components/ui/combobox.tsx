"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Suggestions à afficher (ex. issues d'une recherche asynchrone débouncée par l'appelant). */
  options: string[];
  placeholder?: string;
  className?: string;
}

/**
 * Champ « autocomplete » : saisie libre toujours possible (la valeur est le texte tapé), avec une
 * liste de suggestions cliquables en dessous. Remplace Mantine `Autocomplete` pour les cas de
 * recherche asynchrone à texte libre (ex. école d'origine) — contrairement à `SearchableSelect`,
 * qui lui impose de choisir une option de la liste.
 */
export function Combobox({ value, onChange, options, placeholder, className }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && options.length > 0 && (
        <ul className="absolute z-50 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg">
          {options.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50",
                  o === value && "bg-brand-50 font-medium text-brand-700",
                )}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
