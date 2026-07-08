"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Anchor, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/public/reveal";
import { AuroraBackground, Spotlight } from "@/components/ui/aceternity";
import { resendVerification } from "@/lib/api/platform";
import { ApiError } from "@/lib/api/errors";

export default function ResendVerificationPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: { email: "" },
    validate: { email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Email invalide") },
  });

  async function handleSubmit({ email }: { email: string }) {
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
          <Title order={3}>Renvoyer l&apos;email de vérification</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Saisissez l&apos;email du directeur utilisé lors de l&apos;inscription.
          </Text>

          {sent ? (
            <Alert color="green" variant="light" mt="lg">
              Si un compte en attente existe pour cet email, un nouveau lien vient d&apos;être envoyé.
            </Alert>
          ) : (
            <form onSubmit={form.onSubmit(handleSubmit)}>
              <Stack gap="md" mt="lg">
                {error && <Alert color="red" variant="light">{error}</Alert>}
                <TextInput label="Email" withAsterisk {...form.getInputProps("email")} key={form.key("email")} />
                <Button type="submit" loading={loading} fullWidth>Renvoyer le lien</Button>
              </Stack>
            </form>
          )}

          <Text size="sm" ta="center" c="dimmed" mt="lg">
            <Anchor component={Link} href="/login">Retour à la connexion</Anchor>
          </Text>
        </div>
      </Reveal>
    </AuroraBackground>
  );
}
