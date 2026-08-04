"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { changePassword } from "@/lib/auth/auth-service";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
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
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

const schema = z
  .object({ currentPassword: z.string().min(1, "Mot de passe actuel requis"), newPassword: z.string(), confirm: z.string() })
  .superRefine((v, ctx) => {
    if (!RULES.every((r) => r.test(v.newPassword))) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Le mot de passe ne respecte pas les règles" });
    }
    if (v.confirm !== v.newPassword) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Les mots de passe ne correspondent pas" });
    }
  });
type FormValues = z.infer<typeof schema>;

export default function AccountPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const { handleSubmit, watch, setValue, setError, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: FormValues) {
    setLoading(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      notifySuccess("Mot de passe mis à jour");
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError("currentPassword", { message: "Mot de passe actuel incorrect" });
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mon compte</h1>
        <p className="text-sm text-gray-500">Profil, rôles et sécurité</p>
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
                  <p className="text-lg font-semibold text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4">
                <Info label="Téléphone" value={user.phone} />
                <Info label="École (tenant)" value={user.tenantId ?? "Plateforme"} />
              </dl>
              <div>
                <p className="mb-1.5 text-xs text-gray-500">Rôles</p>
                <div className="flex flex-wrap gap-2">
                  {user.roles.length === 0 ? (
                    <span className="text-sm text-gray-400">Aucun</span>
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
                <p className="mb-1.5 text-xs text-gray-500">Permissions ({user.permissions.length})</p>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {user.permissions.map((p) => (
                    <span
                      key={p}
                      className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-600"
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
              <form onSubmit={handleSubmit(submit)} className="space-y-4">
                <Field>
                  <Label>Mot de passe actuel <span className="text-error-500">*</span></Label>
                  <Input type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setValue("currentPassword", e.target.value)} aria-invalid={!!errors.currentPassword} />
                  {errors.currentPassword && <p className="text-xs text-error-600">{errors.currentPassword.message}</p>}
                </Field>
                <Field>
                  <Label>Nouveau mot de passe <span className="text-error-500">*</span></Label>
                  <Input type="password" autoComplete="new-password" value={v.newPassword} onChange={(e) => setValue("newPassword", e.target.value)} aria-invalid={!!errors.newPassword} />
                </Field>
                {/* Live complexity rules */}
                <ul className="space-y-1">
                  {RULES.map((r) => {
                    const ok = r.test(v.newPassword);
                    return (
                      <li key={r.label} className="flex items-center gap-2 text-xs">
                        {ok ? (
                          <Check className="h-3.5 w-3.5 text-success-600" strokeWidth={3} />
                        ) : (
                          <X className="h-3.5 w-3.5 text-gray-300" strokeWidth={3} />
                        )}
                        <span className={ok ? "text-success-700" : "text-gray-400"}>{r.label}</span>
                      </li>
                    );
                  })}
                </ul>
                <Field>
                  <Label>Confirmer le nouveau mot de passe <span className="text-error-500">*</span></Label>
                  <Input type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setValue("confirm", e.target.value)} aria-invalid={!!errors.confirm} />
                  {errors.confirm && <p className="text-xs text-error-600">{errors.confirm.message}</p>}
                </Field>
                <Button type="submit" loading={loading} fullWidth>
                  Mettre à jour
                </Button>
              </form>
            </CardBody>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
