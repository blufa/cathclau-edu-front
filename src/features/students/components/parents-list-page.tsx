"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCard, UserPlus, Users } from "lucide-react";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { createParent, deleteParent, getLinkedParentIds, getParentChildren, getStaffChildren, listParents, updateParent } from "@/lib/api/parents";
import { createUserWithRole } from "@/lib/api/iam";
import { getCurrentAcademicYear, listClasses } from "@/lib/api/academics";
import { searchEnrollments } from "@/lib/api/enrollments";
import { listTeachers, listEmployees } from "@/lib/api/staff";
import { ApiError } from "@/lib/api/errors";
import { phoneRule } from "@/lib/phone";
import type { Parent, Student } from "@/lib/types/student";
import { Modal } from "@/components/ui/modal";
import { Input, Field, Label } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { MultiChildInvoicesModal } from "@/features/billing/components/multi-child-invoices-modal";

interface StaffEntry {
  staffType: "TEACHER" | "EMPLOYEE";
  staffId: number;
  userId: number | null;
  name: string;
  role: string;
}

/** Liste de tous les parents du tenant — cliquer sur un parent affiche tous ses enfants rattachés. */
export default function ParentsListPage() {
  // Aucune donnée "parents" n'était mise en cache hors-ligne (§retour comptable, guichet d'accueil) —
  // `useCachedQuery` au lieu du hook maison sans cache : le filtrage est déjà 100% client (voir
  // `parents` ci-dessous), la liste complète tient donc en un seul appel mis en cache IndexedDB.
  const q = useCachedQuery("parents", listParents, []);
  // Distingue un parent lié à au moins un élève d'un contact/prospect sans enfant (§7 cahier des
  // charges) — un simple ensemble d'ids, pas de N+1 sur l'annuaire complet.
  const linkedIdsQuery = useCachedQuery("parents-linked-ids", getLinkedParentIds, []);
  const linkedIds = useMemo(() => new Set(linkedIdsQuery.data ?? []), [linkedIdsQuery.data]);
  // Onglet "Personnel" (§retour comptable : "ajouter la liste /parents le personnel aussi... lorsqu'il
  // recherche parent et qu'il trouve, on voit tous les enfants reliés") — même recherche/même modal
  // "enfants rattachés" que pour un parent classique, mais depuis la fiche enseignant/employé.
  const teachersQuery = useCachedQuery("teachers-all", listTeachers, []);
  const employeesQuery = useCachedQuery("employees-all", () => listEmployees(), []);
  const staffEntries = useMemo<StaffEntry[]>(() => {
    const teachers = (teachersQuery.data ?? []).map((t) => ({
      staffType: "TEACHER" as const, staffId: t.id, userId: t.userId,
      name: `${t.firstName} ${t.lastName}`, role: "Enseignant",
    }));
    const employees = (employeesQuery.data ?? []).map((e) => ({
      staffType: "EMPLOYEE" as const, staffId: e.id, userId: e.userId,
      name: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(), role: e.jobTitle || "Personnel",
    }));
    return [...teachers, ...employees];
  }, [teachersQuery.data, employeesQuery.data]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Parent | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffEntry | null>(null);
  const [creating, setCreating] = useState(false);
  // Deux onglets distincts plutôt qu'une liste mélangée avec un badge de statut (§7 cahier des
  // charges) : un prospect sans enfant et un parent qui a réellement des enfants inscrits sont deux
  // usages différents, à ne jamais confondre dans la même liste — pagination propre à chaque onglet.
  const [realPage, setRealPage] = useState(0);
  const [prospectPage, setProspectPage] = useState(0);
  const [staffPage, setStaffPage] = useState(0);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((p) => `${p.firstName} ${p.lastName} ${p.phone ?? ""} ${p.email ?? ""}`.toLowerCase().includes(term));
  }, [q.data, search]);
  const realParents = useMemo(() => filtered.filter((p) => linkedIds.has(p.id)), [filtered, linkedIds]);
  const prospectParents = useMemo(() => filtered.filter((p) => !linkedIds.has(p.id)), [filtered, linkedIds]);
  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return staffEntries;
    return staffEntries.filter((s) => s.name.toLowerCase().includes(term));
  }, [staffEntries, search]);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Parents</h1>
          </div>
          <Button size="sm" onClick={() => setCreating(true)} leftSection={<UserPlus className="h-4 w-4" />}>
            Nouveau parent / prospect
          </Button>
        </div>
      </Reveal>

      <Input
        className="max-w-sm"
        placeholder="Rechercher (nom, téléphone, email)…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setRealPage(0); setProspectPage(0); setStaffPage(0); }}
      />

      {q.loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : (
        <Tabs defaultValue="parents">
          <TabsList>
            <TabsTrigger value="parents">Parents ({realParents.length})</TabsTrigger>
            <TabsTrigger value="prospects">Prospects sans enfant ({prospectParents.length})</TabsTrigger>
            <TabsTrigger value="staff">Personnel ({filteredStaff.length})</TabsTrigger>
          </TabsList>
          <TabsPanel value="parents">
            <ParentsTable
              parents={realParents} page={realPage} pageSize={PAGE_SIZE} onPageChange={setRealPage}
              onSelect={setSelected} emptyLabel="Aucun parent trouvé."
            />
          </TabsPanel>
          <TabsPanel value="prospects">
            <ParentsTable
              parents={prospectParents} page={prospectPage} pageSize={PAGE_SIZE} onPageChange={setProspectPage}
              onSelect={setSelected} emptyLabel="Aucun prospect trouvé."
            />
          </TabsPanel>
          <TabsPanel value="staff">
            <StaffTable
              staff={filteredStaff} page={staffPage} pageSize={PAGE_SIZE} onPageChange={setStaffPage}
              onSelect={setSelectedStaff} loading={teachersQuery.loading || employeesQuery.loading}
            />
          </TabsPanel>
        </Tabs>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.firstName} ${selected.lastName}` : ""}>
        {selected && (
          <ParentChildren
            parent={selected}
            onLinked={() => q.refetch()}
            onUpdated={(updated) => { setSelected(updated); q.refetch(); }}
            onDeleted={() => { setSelected(null); q.refetch(); linkedIdsQuery.refetch(); }}
          />
        )}
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau parent / prospect">
        <CreateProspectForm
          existingParents={q.data ?? []}
          onCancel={() => setCreating(false)}
          onCreated={() => { setCreating(false); notifySuccess("Parent/prospect enregistré."); q.refetch(); linkedIdsQuery.refetch(); }}
        />
      </Modal>

      <Modal open={!!selectedStaff} onClose={() => setSelectedStaff(null)} title={selectedStaff ? `${selectedStaff.name} (${selectedStaff.role})` : ""}>
        {selectedStaff && <StaffChildren staff={selectedStaff} />}
      </Modal>
    </div>
  );
}

/** Table paginée réutilisée pour les deux onglets (parents réels / prospects) — jamais les deux
 * catégories mélangées dans une même instance (§7 cahier des charges). */
function ParentsTable({ parents, page, pageSize, onPageChange, onSelect, emptyLabel }: {
  parents: Parent[]; page: number; pageSize: number; onPageChange: (p: number) => void;
  onSelect: (p: Parent) => void; emptyLabel: string;
}) {
  const totalPages = Math.ceil(parents.length / pageSize);
  const pageParents = parents.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <>
      <Table>
        <THead>
          <tr><TH>Nom</TH><TH className="hidden sm:table-cell">Téléphone</TH><TH className="hidden sm:table-cell">Email</TH><TH className="hidden sm:table-cell">Profession</TH></tr>
        </THead>
        <TBody>
          {pageParents.length === 0 && (
            <TR><TD colSpan={4} className="py-10 text-center text-gray-400">{emptyLabel}</TD></TR>
          )}
          {pageParents.map((p) => (
            <TR key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => onSelect(p)}>
              <TD className="font-medium text-gray-900">{p.firstName} {p.lastName}</TD>
              <TD className="hidden text-gray-600 sm:table-cell">{p.phone ?? "—"}</TD>
              <TD className="hidden text-gray-600 sm:table-cell">{p.email ?? "—"}</TD>
              <TD className="hidden text-gray-600 sm:table-cell">{p.occupation ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} totalElements={parents.length} onPageChange={onPageChange} />
      )}
    </>
  );
}

/** Table paginée du personnel (enseignants + employés) — même usage que ParentsTable, mais pour
 *  l'onglet "Personnel" (§retour comptable). */
function StaffTable({ staff, page, pageSize, onPageChange, onSelect, loading }: {
  staff: StaffEntry[]; page: number; pageSize: number; onPageChange: (p: number) => void;
  onSelect: (s: StaffEntry) => void; loading: boolean;
}) {
  const totalPages = Math.ceil(staff.length / pageSize);
  const pageStaff = staff.slice(page * pageSize, page * pageSize + pageSize);

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <>
      <Table>
        <THead><tr><TH>Nom</TH><TH className="hidden sm:table-cell">Rôle</TH></tr></THead>
        <TBody>
          {pageStaff.length === 0 && (
            <TR><TD colSpan={2} className="py-10 text-center text-gray-400">Aucun membre du personnel trouvé.</TD></TR>
          )}
          {pageStaff.map((s) => (
            <TR key={`${s.staffType}-${s.staffId}`} className="cursor-pointer hover:bg-gray-50" onClick={() => onSelect(s)}>
              <TD className="font-medium text-gray-900">{s.name}</TD>
              <TD className="hidden text-gray-600 sm:table-cell">{s.role}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} totalElements={staff.length} onPageChange={onPageChange} />
      )}
    </>
  );
}

/** Enfants rattachés à un membre du personnel — mirroir en lecture seule de ParentChildren (pas
 *  d'édition de profil/suppression ici : ça reste réservé aux fiches Teacher/Employee dédiées). */
function StaffChildren({ staff }: { staff: StaffEntry }) {
  const childrenQuery = useCachedQuery(
    `staff-children:${staff.staffType}:${staff.staffId}`,
    () => getStaffChildren(staff.staffType, staff.staffId, staff.userId),
    [staff.staffType, staff.staffId, staff.userId],
  );
  const children: Student[] = childrenQuery.data ?? [];

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <Users className="h-4 w-4" /> Enfants ({children.length})
      </p>
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
  );
}

const prospectSchema = z.object({
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
type ProspectFormValues = z.infer<typeof prospectSchema>;

/**
 * Crée un contact/prospect (ex. un parent venu visiter l'école) SANS l'attacher à un élève — un vrai
 * Parent existant dans l'annuaire, pas une fiche élève fictive (§7 cahier des charges). Un enfant pourra
 * lui être rattaché plus tard normalement (fiche élève → Ajouter un parent → Parent existant).
 * Détection de doublon par numéro : avertit sans jamais bloquer ni fusionner automatiquement — un même
 * numéro peut légitimement correspondre à deux contacts distincts (ex. foyer partagé), la décision
 * revient à l'utilisateur.
 */
function CreateProspectForm({ existingParents, onCancel, onCreated }: {
  existingParents: Parent[]; onCancel: () => void; onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<ProspectFormValues>({
    resolver: zodResolver(prospectSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", email: "", occupation: "", address: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  const duplicate = useMemo(
    () => (v.phone ? existingParents.find((p) => p.phone === v.phone) ?? null : null),
    [v.phone, existingParents],
  );

  async function submit(values: ProspectFormValues) {
    if (duplicate && !confirmedDuplicate) return; // le bouton "Créer malgré tout" doit être utilisé explicitement
    setLoading(true);
    try {
      await createParent({
        firstName: values.firstName, lastName: values.lastName,
        phone: values.phone || null, email: values.email || null,
        occupation: values.occupation || null, address: values.address || null,
      });
      onCreated();
    } catch (err) {
      notifyError(err instanceof ApiError ? err : new Error("Impossible de créer ce contact."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <p className="text-xs text-gray-400">
        Pour un parent/visiteur sans enfant encore inscrit — un enfant pourra être rattaché plus tard
        depuis sa fiche.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PhoneInput label={<>Téléphone <span className="text-error-500">*</span></>}
          value={v.phone} onChange={(val) => { setValue("phone", val); setConfirmedDuplicate(false); }}
          error={errors.phone?.message} />
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
      {duplicate && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Un contact existe déjà avec ce numéro : {duplicate.firstName} {duplicate.lastName}. Si c&apos;est
          la même personne, annulez et rattachez-la plutôt depuis la fiche élève concernée. Sinon, vous
          pouvez créer ce contact malgré tout.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        {duplicate && !confirmedDuplicate ? (
          <Button type="button" variant="danger" onClick={() => setConfirmedDuplicate(true)}>Créer malgré tout</Button>
        ) : (
          <Button type="submit" loading={loading}>Enregistrer</Button>
        )}
      </div>
    </form>
  );
}

function ParentChildren({ parent, onLinked, onUpdated, onDeleted }: {
  parent: Parent; onLinked: () => void; onUpdated: (p: Parent) => void; onDeleted: () => void;
}) {
  const childrenQuery = useCachedQuery(`parent-children:${parent.id}`, () => getParentChildren(parent.id), [parent.id]);
  const children = childrenQuery.data ?? [];
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [collectStudents, setCollectStudents] = useState<{ id: number; name: string; classId: number | null; className: string | null }[] | null>(null);
  const [resolvingCollect, setResolvingCollect] = useState(false);

  // Suppression définitive (ex. doublon créé par une coupure réseau pendant l'inscription d'un
  // enfant, §retour comptable) — purge aussi tous les liens de parenté côté serveur, jamais les
  // fiches élève elles-mêmes. Message de confirmation adapté selon qu'il y a des enfants rattachés
  // ou non, pour que la conséquence (liens perdus) soit explicite avant une action irréversible.
  function remove() {
    const childrenWarning = children.length > 0
      ? ` Ses ${children.length} enfant${children.length > 1 ? "s" : ""} rattaché${children.length > 1 ? "s" : ""} ` +
        `(${children.map((c) => `${c.firstName} ${c.lastName}`).join(", ")}) seront détachés — leurs fiches élève ne seront pas supprimées.`
      : "";
    confirmAction({
      title: "Supprimer ce parent",
      message: `Supprimer définitivement ${parent.firstName} ${parent.lastName} ?${childrenWarning} Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        setDeleting(true);
        try {
          await deleteParent(parent.id);
          notifySuccess("Parent supprimé.");
          onDeleted();
        } catch (err) {
          notifyError(err instanceof ApiError ? err : new Error("Impossible de supprimer ce parent."));
        } finally {
          setDeleting(false);
        }
      },
    });
  }

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
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="text-error-600" loading={deleting} onClick={remove}>Supprimer</Button>
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
