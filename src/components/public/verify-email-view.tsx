"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Stack, Text, Title } from "@mantine/core";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { AuroraBackground, Spotlight } from "@/components/ui/aceternity";
import { verifyEmail } from "@/lib/api/platform";
import { ApiError } from "@/lib/api/errors";

type State = "loading" | "success" | "expired" | "invalid" | "error";

export function VerifyEmailView() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // verify once (idempotent server-side, but avoid double-calls)
    ran.current = true;

    void (async () => {
      if (!token) {
        setState("invalid");
        return;
      }
      try {
        await verifyEmail(token);
        setState("success");
      } catch (err) {
        if (err instanceof ApiError && err.status === 422) setState("expired");
        else if (err instanceof ApiError && err.status === 404) setState("invalid");
        else setState("error");
      }
    })();
  }, [token]);

  return (
    <AuroraBackground className="min-h-[70vh] px-4 py-20">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#99f6e4" />
      <Reveal className="relative z-10 mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-xl ring-1 ring-slate-900/[0.03] backdrop-blur">
          {state === "loading" && (
            <Stack align="center" gap="md">
              <Spinner />
              <Text c="dimmed">Vérification de votre email…</Text>
            </Stack>
          )}

          {state === "success" && (
            <Stack align="center" gap="sm">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <CheckCircle2 className="h-8 w-8" strokeWidth={1.8} />
              </span>
              <Title order={3}>Votre école est active</Title>
              <Text c="dimmed">Vous pouvez maintenant vous connecter et commencer votre essai gratuit.</Text>
              <Button component={Link} href="/login" mt="sm">Se connecter</Button>
            </Stack>
          )}

          {state === "expired" && (
            <Stack align="center" gap="sm">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Clock className="h-8 w-8" strokeWidth={1.8} />
              </span>
              <Title order={3}>Lien expiré</Title>
              <Text c="dimmed">Ce lien de vérification n&apos;est plus valide.</Text>
              <Button component={Link} href="/resend-verification" mt="sm">Renvoyer un lien</Button>
            </Stack>
          )}

          {state === "invalid" && (
            <Stack align="center" gap="sm">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <XCircle className="h-8 w-8" strokeWidth={1.8} />
              </span>
              <Title order={3}>Lien invalide</Title>
              <Text c="dimmed">Ce lien de vérification est introuvable ou a déjà été utilisé.</Text>
              <Button component={Link} href="/login" variant="secondary" mt="sm">Aller à la connexion</Button>
            </Stack>
          )}

          {state === "error" && (
            <Alert color="red" variant="light">
              Une erreur est survenue lors de la vérification. Réessayez plus tard.
            </Alert>
          )}
        </div>
      </Reveal>
    </AuroraBackground>
  );
}
