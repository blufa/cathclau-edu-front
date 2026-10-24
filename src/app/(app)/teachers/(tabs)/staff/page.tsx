"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import {
  createEmployee,
  createTeacher,
  deleteEmployee,
  listEmployees,
  setEmployeeActive,
  updateEmployee,
  updateEmployeePhoto,
  type Employee,
  type EmployeeCategory,
  type EmployeeInput,
} from "@/lib/api/staff";
import { listCardTemplates } from "@/lib/api/student-card";
import { getCurrentAcademicYear } from "@/lib/api/academics";
import type { CreateTeacherInput, Teacher } from "@/lib/types/staff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FileUpload } from "@/components/ui/file-upload";
import { EMPLOYEE_CATEGORY_LABEL, EmployeeForm } from "@/components/staff/employee-form";
import { TeacherForm } from "@/components/staff/teacher-form";
import { IdBadge, type IdBadgeProps } from "@/components/cards/id-badge";
import { BadgeSheet } from "@/components/cards/badge-sheet";
import { buildIdentityQr } from "@/lib/identity-qr";
import { resolveBadgeColors } from "@/lib/badge-colors";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate, formatGNF } from "@/lib/format";

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
  const [editingPhotoFor, setEditingPhotoFor] = useState<Employee | null>(null);
  const [badgeFor, setBadgeFor] = useState<Employee | null>(null);
  // Personnel administratif/direction/soutien pouvant aussi enseigner des heures dans une classe :
  // "Devenir enseignant" pré-remplit la création de fiche enseignant avec l'identité déjà saisie ici,
  // plutôt que de tout ressaisir. Les deux fiches restent distinctes (salaire de base vs heures de
  // cours), la paie les traite séparément — voir EmployeeType côté API.
  const [teachingFor, setTeachingFor] = useState<Employee | null>(null);
  const [selected, setSelected] = useState<Employee[]>([]);
  const [sheetBadges, setSheetBadges] = useState<IdBadgeProps[] | null>(null);
  const [buildingSheet, setBuildingSheet] = useState(false);

  const tenantId = user?.tenantId ?? null;
  const templatesQuery = useCachedQuery(tenantId ? `card-templates:${tenantId}` : null, () => listCardTemplates(), [tenantId]);
  const currentYearQuery = useQuery(() => getCurrentAcademicYear(), []);
  const validUntil = currentYearQuery.data?.endDate ? formatDate(currentYearQuery.data.endDate) : null;

  /** Construit les données de badge de plusieurs membres du personnel à la fois (planche d'impression). */
  function buildBadgeSheet(employees: Employee[]) {
    setBuildingSheet(true);
    try {
      const colors = resolveBadgeColors(templatesQuery.data, "STAFF");
      const badges: IdBadgeProps[] = employees.map((e) => ({
        kind: "Badge personnel",
        fullName: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
        firstName: e.firstName,
        lastName: e.lastName,
        photoUrl: e.photo,
        idNumber: e.employeeNumber,
        validUntil,
        academicYearLabel: currentYearQuery.data?.label,
        fields: [
          { label: "Service", value: EMPLOYEE_CATEGORY_LABEL[e.category] },
          { label: "Fonction", value: e.jobTitle ?? "—" },
        ],
        qrData: buildIdentityQr({ type: "EMPLOYEE", fullName: `${e.firstName ?? ""} ${e.lastName ?? ""}`, matricule: e.employeeNumber }),
        footerNote: "Personnel de l'établissement.",
        primaryColor: colors.primaryColor,
        secondaryColor: colors.secondaryColor,
        orientation: colors.orientation,
      }));
      setSheetBadges(badges);
    } catch (e) { notifyError(e); } finally { setBuildingSheet(false); }
  }

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
      header: "Personnel",
      accessor: (e) => `${e.firstName ?? ""} ${e.lastName ?? ""}`,
      render: (e) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            title="Modifier la photo"
            disabled={!canWrite}
            onClick={(ev) => {
              if (!canWrite) return;
              ev.preventDefault();
              ev.stopPropagation();
              setEditingPhotoFor(e);
            }}
            className="shrink-0 disabled:cursor-default"
          >
            {e.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.photo} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                {`${e.firstName?.[0] ?? ""}${e.lastName?.[0] ?? ""}`.toUpperCase() || "?"}
              </span>
            )}
          </button>
          <span className="font-medium text-gray-900">{e.firstName} {e.lastName}</span>
        </div>
      ),
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
        selectable
        onSelectionChange={setSelected}
        toolbar={
          <Button size="sm" disabled={selected.length === 0} loading={buildingSheet}
            leftSection={<Printer className="h-4 w-4" />} onClick={() => buildBadgeSheet(selected)}>
            Imprimer planche {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        }
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
        {badgeFor && <StaffBadgeContent employee={badgeFor} />}
      </Modal>
      <Modal open={!!sheetBadges} onClose={() => setSheetBadges(null)} title="Planche de badges" className="max-w-4xl">
        {sheetBadges && <BadgeSheet badges={sheetBadges} />}
      </Modal>

      <Modal open={!!editingPhotoFor} onClose={() => setEditingPhotoFor(null)} title="Photo du membre du personnel">
        {editingPhotoFor && (
          <EmployeePhotoOnlyEditor
            employeeId={editingPhotoFor.id}
            employeeName={`${editingPhotoFor.firstName ?? ""} ${editingPhotoFor.lastName ?? ""}`}
            photo={editingPhotoFor.photo}
            onDone={() => { setEditingPhotoFor(null); q.refetch(); }}
          />
        )}
      </Modal>
    </div>
  );
}

/** Capture/téléverse puis enregistre immédiatement la nouvelle photo sur le profil personnel — même
 * pattern que PhotoOnlyEditor côté élèves (§11.3 cahier des charges). */
function EmployeePhotoOnlyEditor({ employeeId, employeeName, photo, onDone }: {
  employeeId: number; employeeName: string; photo: string | null; onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function save(url: string | null) {
    if (!url) return;
    setSaving(true);
    try {
      await updateEmployeePhoto(employeeId, url);
      notifySuccess("Photo mise à jour");
      onDone();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{employeeName}</p>
      <FileUpload variant="image" folder="employees/photos" value={photo} onChange={save} allowCapture />
      {saving && <p className="text-xs text-slate-400">Enregistrement…</p>}
    </div>
  );
}

/** Contenu du badge personnel : photo, téléphone, couleurs du modèle « Personnel » par défaut — extrait
 * pour ne charger le modèle de badge que quand la modale est ouverte. */
function StaffBadgeContent({ employee }: { employee: Employee }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const templatesQuery = useCachedQuery(tenantId ? `card-templates:${tenantId}` : null, () => listCardTemplates(), [tenantId]);
  const currentYearQuery = useQuery(() => getCurrentAcademicYear(), []);
  const colors = resolveBadgeColors(templatesQuery.data, "STAFF");

  return (
    <IdBadge
      kind="Badge personnel"
      fullName={`${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim()}
      firstName={employee.firstName}
      lastName={employee.lastName}
      photoUrl={employee.photo}
      idNumber={employee.employeeNumber}
      validUntil={currentYearQuery.data?.endDate ? formatDate(currentYearQuery.data.endDate) : null}
      academicYearLabel={currentYearQuery.data?.label}
      fields={[
        { label: "Service", value: EMPLOYEE_CATEGORY_LABEL[employee.category] },
        { label: "Fonction", value: employee.jobTitle ?? "—" },
      ]}
      qrData={buildIdentityQr({ type: "EMPLOYEE", fullName: `${employee.firstName ?? ""} ${employee.lastName ?? ""}`, matricule: employee.employeeNumber })}
      footerNote="Personnel de l'établissement."
      primaryColor={colors.primaryColor}
      secondaryColor={colors.secondaryColor}
      orientation={colors.orientation}
    />
  );
}
