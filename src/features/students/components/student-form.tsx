"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { phoneRule } from "@/lib/phone";
import { PhoneInput } from "@/components/ui/phone-input";
import { searchSchools } from "@/lib/api/directory";
import { formatClassOrdinal, nextClassOrdinal } from "@/lib/format";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { Input, Label, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { Stepper } from "@/components/ui/stepper";
import type { CreateStudentInput, Student } from "@/lib/types/student";

interface StudentFormProps {
  initial?: Student;
  submitLabel: string;
  onSubmit: (input: CreateStudentInput) => Promise<void>;
  onCancel: () => void;
}

const schema = z
  .object({
    firstName: z.string().trim().min(1, "Prénom requis"),
    lastName: z.string().trim().min(1, "Nom requis"),
    gender: z.enum(["MALE", "FEMALE"]),
    studentNumber: z.string(),
    birthDate: z.string(),
    birthPlace: z.string(),
    nationality: z.string(),
    birthCertificateNumber: z.string(),
    bloodGroup: z.string(),
    neighborhood: z.string(),
    address: z.string(),
    landmark: z.string(),
    phone: z.string(),
    email: z.string(),
    originSchool: z.string(),
    previousClass: z.string(),
    repeating: z.boolean(),
    transferReason: z.string(),
    medicalNotes: z.string(),
    photo: z.string(),
    createLogin: z.boolean(),
    password: z.string(),
  })
  .superRefine((v, ctx) => {
    // L'email est facultatif (l'élève se connecte par son matricule, pas par email).
    if (v.email && !/^\S+@\S+$/.test(v.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email invalide" });
    }
    const phoneError = phoneRule(v.phone);
    if (phoneError) ctx.addIssue({ code: "custom", path: ["phone"], message: phoneError });
    if (v.createLogin && v.password.length < 6) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Mot de passe (6 caractères min.)" });
    }
  });
type FormValues = z.infer<typeof schema>;

// Which step each validated field lives on (to jump back to the first error on submit).
const FIELD_STEP: Record<string, number> = { firstName: 0, lastName: 0, email: 1, phone: 1, password: 4 };
const STEPS = [
  { label: "Identité" },
  { label: "Coordonnées" },
  { label: "Scolarité" },
  { label: "Santé" },
  { label: "Compte" },
];

export function StudentForm({ initial, submitLabel, onSubmit, onCancel }: StudentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState(0);
  // École d'origine : suggestions depuis l'annuaire inter-écoles (saisie libre toujours possible).
  const [schoolOptions, setSchoolOptions] = useState<string[]>([]);
  const schoolDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function fetchSchools(q: string) {
    clearTimeout(schoolDebounce.current);
    if (q.trim().length < 2) { setSchoolOptions([]); return; }
    schoolDebounce.current = setTimeout(() => {
      searchSchools(q).then(setSchoolOptions).catch(() => setSchoolOptions([]));
    }, 300);
  }

  const {
    handleSubmit,
    watch,
    setValue,
    setError: setFieldError,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      gender: initial?.gender ?? "MALE",
      studentNumber: initial?.studentNumber ?? "",
      birthDate: initial?.birthDate ?? "",
      birthPlace: initial?.birthPlace ?? "",
      nationality: initial?.nationality ?? "Guinéenne",
      birthCertificateNumber: initial?.birthCertificateNumber ?? "",
      bloodGroup: initial?.bloodGroup ?? "",
      neighborhood: initial?.neighborhood ?? "",
      address: initial?.address ?? "",
      landmark: initial?.landmark ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      originSchool: initial?.originSchool ?? "",
      previousClass: initial?.previousClass ?? "",
      repeating: initial?.repeating ?? false,
      transferReason: initial?.transferReason ?? "",
      medicalNotes: initial?.medicalNotes ?? "",
      photo: initial?.photo ?? "",
      createLogin: false,
      password: "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function nextStep() {
    // Validate the required fields of the current step before advancing.
    if (active === 0) {
      const ok = await trigger(["firstName", "lastName"]);
      if (!ok) return;
    }
    setActive((s) => Math.min(s + 1, STEPS.length - 1));
  }
  const prevStep = () => setActive((s) => Math.max(s - 1, 0));

  async function handleFormSubmit(values: FormValues) {
    // Garde-fou : une soumission (touche Entrée) ne doit jamais enregistrer avant le dernier step.
    if (active < STEPS.length - 1) { void nextStep(); return; }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        // L'accès portail est créé côté serveur (login = matricule, pas d'email requis).
        createLogin: values.createLogin || undefined,
        loginPassword: values.createLogin ? values.password : undefined,
        firstName: values.firstName,
        lastName: values.lastName,
        gender: values.gender,
        studentNumber: values.studentNumber || null,
        birthDate: values.birthDate || null,
        birthPlace: values.birthPlace || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        nationality: values.nationality || null,
        originSchool: values.originSchool || null,
        photo: values.photo || null,
        birthCertificateNumber: values.birthCertificateNumber || null,
        bloodGroup: values.bloodGroup || null,
        neighborhood: values.neighborhood || null,
        landmark: values.landmark || null,
        previousClass: values.previousClass || null,
        repeating: values.repeating,
        transferReason: values.transferReason || null,
        medicalNotes: values.medicalNotes || null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors;
        const fields = Object.keys(fieldErrors);
        if (fields.length > 0) {
          for (const [field, message] of Object.entries(fieldErrors)) {
            setFieldError(field as keyof FormValues, { message });
          }
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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
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
            <Field>
              <Label>Sexe</Label>
              <Select value={v.gender} onChange={(e) => setValue("gender", e.target.value as FormValues["gender"])}>
                <option value="MALE">Masculin</option>
                <option value="FEMALE">Féminin</option>
              </Select>
            </Field>
            <Field>
              <Label>Matricule</Label>
              <Input placeholder="Auto-généré si vide" value={v.studentNumber} onChange={(e) => setValue("studentNumber", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>Date de naissance</Label>
              <DatePicker value={v.birthDate} onChange={(val) => setValue("birthDate", val)} clearable maxDate={new Date()} />
            </Field>
            <Field>
              <Label>Lieu de naissance</Label>
              <Input value={v.birthPlace} onChange={(e) => setValue("birthPlace", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <Label>Nationalité</Label>
              <Input value={v.nationality} onChange={(e) => setValue("nationality", e.target.value)} />
            </Field>
            <Field>
              <Label>N° acte de naissance</Label>
              <Input value={v.birthCertificateNumber} onChange={(e) => setValue("birthCertificateNumber", e.target.value)} />
            </Field>
            <Field>
              <Label>Groupe sanguin</Label>
              <Input placeholder="A+, O-…" value={v.bloodGroup} onChange={(e) => setValue("bloodGroup", e.target.value)} />
            </Field>
          </div>
          <Field>
            <Label>Photo de l&apos;élève</Label>
            <FileUpload variant="image" folder="students/photos" value={v.photo}
              onChange={(url) => setValue("photo", url ?? "")} />
          </Field>
        </div>
      )}

      {active === 1 && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>Quartier / commune</Label>
              <Input value={v.neighborhood} onChange={(e) => setValue("neighborhood", e.target.value)} />
            </Field>
            <Field>
              <Label>Point de repère</Label>
              <Input placeholder="Près de…" value={v.landmark} onChange={(e) => setValue("landmark", e.target.value)} />
            </Field>
          </div>
          <Field>
            <Label>Adresse</Label>
            <Input value={v.address} onChange={(e) => setValue("address", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <PhoneInput label="Téléphone" value={v.phone} onChange={(val) => setValue("phone", val)} error={errors.phone?.message} />
            <Field>
              <Label>Email</Label>
              <Input type="email" value={v.email} onChange={(e) => setValue("email", e.target.value)} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
            </Field>
          </div>
        </div>
      )}

      {active === 2 && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>École précédente</Label>
              <Combobox
                placeholder="Rechercher ou saisir…"
                options={schoolOptions}
                value={v.originSchool}
                onChange={(val) => { setValue("originSchool", val); fetchSchools(val); }}
              />
            </Field>
            <Field>
              <Label>Dernière classe fréquentée</Label>
              <Input placeholder="Saisir le nombre, ex. 10" value={v.previousClass} onChange={(e) => setValue("previousClass", e.target.value)} />
              <p className="text-xs text-gray-400">
                {v.previousClass ? `Affichée : ${formatClassOrdinal(v.previousClass)}` : "Un nombre seul s'affiche « Nᵉᵐᵉ »"}
              </p>
            </Field>
          </div>
          <Switch checked={v.repeating} onChange={(checked) => setValue("repeating", checked)} ariaLabel="Redoublant" />
          <span className="-mt-3 block text-sm text-gray-600">Redoublant</span>
          {/^\d+$/.test((v.previousClass ?? "").trim()) && (
            <p className="text-xs text-slate-500">
              Classe d&apos;inscription suggérée cette année : <strong>{nextClassOrdinal(v.previousClass, v.repeating)}</strong>
              {v.repeating ? " (redoublant)" : " (passage en classe supérieure)"}
            </p>
          )}
          <Field>
            <Label>Motif de transfert (optionnel)</Label>
            <Textarea rows={2} value={v.transferReason} onChange={(e) => setValue("transferReason", e.target.value)} />
          </Field>
        </div>
      )}

      {active === 3 && (
        <div className="space-y-4 pt-2">
          <Field>
            <Label>Informations médicales</Label>
            <Textarea rows={4} placeholder="Allergies, maladies chroniques, traitement, médecin/contact, observations…"
              value={v.medicalNotes} onChange={(e) => setValue("medicalNotes", e.target.value)} />
          </Field>
        </div>
      )}

      {active === 4 && (
        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-center gap-3">
              <Switch checked={v.createLogin} onChange={(checked) => setValue("createLogin", checked)} ariaLabel="Créer un accès" />
              <span className="text-sm text-gray-700">Créer un accès (espace élève)</span>
            </div>
            {v.createLogin && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-400">
                  L&apos;élève se connectera avec son <strong>matricule</strong> (généré automatiquement) et ce mot de passe.
                  Aucun email n&apos;est nécessaire.
                </p>
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
            <p>{v.firstName} {v.lastName} · {v.gender === "MALE" ? "Masculin" : "Féminin"}{v.birthDate ? ` · né(e) le ${v.birthDate}` : ""}</p>
            <p className="text-gray-500">{[v.neighborhood, v.phone].filter(Boolean).join(" · ") || "—"}</p>
            <p className="text-gray-500">{v.previousClass ? `Venant de ${v.originSchool || "?"} (${v.previousClass})${v.repeating ? " · redoublant" : ""}` : "Nouvelle scolarité"}</p>
          </div>
          <p className="text-xs text-gray-400">
            Les <strong>parents/tuteurs</strong> et les <strong>documents</strong> s&apos;ajoutent après création depuis la fiche de l&apos;élève. La photo est requise pour la carte scolaire.
          </p>
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
