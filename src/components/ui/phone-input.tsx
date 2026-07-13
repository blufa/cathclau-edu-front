"use client";

import { useState } from "react";
import { Input, Select, TextInput, type OptionsFilter } from "@mantine/core";
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
  /** Valeur initiale pour les formulaires non contrôlés (Mantine `mode: "uncontrolled"`). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
}

// Sélecteur de pays : uniquement le drapeau une fois replié (pas de nom qui alourdit la ligne) —
// mais on garde nom + indicatif pour la recherche et pour l'affichage des options dans la liste.
const COUNTRY_BY_CODE = new Map(COUNTRY_OPTIONS.map((c) => [c.code, c]));
const COUNTRY_DATA = COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.flag }));

/** Recherche par nom de pays, indicatif ou code ISO, même si le libellé affiché n'est que le drapeau. */
const filterCountries: OptionsFilter = ({ options, search }) => {
  const q = search.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => {
    if (!("value" in o)) return false;
    const c = COUNTRY_BY_CODE.get(o.value as CountryCode);
    return !!c && (c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q));
  });
};

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

  function changeCountry(code: CountryCode) {
    setCountry(code);
    onChange?.(toE164(code, national));
  }

  function changeNational(input: string) {
    const capped = capNational(country, input);
    setNational(capped);
    onChange?.(toE164(country, capped));
  }

  return (
    <Input.Wrapper label={label} description={description} error={error} withAsterisk={required}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 2 }}>
        <Select
          data={COUNTRY_DATA}
          value={country}
          searchable
          allowDeselect={false}
          disabled={disabled}
          maxDropdownHeight={280}
          nothingFoundMessage="Aucun pays"
          comboboxProps={{ withinPortal: true, width: 240 }}
          filter={filterCountries}
          renderOption={({ option }) => {
            const c = COUNTRY_BY_CODE.get(option.value as CountryCode);
            return (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{option.label}</span>
                <span>{c?.name}</span>
                <span style={{ color: "var(--mantine-color-dimmed)" }}>+{c?.dial}</span>
              </span>
            );
          }}
          aria-label="Pays"
          style={{ width: 72, flex: "0 0 auto" }}
          styles={{ input: { fontSize: 18, textAlign: "center", paddingInline: 4 } }}
          onChange={(code) => code && changeCountry(code as CountryCode)}
        />
        <TextInput
          style={{ flex: 1, minWidth: 0 }}
          inputMode="tel"
          placeholder={placeholderNational(country)}
          value={formatNational(country, national)}
          disabled={disabled}
          error={!!error}
          onChange={(e) => changeNational(e.currentTarget.value)}
        />
      </div>
    </Input.Wrapper>
  );
}
