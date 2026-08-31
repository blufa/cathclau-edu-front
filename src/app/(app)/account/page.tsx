"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Pencil, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { changePassword } from "@/lib/auth/auth-service";
import { getMyParent, updateMyParentProfile, updateMyParentPhoto } from "@/lib/api/parents";
import { getMyStudent, updateMyStudentProfile, updateMyStudentPhoto } from "@/lib/api/students";
import { updateMyTeacherProfile, updateMyTeacherPhoto } from "@/lib/api/staff";
import { updateMyUserProfile, updateMyUserPhoto } from "@/lib/api/iam";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { FileUpload } from "@/components/ui/file-upload";
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
  REDACTEUR: "Rédacteur",
};
const roleLabel = (r: string) => ROLE_LABEL[r.replace(/^ROLE_/, "")] ?? r;
const bareRoles = (roles: string[]) => roles.map((r) => r.replace(/^ROLE_/, ""));

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

const passwordSchema = z
  .object({ currentPassword: z.string().min(1, "Mot de passe actuel requis"), newPassword: z.string(), confirm: z.string() })
  .superRefine((v, ctx) => {
    if (!RULES.every((r) => r.test(v.newPassword))) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Le mot de passe ne respecte pas les règles" });
    }
    if (v.confirm !== v.newPassword) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Les mots de passe ne correspondent pas" });
    }
  });
type PasswordFormValues = z.infer<typeof passwordSchema>;

const profileSchema = z.object({
  phone: z.string(),
  address: z.string(),
  occupation: z.string(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  const roles = useMemo(() => bareRoles(user?.roles ?? []), [user?.roles]);
  const isParent = roles.includes("PARENT");
  const isStudent = roles.includes("STUDENT");
  const isTeacher = roles.includes("TEACHER");
  // Champs éditables selon le rôle : téléphone partout, adresse pour parent/élève, profession pour parent uniquement.
  const showAddress = isParent || isStudent;
  const showOccupation = isParent;

  // La fiche métier (Parent/Élève) porte l'adresse/profession réelles — `AuthUser` ne les expose pas.
  const parentQuery = useQuery(() => (isParent ? getMyParent() : Promise.resolve(null)), [isParent]);
  const studentQuery = useQuery(() => (isStudent ? getMyStudent() : Promise.resolve(null)), [isStudent]);
  const businessAddress = parentQuery.data?.address ?? studentQuery.data?.address ?? "";
  const businessOccupation = parentQuery.data?.occupation ?? "";

  const {
    handleSubmit: handleSubmitPassword, watch: watchPassword, setValue: setPasswordValue,
    setError, reset: resetPassword, formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const pv = watchPassword();

  const {
    handleSubmit: handleSubmitProfile, watch: watchProfile, setValue: setProfileValue,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: { phone: user?.phone ?? "", address: businessAddress, occupation: businessOccupation },
  });
  const fv = watchProfile();

  async function submitPassword(values: PasswordFormValues) {
    setPasswordLoading(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      notifySuccess("Mot de passe mis à jour");
      resetPassword();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError("currentPassword", { message: "Mot de passe actuel incorrect" });
      } else {
        notifyError(err);
      }
    } finally {
      setPasswordLoading(false);
    }
  }

  async function submitProfile(values: ProfileFormValues) {
    setProfileLoading(true);
    try {
      if (isParent) {
        await updateMyParentProfile({ phone: values.phone || null, address: values.address || null, occupation: values.occupation || null });
      } else if (isStudent) {
        await updateMyStudentProfile({ phone: values.phone || null, address: values.address || null });
      } else if (isTeacher) {
        await updateMyTeacherProfile({ phone: values.phone || null });
      } else {
        await updateMyUserProfile({ phone: values.phone || null });
      }
      notifySuccess("Informations mises à jour");
      await refreshUser();
    } catch (err) {
      notifyError(err);
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePhotoChange(url: string | null) {
    if (!url) return;
    setPhotoLoading(true);
    try {
      if (isParent) await updateMyParentPhoto(url);
      else if (isStudent) await updateMyStudentPhoto(url);
      else if (isTeacher) await updateMyTeacherPhoto(url);
      else await updateMyUserPhoto(url);
      notifySuccess("Photo mise à jour");
      await refreshUser();
    } catch (err) {
      notifyError(err);
    } finally {
      setPhotoLoading(false);
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
                {user.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photo} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
                    {(user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")}
                  </span>
                )}
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>

              <FileUpload
                label="Photo de profil"
                value={photoLoading ? undefined : user.photo}
                onChange={handlePhotoChange}
                folder="profile-photos"
                allowCapture
              />

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

        <div className="space-y-6">
          {/* Edit own info */}
          <Reveal y={12}>
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="inline-flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-brand-600" /> Modifier mes informations
                  </span>
                </CardTitle>
              </CardHeader>
              <CardBody>
                <form onSubmit={handleSubmitProfile(submitProfile)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Info label="Nom complet" value={`${user.firstName} ${user.lastName}`} />
                    <Info label="E-mail" value={user.email} />
                  </div>
                  <Field>
                    <Label>Téléphone</Label>
                    <Input value={fv.phone} onChange={(e) => setProfileValue("phone", e.target.value)} />
                  </Field>
                  {showAddress && (
                    <Field>
                      <Label>Adresse</Label>
                      <Input value={fv.address} onChange={(e) => setProfileValue("address", e.target.value)} />
                    </Field>
                  )}
                  {showOccupation && (
                    <Field>
                      <Label>Profession</Label>
                      <Input value={fv.occupation} onChange={(e) => setProfileValue("occupation", e.target.value)} />
                    </Field>
                  )}
                  <Button type="submit" loading={profileLoading} fullWidth>
                    Enregistrer
                  </Button>
                </form>
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
                <form onSubmit={handleSubmitPassword(submitPassword)} className="space-y-4">
                  <Field>
                    <Label>Mot de passe actuel <span className="text-error-500">*</span></Label>
                    <Input type="password" autoComplete="current-password" value={pv.currentPassword} onChange={(e) => setPasswordValue("currentPassword", e.target.value)} aria-invalid={!!passwordErrors.currentPassword} />
                    {passwordErrors.currentPassword && <p className="text-xs text-error-600">{passwordErrors.currentPassword.message}</p>}
                  </Field>
                  <Field>
                    <Label>Nouveau mot de passe <span className="text-error-500">*</span></Label>
                    <Input type="password" autoComplete="new-password" value={pv.newPassword} onChange={(e) => setPasswordValue("newPassword", e.target.value)} aria-invalid={!!passwordErrors.newPassword} />
                  </Field>
                  {/* Live complexity rules */}
                  <ul className="space-y-1">
                    {RULES.map((r) => {
                      const ok = r.test(pv.newPassword);
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
                    <Input type="password" autoComplete="new-password" value={pv.confirm} onChange={(e) => setPasswordValue("confirm", e.target.value)} aria-invalid={!!passwordErrors.confirm} />
                    {passwordErrors.confirm && <p className="text-xs text-error-600">{passwordErrors.confirm.message}</p>}
                  </Field>
                  <Button type="submit" loading={passwordLoading} fullWidth>
                    Mettre à jour
                  </Button>
                </form>
              </CardBody>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
