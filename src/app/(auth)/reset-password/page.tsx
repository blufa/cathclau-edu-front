"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Anchor, Button, Paper, PasswordInput, Stack, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { resetPassword } from "@/lib/auth/auth-service";
import { ApiError } from "@/lib/api/errors";
import { notifySuccess } from "@/lib/feedback";

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: { password: "", confirm: "" },
    validate: {
      password: (v) => (v.length >= 8 ? null : "Au moins 8 caractères"),
      confirm: (v, values) => (v === values.password ? null : "Les mots de passe ne correspondent pas"),
    },
  });

  async function handleSubmit(values: { password: string; confirm: string }) {
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
      <Paper withBorder shadow="sm" radius="lg" p="xl">
        <Alert color="red" variant="light">
          Lien de réinitialisation invalide ou expiré.
        </Alert>
        <Anchor component={Link} href="/forgot-password" size="sm" mt="md" display="inline-block">
          Demander un nouveau lien
        </Anchor>
      </Paper>
    );
  }

  return (
    <Paper withBorder shadow="sm" radius="lg" p="xl">
      <Title order={3} mb="md">
        Nouveau mot de passe
      </Title>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}
          <PasswordInput
            label="Nouveau mot de passe"
            autoComplete="new-password"
            withAsterisk
            {...form.getInputProps("password")}
            key={form.key("password")}
          />
          <PasswordInput
            label="Confirmer le mot de passe"
            autoComplete="new-password"
            withAsterisk
            {...form.getInputProps("confirm")}
            key={form.key("confirm")}
          />
          <Button type="submit" loading={loading} fullWidth>
            Réinitialiser
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
