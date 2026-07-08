"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Anchor,
  Checkbox,
  Group,
  Select,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { Button } from "@/components/ui/button";
import { getSchoolBranding, resendVerification, signup } from "@/lib/api/platform";
import { ApiError } from "@/lib/api/errors";
import { maskEmail, slugify } from "@/lib/platform-utils";
import { ESTABLISHMENT_TYPE_LABEL } from "@/lib/platform-labels";
import { ESTABLISHMENT_TYPES, type EstablishmentType } from "@/lib/types/platform";

const COUNTRIES = ["Guinée", "Sénégal", "Côte d'Ivoire", "Mali", "Burkina Faso", "Bénin", "Togo"];
const RESEND_COOLDOWN = 60;

type SlugState = "idle" | "checking" | "available" | "taken";

interface FormValues {
  nomEcole: string;
  slug: string;
  ville: string;
  pays: string;
  typeEtablissement: EstablishmentType;
  emailDirecteur: string;
  directeur: string;
  prenomAdmin: string;
  nomAdmin: string;
  telephoneAdmin: string;
  password: string;
  confirm: string;
  cgu: boolean;
}

export function SignupForm() {
  const params = useSearchParams();
  const plan = params.get("plan") ?? undefined;

  const [submitted, setSubmitted] = useState<string | null>(null); // real email on success
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [slugEdited, setSlugEdited] = useState(false);

  const form = useForm<FormValues>({
    mode: "controlled",
    initialValues: {
      nomEcole: "", slug: "", ville: "", pays: "Guinée",
      typeEtablissement: "PRIMAIRE", emailDirecteur: "", directeur: "",
      prenomAdmin: "", nomAdmin: "", telephoneAdmin: "",
      password: "", confirm: "", cgu: false,
    },
    validate: {
      nomEcole: (v) => (v.trim().length >= 2 ? null : "Nom de l'école requis"),
      slug: (v) => (/^[a-z0-9-]{2,}$/.test(v) ? null : "Slug invalide (minuscules, chiffres, tirets)"),
      prenomAdmin: (v) => (v.trim().length >= 2 ? null : "Prénom de l'administrateur requis"),
      nomAdmin: (v) => (v.trim().length >= 2 ? null : "Nom de l'administrateur requis"),
      emailDirecteur: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Email invalide"),
      password: (v) =>
        v.length >= 8 && /[A-Za-z]/.test(v) && /[0-9]/.test(v)
          ? null
          : "8 caractères min., avec lettres et chiffres",
      confirm: (v, values) => (v === values.password ? null : "Les mots de passe ne correspondent pas"),
      cgu: (v) => (v ? null : "Vous devez accepter les CGU"),
    },
  });

  // Auto-derive slug from the school name until the user edits it manually.
  useEffect(() => {
    if (!slugEdited) form.setFieldValue("slug", slugify(form.values.nomEcole));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.nomEcole, slugEdited]);

  // Debounced live slug-availability check (branding 200 = taken, 404 = available).
  const slug = form.values.slug;
  useEffect(() => {
    if (!/^[a-z0-9-]{2,}$/.test(slug)) {
      const id = setTimeout(() => setSlugState("idle"), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(async () => {
      setSlugState("checking");
      try {
        await getSchoolBranding(slug);
        setSlugState("taken");
      } catch (err) {
        setSlugState(err instanceof ApiError && err.status === 404 ? "available" : "idle");
      }
    }, 450);
    return () => clearTimeout(id);
  }, [slug]);

  async function handleSubmit(values: FormValues) {
    setServerError(null);
    if (slugState === "taken") {
      form.setFieldError("slug", "Ce slug est déjà pris");
      return;
    }
    setLoading(true);
    try {
      await signup({
        nomEcole: values.nomEcole,
        slugSouhaite: values.slug,
        emailDirecteur: values.emailDirecteur,
        password: values.password,
        directeur: values.directeur || undefined,
        ville: values.ville || undefined,
        pays: values.pays || undefined,
        typeEtablissement: values.typeEtablissement,
        planSouhaite: plan,
        prenomAdmin: values.prenomAdmin,
        nomAdmin: values.nomAdmin,
        telephoneAdmin: values.telephoneAdmin || undefined,
      });
      setSubmitted(values.emailDirecteur);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const msg = err.userMessage.toLowerCase();
        if (msg.includes("slug")) form.setFieldError("slug", "Ce slug est déjà pris");
        else if (msg.includes("email")) form.setFieldError("emailDirecteur", "Un compte existe déjà pour cet email");
        else setServerError(err.userMessage);
      } else {
        setServerError(err instanceof ApiError ? err.userMessage : "Inscription impossible. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return <VerificationSent email={submitted} />;
  }

  const slugHint = {
    idle: null,
    checking: <Text size="xs" c="dimmed">Vérification…</Text>,
    available: <Text size="xs" c="green">✓ Disponible</Text>,
    taken: <Text size="xs" c="red">Déjà pris</Text>,
  }[slugState];

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl" maw={560} mx="auto">
      <Title order={3}>Créer mon école</Title>
      <Text size="sm" c="dimmed" mt={4}>
        Essai gratuit de 30 jours{plan ? ` · plan ${plan}` : ""}. Aucune carte bancaire requise.
      </Text>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md" mt="lg">
          {serverError && <Alert color="red" variant="light">{serverError}</Alert>}

          <Text fw={600} size="sm">École</Text>
          <TextInput label="Nom de l'école" withAsterisk {...form.getInputProps("nomEcole")} />
          <div>
            <TextInput
              label="Adresse (slug)"
              description="Utilisé pour l'URL de connexion de votre école"
              withAsterisk
              {...form.getInputProps("slug")}
              onChange={(e) => {
                setSlugEdited(true);
                form.setFieldValue("slug", slugify(e.currentTarget.value));
              }}
            />
            {slugHint}
          </div>
          <Group grow>
            <TextInput label="Ville" {...form.getInputProps("ville")} />
            <Select label="Pays" data={COUNTRIES} {...form.getInputProps("pays")} />
          </Group>
          <Select
            label="Type d'établissement"
            data={ESTABLISHMENT_TYPES.map((t) => ({ value: t, label: ESTABLISHMENT_TYPE_LABEL[t] }))}
            {...form.getInputProps("typeEtablissement")}
          />

          <Text fw={600} size="sm" mt="xs">Directeur</Text>
          <TextInput label="Nom du directeur" {...form.getInputProps("directeur")} />

          <Text fw={600} size="sm" mt="xs">Administrateur (compte de gestion)</Text>
          <Group grow>
            <TextInput label="Prénom" withAsterisk {...form.getInputProps("prenomAdmin")} />
            <TextInput label="Nom" withAsterisk {...form.getInputProps("nomAdmin")} />
          </Group>
          <TextInput label="Téléphone" placeholder="6XX XX XX XX" {...form.getInputProps("telephoneAdmin")} />
          <TextInput label="Email de connexion" withAsterisk {...form.getInputProps("emailDirecteur")} />
          <Group grow>
            <PasswordInput label="Mot de passe" withAsterisk {...form.getInputProps("password")} />
            <PasswordInput label="Confirmation" withAsterisk {...form.getInputProps("confirm")} />
          </Group>

          <Checkbox
            label={<>J&apos;accepte les conditions générales d&apos;utilisation</>}
            {...form.getInputProps("cgu", { type: "checkbox" })}
          />

          <Button type="submit" loading={loading} fullWidth disabled={slugState === "taken"}>
            Créer mon école
          </Button>
          <Text size="sm" ta="center" c="dimmed">
            Déjà un compte ? <Anchor component={Link} href="/login">Se connecter</Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}

/** Confirmation screen after a successful signup (202). `email` is the real address. */
function VerificationSent({ email }: { email: string }) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    setError(null);
    setSending(true);
    try {
      await resendVerification(email);
      setDone(true);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Renvoi impossible.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl" maw={520} mx="auto" ta="center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-2xl">📧</div>
      <Title order={3}>Vérifiez votre email</Title>
      <Text c="dimmed" mt="sm">
        Nous avons envoyé un lien de vérification à <b>{maskEmail(email)}</b>. Cliquez sur le lien pour
        activer votre école. Pensez à vérifier vos spams.
      </Text>
      {error && <Alert color="red" variant="light" mt="md">{error}</Alert>}
      {done && <Alert color="green" variant="light" mt="md">Email renvoyé.</Alert>}
      <Stack mt="lg" gap="sm">
        <Button variant="secondary" loading={sending} disabled={cooldown > 0} onClick={resend}>
          {cooldown > 0 ? `Renvoyer l'email (${cooldown}s)` : "Renvoyer l'email"}
        </Button>
        <Text size="sm" c="dimmed">
          Mauvaise adresse ? <Anchor component={Link} href="/resend-verification">Renvoyer vers un autre email</Anchor>
        </Text>
      </Stack>
    </Paper>
  );
}
