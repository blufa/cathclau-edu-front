"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Anchor, Button, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { forgotPassword } from "@/lib/auth/auth-service";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: { email: "" },
    validate: { email: (v) => (/^\S+@\S+$/.test(v) ? null : "Email invalide") },
  });

  async function handleSubmit(values: { email: string }) {
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
    <Paper withBorder shadow="sm" radius="lg" p="xl">
      <Title order={3} mb="md">
        Mot de passe oublié
      </Title>
      {done ? (
        <Stack gap="md">
          <Alert color="green" variant="light">
            Si un compte existe pour cette adresse, un lien de réinitialisation vous a été envoyé.
          </Alert>
          <Anchor component={Link} href="/login" size="sm">
            ← Retour à la connexion
          </Anchor>
        </Stack>
      ) : (
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Saisissez votre email pour recevoir un lien de réinitialisation.
            </Text>
            <TextInput
              label="Email"
              autoComplete="email"
              withAsterisk
              {...form.getInputProps("email")}
              key={form.key("email")}
            />
            <Button type="submit" loading={loading} fullWidth>
              Envoyer le lien
            </Button>
            <Anchor component={Link} href="/login" ta="center" size="sm">
              Retour à la connexion
            </Anchor>
          </Stack>
        </form>
      )}
    </Paper>
  );
}
