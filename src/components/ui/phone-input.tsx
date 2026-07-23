"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import {
  COUNTRY_OPTIONS,
  capNational,
  formatNational,
  parsePhone,
  placeholderNational,
  toE164,
  type CountryCode,
} from "@/lib/phone";

interface PhoneInputProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** Numéro au format E.164 (`+224620000000`) ; le pays est détecté à partir de l'indicatif. */
  value?: string;
  /** Valeur initiale pour les formulaires non contrôlés. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
}

const COUNTRY_SELECT_OPTIONS: SearchableOption[] = COUNTRY_OPTIONS.map((c) => ({
  value: c.code,
  trigger: <span className="text-lg leading-none">{c.flag}</span>,
  searchText: `${c.name} ${c.dial} ${c.code}`,
  label: (
    <span className="flex items-center gap-2">
      <span className="text-lg leading-none">{c.flag}</span>
      <span>{c.name}</span>
      <span className="text-gray-400">+{c.dial}</span>
    </span>
  ),
}));

/**
 * Saisie standardisée d'un numéro : on choisit le pays (liste mondiale, recherchable par nom ou
 * indicatif) et le champ impose le format exact et la longueur maximale du pays (métadonnées
 * libphonenumber). La valeur remontée est au format international E.164 (`+224…`).
 *
 * Le pays et le numéro local sont gérés en état interne (pas dérivés de la valeur à chaque frappe),
 * pour que le choix du pays « tienne » même avec un numéro vide et que la saisie ne soit pas corrompue.
 */
export function PhoneInput({
  label,
  description,
  value,
  defaultValue,
  onChange,
  error,
  required,
  disabled,
}: PhoneInputProps) {
  const initial = value ?? defaultValue;
  const [country, setCountry] = useState<CountryCode>(() => parsePhone(initial).country);
  const [national, setNational] = useState<string>(() => parsePhone(initial).national);
  const [prevValue, setPrevValue] = useState(value);

  // Formulaire contrôlé : resynchronise depuis la valeur externe seulement quand elle change vraiment
  // (chargement, reset) et diffère de l'état interne — pattern React « ajuster l'état pendant le rendu ».
  if (value !== undefined && value !== prevValue) {
    setPrevValue(value);
    if (value !== toE164(country, national)) {
      const parsed = parsePhone(value);
      setCountry(parsed.country);
      setNational(parsed.national);
    }
  }

  function changeCountry(code: string) {
    setCountry(code as CountryCode);
    onChange?.(toE164(code as CountryCode, national));
  }

  function changeNational(input: string) {
    const capped = capNational(country, input);
    setNational(capped);
    onChange?.(toE164(country, capped));
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <Label>
          {label}
          {required && <span className="ml-0.5 text-error-500">*</span>}
        </Label>
      )}
      {description && <p className="text-xs text-gray-500">{description}</p>}
      <div className="flex items-start gap-2">
        <SearchableSelect
          value={country}
          options={COUNTRY_SELECT_OPTIONS}
          onChange={changeCountry}
          disabled={disabled}
          ariaLabel="Pays"
          triggerClassName="w-[4.5rem] flex-none"
          noResultsLabel="Aucun pays"
        />
        <Input
          className={cn("flex-1", error && "border-error-500")}
          inputMode="tel"
          placeholder={placeholderNational(country)}
          value={formatNational(country, national)}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={(e) => changeNational(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}
