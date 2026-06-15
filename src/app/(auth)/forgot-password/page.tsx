"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/auth/auth-service";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
    } finally {
      // Always report success: the endpoint is intentionally non-revealing about account existence.
      setDone(true);
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
      </CardHeader>
      <CardBody>
        {done ? (
          <div className="space-y-4">
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Si un compte existe pour cette adresse, un lien de réinitialisation vous a été envoyé.
            </p>
            <Link href="/login" className="text-sm text-indigo-600 hover:underline">
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              Saisissez votre email pour recevoir un lien de réinitialisation.
            </p>
            <Field>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={loading} className="w-full">
              Envoyer le lien
            </Button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-indigo-600 hover:underline">
                Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
