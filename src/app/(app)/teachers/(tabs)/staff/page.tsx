"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createEmployee,
  createTeacher,
  deleteEmployee,
  listEmployees,
  setEmployeeActive,
  updateEmployee,
  type Employee,
  type EmployeeCategory,
  type EmployeeInput,
} from "@/lib/api/staff";
import type { CreateTeacherInput, Teacher } from "@/lib/types/staff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EMPLOYEE_CATEGORY_LABEL, EmployeeForm } from "@/components/staff/employee-form";
import { TeacherForm } from "@/components/staff/teacher-form";
import { IdBadge } from "@/components/cards/id-badge";
import { buildIdentityQr } from "@/lib/identity-qr";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

type ActiveFilter = "all" | "active" | "inactive";

const CATEGORY_TONE: Record<EmployeeCategory, "indigo" | "brand" | "gray"> = {
  DIRECTION: "indigo",
  ADMINISTRATIVE: "brand",
  SUPPORT: "gray",
};

export default function PersonnelPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["enseignant:create", "enseignant:update"]);

  const q = useQuery(() => listEmployees(), []);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EmployeeCategory | "all">("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [badgeFor, setBadgeFor] = useState<Employee | null>(null);
  // Personnel administratif/direction/soutien pouvant aussi enseigner des heures dans une classe :
  // "Devenir enseignant" pré-remplit la création de fiche enseignant avec l'identité déjà saisie ici,
  // plutôt que de tout ressaisir. Les deux fiches restent distinctes (salaire de base vs heures de
  // cours), la paie les traite séparément — voir EmployeeType côté API.
  const [teachingFor, setTeachingFor] = useState<Employee | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data ?? []).filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (activeFilter === "active" && !e.active) return false;
      if (activeFilter === "inactive" && e.active) return false;
      if (!term) return true;
      return (
        `${e.firstName ?? ""} ${e.lastName ?? ""}`.toLowerCase().includes(term) ||
        (e.jobTitle ?? "").toLowerCase().includes(term) ||
        (e.employeeNumber ?? "").toLowerCase().includes(term)
      );
    });
  }, [q.data, search, category, activeFilter]);

  async function handleCreate(input: EmployeeInput) {
    await createEmployee(input);
    setCreating(false);
    notifySuccess("Membre du personnel ajouté");
    q.refetch();
  }
  async function handleUpdate(input: EmployeeInput) {
    if (!editing) return;
    await updateEmployee(editing.id, input);
    setEditing(null);
    notifySuccess("Fiche mise à jour");
    q.refetch();
  }
  async function toggleActive(e: Employee) {
    try {
      await setEmployeeActive(e.id, !e.active);
      notifySuccess(e.active ? "Membre désactivé" : "Membre réactivé");
      q.refetch();
    } catch (err) { notifyError(err); }
  }
  async function handleCreateTeacher(input: CreateTeacherInput): Promise<Teacher> {
    const teacher = await createTeacher(input);
    notifySuccess("Fiche enseignant créée — affectez ses classes/matières depuis l'onglet Enseignants");
    return teacher;
  }
  function handleDelete(e: Employee) {
    confirmAction({
      title: "Supprimer le membre du personnel",
      message: `Supprimer ${e.firstName} ${e.lastName} ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try { await deleteEmployee(e.id); notifySuccess("Membre supprimé"); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Nom",
      accessor: (e) => `${e.firstName ?? ""} ${e.lastName ?? ""}`,
      render: (e) => <span className="font-medium text-gray-900">{e.firstName} {e.lastName}</span>,
    },
    {
      key: "category",
      header: "Catégorie",
      accessor: (e) => EMPLOYEE_CATEGORY_LABEL[e.category],
      render: (e) => <Badge tone={CATEGORY_TONE[e.category]}>{EMPLOYEE_CATEGORY_LABEL[e.category]}</Badge>,
    },
    { key: "jobTitle", header: "Fonction", accessor: (e) => e.jobTitle ?? "", render: (e) => e.jobTitle ?? "—" },
    { key: "contact", header: "Contact", accessor: (e) => e.email ?? e.phone ?? "", render: (e) => e.email ?? e.phone ?? "—" },
    {
      key: "baseSalary",
      header: "Salaire de base",
      accessor: (e) => e.baseSalary ?? "",
      render: (e) => (e.baseSalary ? formatGNF(e.baseSalary) : "—"),
    },
    {
      key: "status",
      header: "Statut",
      accessor: (e) => (e.active ? "Actif" : "Inactif"),
      render: (e) => <Badge tone={e.active ? "green" : "gray"}>{e.active ? "Actif" : "Inactif"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (e) =>
        canWrite ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setBadgeFor(e)}>Badge</Button>
            <Button size="sm" variant="ghost" onClick={() => setTeachingFor(e)}>Devenir enseignant</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Modifier</Button>
            <Button size="sm" variant="ghost" onClick={() => toggleActive(e)}>{e.active ? "Désactiver" : "Réactiver"}</Button>
            <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(e)}>Suppr.</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Personnel</h1>
          <p className="text-sm text-gray-500">
            Personnel non enseignant : administration, direction et soutien. Un membre qui donne
            aussi des heures de cours peut recevoir une fiche enseignant (« Devenir enseignant »).
          </p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)}>Nouveau membre</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Rechercher (nom, fonction, matricule)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select className="max-w-[190px]" value={category} onChange={(e) => setCategory(e.target.value as EmployeeCategory | "all")}>
          <option value="all">Toutes catégories</option>
          {Object.entries(EMPLOYEE_CATEGORY_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
        </Select>
        <Select className="max-w-[150px]" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}>
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={q.loading}
        error={!!q.error}
        getRowKey={(e) => e.id}
        emptyLabel="Aucun membre du personnel."
        columnToggle
        exportable
        exportFilename="personnel.csv"
      />

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau membre du personnel">
        {creating && <EmployeeForm submitLabel="Ajouter" onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la fiche">
        {editing && <EmployeeForm initial={editing} submitLabel="Enregistrer" onSubmit={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>
      <Modal open={!!teachingFor} onClose={() => setTeachingFor(null)} title="Créer un profil enseignant" className="max-w-2xl">
        {teachingFor && (
          <TeacherForm
            initial={{ firstName: teachingFor.firstName ?? "", lastName: teachingFor.lastName ?? "", phone: teachingFor.phone, email: teachingFor.email }}
            submitLabel="Créer"
            onSubmit={handleCreateTeacher}
            onCancel={() => setTeachingFor(null)}
            onFinish={() => setTeachingFor(null)}
          />
        )}
      </Modal>
      <Modal open={!!badgeFor} onClose={() => setBadgeFor(null)} title="Badge personnel">
        {badgeFor && (
          <IdBadge
            kind="Badge personnel"
            fullName={`${badgeFor.firstName ?? ""} ${badgeFor.lastName ?? ""}`.trim()}
            subtitle={badgeFor.jobTitle ?? EMPLOYEE_CATEGORY_LABEL[badgeFor.category]}
            fields={[
              { label: "Matricule", value: badgeFor.employeeNumber ?? "—", mono: true },
              { label: "Catégorie", value: EMPLOYEE_CATEGORY_LABEL[badgeFor.category] },
              { label: "Statut", value: badgeFor.active ? "Actif" : "Inactif" },
            ]}
            qrData={buildIdentityQr({ type: "EMPLOYEE", fullName: `${badgeFor.firstName ?? ""} ${badgeFor.lastName ?? ""}`, matricule: badgeFor.employeeNumber })}
            footerNote="Personnel de l'établissement."
          />
        )}
      </Modal>
    </div>
  );
}
