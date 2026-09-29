"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { PhoneInput } from "@/components/ui/phone-input";
import { FileUpload } from "@/components/ui/file-upload";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import { listTeachers, updateEmployeePhoto, type Employee, type EmployeeCategory, type EmployeeInput } from "@/lib/api/staff";
import { createUser } from "@/lib/api/iam";
import { ApiError } from "@/lib/api/errors";
import { notifyError, notifySuccess } from "@/lib/feedback";

export const EMPLOYEE_CATEGORY_LABEL: Record<EmployeeCategory, string> = {
  ADMINISTRATIVE: "Administratif",
  DIRECTION: "Direction",
  SUPPORT: "Personnel de soutien",
};

export function EmployeeForm({
  initial, submitLabel, onSubmit, onCancel,
}: {
  initial?: Employee;
  submitLabel: string;
  onSubmit: (input: EmployeeInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [category, setCategory] = useState<EmployeeCategory>(initial?.category ?? "ADMINISTRATIVE");
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [employeeNumber, setEmployeeNumber] = useState(initial?.employeeNumber ?? "");
  const [hireDate, setHireDate] = useState(initial?.hireDate ?? "");
  const [baseSalary, setBaseSalary] = useState<string>(initial?.baseSalary ? String(initial.baseSalary) : "");
  const [linkedTeacherId, setLinkedTeacherId] = useState<string>(
    initial?.linkedTeacherId != null ? String(initial.linkedTeacherId) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState(initial?.photo ?? "");
  // Sans compte de connexion lié, cette personne n'apparaît jamais dans « Utilisateurs » ni dans la
  // recherche « Personnel de l'école » de la fiche d'inscription — proposé à la création, et aussi en
  // édition tant qu'aucun compte n'est encore lié (voir EmployeeUseCase.UpdateEmployeeCommand#userId).
  const [createLogin, setCreateLogin] = useState(false);
  const [password, setPassword] = useState("");

  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const teachers = teachersQuery.data ?? [];

  async function submit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Le prénom et le nom sont obligatoires.");
      return;
    }
    // La connexion se fait par numéro de téléphone — l'email n'est qu'un canal optionnel
    // supplémentaire. Au moins l'un des deux reste exigé pour créer un accès.
    if (createLogin && !phone.trim() && !email.trim()) {
      setError("Téléphone ou email requis pour créer un accès.");
      return;
    }
    if (createLogin && email.trim() && !/^\S+@\S+$/.test(email)) {
      setError("Email invalide.");
      return;
    }
    if (createLogin && password.length < 6) {
      setError("Mot de passe (6 caractères min.) requis pour créer un accès.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let userId: number | null = null;
      if (createLogin) {
        try {
          const created = await createUser({
            firstName: firstName.trim(), lastName: lastName.trim(),
            email: email.trim() || null, password, phone: phone.trim() || null,
          });
          userId = created.id;
        } catch (err) {
          setError(err instanceof ApiError ? err.userMessage : "Impossible de créer le compte de connexion.");
          setSaving(false);
          return;
        }
      }
      await onSubmit({
        userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        category,
        jobTitle: jobTitle.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        employeeNumber: employeeNumber.trim() || null,
        hireDate: hireDate || null,
        baseSalary: baseSalary === "" ? null : Number(baseSalary),
        // Retirés du formulaire (trop long) — on repasse tels quels pour ne pas écraser une valeur
        // déjà enregistrée : update() côté backend remplace inconditionnellement, sans fusion.
        cnssNumber: initial?.cnssNumber ?? null,
        bankAccount: initial?.bankAccount ?? null,
        linkedTeacherId: linkedTeacherId === "" ? null : Number(linkedTeacherId),
      });
    } finally {
      setSaving(false);
    }
  }

  async function onPhotoChange(url: string | null) {
    setPhoto(url ?? "");
    if (!initial) return; // pas encore d'id : la photo sera ajoutable après création
    try {
      await updateEmployeePhoto(initial.id, url ?? "");
      notifySuccess("Photo mise à jour");
    } catch (e) { notifyError(e); }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600">{error}</p>}
      {initial && (
        <Field>
          <Label>Photo (badge personnel)</Label>
          <FileUpload variant="image" folder="staff/photos" value={photo} onChange={onPhotoChange} />
        </Field>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Prénom <span className="text-error-500">*</span></Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field>
          <Label>Nom <span className="text-error-500">*</span></Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Catégorie</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as EmployeeCategory)}>
            {Object.entries(EMPLOYEE_CATEGORY_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Fonction / poste</Label>
          <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Ex. Comptable, Surveillant…" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PhoneInput label="Téléphone" value={phone} onChange={setPhone} />
        <Field>
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Matricule</Label>
          <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} placeholder="Généré si vide" />
        </Field>
        <Field>
          <Label>Date d&apos;embauche</Label>
          <DatePicker value={hireDate} onChange={setHireDate} clearable />
        </Field>
      </div>
      <Field>
        <Label>Salaire de base (GNF)</Label>
        <Input type="number" min={0} value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} />
      </Field>
      <div className="rounded-xl border border-gray-200 p-3">
        <Field>
          <Label>Enseigne aussi (optionnel)</Label>
          <Select value={linkedTeacherId} onChange={(e) => setLinkedTeacherId(e.target.value)}>
            <option value="">Non — poste administratif/direction uniquement</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
            ))}
          </Select>
        </Field>
        <p className="mt-1.5 text-xs text-gray-400">
          Si cette personne donne aussi des cours, reliez sa fiche enseignant ici — la paie pourra
          alors générer une fiche combinée (salaire de base + heures d&apos;enseignement).
        </p>
      </div>
      {initial?.userId != null ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          Cette personne a déjà un accès (compte de connexion lié).
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <Switch checked={createLogin} onChange={setCreateLogin} ariaLabel="Créer un accès" />
            <span className="text-sm text-gray-700">Créer un compte de connexion</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            Indispensable pour lui attribuer un rôle ensuite (ex. Comptable) — sans compte, cette
            personne n&apos;apparaît jamais dans « Utilisateurs ».
          </p>
          {createLogin && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-400">Cette personne se connectera avec son <strong>numéro de téléphone</strong> et ce mot de passe.</p>
              <Field>
                <Label>Mot de passe</Label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={saving}>{submitLabel}</Button>
      </div>
    </div>
  );
}
