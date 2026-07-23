"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
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
            <div className="flex flex-col items-center gap-4">
              <Spinner />
              <p className="text-gray-500">Vérification de votre email…</p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <CheckCircle2 className="h-8 w-8" strokeWidth={1.8} />
              </span>
              <h3 className="text-lg font-semibold text-gray-900">Votre école est active</h3>
              <p className="text-gray-500">Vous pouvez maintenant vous connecter et commencer votre essai gratuit.</p>
              <Button component={Link} href="/login" className="mt-1">Se connecter</Button>
            </div>
          )}

          {state === "expired" && (
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Clock className="h-8 w-8" strokeWidth={1.8} />
              </span>
              <h3 className="text-lg font-semibold text-gray-900">Lien expiré</h3>
              <p className="text-gray-500">Ce lien de vérification n&apos;est plus valide.</p>
              <Button component={Link} href="/resend-verification" className="mt-1">Renvoyer un lien</Button>
            </div>
          )}

          {state === "invalid" && (
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <XCircle className="h-8 w-8" strokeWidth={1.8} />
              </span>
              <h3 className="text-lg font-semibold text-gray-900">Lien invalide</h3>
              <p className="text-gray-500">Ce lien de vérification est introuvable ou a déjà été utilisé.</p>
              <Button component={Link} href="/login" variant="secondary" className="mt-1">Aller à la connexion</Button>
            </div>
          )}

          {state === "error" && (
            <Alert tone="red">Une erreur est survenue lors de la vérification. Réessayez plus tard.</Alert>
          )}
        </div>
      </Reveal>
    </AuroraBackground>
  );
}
