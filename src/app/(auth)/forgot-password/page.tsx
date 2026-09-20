"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { forgotPassword, requestPasswordResetOtp, resetPasswordWithOtp } from "@/lib/auth/auth-service";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { notifyError } from "@/lib/feedback";

const identifierSchema = z.object({ identifier: z.string().trim().min(1, "Requis") });
type IdentifierValues = z.infer<typeof identifierSchema>;

const codeSchema = z.object({
  code: z.string().trim().length(6, "Code à 6 chiffres"),
  newPassword: z.string().min(8, "8 caractères minimum"),
});
type CodeValues = z.infer<typeof codeSchema>;

/**
 * Réinitialisation par code OTP envoyé par SMS — canal par défaut, car la connexion se fait par
 * numéro de téléphone pour la majorité des utilisateurs (parents, enseignants, personnel). Un lien
 * « Recevoir par email » reste disponible pour ceux qui préfèrent l'ancien flux (lien email).
 */
export default function ForgotPasswordPage() {
  const [mode, setMode] = useState<"otp" | "email">("otp");
  const [step, setStep] = useState<"identifier" | "code" | "done">("identifier");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailDone, setEmailDone] = useState(false);

  const identifierForm = useForm<IdentifierValues>({
    resolver: zodResolver(identifierSchema),
    defaultValues: { identifier: "" },
  });
  const codeForm = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "", newPassword: "" },
  });

  async function submitIdentifier(values: IdentifierValues) {
    setLoading(true);
    try {
      await requestPasswordResetOtp(values.identifier);
    } catch {
      // Toujours avancer : l'endpoint ne révèle jamais si le compte existe.
    } finally {
      setIdentifier(values.identifier);
      setStep("code");
      setLoading(false);
    }
  }

  async function submitCode(values: CodeValues) {
    setLoading(true);
    try {
      await resetPasswordWithOtp(identifier, values.code, values.newPassword);
      setStep("done");
    } catch (err) {
      notifyError(err instanceof ApiError ? err.userMessage : "Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  }

  async function submitEmail(values: { email: string }) {
    setLoading(true);
    try {
      await forgotPassword(values.email);
    } finally {
      setEmailDone(true);
      setLoading(false);
    }
  }

  if (mode === "email") {
    return <EmailForm loading={loading} done={emailDone} onSubmit={submitEmail} onSwitchToOtp={() => setMode("otp")} />;
  }

  return (
    <>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Mot de passe oublié</h3>
      {step === "identifier" && (
        <form onSubmit={identifierForm.handleSubmit(submitIdentifier)} className="space-y-4">
          <p className="text-sm text-gray-500">
            Saisissez votre numéro de téléphone (ou votre identifiant) pour recevoir un code par SMS.
          </p>
          <Field>
            <Label htmlFor="identifier">
              Téléphone <span className="text-error-500">*</span>
            </Label>
            <Input id="identifier" autoComplete="tel" aria-invalid={!!identifierForm.formState.errors.identifier}
              {...identifierForm.register("identifier")} />
            {identifierForm.formState.errors.identifier && (
              <p className="text-xs text-error-600">{identifierForm.formState.errors.identifier.message}</p>
            )}
          </Field>
          <Button type="submit" loading={loading} fullWidth>
            Recevoir le code par SMS
          </Button>
          <button type="button" onClick={() => setMode("email")} className="block w-full text-center text-sm font-medium text-brand-700 hover:underline">
            Recevoir par email à la place
          </button>
          <Link href="/login" className="block text-center text-sm text-gray-500 hover:underline">
            Retour à la connexion
          </Link>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={codeForm.handleSubmit(submitCode)} className="space-y-4">
          <p className="text-sm text-gray-500">
            Si un compte existe pour « {identifier} », un code à 6 chiffres a été envoyé par SMS (valable 10 min).
          </p>
          <Field>
            <Label htmlFor="code">
              Code reçu par SMS <span className="text-error-500">*</span>
            </Label>
            <Input id="code" inputMode="numeric" maxLength={6} aria-invalid={!!codeForm.formState.errors.code}
              {...codeForm.register("code")} />
            {codeForm.formState.errors.code && <p className="text-xs text-error-600">{codeForm.formState.errors.code.message}</p>}
          </Field>
          <Field>
            <Label htmlFor="newPassword">
              Nouveau mot de passe <span className="text-error-500">*</span>
            </Label>
            <Input id="newPassword" type="password" autoComplete="new-password"
              aria-invalid={!!codeForm.formState.errors.newPassword} {...codeForm.register("newPassword")} />
            {codeForm.formState.errors.newPassword && (
              <p className="text-xs text-error-600">{codeForm.formState.errors.newPassword.message}</p>
            )}
          </Field>
          <Button type="submit" loading={loading} fullWidth>
            Changer le mot de passe
          </Button>
          <button type="button" onClick={() => setStep("identifier")} className="block w-full text-center text-sm text-gray-500 hover:underline">
            ← Changer de numéro / renvoyer le code
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <Alert tone="green">Mot de passe modifié. Vous pouvez vous connecter avec le nouveau.</Alert>
          <Link href="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
            ← Retour à la connexion
          </Link>
        </div>
      )}
    </>
  );
}

const emailSchema = z.object({ email: z.string().regex(/^\S+@\S+$/, "Email invalide") });

function EmailForm({ loading, done, onSubmit, onSwitchToOtp }: {
  loading: boolean; done: boolean; onSubmit: (values: { email: string }) => Promise<void>; onSwitchToOtp: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  return (
    <>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Mot de passe oublié</h3>
      {done ? (
        <div className="space-y-4">
          <Alert tone="green">Si un compte existe pour cette adresse, un lien de réinitialisation vous a été envoyé.</Alert>
          <Link href="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
            ← Retour à la connexion
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-gray-500">Saisissez votre email pour recevoir un lien de réinitialisation.</p>
          <Field>
            <Label htmlFor="email">
              Email <span className="text-error-500">*</span>
            </Label>
            <Input id="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
            {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
          </Field>
          <Button type="submit" loading={loading} fullWidth>
            Envoyer le lien
          </Button>
          <button type="button" onClick={onSwitchToOtp} className="block w-full text-center text-sm font-medium text-brand-700 hover:underline">
            Recevoir un code par SMS à la place
          </button>
          <Link href="/login" className="block text-center text-sm text-gray-500 hover:underline">
            Retour à la connexion
          </Link>
        </form>
      )}
    </>
  );
}
