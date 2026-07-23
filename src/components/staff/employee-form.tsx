"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
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
  const [hireDate, setHireDate] = useState(initial?.hireDate ?? "");
  const [baseSalary, setBaseSalary] = useState<string>(initial?.baseSalary ? String(initial.baseSalary) : "");
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
        hireDate: hireDate || null,
        baseSalary: baseSalary === "" ? null : Number(baseSalary),
        cnssNumber: cnssNumber.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Prénom <span className="text-error-500">*</span></Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field>
          <Label>Nom <span className="text-error-500">*</span></Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Catégorie</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as EmployeeCategory)}>
            {Object.entries(EMPLOYEE_CATEGORY_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Fonction / poste</Label>
          <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Ex. Comptable, Surveillant…" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <PhoneInput label="Téléphone" value={phone} onChange={setPhone} />
        <Field>
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Matricule</Label>
          <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} placeholder="Généré si vide" />
        </Field>
        <Field>
          <Label>Date d&apos;embauche</Label>
          <DatePicker value={hireDate} onChange={setHireDate} clearable />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Salaire de base (GNF)</Label>
          <Input type="number" min={0} value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} />
        </Field>
        <Field>
          <Label>Numéro CNSS</Label>
          <Input value={cnssNumber} onChange={(e) => setCnssNumber(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={saving}>{submitLabel}</Button>
      </div>
    </div>
  );
}
