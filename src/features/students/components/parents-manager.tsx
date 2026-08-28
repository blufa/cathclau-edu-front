"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, UserPlus, Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import {
  createParent,
  getParentChildren,
  getStudentParents,
  linkParentToStudent,
  listParents,
  RELATIONSHIP_LABEL,
  setPrimaryGuardian,
  unlinkParentFromStudent,
  updateParent,
  type Relationship,
} from "@/lib/api/parents";
import { createUserWithRole } from "@/lib/api/iam";
import { phoneRule } from "@/lib/phone";
import { PhoneInput } from "@/components/ui/phone-input";
import type { Parent } from "@/lib/types/student";
import { MultiChildCollectModal } from "@/features/billing/components/multi-child-collect-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

/** Manage a student's parents: list, link an existing parent (sibling reuse) or create + link a new one. */
export function ParentsManager({ studentId, canWrite }: { studentId: number; canWrite: boolean }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const q = useQuery(() => getStudentParents(studentId), [studentId]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parent | null>(null);
  const [collectingFor, setCollectingFor] = useState<Parent | null>(null);
  const childrenQuery = useQuery(
    () => (collectingFor ? getParentChildren(collectingFor.id) : Promise.resolve([])),
    [collectingFor?.id],
  );

  function makePrimary(p: Parent) {
    setPrimaryGuardian(p.id, studentId)
      .then(() => { notifySuccess(`${p.firstName} défini comme responsable 1`); q.refetch(); })
      .catch(notifyError);
  }

  function unlink(p: Parent) {
    confirmAction({
      title: "Délier le parent",
      message: `Délier ${p.firstName} ${p.lastName} de cet élève ?`,
      confirmLabel: "Délier",
      danger: true,
      onConfirm: async () => {
        try { await unlinkParentFromStudent(studentId, p.id); notifySuccess("Parent délié"); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Parents / tuteurs</h3>
          {canWrite && <Button size="sm" onClick={() => setOpen(true)} leftSection={<UserPlus className="h-4 w-4" />}>Ajouter un parent</Button>}
        </div>

        {q.loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Aucun parent lié. Cliquez sur « Ajouter un parent ».</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(q.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {(p.firstName?.[0] ?? "") + (p.lastName?.[0] ?? "")}
                </span>
                <div className="flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    {p.firstName} {p.lastName}
                    {p.primaryGuardian && <Badge tone="green">Responsable 1</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">{p.phone ?? p.email ?? "—"}</p>
                </div>
                {canWrite && tenantId != null && (
                  <Button size="sm" variant="ghost" leftSection={<Wallet className="h-4 w-4" />} onClick={() => setCollectingFor(p)}>
                    Encaisser (fratrie)
                  </Button>
                )}
                {canWrite && !p.primaryGuardian && <Button size="sm" variant="ghost" onClick={() => makePrimary(p)}>Définir principal</Button>}
                {canWrite && <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Modifier</Button>}
                {canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => unlink(p)}>Délier</Button>}
              </li>
            ))}
          </ul>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Ajouter un parent">
          <AddParentForm studentId={studentId} onCancel={() => setOpen(false)} onDone={() => { setOpen(false); notifySuccess("Parent rattaché"); q.refetch(); }} />
        </Modal>

        <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier le parent">
          {editing && <EditParentForm parent={editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); notifySuccess("Parent mis à jour"); q.refetch(); }} />}
        </Modal>

        {collectingFor && tenantId != null && !childrenQuery.loading && (
          <MultiChildCollectModal
            students={(childrenQuery.data ?? []).map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
            tenantId={tenantId}
            open={!!collectingFor}
            onClose={() => setCollectingFor(null)}
            onCollected={() => setCollectingFor(null)}
          />
        )}
      </CardBody>
    </Card>
  );
}

const editSchema = z.object({
  firstName: z.string().trim().min(1, "Requis"),
  lastName: z.string().trim().min(1, "Requis"),
  phone: z.string().trim().min(1, "Requis"),
  email: z.string(),
  occupation: z.string(),
  address: z.string(),
}).superRefine((v, ctx) => {
  const phoneError = phoneRule(v.phone);
  if (phoneError) ctx.addIssue({ code: "custom", path: ["phone"], message: phoneError });
});
type EditFormValues = z.infer<typeof editSchema>;

function EditParentForm({ parent, onCancel, onDone }: { parent: Parent; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: parent.firstName ?? "", lastName: parent.lastName ?? "",
      phone: parent.phone ?? "", email: parent.email ?? "",
      occupation: parent.occupation ?? "", address: parent.address ?? "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function save(values: EditFormValues) {
    setLoading(true);
    try {
      await updateParent(parent.id, {
        firstName: values.firstName, lastName: values.lastName,
        phone: values.phone || null, email: values.email || null,
        occupation: values.occupation || null, address: values.address || null,
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(save)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Prénom <span className="text-error-500">*</span></Label>
          <Input value={v.firstName} onChange={(e) => setValue("firstName", e.target.value)} aria-invalid={!!errors.firstName} />
          {errors.firstName && <p className="text-xs text-error-600">{errors.firstName.message}</p>}
        </Field>
        <Field>
          <Label>Nom <span className="text-error-500">*</span></Label>
          <Input value={v.lastName} onChange={(e) => setValue("lastName", e.target.value)} aria-invalid={!!errors.lastName} />
          {errors.lastName && <p className="text-xs text-error-600">{errors.lastName.message}</p>}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <PhoneInput label={<>Téléphone <span className="text-error-500">*</span></>} value={v.phone} onChange={(val) => setValue("phone", val)} error={errors.phone?.message} />
        <Field>
          <Label>Email</Label>
          <Input value={v.email} onChange={(e) => setValue("email", e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Profession</Label>
        <Input value={v.occupation} onChange={(e) => setValue("occupation", e.target.value)} />
      </Field>
      <Field>
        <Label>Adresse</Label>
        <Input value={v.address} onChange={(e) => setValue("address", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Enregistrer</Button>
      </div>
    </form>
  );
}

const addSchema = z.object({
  firstName: z.string().trim().min(1, "Requis"),
  lastName: z.string().trim().min(1, "Requis"),
  phone: z.string().trim().min(1, "Requis"),
  email: z.string(),
  occupation: z.string(),
  address: z.string(),
  createLogin: z.boolean(),
  password: z.string(),
}).superRefine((v, ctx) => {
  const phoneError = phoneRule(v.phone);
  if (phoneError) ctx.addIssue({ code: "custom", path: ["phone"], message: phoneError });
  if (v.createLogin && !/^\S+@\S+$/.test(v.email)) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Email requis pour l'accès" });
  }
  if (v.createLogin && v.password.length < 6) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "Mot de passe (6 caractères min.)" });
  }
});
type AddFormValues = z.infer<typeof addSchema>;

function AddParentForm({ studentId, onCancel, onDone }: { studentId: number; onCancel: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [relationship, setRelationship] = useState<Relationship>("FATHER");
  const [loading, setLoading] = useState(false);

  // Existing parent search (reuse a parent across siblings).
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const parentsQuery = useQuery(() => (query ? listParents(query) : Promise.resolve([])), [query]);

  // New parent form.
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<AddFormValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", email: "", occupation: "", address: "", createLogin: false, password: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function linkExisting(p: Parent) {
    setLoading(true);
    try { await linkParentToStudent(p.id, studentId, relationship); onDone(); }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  async function createAndLink(values: AddFormValues) {
    setLoading(true);
    try {
      // Optionally create a login account (role PARENT) and link the parent to it.
      let userId: number | null = null;
      if (values.createLogin) {
        const user = await createUserWithRole(
          { firstName: values.firstName, lastName: values.lastName, email: values.email, password: values.password, phone: values.phone || null },
          "PARENT",
        );
        userId = user.id;
      }
      const parent = await createParent({
        firstName: values.firstName, lastName: values.lastName,
        phone: values.phone || null, email: values.email || null,
        occupation: values.occupation || null, address: values.address || null,
      }, userId);
      await linkParentToStudent(parent.id, studentId, relationship);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field>
        <Label>Lien de parenté</Label>
        <Select value={relationship} onChange={(e) => setRelationship(e.target.value as Relationship)}>
          {(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => (
            <option key={r} value={r}>{RELATIONSHIP_LABEL[r]}</option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
        {(["existing", "new"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            {m === "existing" ? "Parent existant" : "Nouveau parent"}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <div className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }} className="flex gap-2">
            <Input className="flex-1" placeholder="Rechercher (nom, téléphone, email)…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="submit" variant="secondary">Chercher</Button>
          </form>
          <p className="text-xs text-slate-400">Réutilisez un parent déjà enregistré (fratrie).</p>
          <div className="max-h-64 space-y-1 overflow-auto">
            {(parentsQuery.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-slate-400">{p.phone ?? p.email ?? "—"}</p>
                </div>
                <Button size="sm" loading={loading} onClick={() => linkExisting(p)}>Rattacher</Button>
              </div>
            ))}
            {query && (parentsQuery.data ?? []).length === 0 && (
              <p className="text-sm text-slate-400">Aucun parent trouvé — créez-en un nouveau.</p>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(createAndLink)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label>Prénom <span className="text-error-500">*</span></Label>
              <Input value={v.firstName} onChange={(e) => setValue("firstName", e.target.value)} aria-invalid={!!errors.firstName} />
              {errors.firstName && <p className="text-xs text-error-600">{errors.firstName.message}</p>}
            </Field>
            <Field>
              <Label>Nom <span className="text-error-500">*</span></Label>
              <Input value={v.lastName} onChange={(e) => setValue("lastName", e.target.value)} aria-invalid={!!errors.lastName} />
              {errors.lastName && <p className="text-xs text-error-600">{errors.lastName.message}</p>}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PhoneInput label={<>Téléphone <span className="text-error-500">*</span></>} value={v.phone} onChange={(val) => setValue("phone", val)} error={errors.phone?.message} />
            <Field>
              <Label>Email</Label>
              <Input value={v.email} onChange={(e) => setValue("email", e.target.value)} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
            </Field>
          </div>
          <Field>
            <Label>Profession</Label>
            <Input value={v.occupation} onChange={(e) => setValue("occupation", e.target.value)} />
          </Field>
          <Field>
            <Label>Adresse</Label>
            <Input value={v.address} onChange={(e) => setValue("address", e.target.value)} />
          </Field>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-3">
              <Switch checked={v.createLogin} onChange={(checked) => setValue("createLogin", checked)} ariaLabel="Créer un accès (espace parent)" />
              <span className="text-sm text-gray-700">Créer un accès (espace parent)</span>
            </div>
            {v.createLogin && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-400">Le parent se connectera avec son <strong>email</strong> et ce mot de passe.</p>
                <Field>
                  <Label>Mot de passe</Label>
                  <Input type="password" placeholder="••••••••" value={v.password} onChange={(e) => setValue("password", e.target.value)} aria-invalid={!!errors.password} />
                  {errors.password && <p className="text-xs text-error-600">{errors.password.message}</p>}
                </Field>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
            <Button type="submit" loading={loading} leftSection={<Plus className="h-4 w-4" />}>Créer & rattacher</Button>
          </div>
        </form>
      )}
    </div>
  );
}
