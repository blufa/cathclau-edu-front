"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api/errors";
import { roleHome } from "@/lib/auth/role-access";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, PasswordInput } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const schema = z.object({
  email: z.string().trim().min(1, "Email, identifiant ou téléphone requis"),
  password: z.string().min(1, "Mot de passe requis"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Success banner after the e-mail activation link redirects here (?verified=1).
  const [verified] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("verified") === "1",
  );
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: FormValues) {
    setError(null);
    setLoading(true);
    try {
      const me = await login(values.email, values.password);
      router.replace(roleHome(me));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "Email ou mot de passe incorrect." : err.userMessage);
      } else {
        setError("Connexion impossible. Vérifiez votre réseau.");
      }
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h3 className="text-xl font-bold tracking-tight text-gray-900">Connexion</h3>
        <p className="mt-1 text-sm text-gray-500">Heureux de vous revoir — accédez à votre espace.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {verified && <Alert tone="brand">Votre e-mail est vérifié et votre école activée. Connectez-vous pour accéder à votre tableau de bord.</Alert>}
        {error && <Alert tone="red">{error}</Alert>}
        <Field>
          <Label htmlFor="email">
            Email, identifiant ou téléphone <span className="text-error-500">*</span>
          </Label>
          <Input
            id="email"
            placeholder="email, identifiant ou numéro de téléphone"
            autoComplete="username"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
        </Field>
        <Field>
          <Label htmlFor="password">
            Mot de passe <span className="text-error-500">*</span>
          </Label>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && <p className="text-xs text-error-600">{errors.password.message}</p>}
        </Field>
        <Button type="submit" loading={loading} fullWidth size="lg" className="shadow-lg shadow-brand-500/20">
          Se connecter
        </Button>
        <Link href="/forgot-password" className="block text-center text-sm font-medium text-brand-700 hover:underline">
          Mot de passe oublié ?
        </Link>
      </form>
    </>
  );
}
