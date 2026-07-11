"use client";

import { useRef, useState } from "react";
import { Alert, Autocomplete, Button, Group, Select, PasswordInput, SimpleGrid, Stack, Stepper, Switch, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Check } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { phoneRule } from "@/lib/phone";
import { PhoneInput } from "@/components/ui/phone-input";
import { searchSchools } from "@/lib/api/directory";
import { formatClassOrdinal, nextClassOrdinal } from "@/lib/format";
import { FileUpload } from "@/components/ui/file-upload";
import type { CreateStudentInput, Gender, Student } from "@/lib/types/student";

interface StudentFormProps {
  initial?: Student;
  submitLabel: string;
  onSubmit: (input: CreateStudentInput) => Promise<void>;
  onCancel: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  gender: Gender;
  studentNumber: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  birthCertificateNumber: string;
  bloodGroup: string;
  neighborhood: string;
  address: string;
  landmark: string;
  phone: string;
  email: string;
  originSchool: string;
  previousClass: string;
  repeating: boolean;
  transferReason: string;
  medicalNotes: string;
  photo: string;
  createLogin: boolean;
  password: string;
}

// Which step each validated field lives on (to jump back to the first error on submit).
const FIELD_STEP: Record<string, number> = { firstName: 0, lastName: 0, email: 1, password: 4 };
const STEPS = 5;

export function StudentForm({ initial, submitLabel, onSubmit, onCancel }: StudentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>(initial?.photo ?? "");
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

  const form = useForm<FormValues>({
    mode: "controlled",
    initialValues: {
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
    validate: {
      firstName: (v) => (v.trim() ? null : "Prénom requis"),
      lastName: (v) => (v.trim() ? null : "Nom requis"),
      // L'email est facultatif (l'élève se connecte par son matricule, pas par email).
      email: (v) => (!v || /^\S+@\S+$/.test(v) ? null : "Email invalide"),
      phone: phoneRule,
      password: (v, vals) => (vals.createLogin && v.length < 6 ? "Mot de passe (6 caractères min.)" : null),
    },
  });

  function nextStep() {
    // Validate the required fields of the current step before advancing.
    if (active === 0) {
      const a = form.validateField("firstName");
      const b = form.validateField("lastName");
      if (a.hasError || b.hasError) return;
    }
    setActive((s) => Math.min(s + 1, STEPS - 1));
  }
  const prevStep = () => setActive((s) => Math.max(s - 1, 0));

  function handleErrors(errors: Record<string, React.ReactNode>) {
    const firstKey = Object.keys(errors)[0];
    if (firstKey && FIELD_STEP[firstKey] != null) setActive(FIELD_STEP[firstKey]);
  }

  async function handleSubmit(values: FormValues) {
    // Garde-fou : une soumission (clic "Suivant" mal typé, ou touche Entrée) ne doit jamais
    // enregistrer avant le dernier step — on avance simplement.
    if (active < STEPS - 1) { nextStep(); return; }
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
        if (Object.keys(fieldErrors).length > 0) form.setErrors(fieldErrors);
        else setError(err.userMessage);
      } else {
        setError("Enregistrement impossible.");
      }
      setSubmitting(false);
    }
  }

  const v = form.getValues();

  return (
    <form onSubmit={form.onSubmit(handleSubmit, handleErrors)}>
      <Stack gap="md">
        {error && <Alert color="red" variant="light">{error}</Alert>}

        <div className="overflow-x-auto pb-1">
        <Stepper
          active={active}
          onStepClick={setActive}
          size="sm"
          color="brand"
          radius="xl"
          wrap={false}
          completedIcon={<Check className="h-4 w-4" />}
          classNames={{ separator: "mx-1" }}
        >
          {/* Step 1 — Identity */}
          <Stepper.Step label="Identité">
            <Stack gap="md" pt="md">
              <SimpleGrid cols={2}>
                <TextInput label="Prénom" withAsterisk {...form.getInputProps("firstName")} />
                <TextInput label="Nom" withAsterisk {...form.getInputProps("lastName")} />
              </SimpleGrid>
              <SimpleGrid cols={2}>
                <Select label="Sexe" allowDeselect={false} data={[{ value: "MALE", label: "Masculin" }, { value: "FEMALE", label: "Féminin" }]} {...form.getInputProps("gender")} />
                <TextInput label="Matricule" placeholder="Auto-généré si vide" {...form.getInputProps("studentNumber")} />
              </SimpleGrid>
              <SimpleGrid cols={2}>
                <DatePickerInput
                  label="Date de naissance"
                  valueFormat="DD/MM/YYYY"
                  clearable
                  defaultLevel="decade"
                  maxDate={new Date()}
                  {...form.getInputProps("birthDate")}
                />
                <TextInput label="Lieu de naissance" {...form.getInputProps("birthPlace")} />
              </SimpleGrid>
              <SimpleGrid cols={3}>
                <TextInput label="Nationalité" {...form.getInputProps("nationality")} />
                <TextInput label="N° acte de naissance" {...form.getInputProps("birthCertificateNumber")} />
                <TextInput label="Groupe sanguin" placeholder="A+, O-…" {...form.getInputProps("bloodGroup")} />
              </SimpleGrid>
              <FileUpload label="Photo de l'élève" variant="image" folder="students/photos" value={photoUrl}
                onChange={(url) => { setPhotoUrl(url ?? ""); form.setFieldValue("photo", url ?? ""); }} />
            </Stack>
          </Stepper.Step>

          {/* Step 2 — Address & contact */}
          <Stepper.Step label="Coordonnées">
            <Stack gap="md" pt="md">
              <SimpleGrid cols={2}>
                <TextInput label="Quartier / commune" {...form.getInputProps("neighborhood")} />
                <TextInput label="Point de repère" placeholder="Près de…" {...form.getInputProps("landmark")} />
              </SimpleGrid>
              <TextInput label="Adresse" {...form.getInputProps("address")} />
              <SimpleGrid cols={2}>
                <PhoneInput label="Téléphone" {...form.getInputProps("phone")} />
                <TextInput label="Email" type="email" {...form.getInputProps("email")} />
              </SimpleGrid>
            </Stack>
          </Stepper.Step>

          {/* Step 3 — Prior schooling */}
          <Stepper.Step label="Scolarité">
            <Stack gap="md" pt="md">
              <SimpleGrid cols={2}>
                <Autocomplete
                  label="École précédente"
                  placeholder="Rechercher ou saisir…"
                  data={schoolOptions}
                  value={v.originSchool}
                  onChange={(val) => { form.setFieldValue("originSchool", val); fetchSchools(val); }}
                />
                <TextInput
                  label="Dernière classe fréquentée"
                  placeholder="Saisir le nombre, ex. 10"
                  description={v.previousClass ? `Affichée : ${formatClassOrdinal(v.previousClass)}` : "Un nombre seul s'affiche « Nᵉᵐᵉ »"}
                  {...form.getInputProps("previousClass")}
                />
              </SimpleGrid>
              <Switch color="green" label="Redoublant" {...form.getInputProps("repeating", { type: "checkbox" })} />
              {/^\d+$/.test((v.previousClass ?? "").trim()) && (
                <p className="text-xs text-slate-500">
                  Classe d&apos;inscription suggérée cette année : <strong>{nextClassOrdinal(v.previousClass, v.repeating)}</strong>
                  {v.repeating ? " (redoublant)" : " (passage en classe supérieure)"}
                </p>
              )}
              <Textarea label="Motif de transfert (optionnel)" autosize minRows={2} {...form.getInputProps("transferReason")} />
            </Stack>
          </Stepper.Step>

          {/* Step 4 — Health */}
          <Stepper.Step label="Santé">
            <Stack gap="md" pt="md">
              <Textarea label="Informations médicales" placeholder="Allergies, maladies chroniques, traitement, médecin/contact, observations…"
                autosize minRows={4} {...form.getInputProps("medicalNotes")} />
            </Stack>
          </Stepper.Step>

          {/* Step 5 — Account & summary */}
          <Stepper.Step label="Compte">
            <Stack gap="md" pt="md">
              <div className="rounded-xl border border-slate-200 p-3">
                <Switch color="brand" label="Créer un accès (espace élève)" {...form.getInputProps("createLogin", { type: "checkbox" })} />
                {v.createLogin && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-slate-400">
                      L&apos;élève se connectera avec son <strong>matricule</strong> (généré automatiquement) et ce mot de passe.
                      Aucun email n&apos;est nécessaire.
                    </p>
                    <PasswordInput label="Mot de passe" placeholder="••••••••" {...form.getInputProps("password")} />
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-700">Récapitulatif</p>
                <p>{v.firstName} {v.lastName} · {v.gender === "MALE" ? "Masculin" : "Féminin"}{v.birthDate ? ` · né(e) le ${v.birthDate}` : ""}</p>
                <p className="text-slate-500">{[v.neighborhood, v.phone].filter(Boolean).join(" · ") || "—"}</p>
                <p className="text-slate-500">{v.previousClass ? `Venant de ${v.originSchool || "?"} (${v.previousClass})${v.repeating ? " · redoublant" : ""}` : "Nouvelle scolarité"}</p>
              </div>
              <p className="text-xs text-slate-400">
                Les <strong>parents/tuteurs</strong> et les <strong>documents</strong> s&apos;ajoutent après création depuis la fiche de l&apos;élève. La photo est requise pour la carte scolaire.
              </p>
            </Stack>
          </Stepper.Step>
        </Stepper>
        </div>

        <Group justify="space-between" gap="sm">
          <Button type="button" variant="default" onClick={onCancel} disabled={submitting}>Annuler</Button>
          <Group gap="sm">
            {active > 0 && <Button type="button" variant="default" onClick={prevStep} disabled={submitting}>Précédent</Button>}
            {active < STEPS - 1 ? (
              <Button type="button" onClick={nextStep}>Suivant</Button>
            ) : (
              <Button type="submit" loading={submitting}>{submitLabel}</Button>
            )}
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
