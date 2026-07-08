"use client";

import { useState } from "react";
import { PasswordInput, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Check, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { changePassword } from "@/lib/auth/auth-service";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/public/reveal";
import { notifyError, notifySuccess } from "@/lib/feedback";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super administrateur",
  SCHOOL_ADMIN: "Administrateur école",
  DIRECTOR: "Directeur",
  ACCOUNTANT: "Comptable",
  SECRETARY: "Secrétaire",
  TEACHER: "Enseignant",
  PARENT: "Parent",
  STUDENT: "Élève",
};
const roleLabel = (r: string) => ROLE_LABEL[r.replace(/^ROLE_/, "")] ?? r;

const RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "Au moins 8 caractères", test: (v) => v.length >= 8 },
  { label: "Une majuscule", test: (v) => /[A-Z]/.test(v) },
  { label: "Une minuscule", test: (v) => /[a-z]/.test(v) },
  { label: "Un chiffre", test: (v) => /\d/.test(v) },
];

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default function AccountPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    mode: "controlled",
    initialValues: { currentPassword: "", newPassword: "", confirm: "" },
    validate: {
      currentPassword: (v) => (v ? null : "Mot de passe actuel requis"),
      newPassword: (v) =>
        RULES.every((r) => r.test(v)) ? null : "Le mot de passe ne respecte pas les règles",
      confirm: (v, values) => (v === values.newPassword ? null : "Les mots de passe ne correspondent pas"),
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setLoading(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      notifySuccess("Mot de passe mis à jour");
      form.reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        form.setFieldError("currentPassword", "Mot de passe actuel incorrect");
      } else {
        notifyError(err);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mon compte</h1>
        <p className="text-sm text-slate-500">Profil, rôles et sécurité</p>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Reveal y={12}>
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
                  {(user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")}
                </span>
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4">
                <Info label="Téléphone" value={user.phone} />
                <Info label="École (tenant)" value={user.tenantId ?? "Plateforme"} />
              </dl>
              <div>
                <p className="mb-1.5 text-xs text-slate-500">Rôles</p>
                <div className="flex flex-wrap gap-2">
                  {user.roles.length === 0 ? (
                    <span className="text-sm text-slate-400">Aucun</span>
                  ) : (
                    user.roles.map((r) => (
                      <Badge key={r} tone="indigo">
                        {roleLabel(r)}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-slate-500">Permissions ({user.permissions.length})</p>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {user.permissions.map((p) => (
                    <span
                      key={p}
                      className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </Reveal>

        {/* Change password */}
        <Reveal y={12} delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand-600" /> Changer le mot de passe
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="md">
                  <PasswordInput
                    label="Mot de passe actuel"
                    autoComplete="current-password"
                    withAsterisk
                    {...form.getInputProps("currentPassword")}
                  />
                  <PasswordInput
                    label="Nouveau mot de passe"
                    autoComplete="new-password"
                    withAsterisk
                    {...form.getInputProps("newPassword")}
                  />
                  {/* Live complexity rules */}
                  <ul className="space-y-1">
                    {RULES.map((r) => {
                      const ok = r.test(form.values.newPassword);
                      return (
                        <li key={r.label} className="flex items-center gap-2 text-xs">
                          {ok ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                          ) : (
                            <X className="h-3.5 w-3.5 text-slate-300" strokeWidth={3} />
                          )}
                          <span className={ok ? "text-emerald-700" : "text-slate-400"}>{r.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <PasswordInput
                    label="Confirmer le nouveau mot de passe"
                    autoComplete="new-password"
                    withAsterisk
                    {...form.getInputProps("confirm")}
                  />
                  <Button type="submit" loading={loading} fullWidth>
                    Mettre à jour
                  </Button>
                </Stack>
              </form>
            </CardBody>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
