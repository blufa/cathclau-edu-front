"use client";

import { useState } from "react";
import { MultiSelect, PasswordInput, Select, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/platform-utils";
import { ESTABLISHMENT_TYPE_LABEL } from "@/lib/platform-labels";
import { ESTABLISHMENT_TYPES, type CreateTenantInput, type EstablishmentType } from "@/lib/types/platform";

interface TenantFormProps {
  onSubmit: (input: CreateTenantInput) => Promise<void>;
  onCancel: () => void;
}

/** Manual school creation (SUPER_ADMIN) — features/01-platform.md §3. */
export function TenantForm({ onSubmit, onCancel }: TenantFormProps) {
  // Tant que le slug n'a pas été édité à la main, il suit le nom de l'école.
  const [slugEdited, setSlugEdited] = useState(false);
  const form = useForm<CreateTenantInput & { typeValues: EstablishmentType[]; confirmPassword: string }>({
    mode: "controlled",
    initialValues: {
      schoolName: "", slug: "", email: "", phone: "", city: "", country: "Guinée",
      director: "", establishmentTypes: ["PRIMAIRE"], initialState: "TRIAL", typeValues: ["PRIMAIRE"],
      adminPassword: "", confirmPassword: "",
    },
    validate: {
      schoolName: (v) => (v.trim().length >= 2 ? null : "Nom requis"),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Email invalide"),
      phone: (v) => (v.trim() ? null : "Téléphone requis"),
      typeValues: (v) => (v && v.length > 0 ? null : "Au moins un type requis"),
      adminPassword: (v) => (!v || v.length >= 8 ? null : "8 caractères minimum"),
      confirmPassword: (v, values) =>
        (values.adminPassword ?? "") === (v ?? "") ? null : "Les mots de passe ne correspondent pas",
    },
  });

  async function handleSubmit(values: typeof form.values) {
    await onSubmit({
      schoolName: values.schoolName,
      slug: values.slug || slugify(values.schoolName),
      email: values.email,
      phone: values.phone,
      city: values.city || undefined,
      country: values.country || undefined,
      director: values.director || undefined,
      establishmentTypes: values.typeValues,
      initialState: values.initialState,
      adminPassword: values.adminPassword || undefined,
    });
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TextInput label="Nom de l'école" withAsterisk {...form.getInputProps("schoolName")}
          onChange={(e) => {
            const name = e.currentTarget.value;
            form.setFieldValue("schoolName", name);
            if (!slugEdited) form.setFieldValue("slug", slugify(name));
          }} />
        <TextInput label="Slug" description="URL publique de l'école (rempli automatiquement)"
          {...form.getInputProps("slug")}
          onChange={(e) => {
            setSlugEdited(true);
            form.setFieldValue("slug", slugify(e.currentTarget.value));
          }} />
        <TextInput label="Email du directeur" withAsterisk {...form.getInputProps("email")} />
        <TextInput label="Téléphone" withAsterisk {...form.getInputProps("phone")} />
        <TextInput label="Ville" {...form.getInputProps("city")} />
        <TextInput label="Pays" {...form.getInputProps("country")} />
        <TextInput label="Directeur" {...form.getInputProps("director")} />
        <MultiSelect
          label="Types d'établissement"
          description="Une école peut cumuler plusieurs cycles (primaire, collège, lycée…)"
          withAsterisk
          data={ESTABLISHMENT_TYPES.map((t) => ({ value: t, label: ESTABLISHMENT_TYPE_LABEL[t] }))}
          {...form.getInputProps("typeValues")}
        />
        <Select
          label="État initial"
          data={[
            { value: "TRIAL", label: "Essai (TRIAL)" },
            { value: "ACTIVE", label: "Active (contrat déjà payé)" },
          ]}
          {...form.getInputProps("initialState")}
        />
        <PasswordInput
          label="Mot de passe admin"
          description="Optionnel — laissez vide pour générer un accès temporaire (changé à la 1re connexion)"
          autoComplete="new-password"
          {...form.getInputProps("adminPassword")}
        />
        <PasswordInput
          label="Confirmer le mot de passe"
          autoComplete="new-password"
          disabled={!form.values.adminPassword}
          {...form.getInputProps("confirmPassword")}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit">Créer l&apos;école</Button>
        </div>
      </Stack>
    </form>
  );
}
