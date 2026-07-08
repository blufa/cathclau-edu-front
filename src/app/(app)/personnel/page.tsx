"use client";

import { useMemo, useState } from "react";
import { Group, Select, TextInput, Title } from "@mantine/core";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  setEmployeeActive,
  updateEmployee,
  type Employee,
  type EmployeeCategory,
  type EmployeeInput,
} from "@/lib/api/staff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EMPLOYEE_CATEGORY_LABEL, EmployeeForm } from "@/components/staff/employee-form";
import { IdBadge } from "@/components/cards/id-badge";
import { useBranding } from "@/providers/branding-provider";
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
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const q = useQuery(() => listEmployees(), []);
  const schoolName = useBranding().branding?.schoolName ?? null;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EmployeeCategory | "all">("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [badgeFor, setBadgeFor] = useState<Employee | null>(null);

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
      render: (e) => <span className="font-medium text-slate-900">{e.firstName} {e.lastName}</span>,
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
          <Group justify="flex-end" gap="xs">
            <Button size="sm" variant="ghost" onClick={() => setBadgeFor(e)}>Badge</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Modifier</Button>
            <Button size="sm" variant="ghost" onClick={() => toggleActive(e)}>{e.active ? "Désactiver" : "Réactiver"}</Button>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(e)}>Suppr.</Button>
          </Group>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Title order={2}>Personnel</Title>
          <p className="text-sm text-gray-500">Personnel non enseignant : administration, direction et soutien</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)}>Nouveau membre</Button>}
      </div>

      <Group gap="sm">
        <TextInput
          placeholder="Rechercher (nom, fonction, matricule)…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="max-w-xs"
        />
        <Select
          value={category}
          onChange={(v) => setCategory((v ?? "all") as EmployeeCategory | "all")}
          data={[
            { value: "all", label: "Toutes catégories" },
            ...Object.entries(EMPLOYEE_CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Select
          value={activeFilter}
          onChange={(v) => setActiveFilter((v ?? "all") as ActiveFilter)}
          data={[
            { value: "all", label: "Tous" },
            { value: "active", label: "Actifs" },
            { value: "inactive", label: "Inactifs" },
          ]}
        />
      </Group>

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
            qrData={buildIdentityQr({ schoolName, fullName: `${badgeFor.firstName ?? ""} ${badgeFor.lastName ?? ""}`, matricule: badgeFor.employeeNumber })}
            footerNote="Personnel de l'établissement."
          />
        )}
      </Modal>
    </div>
  );
}
