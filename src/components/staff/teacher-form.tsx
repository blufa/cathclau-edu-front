"use client";

import { useState } from "react";
import { Alert, Autocomplete, Button, Group, Select, NumberInput, PasswordInput, SimpleGrid, Stack, Stepper, Switch, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Check } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { listSubjects } from "@/lib/api/academics";
import { ApiError } from "@/lib/api/errors";
import { createUserWithRole } from "@/lib/api/iam";
import type { CreateTeacherInput, Teacher } from "@/lib/types/staff";
import { PhoneInput } from "@/components/ui/phone-input";

interface TeacherFormProps {
  initial?: Teacher;
  submitLabel: string;
  onSubmit: (input: CreateTeacherInput) => Promise<void>;
  onCancel: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  staffNumber: string;
  specialization: string;
  phone: string;
  email: string;
  hireDate: string;
  employmentStatus: string;
  diploma: string;
  remunerationType: string;
  remunerationRate: string | number;
  teachingAuthorizationNumber: string;
  cnssNumber: string;
  createLogin: boolean;
  password: string;
}

const FIELD_STEP: Record<string, number> = { firstName: 0, lastName: 0, email: 0, password: 2 };
const STEPS = 3;

export function TeacherForm({ initial, submitLabel, onSubmit, onCancel }: TeacherFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState(0);
  const subjectsQuery = useQuery(listSubjects, []);
  const subjectOptions = (subjectsQuery.data ?? []).map((s) => s.label);

  const form = useForm<FormValues>({
    mode: "controlled",
    initialValues: {
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
      remunerationRate: initial?.remunerationRate ?? "",
      teachingAuthorizationNumber: initial?.teachingAuthorizationNumber ?? "",
      cnssNumber: initial?.cnssNumber ?? "",
      createLogin: false,
      password: "",
    },
    validate: {
      firstName: (v) => (v.trim() ? null : "Prénom requis"),
      lastName: (v) => (v.trim() ? null : "Nom requis"),
      email: (v, vals) => {
        if (vals.createLogin) return /^\S+@\S+$/.test(v) ? null : "Email requis pour l'accès";
        return !v || /^\S+@\S+$/.test(v) ? null : "Email invalide";
      },
      password: (v, vals) => (vals.createLogin && v.length < 6 ? "Mot de passe (6 caractères min.)" : null),
    },
  });

  function nextStep() {
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
      let userId: number | null = null;
      if (values.createLogin) {
        const user = await createUserWithRole(
          { firstName: values.firstName, lastName: values.lastName, email: values.email, password: values.password, phone: values.phone || null },
          "TEACHER",
        );
        userId = user.id;
      }
      const rate = values.remunerationRate === "" || values.remunerationRate == null ? null : String(values.remunerationRate);
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
        remunerationRate: rate,
        teachingAuthorizationNumber: values.teachingAuthorizationNumber || null,
        cnssNumber: values.cnssNumber || null,
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
                <PhoneInput label="Téléphone" {...form.getInputProps("phone")} />
                <TextInput label="Email" type="email" {...form.getInputProps("email")} />
              </SimpleGrid>
            </Stack>
          </Stepper.Step>

          {/* Step 2 — Professional */}
          <Stepper.Step label="Professionnel">
            <Stack gap="md" pt="md">
              <SimpleGrid cols={2}>
                <TextInput label="Matricule" placeholder="Auto-généré si vide" {...form.getInputProps("staffNumber")} />
                <Autocomplete label="Spécialité" placeholder="Matière principale" data={subjectOptions} {...form.getInputProps("specialization")} />
              </SimpleGrid>
              <SimpleGrid cols={2}>
                <TextInput label="Diplôme le plus élevé" {...form.getInputProps("diploma")} />
                <Select label="Statut" allowDeselect={false} data={[
                  { value: "PERMANENT", label: "Permanent" },
                  { value: "VACATAIRE", label: "Vacataire" },
                  { value: "CONTRACTUEL", label: "Contractuel" },
                ]} {...form.getInputProps("employmentStatus")} />
              </SimpleGrid>
              <SimpleGrid cols={2}>
                <Select label="Type de rémunération" allowDeselect={false} data={[
                  { value: "MENSUEL", label: "Mensuel" },
                  { value: "HORAIRE", label: "Horaire" },
                  { value: "FORFAIT", label: "Forfait" },
                ]} {...form.getInputProps("remunerationType")} />
                <NumberInput
                  label={v.remunerationType === "HORAIRE" ? "Taux horaire (GNF/h)"
                    : v.remunerationType === "FORFAIT" ? "Montant forfaitaire (GNF)"
                    : "Salaire mensuel (GNF)"}
                  thousandSeparator=" " min={0} {...form.getInputProps("remunerationRate")} />
              </SimpleGrid>
              <SimpleGrid cols={2}>
                <DatePickerInput label="Date d'embauche" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("hireDate")} />
                <TextInput label="N° autorisation d'enseigner (SNEPUP)" {...form.getInputProps("teachingAuthorizationNumber")} />
              </SimpleGrid>
              <TextInput label="N° CNSS (optionnel)" {...form.getInputProps("cnssNumber")} />
            </Stack>
          </Stepper.Step>

          {/* Step 3 — Account & summary */}
          <Stepper.Step label="Compte">
            <Stack gap="md" pt="md">
              <div className="rounded-xl border border-slate-200 p-3">
                <Switch color="brand" label="Créer un accès (espace enseignant)" {...form.getInputProps("createLogin", { type: "checkbox" })} />
                {v.createLogin && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-slate-400">L&apos;enseignant se connectera avec son <strong>email</strong> et ce mot de passe.</p>
                    <PasswordInput label="Mot de passe" placeholder="••••••••" {...form.getInputProps("password")} />
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-700">Récapitulatif</p>
                <p>{v.firstName} {v.lastName}{v.specialization ? ` · ${v.specialization}` : ""}</p>
                <p className="text-slate-500">{[v.employmentStatus, v.remunerationType, v.remunerationRate ? `${v.remunerationRate} GNF` : null].filter(Boolean).join(" · ") || "—"}</p>
              </div>
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
