"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import type { CreateTeacherInput } from "@/lib/types/staff";
import { notifyError } from "@/lib/feedback";

const schema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
  staffNumber: z.string(),
  specialization: z.string(),
  phone: z.string(),
  email: z.string(),
  hireDate: z.string(),
  employmentStatus: z.string(),
  diploma: z.string(),
});
type FormValues = z.infer<typeof schema>;

const DIPLOMAS = ["Licence", "Master", "BTS", "Doctorat", "Ingénieur"];

/**
 * Formulaire de création d'enseignant volontairement simplifié pour le mode hors-ligne (§staff,
 * Phase 3) : identité + informations professionnelles de base uniquement — pas d'étape « Compte »
 * (nécessite `createUserWithRole`, un second appel réseau sans idempotence propre, exclu du mode
 * hors-ligne) ni « Affectations » (nécessite un `teacher.id` réel, à compléter après synchronisation,
 * exactement comme `TeacherForm` en ligne). Contrairement à `TeacherForm`, un seul écran, pas
 * d'assistant multi-étapes.
 */
export function OfflineTeacherFields({
  onSubmit, onCancel,
}: {
  onSubmit: (input: CreateTeacherInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "", lastName: "", staffNumber: "", specialization: "", phone: "", email: "",
      hireDate: "", employmentStatus: "PERMANENT", diploma: "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: FormValues) {
    setSubmitting(true);
    try {
      await onSubmit({
        userId: null,
        firstName: values.firstName, lastName: values.lastName,
        staffNumber: values.staffNumber || null,
        specialization: values.specialization || null,
        phone: values.phone || null, email: values.email || null,
        hireDate: values.hireDate || null,
        employmentStatus: values.employmentStatus || null,
        diploma: values.diploma || null,
        remunerationType: null, remunerationRate: null,
        teachingAuthorizationNumber: null, cnssNumber: null,
      });
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <p className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-800">
        Hors-ligne — l&apos;accès portail et les affectations (niveaux/classes/matières) resteront à
        compléter depuis sa fiche une fois la connexion rétablie.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field>
          <Label>Prénom <span className="text-error-500">*</span></Label>
          <Input value={v.firstName} onChange={(e) => setValue("firstName", e.target.value)} aria-invalid={!!errors.firstName} />
          {errors.firstName && <p className="text-xs text-error-600">{errors.firstName.message}</p>}
        </Field>
        <Field>
          <Label>Nom <span className="text-error-500">*</span></Label>
          <Input value={v.lastName} onChange={(e) => setValue("lastName", e.target.value)} aria-invalid={!!errors.lastName} />
          {errors.lastName && <p className="text-xs text-error-600">{errors.lastName.message}</p>}
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhoneInput label="Téléphone" value={v.phone} onChange={(val) => setValue("phone", val)} />
        <Field>
          <Label>Email</Label>
          <Input type="email" value={v.email} onChange={(e) => setValue("email", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field>
          <Label>Matricule</Label>
          <Input placeholder="Auto-généré si vide" value={v.staffNumber} onChange={(e) => setValue("staffNumber", e.target.value)} />
        </Field>
        <Field>
          <Label>Diplôme le plus élevé</Label>
          <Select value={v.diploma} onChange={(e) => setValue("diploma", e.target.value)}>
            <option value="">—</option>
            {DIPLOMAS.map((d) => (<option key={d} value={d}>{d}</option>))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field>
          <Label>Spécialité</Label>
          <Input placeholder="Ex. Informatique, Lettres modernes…" value={v.specialization} onChange={(e) => setValue("specialization", e.target.value)} />
        </Field>
        <Field>
          <Label>Statut</Label>
          <Select value={v.employmentStatus} onChange={(e) => setValue("employmentStatus", e.target.value)}>
            <option value="PERMANENT">Permanent</option>
            <option value="VACATAIRE">Vacataire</option>
            <option value="CONTRACTUEL">Contractuel</option>
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Date d&apos;embauche</Label>
        <DatePicker value={v.hireDate} onChange={(val) => setValue("hireDate", val)} clearable />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button type="submit" loading={submitting}>Créer</Button>
      </div>
    </form>
  );
}
