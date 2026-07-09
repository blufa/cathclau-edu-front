"use client";

import { useState } from "react";
import { Select, PasswordInput, SegmentedControl, Stack, Switch, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Plus, UserPlus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createParent,
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
import { guineaPhoneRule, PHONE_PLACEHOLDER } from "@/lib/phone";
import type { Parent } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

/** Manage a student's parents: list, link an existing parent (sibling reuse) or create + link a new one. */
export function ParentsManager({ studentId, canWrite }: { studentId: number; canWrite: boolean }) {
  const q = useQuery(() => getStudentParents(studentId), [studentId]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parent | null>(null);

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
                {canWrite && !p.primaryGuardian && <Button size="sm" variant="ghost" onClick={() => makePrimary(p)}>Définir principal</Button>}
                {canWrite && <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Modifier</Button>}
                {canWrite && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => unlink(p)}>Délier</Button>}
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
      </CardBody>
    </Card>
  );
}

function EditParentForm({ parent, onCancel, onDone }: { parent: Parent; onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      firstName: parent.firstName ?? "", lastName: parent.lastName ?? "",
      phone: parent.phone ?? "", email: parent.email ?? "",
      occupation: parent.occupation ?? "", address: parent.address ?? "",
    },
    validate: { firstName: (v) => (v ? null : "Requis"), lastName: (v) => (v ? null : "Requis"), phone: guineaPhoneRule },
  });

  async function save(values: typeof form.values) {
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
    <form onSubmit={form.onSubmit(save)}>
      <Stack gap="md">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Prénom" withAsterisk {...form.getInputProps("firstName")} />
          <TextInput label="Nom" withAsterisk {...form.getInputProps("lastName")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Téléphone" placeholder={PHONE_PLACEHOLDER} inputMode="tel" {...form.getInputProps("phone")} />
          <TextInput label="Email" {...form.getInputProps("email")} />
        </div>
        <TextInput label="Profession" {...form.getInputProps("occupation")} />
        <TextInput label="Adresse" {...form.getInputProps("address")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Enregistrer</Button>
        </div>
      </Stack>
    </form>
  );
}

function AddParentForm({ studentId, onCancel, onDone }: { studentId: number; onCancel: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [relationship, setRelationship] = useState<Relationship>("FATHER");
  const [loading, setLoading] = useState(false);

  // Existing parent search (reuse a parent across siblings).
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const parentsQuery = useQuery(() => (query ? listParents(query) : Promise.resolve([])), [query]);

  // New parent form.
  const form = useForm({
    mode: "controlled",
    initialValues: { firstName: "", lastName: "", phone: "", email: "", occupation: "", address: "", createLogin: false, password: "" },
    validate: {
      firstName: (v) => (v ? null : "Requis"),
      lastName: (v) => (v ? null : "Requis"),
      phone: guineaPhoneRule,
      email: (v, vals) => (vals.createLogin && !/^\S+@\S+$/.test(v) ? "Email requis pour l'accès" : null),
      password: (v, vals) => (vals.createLogin && v.length < 6 ? "Mot de passe (6 caractères min.)" : null),
    },
  });

  async function linkExisting(p: Parent) {
    setLoading(true);
    try { await linkParentToStudent(p.id, studentId, relationship); onDone(); }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  async function createAndLink(values: typeof form.values) {
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
    <Stack gap="md">
      <Select
        label="Lien de parenté"
        data={(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => ({ value: r, label: RELATIONSHIP_LABEL[r] }))}
        value={relationship}
        onChange={(value) => value && setRelationship(value as Relationship)}
      />

      <SegmentedControl
        fullWidth
        color="brand"
        value={mode}
        onChange={(v) => setMode(v as "existing" | "new")}
        data={[{ value: "existing", label: "Parent existant" }, { value: "new", label: "Nouveau parent" }]}
      />

      {mode === "existing" ? (
        <Stack gap="sm">
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
        </Stack>
      ) : (
        <form onSubmit={form.onSubmit(createAndLink)}>
          <Stack gap="md">
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Prénom" withAsterisk {...form.getInputProps("firstName")} />
              <TextInput label="Nom" withAsterisk {...form.getInputProps("lastName")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Téléphone" placeholder={PHONE_PLACEHOLDER} inputMode="tel" {...form.getInputProps("phone")} />
              <TextInput label="Email" {...form.getInputProps("email")} />
            </div>
            <TextInput label="Profession" {...form.getInputProps("occupation")} />
            <TextInput label="Adresse" {...form.getInputProps("address")} />

            <div className="rounded-xl border border-slate-200 p-3">
              <Switch
                color="brand"
                label="Créer un accès (espace parent)"
                checked={form.values.createLogin}
                onChange={(e) => form.setFieldValue("createLogin", e.currentTarget.checked)}
              />
              {form.values.createLogin && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-slate-400">Le parent se connectera avec son <strong>email</strong> et ce mot de passe.</p>
                  <PasswordInput label="Mot de passe" placeholder="••••••••" {...form.getInputProps("password")} />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
              <Button type="submit" loading={loading} leftSection={<Plus className="h-4 w-4" />}>Créer & rattacher</Button>
            </div>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
