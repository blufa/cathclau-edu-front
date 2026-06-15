"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Group, NativeSelect, TextInput, Title } from "@mantine/core";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createTeacher,
  deleteTeacher,
  listTeachers,
  setTeacherActive,
  updateTeacher,
} from "@/lib/api/staff";
import type { CreateTeacherInput, Teacher } from "@/lib/types/staff";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TeacherForm } from "@/components/staff/teacher-form";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

type ActiveFilter = "all" | "active" | "inactive";

export default function TeachersPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const q = useQuery(listTeachers, []);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);

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

  async function handleCreate(input: CreateTeacherInput) {
    await createTeacher(input);
    setCreating(false);
    notifySuccess("Enseignant créé");
    q.refetch();
  }
  async function handleUpdate(input: CreateTeacherInput) {
    if (!editing) return;
    await updateTeacher(editing.id, input);
    setEditing(null);
    notifySuccess("Enseignant mis à jour");
    q.refetch();
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Title order={2}>Enseignants</Title>
          <p className="text-sm text-gray-500">Personnel enseignant de l&apos;établissement</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)}>Nouvel enseignant</Button>}
      </div>

      <Group gap="sm">
        <TextInput
          placeholder="Rechercher (nom, matricule, spécialité)…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="max-w-xs"
        />
        <NativeSelect
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.currentTarget.value as ActiveFilter)}
          data={[
            { value: "all", label: "Tous" },
            { value: "active", label: "Actifs" },
            { value: "inactive", label: "Inactifs" },
          ]}
        />
      </Group>

      {q.error ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger les enseignants.
        </p>
      ) : q.loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Matricule</TH>
              <TH>Nom</TH>
              <TH>Spécialité</TH>
              <TH>Contact</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {teachers.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-gray-400">
                  Aucun enseignant.
                </TD>
              </TR>
            )}
            {teachers.map((t) => (
              <TR key={t.id}>
                <TD className="font-mono text-xs">{t.staffNumber}</TD>
                <TD>
                  <Link href={`/teachers/${t.id}`} className="font-medium text-indigo-600 hover:underline">
                    {t.firstName} {t.lastName}
                  </Link>
                </TD>
                <TD>{t.specialization ?? "—"}</TD>
                <TD>{t.email ?? t.phone ?? "—"}</TD>
                <TD>
                  <Badge tone={t.active ? "green" : "gray"}>{t.active ? "Actif" : "Inactif"}</Badge>
                </TD>
                <TD className="text-right">
                  {canWrite && (
                    <Group justify="flex-end" gap="xs">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                        Modifier
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(t)}>
                        {t.active ? "Désactiver" : "Réactiver"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(t)}>
                        Suppr.
                      </Button>
                    </Group>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel enseignant">
        {creating && <TeacherForm submitLabel="Créer" onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'enseignant">
        {editing && (
          <TeacherForm initial={editing} submitLabel="Enregistrer" onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
        )}
      </Modal>
    </div>
  );
}
