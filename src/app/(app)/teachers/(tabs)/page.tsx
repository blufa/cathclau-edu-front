"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import {
  createTeacher,
  deleteTeacher,
  getTeacherClasses,
  getTeacherSubjects,
  listTeachers,
  setTeacherActive,
  updateTeacher,
} from "@/lib/api/staff";
import { listCardTemplates } from "@/lib/api/student-card";
import { getCurrentAcademicYear, listSubjects } from "@/lib/api/academics";
import type { CreateTeacherInput, Teacher } from "@/lib/types/staff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { TeacherForm } from "@/components/staff/teacher-form";
import { OfflineTeacherFields } from "@/components/staff/offline-teacher-fields";
import { IdBadge, type IdBadgeProps } from "@/components/cards/id-badge";
import { BadgeSheet } from "@/components/cards/badge-sheet";
import { generateBadge } from "@/lib/api/biometric";
import { buildIdentityQr } from "@/lib/identity-qr";
import { resolveBadgeColors } from "@/lib/badge-colors";
import { formatDate } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { isNetworkError } from "@/lib/api/errors";
import { useNetworkStore } from "@/lib/offline/network-store";
import { useTeacherQueueStore } from "@/lib/offline/teacher-queue-store";
import { useTeacherUpdateQueueStore } from "@/lib/offline/teacher-update-queue-store";
import { submitTeacherOfflineAware } from "@/lib/offline/submit-teacher-creation";
import {
  retryFailedTeacherEntry, discardFailedTeacherEntry,
  enqueueTeacherUpdate, retryFailedTeacherUpdateEntry, discardFailedTeacherUpdateEntry,
} from "@/lib/offline/sync-engine";

type ActiveFilter = "all" | "active" | "inactive";

const EMPLOYMENT_STATUS_LABEL: Record<string, string> = {
  PERMANENT: "Permanent", VACATAIRE: "Vacataire", CONTRACTUEL: "Contractuel",
};

export default function TeachersPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["enseignant:create", "enseignant:update"]);

  const q = useQuery(listTeachers, []);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [badgeFor, setBadgeFor] = useState<Teacher | null>(null);
  const [badgeQr, setBadgeQr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Teacher[]>([]);
  const [sheetBadges, setSheetBadges] = useState<IdBadgeProps[] | null>(null);
  const [buildingSheet, setBuildingSheet] = useState(false);
  const online = useNetworkStore((s) => s.online);
  const teacherQueueItems = useTeacherQueueStore((s) => s.items);
  const teacherUpdateQueueItems = useTeacherUpdateQueueStore((s) => s.items);

  const tenantId = user?.tenantId ?? null;
  const templatesQuery = useCachedQuery(tenantId ? `card-templates:${tenantId}` : null, () => listCardTemplates(), [tenantId]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);
  const currentYearQuery = useQuery(() => getCurrentAcademicYear(), []);
  const subjectLabel = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);
  const validUntil = currentYearQuery.data?.endDate ? formatDate(currentYearQuery.data.endDate) : null;

  /** Construit les données de badge de plusieurs enseignants à la fois (planche d'impression) —
   * résout les matières enseignées par enseignant (un appel chacun, comme TeacherBadgeContent). */
  async function buildBadgeSheet(teachers: Teacher[]) {
    setBuildingSheet(true);
    try {
      const colors = resolveBadgeColors(templatesQuery.data, "TEACHER");
      const subjectsLists = await Promise.all(teachers.map((t) => getTeacherSubjects(t.id)));
      // Un enseignant du primaire n'a généralement aucune matière assignée (généraliste, seul titulaire
      // d'une classe) — dans ce cas, le badge affiche sa classe à la place (§retour direction des
      // études). N'interroge les classes que pour ceux sans matière, pour ne pas multiplier les appels.
      const classesLists = await Promise.all(teachers.map((t, i) => (subjectsLists[i].length === 0 ? getTeacherClasses(t.id) : Promise.resolve([]))));
      const badges: IdBadgeProps[] = teachers.map((t, i) => {
        const fullName = `${t.firstName} ${t.lastName}`.trim();
        // Une seule matière sur le badge (§retour direction des études), même si l'enseignant en couvre
        // plusieurs — pas la peine de tout lister sur une carte aussi étroite (54mm).
        const firstSubjectId = subjectsLists[i][0]?.subjectId;
        const taughtSubject = firstSubjectId != null ? subjectLabel.get(firstSubjectId) : null;
        const firstClass = classesLists[i][0];
        const secondField = taughtSubject
          ? { label: "Matière", value: taughtSubject }
          : { label: "Classe", value: firstClass?.label ?? "—" };
        return {
          kind: "Badge enseignant",
          fullName, firstName: t.firstName, lastName: t.lastName,
          photoUrl: t.photo,
          idNumber: t.staffNumber,
          validUntil,
          academicYearLabel: currentYearQuery.data?.label,
          fields: [
            secondField,
            { label: "Statut", value: t.employmentStatus ? (EMPLOYMENT_STATUS_LABEL[t.employmentStatus] ?? t.employmentStatus) : "—" },
          ],
          qrData: buildIdentityQr({ type: "TEACHER", fullName, matricule: t.staffNumber }),
          primaryColor: colors.primaryColor,
          secondaryColor: colors.secondaryColor,
          orientation: colors.orientation,
        };
      });
      setSheetBadges(badges);
    } catch (e) { notifyError(e); } finally { setBuildingSheet(false); }
  }

  // Générer le badge = enrôler l'enseignant pour le pointage (un seul QR scannable « BADGE|… »).
  function openBadge(t: Teacher) {
    setBadgeFor(t);
    setBadgeQr(null);
    generateBadge("TEACHER", t.id)
      .then((r) => setBadgeQr(r.qrPayload))
      .catch((err) => notifyError(err));
  }

  const teachers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data ?? []).filter((t) => {
      if (activeFilter === "active" && !t.active) return false;
      if (activeFilter === "inactive" && t.active) return false;
      if (!term) return true;
      return (
        `${t.firstName} ${t.lastName}`.toLowerCase().includes(term) ||
        (t.staffNumber ?? "").toLowerCase().includes(term) ||
        (t.specialization ?? "").toLowerCase().includes(term)
      );
    });
  }, [q.data, search, activeFilter]);

  async function handleCreate(input: CreateTeacherInput): Promise<Teacher> {
    const teacher = await createTeacher(input);
    notifySuccess("Enseignant créé");
    q.refetch();
    return teacher;
  }
  async function handleCreateOffline(input: CreateTeacherInput) {
    const attempt = await submitTeacherOfflineAware(input);
    setCreating(false);
    if (attempt.outcome === "queued") {
      notifySuccess("Enseignant enregistré hors-ligne — sera synchronisé automatiquement.");
      return;
    }
    notifySuccess("Enseignant créé");
    q.refetch();
  }
  async function handleUpdate(input: CreateTeacherInput): Promise<Teacher> {
    if (!editing) throw new Error("no teacher being edited");
    try {
      const teacher = await updateTeacher(editing.id, input);
      notifySuccess("Enseignant mis à jour");
      q.refetch();
      return teacher;
    } catch (err) {
      // Hors-ligne : mis en file (dernière écriture gagne, aucune contrainte en jeu — voir
      // enqueueTeacherUpdate). Le retour (ignoré par TeacherForm) reste le teacher pré-modification.
      if (isNetworkError(err)) {
        await enqueueTeacherUpdate(editing.id, input);
        notifySuccess("Hors-ligne : modification mise en file, sera synchronisée au retour du réseau.");
        return editing;
      }
      throw err;
    }
  }
  async function toggleActive(t: Teacher) {
    try {
      await setTeacherActive(t.id, !t.active);
      notifySuccess(t.active ? "Enseignant désactivé" : "Enseignant réactivé");
      q.refetch();
    } catch (err) {
      notifyError(err);
    }
  }
  function handleDelete(t: Teacher) {
    confirmAction({
      title: "Supprimer l'enseignant",
      message: `Supprimer ${t.firstName} ${t.lastName} ? (interdit s'il est lié à des évaluations)`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteTeacher(t.id);
          notifySuccess("Enseignant supprimé");
          q.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  const columns: Column<Teacher>[] = [
    {
      key: "staffNumber",
      header: "Matricule",
      accessor: (t) => t.staffNumber ?? "",
      render: (t) => <span className="font-mono text-xs text-gray-500">{t.staffNumber}</span>,
    },
    {
      key: "name",
      header: "Nom",
      accessor: (t) => `${t.firstName} ${t.lastName}`,
      render: (t) => (
        <Link href={`/teachers/detail?id=${t.id}`} className="font-medium text-brand-700 hover:underline">
          {t.firstName} {t.lastName}
        </Link>
      ),
    },
    { key: "specialization", header: "Spécialité", accessor: (t) => t.specialization ?? "", render: (t) => t.specialization ?? "—" },
    { key: "contact", header: "Contact", accessor: (t) => t.email ?? t.phone ?? "", render: (t) => t.email ?? t.phone ?? "—" },
    {
      key: "status",
      header: "Statut",
      accessor: (t) => (t.active ? "Actif" : "Inactif"),
      render: (t) => <Badge tone={t.active ? "green" : "gray"}>{t.active ? "Actif" : "Inactif"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (t) =>
        canWrite ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => openBadge(t)}>Badge</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Modifier</Button>
            <Button size="sm" variant="ghost" onClick={() => toggleActive(t)}>{t.active ? "Désactiver" : "Réactiver"}</Button>
            <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(t)}>Suppr.</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Enseignants</h1>
          <p className="text-sm text-gray-500">Personnel enseignant de l&apos;établissement</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)}>Nouvel enseignant</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Rechercher (nom, matricule, spécialité)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select className="max-w-[180px]" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}>
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={teachers}
        loading={q.loading}
        error={!!q.error}
        getRowKey={(t) => t.id}
        emptyLabel="Aucun enseignant."
        columnToggle
        exportable
        exportFilename="enseignants.csv"
        selectable
        onSelectionChange={setSelected}
        toolbar={
          <Button size="sm" disabled={selected.length === 0} loading={buildingSheet}
            leftSection={<Printer className="h-4 w-4" />} onClick={() => buildBadgeSheet(selected)}>
            Imprimer planche {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        }
      />

      {teacherQueueItems.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold text-warning-700">
              Enseignants en attente de synchronisation (hors-ligne)
            </h2>
            <ul className="divide-y divide-slate-100">
              {teacherQueueItems.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-slate-700">
                    {entry.input.firstName} {entry.input.lastName}
                    <span className="ml-2 font-mono text-xs text-slate-400">Matricule : en attente</span>
                  </span>
                  {entry.status === "failed" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-error-600">{entry.lastError ?? "Échec"}</span>
                      <Button size="sm" variant="secondary" onClick={() => discardFailedTeacherEntry(entry.id)}>Ignorer</Button>
                      <Button size="sm" onClick={() => retryFailedTeacherEntry(entry.id)}>Réessayer</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {teacherUpdateQueueItems.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold text-warning-700">
              Modifications en attente de synchronisation (hors-ligne)
            </h2>
            <ul className="divide-y divide-slate-100">
              {teacherUpdateQueueItems.map((entry) => (
                <li key={entry.teacherId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-slate-700">{entry.input.firstName} {entry.input.lastName}</span>
                  {entry.status === "failed" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-error-600">{entry.lastError ?? "Échec"}</span>
                      <Button size="sm" variant="secondary" onClick={() => discardFailedTeacherUpdateEntry(entry.teacherId)}>Ignorer</Button>
                      <Button size="sm" onClick={() => retryFailedTeacherUpdateEntry(entry.teacherId)}>Réessayer</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel enseignant" className="max-w-2xl">
        {creating && (online ? (
          <TeacherForm submitLabel="Créer" onSubmit={handleCreate} onCancel={() => setCreating(false)}
            onFinish={() => { setCreating(false); q.refetch(); }} />
        ) : (
          <OfflineTeacherFields onSubmit={handleCreateOffline} onCancel={() => setCreating(false)} />
        ))}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'enseignant" className="max-w-2xl">
        {editing && (
          <TeacherForm initial={editing} submitLabel="Enregistrer" onSubmit={handleUpdate} onCancel={() => setEditing(null)}
            onFinish={() => { setEditing(null); q.refetch(); }} />
        )}
      </Modal>
      <Modal open={!!badgeFor} onClose={() => { setBadgeFor(null); setBadgeQr(null); }} title="Badge enseignant">
        {badgeFor && <TeacherBadgeContent teacher={badgeFor} enrolled={!!badgeQr} />}
      </Modal>
      <Modal open={!!sheetBadges} onClose={() => setSheetBadges(null)} title="Planche de badges" className="max-w-4xl">
        {sheetBadges && <BadgeSheet badges={sheetBadges} />}
      </Modal>
    </div>
  );
}

/** Contenu du badge enseignant : matière enseignée (ou classe si généraliste du primaire sans matière
 * assignée), statut, photo, couleurs du modèle « Enseignant » par défaut — extrait pour ne charger ces
 * requêtes que quand la modale est ouverte. */
function TeacherBadgeContent({ teacher, enrolled }: { teacher: Teacher; enrolled: boolean }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const templatesQuery = useCachedQuery(tenantId ? `card-templates:${tenantId}` : null, () => listCardTemplates(), [tenantId]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);
  const teacherSubjectsQuery = useQuery(() => getTeacherSubjects(teacher.id), [teacher.id]);
  // Un enseignant du primaire n'a généralement aucune matière assignée (généraliste, seul titulaire
  // d'une classe) — dans ce cas, le badge affiche sa classe à la place (§retour direction des études).
  const teacherClassesQuery = useQuery(
    () => (teacherSubjectsQuery.data?.length === 0 ? getTeacherClasses(teacher.id) : Promise.resolve([])),
    [teacher.id, teacherSubjectsQuery.data?.length === 0],
  );
  const currentYearQuery = useQuery(() => getCurrentAcademicYear(), []);

  const subjectLabel = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);
  // Une seule matière sur le badge (§retour direction des études), même si l'enseignant en couvre
  // plusieurs — pas la peine de tout lister sur une carte aussi étroite (54mm).
  const secondField = useMemo(() => {
    const firstSubjectId = teacherSubjectsQuery.data?.[0]?.subjectId;
    const subject = firstSubjectId != null ? subjectLabel.get(firstSubjectId) : null;
    if (subject) return { label: "Matière", value: subject };
    return { label: "Classe", value: teacherClassesQuery.data?.[0]?.label ?? "—" };
  }, [teacherSubjectsQuery.data, subjectLabel, teacherClassesQuery.data]);

  const colors = resolveBadgeColors(templatesQuery.data, "TEACHER");

  return (
    <IdBadge
      kind="Badge enseignant"
      fullName={`${teacher.firstName} ${teacher.lastName}`.trim()}
      firstName={teacher.firstName}
      lastName={teacher.lastName}
      photoUrl={teacher.photo}
      idNumber={teacher.staffNumber}
      validUntil={currentYearQuery.data?.endDate ? formatDate(currentYearQuery.data.endDate) : null}
      academicYearLabel={currentYearQuery.data?.label}
      fields={[
        secondField,
        { label: "Statut", value: teacher.employmentStatus ? (EMPLOYMENT_STATUS_LABEL[teacher.employmentStatus] ?? teacher.employmentStatus) : "—" },
      ]}
      qrData={buildIdentityQr({ type: "TEACHER", fullName: `${teacher.firstName} ${teacher.lastName}`, matricule: teacher.staffNumber })}
      footerNote={enrolled ? "QR de pointage — enseignant enrôlé pour les présences." : "Enrôlement en cours…"}
      primaryColor={colors.primaryColor}
      secondaryColor={colors.secondaryColor}
      orientation={colors.orientation}
    />
  );
}
