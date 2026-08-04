"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, PasswordInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneInput } from "@/components/ui/phone-input";
import { Stepper } from "@/components/ui/stepper";
import { Alert } from "@/components/ui/alert";
import { getSchoolBranding, resendVerification, signup } from "@/lib/api/platform";
import { ApiError } from "@/lib/api/errors";
import { maskEmail, slugify } from "@/lib/platform-utils";
import { phoneRule } from "@/lib/phone";
import { ESTABLISHMENT_TYPE_LABEL } from "@/lib/platform-labels";
import { ESTABLISHMENT_TYPES, type EstablishmentType } from "@/lib/types/platform";

const COUNTRIES = ["Guinée", "Sénégal", "Côte d'Ivoire", "Mali", "Burkina Faso", "Bénin", "Togo"];
const RESEND_COOLDOWN = 60;

type SlugState = "idle" | "checking" | "available" | "taken";

const schema = z
  .object({
    nomEcole: z.string().trim().min(2, "Nom de l'école requis"),
    slug: z.string().regex(/^[a-z0-9-]{2,}$/, "Adresse invalide (minuscules, chiffres, tirets)"),
    ville: z.string(),
    pays: z.string(),
    typesEtablissement: z.array(z.string()).min(1, "Choisissez au moins un type"),
    directeur: z.string(),
    prenomAdmin: z.string().trim().min(2, "Prénom requis"),
    nomAdmin: z.string().trim().min(2, "Nom requis"),
    username: z.string().regex(/^[a-zA-Z0-9._-]{3,}$/, "Identifiant : 3 caractères min. (lettres, chiffres, . _ -)"),
    telephoneAdmin: z.string(),
    emailDirecteur: z.string(),
    password: z.string(),
    confirm: z.string(),
    cgu: z.boolean(),
  })
  .superRefine((v, ctx) => {
    // Email FACULTATIF : validé seulement s'il est saisi.
    if (v.emailDirecteur && !/^\S+@\S+\.\S+$/.test(v.emailDirecteur)) {
      ctx.addIssue({ code: "custom", path: ["emailDirecteur"], message: "Email invalide" });
    }
    const phoneError = phoneRule(v.telephoneAdmin);
    if (phoneError) ctx.addIssue({ code: "custom", path: ["telephoneAdmin"], message: phoneError });
    if (!(v.password.length >= 8 && /[A-Za-z]/.test(v.password) && /[0-9]/.test(v.password))) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "8 caractères min., avec lettres et chiffres" });
    }
    if (v.confirm !== v.password) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Les mots de passe ne correspondent pas" });
    }
    if (!v.cgu) ctx.addIssue({ code: "custom", path: ["cgu"], message: "Vous devez accepter les CGU" });
  });
type FormValues = z.infer<typeof schema>;

// Champs validés avant de passer à l'étape suivante.
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

  const {
    handleSubmit, watch, setValue, setError, trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nomEcole: "", slug: "", ville: "", pays: "Guinée",
      typesEtablissement: ["PRIMAIRE"], directeur: "",
      prenomAdmin: "", nomAdmin: "", username: "", telephoneAdmin: "",
      emailDirecteur: "", password: "", confirm: "", cgu: false,
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  // Slug dérivé du nom de l'école tant qu'il n'est pas édité à la main.
  useEffect(() => {
    if (!slugEdited) setValue("slug", slugify(v.nomEcole));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.nomEcole, slugEdited]);

  // Disponibilité du slug en direct (branding 200 = pris, 404 = libre).
  useEffect(() => {
    if (!/^[a-z0-9-]{2,}$/.test(v.slug)) {
      const id = setTimeout(() => setSlugState("idle"), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(async () => {
      setSlugState("checking");
      try {
        await getSchoolBranding(v.slug);
        setSlugState("taken");
      } catch (err) {
        setSlugState(err instanceof ApiError && err.status === 404 ? "available" : "idle");
      }
    }, 450);
    return () => clearTimeout(id);
  }, [v.slug]);

  async function nextStep() {
    const ok = await trigger(STEP0_FIELDS);
    if (!ok || slugState === "taken") {
      if (slugState === "taken") setError("slug", { message: "Cette adresse est déjà prise" });
      return;
    }
    setActive(1);
  }
  const prevStep = () => setActive(0);

  async function onSubmit(values: FormValues) {
    if (active === 0) { void nextStep(); return; }
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
        typesEtablissement: values.typesEtablissement as EstablishmentType[],
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
        if (msg.includes("slug")) { setActive(0); setError("slug", { message: "Cette adresse est déjà prise" }); }
        else if (msg.includes("email")) setError("emailDirecteur", { message: "Un compte existe déjà pour cet email" });
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
    checking: <p className="text-xs text-gray-500">Vérification…</p>,
    available: <p className="text-xs text-green-600">✓ Disponible</p>,
    taken: <p className="text-xs text-red-600">Déjà pris</p>,
  }[slugState];

  function toggleType(type: EstablishmentType) {
    const set = new Set(v.typesEtablissement);
    if (set.has(type)) set.delete(type);
    else set.add(type);
    setValue("typesEtablissement", [...set]);
  }

  return (
    <div className="mx-auto max-w-[600px] rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Créer mon école</h3>
      <p className="mt-1 text-sm text-gray-500">
        Essai gratuit de 30 jours{plan ? ` · plan ${plan}` : ""}. Aucune carte bancaire requise.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
        {serverError && <Alert tone="red" className="mb-4">{serverError}</Alert>}

        <Stepper steps={[{ label: "École" }, { label: "Compte" }]} active={active} onStepClick={setActive} />

        {/* Étape 1 — École */}
        {active === 0 && (
          <div className="space-y-4 pt-5">
            <Field>
              <Label htmlFor="nomEcole">
                Nom de l&apos;école <span className="text-error-500">*</span>
              </Label>
              <Input id="nomEcole" value={v.nomEcole} onChange={(e) => setValue("nomEcole", e.target.value)} aria-invalid={!!errors.nomEcole} />
              {errors.nomEcole && <p className="text-xs text-error-600">{errors.nomEcole.message}</p>}
            </Field>
            <Field>
              <Label htmlFor="slug">
                Adresse (URL de connexion) <span className="text-error-500">*</span>
              </Label>
              <p className="mb-1 text-xs text-gray-500">Ex. votre-ecole → votre-ecole se connecte à la plateforme</p>
              <Input
                id="slug"
                value={v.slug}
                onChange={(e) => { setSlugEdited(true); setValue("slug", slugify(e.target.value)); }}
                aria-invalid={!!errors.slug}
              />
              {errors.slug && <p className="text-xs text-error-600">{errors.slug.message}</p>}
              {slugHint}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="ville">Ville</Label>
                <Input id="ville" value={v.ville} onChange={(e) => setValue("ville", e.target.value)} />
              </Field>
              <Field>
                <Label htmlFor="pays">Pays</Label>
                <Select id="pays" value={v.pays} onChange={(e) => setValue("pays", e.target.value)}>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field>
              <Label>Types d&apos;établissement</Label>
              <p className="mb-2 text-xs text-gray-500">
                Une école peut cumuler plusieurs cycles (primaire, collège, lycée…)
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {ESTABLISHMENT_TYPES.map((t) => (
                  <Checkbox
                    key={t}
                    label={ESTABLISHMENT_TYPE_LABEL[t]}
                    checked={v.typesEtablissement.includes(t)}
                    onChange={() => toggleType(t)}
                  />
                ))}
              </div>
            </Field>
            <Field>
              <Label htmlFor="directeur">Nom du directeur (optionnel)</Label>
              <Input id="directeur" value={v.directeur} onChange={(e) => setValue("directeur", e.target.value)} />
            </Field>
          </div>
        )}

        {/* Étape 2 — Compte administrateur */}
        {active === 1 && (
          <div className="space-y-4 pt-5">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="prenomAdmin">
                  Prénom <span className="text-error-500">*</span>
                </Label>
                <Input id="prenomAdmin" value={v.prenomAdmin} onChange={(e) => setValue("prenomAdmin", e.target.value)} aria-invalid={!!errors.prenomAdmin} />
                {errors.prenomAdmin && <p className="text-xs text-error-600">{errors.prenomAdmin.message}</p>}
              </Field>
              <Field>
                <Label htmlFor="nomAdmin">
                  Nom <span className="text-error-500">*</span>
                </Label>
                <Input id="nomAdmin" value={v.nomAdmin} onChange={(e) => setValue("nomAdmin", e.target.value)} aria-invalid={!!errors.nomAdmin} />
                {errors.nomAdmin && <p className="text-xs text-error-600">{errors.nomAdmin.message}</p>}
              </Field>
            </div>
            <Field>
              <Label htmlFor="username">
                Identifiant de connexion <span className="text-error-500">*</span>
              </Label>
              <p className="mb-1 text-xs text-gray-500">
                Vous vous connecterez avec cet identifiant (ou votre email s&apos;il est renseigné)
              </p>
              <Input id="username" value={v.username} onChange={(e) => setValue("username", e.target.value)} aria-invalid={!!errors.username} />
              {errors.username && <p className="text-xs text-error-600">{errors.username.message}</p>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Téléphone</Label>
                <PhoneInput value={v.telephoneAdmin} onChange={(val) => setValue("telephoneAdmin", val)} error={errors.telephoneAdmin?.message} />
              </Field>
              <Field>
                <Label htmlFor="emailDirecteur">Email (optionnel)</Label>
                <Input id="emailDirecteur" type="email" value={v.emailDirecteur} onChange={(e) => setValue("emailDirecteur", e.target.value)} aria-invalid={!!errors.emailDirecteur} />
                {errors.emailDirecteur && <p className="text-xs text-error-600">{errors.emailDirecteur.message}</p>}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="password">
                  Mot de passe <span className="text-error-500">*</span>
                </Label>
                <PasswordInput id="password" value={v.password} onChange={(e) => setValue("password", e.target.value)} aria-invalid={!!errors.password} />
                {errors.password && <p className="text-xs text-error-600">{errors.password.message}</p>}
              </Field>
              <Field>
                <Label htmlFor="confirm">
                  Confirmation <span className="text-error-500">*</span>
                </Label>
                <PasswordInput id="confirm" value={v.confirm} onChange={(e) => setValue("confirm", e.target.value)} aria-invalid={!!errors.confirm} />
                {errors.confirm && <p className="text-xs text-error-600">{errors.confirm.message}</p>}
              </Field>
            </div>
            <div>
              <Checkbox
                label="J'accepte les conditions générales d'utilisation"
                checked={v.cgu}
                onChange={(e) => setValue("cgu", e.target.checked)}
              />
              {errors.cgu && <p className="mt-1 text-xs text-error-600">{errors.cgu.message}</p>}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          {active === 1 ? (
            <Button type="button" variant="secondary" onClick={prevStep} disabled={loading}>Précédent</Button>
          ) : <span />}
          {active === 0 ? (
            <Button type="button" onClick={nextStep} disabled={slugState === "taken"}>Continuer</Button>
          ) : (
            <Button type="submit" loading={loading}>Créer mon école</Button>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          Déjà un compte ? <Link href="/login" className="font-medium text-brand-700 hover:underline">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}

/** École active immédiatement (sans vérification email) → invite à se connecter. */
function SignupSuccess({ username }: { username: string }) {
  return (
    <div className="mx-auto max-w-[520px] rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">✅</div>
      <h3 className="text-lg font-semibold text-gray-900">Votre école est créée</h3>
      <p className="mt-2 text-gray-500">
        Connectez-vous avec votre identifiant <b>{username}</b> (ou votre email) et votre mot de passe pour
        commencer à gérer votre établissement.
      </p>
      <div className="mt-6">
        <Button component={Link} href="/login">Se connecter</Button>
      </div>
    </div>
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
    <div className="mx-auto max-w-[520px] rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-2xl">📧</div>
      <h3 className="text-lg font-semibold text-gray-900">Vérifiez votre email</h3>
      <p className="mt-2 text-gray-500">
        Nous avons envoyé un lien de vérification à <b>{maskEmail(email)}</b>. Cliquez sur le lien pour
        activer votre école. Pensez à vérifier vos spams.
      </p>
      {error && <Alert tone="red" className="mt-4">{error}</Alert>}
      {done && <Alert tone="green" className="mt-4">Email renvoyé.</Alert>}
      <div className="mt-6 space-y-3">
        <Button variant="secondary" loading={sending} disabled={cooldown > 0} onClick={resend} fullWidth>
          {cooldown > 0 ? `Renvoyer l'email (${cooldown}s)` : "Renvoyer l'email"}
        </Button>
        <p className="text-sm text-gray-500">
          Mauvaise adresse ?{" "}
          <Link href="/resend-verification" className="font-medium text-brand-700 hover:underline">
            Renvoyer vers un autre email
          </Link>
        </p>
      </div>
    </div>
  );
}
