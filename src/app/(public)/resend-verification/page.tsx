"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Reveal } from "@/components/public/reveal";
import { AuroraBackground, Spotlight } from "@/components/ui/aceternity";
import { resendVerification } from "@/lib/api/platform";
import { ApiError } from "@/lib/api/errors";

const schema = z.object({ email: z.string().regex(/^\S+@\S+\.\S+$/, "Email invalide") });
type FormValues = z.infer<typeof schema>;

export default function ResendVerificationPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit({ email }: FormValues) {
    setError(null);
    setLoading(true);
    try {
      await resendVerification(email);
      setSent(true);
    } catch (err) {
      // Avoid leaking which emails exist: a 404/422 still shows a neutral confirmation.
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) setSent(true);
      else setError(err instanceof ApiError ? err.userMessage : "Renvoi impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuroraBackground className="min-h-[70vh] px-4 py-20">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#99f6e4" />
      <Reveal className="relative z-10 mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-xl ring-1 ring-slate-900/[0.03] backdrop-blur">
          <h3 className="text-lg font-semibold text-gray-900">Renvoyer l&apos;email de vérification</h3>
          <p className="mt-1 text-sm text-gray-500">Saisissez l&apos;email du directeur utilisé lors de l&apos;inscription.</p>

          {sent ? (
            <Alert tone="green" className="mt-6">
              Si un compte en attente existe pour cet email, un nouveau lien vient d&apos;être envoyé.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              {error && <Alert tone="red">{error}</Alert>}
              <Field>
                <Label htmlFor="email">
                  Email <span className="text-error-500">*</span>
                </Label>
                <Input id="email" aria-invalid={!!errors.email} {...register("email")} />
                {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
              </Field>
              <Button type="submit" loading={loading} fullWidth>
                Renvoyer le lien
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/login" className="font-medium text-brand-700 hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </div>
      </Reveal>
    </AuroraBackground>
  );
}
