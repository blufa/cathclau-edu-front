"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { forgotPassword } from "@/lib/auth/auth-service";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const schema = z.object({ email: z.string().regex(/^\S+@\S+$/, "Email invalide") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      await forgotPassword(values.email);
    } finally {
      // Always report success: the endpoint is intentionally non-revealing about account existence.
      setDone(true);
      setLoading(false);
    }
  }

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
          <Link href="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
            Retour à la connexion
          </Link>
        </form>
      )}
    </>
  );
}
