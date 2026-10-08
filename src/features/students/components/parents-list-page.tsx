"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, Users } from "lucide-react";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getParentChildren, listParents, updateParent } from "@/lib/api/parents";
import { createUserWithRole } from "@/lib/api/iam";
import { getCurrentAcademicYear, listClasses } from "@/lib/api/academics";
import { searchEnrollments } from "@/lib/api/enrollments";
import { ApiError } from "@/lib/api/errors";
import type { Parent } from "@/lib/types/student";
import { Modal } from "@/components/ui/modal";
import { Input, Field, Label } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Reveal } from "@/components/public/reveal";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { MultiChildInvoicesModal } from "@/features/billing/components/multi-child-invoices-modal";

/** Liste de tous les parents du tenant — cliquer sur un parent affiche tous ses enfants rattachés. */
export default function ParentsListPage() {
  // Aucune donnée "parents" n'était mise en cache hors-ligne (§retour comptable, guichet d'accueil) —
  // `useCachedQuery` au lieu du hook maison sans cache : le filtrage est déjà 100% client (voir
  // `parents` ci-dessous), la liste complète tient donc en un seul appel mis en cache IndexedDB.
  const q = useCachedQuery("parents", listParents, []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Parent | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const parents = useMemo(() => {
    const list = q.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((p) => `${p.firstName} ${p.lastName} ${p.phone ?? ""} ${p.email ?? ""}`.toLowerCase().includes(term));
  }, [q.data, search]);
  const totalPages = Math.ceil(parents.length / PAGE_SIZE);
  const pageParents = parents.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Parents</h1>
        <p className="text-sm text-gray-500">Tous les parents de l&apos;école — cliquez sur un parent pour voir ses enfants</p>
      </Reveal>

      <Input
        className="max-w-sm"
        placeholder="Rechercher (nom, téléphone, email)…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
      />

      {q.loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : (
        <Table>
          <THead>
            <tr><TH>Nom</TH><TH className="hidden sm:table-cell">Téléphone</TH><TH className="hidden sm:table-cell">Email</TH><TH className="hidden sm:table-cell">Profession</TH></tr>
          </THead>
          <TBody>
            {pageParents.length === 0 && (
              <TR><TD colSpan={4} className="py-10 text-center text-gray-400">Aucun parent trouvé.</TD></TR>
            )}
            {pageParents.map((p) => (
              <TR key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(p)}>
                <TD className="font-medium text-gray-900">{p.firstName} {p.lastName}</TD>
                <TD className="hidden text-gray-600 sm:table-cell">{p.phone ?? "—"}</TD>
                <TD className="hidden text-gray-600 sm:table-cell">{p.email ?? "—"}</TD>
                <TD className="hidden text-gray-600 sm:table-cell">{p.occupation ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} totalElements={parents.length} onPageChange={setPage} />
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.firstName} ${selected.lastName}` : ""}>
        {selected && (
          <ParentChildren
            parent={selected}
            onLinked={() => q.refetch()}
            onUpdated={(updated) => { setSelected(updated); q.refetch(); }}
          />
        )}
      </Modal>
    </div>
  );
}

function ParentChildren({ parent, onLinked, onUpdated }: { parent: Parent; onLinked: () => void; onUpdated: (p: Parent) => void }) {
  const childrenQuery = useCachedQuery(`parent-children:${parent.id}`, () => getParentChildren(parent.id), [parent.id]);
  const children = childrenQuery.data ?? [];
  const [editing, setEditing] = useState(false);
  const [collectStudents, setCollectStudents] = useState<{ id: number; name: string; classId: number | null; className: string | null }[] | null>(null);
  const [resolvingCollect, setResolvingCollect] = useState(false);

  /**
   * "Encaisser tous les enfants" depuis la fiche parent (§retour comptable : un parent revenu un
   * autre jour payer la scolarité de ses enfants ne doit pas avoir à chercher chacun d'eux un par
   * un) — ouvre la même fenêtre d'encaissement groupé que juste après une inscription
   * (MultiChildInvoicesModal), pré-remplie avec tous les enfants de ce parent. Résout la classe
   * courante de chaque enfant (même logique que MultiChildCollectModal.fetchChildRows) puisque
   * `Student` ne porte pas directement son classId — passe par l'inscription validée de l'année en
   * cours.
   */
  async function openCollectAll() {
    if (children.length === 0) return;
    setResolvingCollect(true);
    try {
      const year = await getCurrentAcademicYear();
      // Retour comptable : la classe de chaque enfant doit être visible dans la fenêtre d'encaissement
      // groupé — résolue via les classes de l'année en cours (même source que les autres écrans).
      const classLabelById = year
        ? new Map((await listClasses(year.id)).map((cl) => [cl.id, cl.label]))
        : new Map<number, string>();
      const resolved = await Promise.all(children.map(async (c) => {
        let classId: number | null = null;
        if (year) {
          const enrollments = await searchEnrollments({ studentId: c.id, academicYearId: year.id, status: "VALIDATED" });
          classId = enrollments[0]?.classId ?? null;
        }
        return { id: c.id, name: `${c.firstName} ${c.lastName}`, classId, className: classId != null ? classLabelById.get(classId) ?? null : null };
      }));
      setCollectStudents(resolved);
    } catch (err) {
      notifyError(err);
    } finally {
      setResolvingCollect(false);
    }
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <ParentEditForm parent={parent} onCancel={() => setEditing(false)} onSaved={(p) => { setEditing(false); onUpdated(p); }} />
      ) : (
        <div className="space-y-2">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-400">Téléphone</dt><dd className="text-gray-900">{parent.phone ?? "—"}</dd></div>
            <div><dt className="text-gray-400">Email</dt><dd className="text-gray-900">{parent.email ?? "—"}</dd></div>
            <div><dt className="text-gray-400">Profession</dt><dd className="text-gray-900">{parent.occupation ?? "—"}</dd></div>
            <div><dt className="text-gray-400">Adresse</dt><dd className="text-gray-900">{parent.address ?? "—"}</dd></div>
          </dl>
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Modifier</Button>
          </div>
        </div>
      )}
      <CreateParentAccessSection parent={parent} onLinked={onLinked} />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <Users className="h-4 w-4" /> Enfants ({children.length})
          </p>
          {children.length > 0 && (
            <Button size="sm" variant="secondary" leftSection={<CreditCard className="h-3.5 w-3.5" />}
              onClick={openCollectAll} loading={resolvingCollect}>
              Encaisser tous les enfants
            </Button>
          )}
        </div>
        {childrenQuery.loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun enfant rattaché.</p>
        ) : (
          <ul className="space-y-2">
            {children.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                <div>
                  <Link href={`/students/detail?id=${c.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  <p className="text-xs text-gray-400">{c.studentNumber}</p>
                </div>
                <Badge tone="gray">{c.gender === "MALE" ? "Garçon" : c.gender === "FEMALE" ? "Fille" : c.gender}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      <MultiChildInvoicesModal
        students={collectStudents ?? []}
        tenantId={parent.tenantId}
        open={collectStudents != null}
        onClose={() => setCollectStudents(null)}
      />
    </div>
  );
}

/**
 * Créer un accès de connexion (portail parent) à une fiche parent existante — n'existait pas du tout
 * jusqu'ici, contrairement aux enseignants/personnel (même pattern : case à cocher + mot de passe,
 * visible seulement si aucun compte n'est encore lié).
 */
function CreateParentAccessSection({ parent, onLinked }: { parent: Parent; onLinked: () => void }) {
  const [createLogin, setCreateLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (parent.userId != null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
        Ce parent a déjà un accès (compte de connexion lié).
      </div>
    );
  }

  async function submit() {
    if (!parent.phone?.trim() && !parent.email?.trim()) {
      notifyError(new Error("Téléphone ou email requis sur la fiche pour créer un accès."));
      return;
    }
    if (password.length < 6) {
      notifyError(new Error("Mot de passe (6 caractères min.) requis."));
      return;
    }
    setSaving(true);
    try {
      const user = await createUserWithRole(
        { firstName: parent.firstName, lastName: parent.lastName, email: parent.email ?? null, password, phone: parent.phone ?? null },
        "PARENT",
      );
      await updateParent(parent.id, {
        firstName: parent.firstName, lastName: parent.lastName, phone: parent.phone,
        email: parent.email, occupation: parent.occupation, address: parent.address,
      }, user.id);
      notifySuccess("Accès créé.");
      setCreateLogin(false);
      setPassword("");
      onLinked();
    } catch (err) {
      notifyError(err instanceof ApiError ? err : new Error("Impossible de créer l'accès."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-center gap-3">
        <Switch checked={createLogin} onChange={setCreateLogin} ariaLabel="Créer un accès" />
        <span className="text-sm text-gray-700">Créer un accès (portail parent)</span>
      </div>
      {createLogin && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-400">
            Ce parent se connectera avec son <strong>numéro de téléphone</strong> (ou son email) et ce mot de passe.
          </p>
          <Field>
            <Label>Mot de passe</Label>
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} loading={saving}>Créer l&apos;accès</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Formulaire d'édition d'un parent (§retour comptable : "il doit pouvoir venir modifier le nom ou le
 * numéro") — n'existait pas : la fiche parent était jusqu'ici en lecture seule (seule exception :
 * une résaisie identique des mêmes champs lors de la création d'un accès). userId=null : ne touche
 * jamais au compte de connexion/lien personnel déjà en place. */
function ParentEditForm({ parent, onCancel, onSaved }: { parent: Parent; onCancel: () => void; onSaved: (p: Parent) => void }) {
  const [firstName, setFirstName] = useState(parent.firstName);
  const [lastName, setLastName] = useState(parent.lastName);
  const [phone, setPhone] = useState(parent.phone ?? "");
  const [email, setEmail] = useState(parent.email ?? "");
  const [occupation, setOccupation] = useState(parent.occupation ?? "");
  const [address, setAddress] = useState(parent.address ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!firstName.trim() || !lastName.trim()) {
      notifyError(new Error("Prénom et nom requis."));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateParent(parent.id, {
        firstName: firstName.trim(), lastName: lastName.trim(),
        phone: phone.trim() || null, email: email.trim() || null,
        occupation: occupation.trim() || null, address: address.trim() || null,
      }, null);
      notifySuccess("Parent modifié.");
      onSaved(updated);
    } catch (err) {
      notifyError(err instanceof ApiError ? err : new Error("Impossible de modifier ce parent."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
        <Field><Label>Nom</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
      </div>
      <PhoneInput label="Téléphone" value={phone} onChange={setPhone} />
      <Field><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field><Label>Profession</Label><Input value={occupation} onChange={(e) => setOccupation(e.target.value)} /></Field>
      <Field><Label>Adresse</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button size="sm" onClick={save} loading={saving}>Enregistrer</Button>
      </div>
    </div>
  );
}
