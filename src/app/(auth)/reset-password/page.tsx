"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "@/lib/auth/auth-service";
import { ApiError } from "@/lib/api/errors";
import { notifySuccess } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Field, Label, PasswordInput } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const schema = z
  .object({
    password: z.string().min(8, "Au moins 8 caractères"),
    confirm: z.string(),
  })
  .refine((v) => v.confirm === v.password, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] });
type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  async function onSubmit(values: FormValues) {
    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, values.password);
      notifySuccess("Mot de passe réinitialisé");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Réinitialisation impossible.");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <>
        <Alert tone="red">Lien de réinitialisation invalide ou expiré.</Alert>
        <Link href="/forgot-password" className="mt-4 block text-sm font-medium text-brand-700 hover:underline">
          Demander un nouveau lien
        </Link>
      </>
    );
  }

  return (
    <>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Nouveau mot de passe</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="red">{error}</Alert>}
        <Field>
          <Label htmlFor="password">
            Nouveau mot de passe <span className="text-error-500">*</span>
          </Label>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          {errors.password && <p className="text-xs text-error-600">{errors.password.message}</p>}
        </Field>
        <Field>
          <Label htmlFor="confirm">
            Confirmer le mot de passe <span className="text-error-500">*</span>
          </Label>
          <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
          {errors.confirm && <p className="text-xs text-error-600">{errors.confirm.message}</p>}
        </Field>
        <Button type="submit" loading={loading} fullWidth>
          Réinitialiser
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
