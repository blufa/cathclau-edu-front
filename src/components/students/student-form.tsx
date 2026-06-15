"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CreateStudentInput, Gender, Student } from "@/lib/types/student";

interface StudentFormProps {
  initial?: Student;
  submitLabel: string;
  onSubmit: (input: CreateStudentInput) => Promise<void>;
  onCancel: () => void;
}

export function StudentForm({ initial, submitLabel, onSubmit, onCancel }: StudentFormProps) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [gender, setGender] = useState<Gender>(initial?.gender ?? "MALE");
  const [studentNumber, setStudentNumber] = useState(initial?.studentNumber ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [nationality, setNationality] = useState(initial?.nationality ?? "");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit({
        firstName,
        lastName,
        gender,
        studentNumber: studentNumber || null,
        birthDate: birthDate || null,
        birthPlace: birthPlace || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        nationality: nationality || null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setError(Object.keys(err.fieldErrors).length === 0 ? err.userMessage : null);
      } else {
        setError("Enregistrement impossible.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="firstName">Prénom *</Label>
          <Input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          {fieldErrors.firstName && <p className="text-xs text-red-600">{fieldErrors.firstName}</p>}
        </Field>
        <Field>
          <Label htmlFor="lastName">Nom *</Label>
          <Input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          {fieldErrors.lastName && <p className="text-xs text-red-600">{fieldErrors.lastName}</p>}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="gender">Sexe *</Label>
          <Select id="gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="MALE">Masculin</option>
            <option value="FEMALE">Féminin</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="studentNumber">Matricule</Label>
          <Input
            id="studentNumber"
            value={studentNumber}
            onChange={(e) => setStudentNumber(e.target.value)}
            placeholder="Auto-généré si vide"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="birthDate">Date de naissance</Label>
          <Input id="birthDate" type="date" value={birthDate ?? ""} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="birthPlace">Lieu de naissance</Label>
          <Input id="birthPlace" value={birthPlace ?? ""} onChange={(e) => setBirthPlace(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="nationality">Nationalité</Label>
          <Input id="nationality" value={nationality ?? ""} onChange={(e) => setNationality(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="address">Adresse</Label>
          <Input id="address" value={address ?? ""} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Annuler
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
