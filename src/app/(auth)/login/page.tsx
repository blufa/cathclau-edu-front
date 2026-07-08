"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Anchor, Button, PasswordInput, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api/errors";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Success banner after the e-mail activation link redirects here (?verified=1).
  const [verified] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("verified") === "1",
  );
  const [loading, setLoading] = useState(false);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: { email: "", password: "" },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : "Email invalide"),
      password: (v) => (v ? null : "Mot de passe requis"),
    },
  });

  async function handleSubmit(values: { email: string; password: string }) {
    setError(null);
    setLoading(true);
    try {
      await login(values.email, values.password);
      router.replace("/dashboard");
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
      <Title order={3} mb="md">
        Connexion
      </Title>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {verified && (
            <Alert color="teal" variant="light">
              Votre e-mail est vérifié et votre école activée. Connectez-vous pour accéder à votre tableau de bord.
            </Alert>
          )}
          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}
          <TextInput
            label="Email"
            placeholder="vous@ecole.com"
            autoComplete="email"
            withAsterisk
            {...form.getInputProps("email")}
            key={form.key("email")}
          />
          <PasswordInput
            label="Mot de passe"
            placeholder="••••••••"
            autoComplete="current-password"
            withAsterisk
            {...form.getInputProps("password")}
            key={form.key("password")}
          />
          <Button type="submit" loading={loading} fullWidth>
            Se connecter
          </Button>
          <Anchor component={Link} href="/forgot-password" ta="center" size="sm">
            Mot de passe oublié ?
          </Anchor>
        </Stack>
      </form>
    </>
  );
}
