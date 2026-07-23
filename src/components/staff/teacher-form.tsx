"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@/hooks/use-query";
import { listSubjects } from "@/lib/api/academics";
import { ApiError } from "@/lib/api/errors";
import { createUserWithRole } from "@/lib/api/iam";
import type { CreateTeacherInput, Teacher } from "@/lib/types/staff";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { Stepper } from "@/components/ui/stepper";

interface TeacherFormProps {
  initial?: Teacher;
  submitLabel: string;
  onSubmit: (input: CreateTeacherInput) => Promise<void>;
  onCancel: () => void;
}

const schema = z
  .object({
    firstName: z.string().trim().min(1, "Prénom requis"),
    lastName: z.string().trim().min(1, "Nom requis"),
    staffNumber: z.string(),
    specialization: z.string(),
    phone: z.string(),
    email: z.string(),
    hireDate: z.string(),
    employmentStatus: z.string(),
    diploma: z.string(),
    remunerationType: z.string(),
    remunerationRate: z.string(),
    teachingAuthorizationNumber: z.string(),
    cnssNumber: z.string(),
    createLogin: z.boolean(),
    password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.createLogin && !/^\S+@\S+$/.test(v.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email requis pour l'accès" });
    } else if (v.email && !/^\S+@\S+$/.test(v.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email invalide" });
    }
    if (v.createLogin && v.password.length < 6) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Mot de passe (6 caractères min.)" });
    }
  });
type FormValues = z.infer<typeof schema>;

const FIELD_STEP: Record<string, number> = { firstName: 0, lastName: 0, email: 0, password: 2 };
const STEPS = [{ label: "Identité" }, { label: "Professionnel" }, { label: "Compte" }];

export function TeacherForm({ initial, submitLabel, onSubmit, onCancel }: TeacherFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState(0);
  const subjectsQuery = useQuery(listSubjects, []);
  const subjectOptions = (subjectsQuery.data ?? []).map((s) => s.label);

  const {
    handleSubmit, watch, setValue, setError: setFieldError, trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      staffNumber: initial?.staffNumber ?? "",
      specialization: initial?.specialization ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      hireDate: initial?.hireDate ?? "",
      employmentStatus: initial?.employmentStatus ?? "PERMANENT",
      diploma: initial?.diploma ?? "",
      remunerationType: initial?.remunerationType ?? "MENSUEL",
      remunerationRate: initial?.remunerationRate != null ? String(initial.remunerationRate) : "",
      teachingAuthorizationNumber: initial?.teachingAuthorizationNumber ?? "",
      cnssNumber: initial?.cnssNumber ?? "",
      createLogin: false,
      password: "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function nextStep() {
    if (active === 0) {
      const ok = await trigger(["firstName", "lastName"]);
      if (!ok) return;
    }
    setActive((s) => Math.min(s + 1, STEPS.length - 1));
  }
  const prevStep = () => setActive((s) => Math.max(s - 1, 0));

  async function submit(values: FormValues) {
    if (active < STEPS.length - 1) { void nextStep(); return; }
    setError(null);
    setSubmitting(true);
    try {
      let userId: number | null = null;
      if (values.createLogin) {
        const user = await createUserWithRole(
          { firstName: values.firstName, lastName: values.lastName, email: values.email, password: values.password, phone: values.phone || null },
          "TEACHER",
        );
        userId = user.id;
      }
      await onSubmit({
        userId,
        firstName: values.firstName,
        lastName: values.lastName,
        staffNumber: values.staffNumber || null,
        specialization: values.specialization || null,
        phone: values.phone || null,
        email: values.email || null,
        hireDate: values.hireDate || null,
        employmentStatus: values.employmentStatus || null,
        diploma: values.diploma || null,
        remunerationType: values.remunerationType || null,
        remunerationRate: values.remunerationRate === "" ? null : values.remunerationRate,
        teachingAuthorizationNumber: values.teachingAuthorizationNumber || null,
        cnssNumber: values.cnssNumber || null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors;
        const fields = Object.keys(fieldErrors);
        if (fields.length > 0) {
          for (const [field, message] of Object.entries(fieldErrors)) setFieldError(field as keyof FormValues, { message });
          const firstStep = FIELD_STEP[fields[0]];
          if (firstStep != null) setActive(firstStep);
        } else {
          setError(err.userMessage);
        }
      } else {
        setError("Enregistrement impossible.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      {error && <div className="rounded-lg bg-error-50 px-3.5 py-2.5 text-sm text-error-700">{error}</div>}

      <Stepper steps={STEPS} active={active} onStepClick={setActive} />

      {active === 0 && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
            <PhoneInput label="Téléphone" value={v.phone} onChange={(val) => setValue("phone", val)} />
            <Field>
              <Label>Email</Label>
              <Input type="email" value={v.email} onChange={(e) => setValue("email", e.target.value)} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
            </Field>
          </div>
        </div>
      )}

      {active === 1 && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>Matricule</Label>
              <Input placeholder="Auto-généré si vide" value={v.staffNumber} onChange={(e) => setValue("staffNumber", e.target.value)} />
            </Field>
            <Field>
              <Label>Spécialité</Label>
              <Combobox placeholder="Matière principale" options={subjectOptions} value={v.specialization} onChange={(val) => setValue("specialization", val)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>Diplôme le plus élevé</Label>
              <Input value={v.diploma} onChange={(e) => setValue("diploma", e.target.value)} />
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
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>Type de rémunération</Label>
              <Select value={v.remunerationType} onChange={(e) => setValue("remunerationType", e.target.value)}>
                <option value="MENSUEL">Mensuel</option>
                <option value="HORAIRE">Horaire</option>
                <option value="FORFAIT">Forfait</option>
              </Select>
            </Field>
            <Field>
              <Label>
                {v.remunerationType === "HORAIRE" ? "Taux horaire (GNF/h)"
                  : v.remunerationType === "FORFAIT" ? "Montant forfaitaire (GNF)"
                  : "Salaire mensuel (GNF)"}
              </Label>
              <Input type="number" min={0} value={v.remunerationRate} onChange={(e) => setValue("remunerationRate", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>Date d&apos;embauche</Label>
              <DatePicker value={v.hireDate} onChange={(val) => setValue("hireDate", val)} clearable />
            </Field>
            <Field>
              <Label>N° autorisation d&apos;enseigner (SNEPUP)</Label>
              <Input value={v.teachingAuthorizationNumber} onChange={(e) => setValue("teachingAuthorizationNumber", e.target.value)} />
            </Field>
          </div>
          <Field>
            <Label>N° CNSS (optionnel)</Label>
            <Input value={v.cnssNumber} onChange={(e) => setValue("cnssNumber", e.target.value)} />
          </Field>
        </div>
      )}

      {active === 2 && (
        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-center gap-3">
              <Switch checked={v.createLogin} onChange={(checked) => setValue("createLogin", checked)} ariaLabel="Créer un accès" />
              <span className="text-sm text-gray-700">Créer un accès (espace enseignant)</span>
            </div>
            {v.createLogin && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-400">L&apos;enseignant se connectera avec son <strong>email</strong> et ce mot de passe.</p>
                <Field>
                  <Label>Mot de passe</Label>
                  <Input type="password" placeholder="••••••••" value={v.password} onChange={(e) => setValue("password", e.target.value)} aria-invalid={!!errors.password} />
                  {errors.password && <p className="text-xs text-error-600">{errors.password.message}</p>}
                </Field>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
            <p className="font-medium text-gray-700">Récapitulatif</p>
            <p>{v.firstName} {v.lastName}{v.specialization ? ` · ${v.specialization}` : ""}</p>
            <p className="text-gray-500">{[v.employmentStatus, v.remunerationType, v.remunerationRate ? `${v.remunerationRate} GNF` : null].filter(Boolean).join(" · ") || "—"}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <div className="flex items-center gap-3">
          {active > 0 && <Button type="button" variant="secondary" onClick={prevStep} disabled={submitting}>Précédent</Button>}
          {active < STEPS.length - 1 ? (
            <Button type="button" onClick={() => void nextStep()}>Suivant</Button>
          ) : (
            <Button type="submit" loading={submitting}>{submitLabel}</Button>
          )}
        </div>
      </div>
    </form>
  );
}
