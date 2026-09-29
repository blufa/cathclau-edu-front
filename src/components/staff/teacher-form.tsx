"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { createUserWithRole } from "@/lib/api/iam";
import { updateTeacherPhoto } from "@/lib/api/staff";
import type { CreateTeacherInput, Teacher } from "@/lib/types/staff";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Stepper } from "@/components/ui/stepper";
import { FileUpload } from "@/components/ui/file-upload";
import { notifyError, notifySuccess } from "@/lib/feedback";

interface TeacherFormProps {
  /** En édition : la fiche enseignant existante. En pré-remplissage (ex. création d'un profil
   * enseignant depuis une fiche personnel), seuls quelques champs (nom, contact) sont fournis. */
  initial?: Partial<Teacher>;
  submitLabel: string;
  onSubmit: (input: CreateTeacherInput) => Promise<Teacher>;
  onCancel: () => void;
  /** Appelé une fois l'enseignant créé/modifié — ferme le formulaire. Les affectations (niveaux,
   * classes/matières) se font séparément, depuis la fiche de l'enseignant. */
  onFinish: () => void;
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
    createLogin: z.boolean(),
    password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.email && !/^\S+@\S+$/.test(v.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email invalide" });
    }
    // La connexion se fait par numéro de téléphone — l'email n'est qu'un canal optionnel
    // supplémentaire. Au moins l'un des deux reste exigé pour créer un accès.
    if (v.createLogin && !v.phone.trim() && !v.email.trim()) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Téléphone ou email requis pour l'accès" });
    }
    if (v.createLogin && v.password.length < 6) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Mot de passe (6 caractères min.)" });
    }
  });
type FormValues = z.infer<typeof schema>;

const FIELD_STEP: Record<string, number> = { firstName: 0, lastName: 0, email: 0, password: 2 };
const STEPS = [{ label: "Identité" }, { label: "Professionnel" }, { label: "Compte" }];
const DIPLOMAS = ["Licence", "Master", "BTS", "Doctorat", "Ingénieur"];

export function TeacherForm({ initial, submitLabel, onSubmit, onCancel, onFinish }: TeacherFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState(0);
  const [photo, setPhoto] = useState(initial?.photo ?? "");

  async function onPhotoChange(url: string | null) {
    setPhoto(url ?? "");
    if (initial?.id == null) return; // pas encore d'id : la photo sera ajoutable après création
    try {
      await updateTeacherPhoto(initial.id, url ?? "");
      notifySuccess("Photo mise à jour");
    } catch (e) { notifyError(e); }
  }

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
    setActive((s) => Math.min(s + 1, 2));
  }
  const prevStep = () => setActive((s) => Math.max(s - 1, 0));

  async function submit(values: FormValues) {
    if (active < 2) { void nextStep(); return; }
    setError(null);
    setSubmitting(true);
    try {
      let userId: number | null = null;
      if (values.createLogin) {
        const user = await createUserWithRole(
          { firstName: values.firstName, lastName: values.lastName, email: values.email.trim() || null, password: values.password, phone: values.phone || null },
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
        // Horaire : le taux se configure dans Paie (dépend des classes affectées), pas ici.
        remunerationRate: values.remunerationType === "HORAIRE" || values.remunerationRate === ""
          ? null : values.remunerationRate,
        // Champs retirés du formulaire : on préserve la valeur existante (édition) plutôt que de
        // l'écraser silencieusement au prochain enregistrement.
        teachingAuthorizationNumber: initial?.teachingAuthorizationNumber ?? null,
        cnssNumber: initial?.cnssNumber ?? null,
        bankAccount: initial?.bankAccount ?? null,
      });
      onFinish();
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      {error && <div className="rounded-lg bg-error-50 px-3.5 py-2.5 text-sm text-error-700">{error}</div>}

      <Stepper steps={STEPS} active={active} onStepClick={setActive} />

      {active === 0 && (
        <div className="space-y-4 pt-2">
          {initial?.id != null && (
            <Field>
              <Label>Photo (badge enseignant)</Label>
              <FileUpload variant="image" folder="staff/photos" value={photo} onChange={onPhotoChange} />
            </Field>
          )}
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
              <Input type="email" value={v.email} onChange={(e) => setValue("email", e.target.value)} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
            </Field>
          </div>
        </div>
      )}

      {active === 1 && (
        <div className="space-y-4 pt-2">
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
              <p className="text-xs text-gray-400">Domaine du diplôme — pas forcément la matière enseignée</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label>Type de rémunération</Label>
              <Select value={v.remunerationType} onChange={(e) => setValue("remunerationType", e.target.value)}>
                <option value="MENSUEL">Mensuel</option>
                <option value="HORAIRE">Horaire</option>
                <option value="FORFAIT">Forfait</option>
              </Select>
            </Field>
            {v.remunerationType === "HORAIRE" ? (
              <Field>
                <Label>Taux horaire</Label>
                <p className="text-xs text-gray-400 pt-2">
                  Dépend des classes affectées (normales ou d&apos;examen — 10ème, Terminale, CM2…) :
                  se configure dans <strong>Paie</strong> une fois les classes choisies ci-dessous.
                </p>
              </Field>
            ) : (
              <Field>
                <Label>{v.remunerationType === "FORFAIT" ? "Montant forfaitaire (GNF)" : "Salaire mensuel (GNF)"}</Label>
                <Input type="number" min={0} value={v.remunerationRate} onChange={(e) => setValue("remunerationRate", e.target.value)} />
              </Field>
            )}
          </div>
          <Field>
            <Label>Date d&apos;embauche</Label>
            <DatePicker value={v.hireDate} onChange={(val) => setValue("hireDate", val)} clearable />
          </Field>
        </div>
      )}

      {active === 2 && (
        <div className="space-y-4 pt-2">
          {initial?.userId != null ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              Cet enseignant a déjà un accès (compte de connexion lié).
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-3">
                <Switch checked={v.createLogin} onChange={(checked) => setValue("createLogin", checked)} ariaLabel="Créer un accès" />
                <span className="text-sm text-gray-700">Créer un accès (espace enseignant)</span>
              </div>
              {v.createLogin && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-400">L&apos;enseignant se connectera avec son <strong>numéro de téléphone</strong> et ce mot de passe.</p>
                  <Field>
                    <Label>Mot de passe</Label>
                    <Input type="password" placeholder="••••••••" value={v.password} onChange={(e) => setValue("password", e.target.value)} aria-invalid={!!errors.password} />
                    {errors.password && <p className="text-xs text-error-600">{errors.password.message}</p>}
                  </Field>
                </div>
              )}
            </div>
          )}
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
          {active < 2 ? (
            // `key` distinct du bouton de soumission ci-dessous : sans ça, React réutilise le MÊME
            // nœud DOM <button> en changeant juste son attribut `type` ("button" → "submit") au clic
            // suivant — un bouton qui devient "submit" sur son propre nœud pendant le traitement du
            // clic peut déclencher la soumission native du formulaire, créant l'enseignant au lieu de
            // passer à l'étape suivante. Un `key` différent force un vrai démontage/remontage.
            <Button key="next" type="button" onClick={(e) => { e.preventDefault(); void nextStep(); }}>Suivant</Button>
          ) : (
            <Button key="submit" type="submit" loading={submitting}>{submitLabel}</Button>
          )}
        </div>
      </div>
    </form>
  );
}
