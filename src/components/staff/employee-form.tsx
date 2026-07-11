"use client";

import { useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import type { Employee, EmployeeCategory, EmployeeInput } from "@/lib/api/staff";

export const EMPLOYEE_CATEGORY_LABEL: Record<EmployeeCategory, string> = {
  ADMINISTRATIVE: "Administratif",
  DIRECTION: "Direction",
  SUPPORT: "Personnel de soutien",
};

export function EmployeeForm({
  initial, submitLabel, onSubmit, onCancel,
}: {
  initial?: Employee;
  submitLabel: string;
  onSubmit: (input: EmployeeInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [category, setCategory] = useState<EmployeeCategory>(initial?.category ?? "ADMINISTRATIVE");
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [employeeNumber, setEmployeeNumber] = useState(initial?.employeeNumber ?? "");
  const [hireDate, setHireDate] = useState<string | null>(initial?.hireDate ?? null);
  const [baseSalary, setBaseSalary] = useState<number | "">(initial?.baseSalary ? Number(initial.baseSalary) : "");
  const [cnssNumber, setCnssNumber] = useState(initial?.cnssNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Le prénom et le nom sont obligatoires.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        category,
        jobTitle: jobTitle.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        employeeNumber: employeeNumber.trim() || null,
        hireDate,
        baseSalary: baseSalary === "" ? null : Number(baseSalary),
        cnssNumber: cnssNumber.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="md">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Prénom" withAsterisk value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
        <TextInput label="Nom" withAsterisk value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MantineSelect
          label="Catégorie" allowDeselect={false}
          data={Object.entries(EMPLOYEE_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
          value={category}
          onChange={(v) => v && setCategory(v as EmployeeCategory)}
        />
        <TextInput label="Fonction / poste" value={jobTitle} onChange={(e) => setJobTitle(e.currentTarget.value)} placeholder="Ex. Comptable, Surveillant…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <PhoneInput label="Téléphone" value={phone} onChange={setPhone} />
        <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Matricule" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.currentTarget.value)} placeholder="Généré si vide" />
        <DatePickerInput label="Date d'embauche" valueFormat="DD/MM/YYYY" clearable value={hireDate} onChange={setHireDate} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="Salaire de base (GNF)" min={0} thousandSeparator=" " value={baseSalary} onChange={(v) => setBaseSalary(typeof v === "number" ? v : "")} />
        <TextInput label="Numéro CNSS" value={cnssNumber} onChange={(e) => setCnssNumber(e.currentTarget.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={saving}>{submitLabel}</Button>
      </div>
    </Stack>
  );
}
