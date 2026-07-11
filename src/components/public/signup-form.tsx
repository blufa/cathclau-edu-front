"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Anchor,
  Checkbox,
  Group,
  MultiSelect,
  Select,
  Paper,
  PasswordInput,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSchoolBranding, resendVerification, signup } from "@/lib/api/platform";
import { ApiError } from "@/lib/api/errors";
import { maskEmail, slugify } from "@/lib/platform-utils";
import { phoneRule } from "@/lib/phone";
import { PhoneInput } from "@/components/ui/phone-input";
import { ESTABLISHMENT_TYPE_LABEL } from "@/lib/platform-labels";
import { ESTABLISHMENT_TYPES, type EstablishmentType } from "@/lib/types/platform";

const COUNTRIES = ["Guinée", "Sénégal", "Côte d'Ivoire", "Mali", "Burkina Faso", "Bénin", "Togo"];
const RESEND_COOLDOWN = 60;

// Opérateurs du numéro marchand de reversement (Mobile Money).
const PAYOUT_OPERATORS = [
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MONEY", label: "MTN MoMo" },
  { value: "WAVE", label: "Wave" },
];

type SlugState = "idle" | "checking" | "available" | "taken";

interface FormValues {
  nomEcole: string;
  slug: string;
  ville: string;
  pays: string;
  typesEtablissement: EstablishmentType[];
  directeur: string;
  numeroMarchand: string;
  operateurMarchand: string;
  prenomAdmin: string;
  nomAdmin: string;
  username: string;
  telephoneAdmin: string;
  emailDirecteur: string;
  password: string;
  confirm: string;
  cgu: boolean;
}

// Chaque champ validé et l'étape où il se trouve (pour bloquer le passage à l'étape suivante).
const STEP0_FIELDS = ["nomEcole", "slug"] as const;

export function SignupForm() {
  const params = useSearchParams();
  const plan = params.get("plan") ?? undefined;

  const [active, setActive] = useState(0);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null); // écran vérif email
  const [activated, setActivated] = useState<{ username: string } | null>(null); // écran « connectez-vous »
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [slugEdited, setSlugEdited] = useState(false);

  const form = useForm<FormValues>({
    mode: "controlled",
    initialValues: {
      nomEcole: "", slug: "", ville: "", pays: "Guinée",
      typesEtablissement: ["PRIMAIRE"], directeur: "",
      numeroMarchand: "", operateurMarchand: "ORANGE_MONEY",
      prenomAdmin: "", nomAdmin: "", username: "", telephoneAdmin: "",
      emailDirecteur: "", password: "", confirm: "", cgu: false,
    },
    validate: {
      nomEcole: (v) => (v.trim().length >= 2 ? null : "Nom de l'école requis"),
      slug: (v) => (/^[a-z0-9-]{2,}$/.test(v) ? null : "Adresse invalide (minuscules, chiffres, tirets)"),
      prenomAdmin: (v) => (v.trim().length >= 2 ? null : "Prénom requis"),
      nomAdmin: (v) => (v.trim().length >= 2 ? null : "Nom requis"),
      username: (v) => (/^[a-zA-Z0-9._-]{3,}$/.test(v) ? null : "Identifiant : 3 caractères min. (lettres, chiffres, . _ -)"),
      // Email FACULTATIF : validé seulement s'il est saisi.
      emailDirecteur: (v) => (!v || /^\S+@\S+\.\S+$/.test(v) ? null : "Email invalide"),
      telephoneAdmin: phoneRule,
      password: (v) =>
        v.length >= 8 && /[A-Za-z]/.test(v) && /[0-9]/.test(v) ? null : "8 caractères min., avec lettres et chiffres",
      confirm: (v, values) => (v === values.password ? null : "Les mots de passe ne correspondent pas"),
      cgu: (v) => (v ? null : "Vous devez accepter les CGU"),
    },
  });

  // Slug dérivé du nom de l'école tant qu'il n'est pas édité à la main.
  useEffect(() => {
    if (!slugEdited) form.setFieldValue("slug", slugify(form.values.nomEcole));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.nomEcole, slugEdited]);

  // Disponibilité du slug en direct (branding 200 = pris, 404 = libre).
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

  function nextStep() {
    const errs = STEP0_FIELDS.map((f) => form.validateField(f).hasError);
    if (errs.some(Boolean) || slugState === "taken") {
      if (slugState === "taken") form.setFieldError("slug", "Cette adresse est déjà prise");
      return;
    }
    setActive(1);
  }
  const prevStep = () => setActive(0);

  async function handleSubmit(values: FormValues) {
    if (active === 0) { nextStep(); return; }
    setServerError(null);
    setLoading(true);
    try {
      const result = await signup({
        nomEcole: values.nomEcole,
        slugSouhaite: values.slug,
        emailDirecteur: values.emailDirecteur || undefined,
        username: values.username,
        password: values.password,
        directeur: values.directeur || undefined,
        ville: values.ville || undefined,
        pays: values.pays || undefined,
        typesEtablissement: values.typesEtablissement,
        numeroMarchand: values.numeroMarchand.trim() || undefined,
        operateurMarchand: values.numeroMarchand.trim() ? values.operateurMarchand : undefined,
        planSouhaite: plan,
        prenomAdmin: values.prenomAdmin,
        nomAdmin: values.nomAdmin,
        telephoneAdmin: values.telephoneAdmin || undefined,
      });
      // Si l'école est active tout de suite (pas de vérification email), on invite à se connecter.
      if (result.status === "PENDING_VERIFICATION" && values.emailDirecteur) {
        setSubmittedEmail(values.emailDirecteur);
      } else {
        setActivated({ username: values.username });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const msg = err.userMessage.toLowerCase();
        if (msg.includes("slug")) { setActive(0); form.setFieldError("slug", "Cette adresse est déjà prise"); }
        else if (msg.includes("email")) form.setFieldError("emailDirecteur", "Un compte existe déjà pour cet email");
        else setServerError(err.userMessage);
      } else {
        setServerError(err instanceof ApiError ? err.userMessage : "Inscription impossible. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (submittedEmail) return <VerificationSent email={submittedEmail} />;
  if (activated) return <SignupSuccess username={activated.username} />;

  const slugHint = {
    idle: null,
    checking: <Text size="xs" c="dimmed">Vérification…</Text>,
    available: <Text size="xs" c="green">✓ Disponible</Text>,
    taken: <Text size="xs" c="red">Déjà pris</Text>,
  }[slugState];

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl" maw={600} mx="auto">
      <Title order={3}>Créer mon école</Title>
      <Text size="sm" c="dimmed" mt={4}>
        Essai gratuit de 30 jours{plan ? ` · plan ${plan}` : ""}. Aucune carte bancaire requise.
      </Text>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        {serverError && <Alert color="red" variant="light" mt="md">{serverError}</Alert>}

        <Stepper active={active} onStepClick={setActive} size="sm" color="brand" mt="lg"
          completedIcon={<Check className="h-4 w-4" />}>
          {/* Étape 1 — École */}
          <Stepper.Step label="École" description="Établissement">
            <Stack gap="md" pt="md">
              <TextInput label="Nom de l'école" withAsterisk {...form.getInputProps("nomEcole")} />
              <div>
                <TextInput
                  label="Adresse (URL de connexion)"
                  description="Ex. votre-ecole → votre-ecole se connecte à la plateforme"
                  withAsterisk
                  {...form.getInputProps("slug")}
                  onChange={(e) => { setSlugEdited(true); form.setFieldValue("slug", slugify(e.currentTarget.value)); }}
                />
                {slugHint}
              </div>
              <Group grow>
                <TextInput label="Ville" {...form.getInputProps("ville")} />
                <Select label="Pays" data={COUNTRIES} {...form.getInputProps("pays")} />
              </Group>
              <MultiSelect
                label="Types d'établissement"
                description="Une école peut cumuler plusieurs cycles (primaire, collège, lycée…)"
                data={ESTABLISHMENT_TYPES.map((t) => ({ value: t, label: ESTABLISHMENT_TYPE_LABEL[t] }))}
                {...form.getInputProps("typesEtablissement")}
              />
              <TextInput label="Nom du directeur (optionnel)" {...form.getInputProps("directeur")} />
              <Group grow align="flex-end">
                <TextInput
                  label="Numéro marchand (optionnel)"
                  description="Compte Mobile Money où vous recevrez vos encaissements — modifiable plus tard"
                  placeholder="Ex. 620 00 00 00"
                  inputMode="tel"
                  {...form.getInputProps("numeroMarchand")}
                />
                <Select label="Opérateur" data={PAYOUT_OPERATORS} {...form.getInputProps("operateurMarchand")} />
              </Group>
            </Stack>
          </Stepper.Step>

          {/* Étape 2 — Compte administrateur */}
          <Stepper.Step label="Compte" description="Administrateur">
            <Stack gap="md" pt="md">
              <Group grow>
                <TextInput label="Prénom" withAsterisk {...form.getInputProps("prenomAdmin")} />
                <TextInput label="Nom" withAsterisk {...form.getInputProps("nomAdmin")} />
              </Group>
              <TextInput
                label="Identifiant de connexion"
                description="Vous vous connecterez avec cet identifiant (ou votre email s'il est renseigné)"
                withAsterisk
                {...form.getInputProps("username")}
              />
              <Group grow>
                <PhoneInput label="Téléphone" {...form.getInputProps("telephoneAdmin")} />
                <TextInput label="Email (optionnel)" type="email" {...form.getInputProps("emailDirecteur")} />
              </Group>
              <Group grow>
                <PasswordInput label="Mot de passe" withAsterisk {...form.getInputProps("password")} />
                <PasswordInput label="Confirmation" withAsterisk {...form.getInputProps("confirm")} />
              </Group>
              <Checkbox
                label={<>J&apos;accepte les conditions générales d&apos;utilisation</>}
                {...form.getInputProps("cgu", { type: "checkbox" })}
              />
            </Stack>
          </Stepper.Step>
        </Stepper>

        <Group justify="space-between" mt="xl">
          {active === 1 ? (
            <Button type="button" variant="secondary" onClick={prevStep} disabled={loading}>Précédent</Button>
          ) : <span />}
          {active === 0 ? (
            <Button type="button" onClick={nextStep} disabled={slugState === "taken"}>Continuer</Button>
          ) : (
            <Button type="submit" loading={loading}>Créer mon école</Button>
          )}
        </Group>
        <Text size="sm" ta="center" c="dimmed" mt="md">
          Déjà un compte ? <Anchor component={Link} href="/login">Se connecter</Anchor>
        </Text>
      </form>
    </Paper>
  );
}

/** École active immédiatement (sans vérification email) → invite à se connecter. */
function SignupSuccess({ username }: { username: string }) {
  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl" maw={520} mx="auto" ta="center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">✅</div>
      <Title order={3}>Votre école est créée</Title>
      <Text c="dimmed" mt="sm">
        Connectez-vous avec votre identifiant <b>{username}</b> (ou votre email) et votre mot de passe pour
        commencer à gérer votre établissement.
      </Text>
      <Stack mt="lg" gap="sm">
        <Button component={Link} href="/login">Se connecter</Button>
      </Stack>
    </Paper>
  );
}

/** Écran de confirmation quand une vérification email est requise. */
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
