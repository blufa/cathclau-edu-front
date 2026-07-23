"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { slugify } from "@/lib/platform-utils";
import { ESTABLISHMENT_TYPE_LABEL } from "@/lib/platform-labels";
import { ESTABLISHMENT_TYPES, type CreateTenantInput, type EstablishmentType } from "@/lib/types/platform";
import { phoneRule } from "@/lib/phone";
import { PhoneInput } from "@/components/ui/phone-input";

interface TenantFormProps {
  onSubmit: (input: CreateTenantInput) => Promise<void>;
  onCancel: () => void;
}

const schema = z
  .object({
    schoolName: z.string().trim().min(2, "Nom requis"),
    slug: z.string(),
    email: z.string(),
    username: z.string(),
    phone: z.string(),
    city: z.string(),
    country: z.string(),
    director: z.string(),
    typeValues: z.array(z.string()).min(1, "Au moins un type requis"),
    initialState: z.enum(["TRIAL", "ACTIVE"]),
    adminPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email invalide" });
    }
    if (v.username && !/^[a-zA-Z0-9._-]{3,}$/.test(v.username)) {
      ctx.addIssue({ code: "custom", path: ["username"], message: "3 caractères min. (lettres, chiffres, . _ -)" });
    }
    if (!v.username && !v.email.trim()) {
      ctx.addIssue({ code: "custom", path: ["username"], message: "Renseignez un email ou un identifiant" });
    }
    if (!v.phone.trim()) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Téléphone requis" });
    } else {
      const err = phoneRule(v.phone);
      if (err) ctx.addIssue({ code: "custom", path: ["phone"], message: err });
    }
    if (v.adminPassword && v.adminPassword.length < 8) {
      ctx.addIssue({ code: "custom", path: ["adminPassword"], message: "8 caractères minimum" });
    }
    if ((v.adminPassword ?? "") !== (v.confirmPassword ?? "")) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Les mots de passe ne correspondent pas" });
    }
  });
type FormValues = z.infer<typeof schema>;

/** Manual school creation (SUPER_ADMIN) — features/01-platform.md §3. */
export function TenantForm({ onSubmit, onCancel }: TenantFormProps) {
  // Tant que le slug n'a pas été édité à la main, il suit le nom de l'école.
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      schoolName: "", slug: "", email: "", username: "", phone: "", city: "", country: "Guinée",
      director: "", typeValues: ["PRIMAIRE"], initialState: "TRIAL",
      adminPassword: "", confirmPassword: "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  function toggleType(t: EstablishmentType) {
    setValue("typeValues", v.typeValues.includes(t) ? v.typeValues.filter((x) => x !== t) : [...v.typeValues, t]);
  }

  async function submit(values: FormValues) {
    setSubmitting(true);
    try {
      await onSubmit({
        schoolName: values.schoolName,
        slug: values.slug || slugify(values.schoolName),
        email: values.email || undefined,
        username: values.username || undefined,
        phone: values.phone,
        city: values.city || undefined,
        country: values.country || undefined,
        director: values.director || undefined,
        establishmentTypes: values.typeValues as EstablishmentType[],
        initialState: values.initialState,
        adminPassword: values.adminPassword || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Nom de l&apos;école <span className="text-error-500">*</span></Label>
        <Input
          value={v.schoolName}
          onChange={(e) => {
            const name = e.target.value;
            setValue("schoolName", name);
            if (!slugEdited) setValue("slug", slugify(name));
          }}
          aria-invalid={!!errors.schoolName}
        />
        {errors.schoolName && <p className="text-xs text-error-600">{errors.schoolName.message}</p>}
      </Field>
      <Field>
        <Label>Slug</Label>
        <p className="text-xs text-gray-400">URL publique de l&apos;école (rempli automatiquement)</p>
        <Input
          value={v.slug}
          onChange={(e) => { setSlugEdited(true); setValue("slug", slugify(e.target.value)); }}
        />
      </Field>
      <Field>
        <Label>Identifiant de connexion</Label>
        <p className="text-xs text-gray-400">L&apos;admin se connectera avec cet identifiant (ou son email s&apos;il est renseigné). Généré si vide.</p>
        <Input placeholder="ex. direction-lumiere" value={v.username} onChange={(e) => setValue("username", e.target.value)} aria-invalid={!!errors.username} />
        {errors.username && <p className="text-xs text-error-600">{errors.username.message}</p>}
      </Field>
      <Field>
        <Label>Email du directeur (optionnel)</Label>
        <Input value={v.email} onChange={(e) => setValue("email", e.target.value)} aria-invalid={!!errors.email} />
        {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
      </Field>
      <PhoneInput label="Téléphone" required value={v.phone} onChange={(val) => setValue("phone", val)} error={errors.phone?.message} />
      <Field>
        <Label>Ville</Label>
        <Input value={v.city} onChange={(e) => setValue("city", e.target.value)} />
      </Field>
      <Field>
        <Label>Pays</Label>
        <Input value={v.country} onChange={(e) => setValue("country", e.target.value)} />
      </Field>
      <Field>
        <Label>Directeur</Label>
        <Input value={v.director} onChange={(e) => setValue("director", e.target.value)} />
      </Field>
      <Field>
        <Label>Types d&apos;établissement <span className="text-error-500">*</span></Label>
        <p className="text-xs text-gray-400">Une école peut cumuler plusieurs cycles (primaire, collège, lycée…)</p>
        <div className="mt-1.5 space-y-1 rounded-lg border border-gray-200 p-2">
          {ESTABLISHMENT_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={v.typeValues.includes(t)} onChange={() => toggleType(t)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
              {ESTABLISHMENT_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
        {errors.typeValues && <p className="text-xs text-error-600">{errors.typeValues.message}</p>}
      </Field>
      <Field>
        <Label>État initial</Label>
        <Select value={v.initialState} onChange={(e) => setValue("initialState", e.target.value as FormValues["initialState"])}>
          <option value="TRIAL">Essai (TRIAL)</option>
          <option value="ACTIVE">Active (contrat déjà payé)</option>
        </Select>
      </Field>
      <Field>
        <Label>Mot de passe admin</Label>
        <p className="text-xs text-gray-400">Optionnel — laissez vide pour générer un accès temporaire (changé à la 1re connexion)</p>
        <Input type="password" autoComplete="new-password" value={v.adminPassword} onChange={(e) => setValue("adminPassword", e.target.value)} aria-invalid={!!errors.adminPassword} />
        {errors.adminPassword && <p className="text-xs text-error-600">{errors.adminPassword.message}</p>}
      </Field>
      <Field>
        <Label>Confirmer le mot de passe</Label>
        <Input type="password" autoComplete="new-password" disabled={!v.adminPassword} value={v.confirmPassword} onChange={(e) => setValue("confirmPassword", e.target.value)} aria-invalid={!!errors.confirmPassword} />
        {errors.confirmPassword && <p className="text-xs text-error-600">{errors.confirmPassword.message}</p>}
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={submitting}>Créer l&apos;école</Button>
      </div>
    </form>
  );
}
