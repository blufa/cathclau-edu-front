"use client";

import { useState } from "react";
import { Input, Select, TextInput } from "@mantine/core";
import {
  COUNTRY_OPTIONS,
  capNational,
  formatNational,
  parsePhone,
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

const COUNTRY_DATA = COUNTRY_OPTIONS.map((c) => ({
  value: c.code,
  label: `${c.flag} ${c.name} (+${c.dial})`,
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
          comboboxProps={{ withinPortal: true }}
          aria-label="Pays"
          style={{ width: 158, flex: "0 0 auto" }}
          onChange={(code) => code && changeCountry(code as CountryCode)}
        />
        <TextInput
          style={{ flex: 1, minWidth: 0 }}
          inputMode="tel"
          placeholder="Numéro de téléphone"
          value={formatNational(country, national)}
          disabled={disabled}
          error={!!error}
          onChange={(e) => changeNational(e.currentTarget.value)}
        />
      </div>
    </Input.Wrapper>
  );
}
