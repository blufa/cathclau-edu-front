"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery as useLegacyQuery } from "@/hooks/use-query";
import { listAcademicYears, listLevels, listRooms, listSubjects } from "@/lib/api/academics";
import type { Classe, CreateClassInput } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ClassForm } from "./class-form";
import { ClassAssistant } from "./class-assistant";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import {
  useClassesQuery,
  useCreateClassMutation,
  useDeleteClassMutation,
  useUpdateClassMutation,
} from "../hooks/use-classes";

export default function ClassesListPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const yearsQuery = useLegacyQuery(listAcademicYears, []);
  const levelsQuery = useLegacyQuery(listLevels, []);
  const roomsQuery = useLegacyQuery(listRooms, []);
  const subjectsQuery = useLegacyQuery(listSubjects, []);

  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [editing, setEditing] = useState<Classe | null>(null);

  // Années par ordre décroissant (la plus récente en premier).
  const years = useMemo(
    () => [...(yearsQuery.data ?? [])].sort((a, b) => (b.label ?? "").localeCompare(a.label ?? "", "fr", { numeric: true })),
    [yearsQuery.data],
  );
  const levels = useMemo(() => levelsQuery.data ?? [], [levelsQuery.data]);
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);

  // Effective year = explicit choice, else the current year, else the first available.
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const yearId = selectedYearId ?? defaultYearId;

  const classesQuery = useClassesQuery(yearId);
  const createMutation = useCreateClassMutation(yearId);
  const updateMutation = useUpdateClassMutation(yearId);
  const deleteMutation = useDeleteClassMutation(yearId);

  const levelLabel = useMemo(() => new Map(levels.map((l) => [l.id, l.label])), [levels]);
  const roomLabel = useMemo(() => new Map(rooms.map((r) => [r.id, r.label])), [rooms]);

  async function handleCreate(input: CreateClassInput) {
    await createMutation.mutateAsync(input);
    setCreating(false);
    notifySuccess("Classe créée");
  }
  async function handleUpdate(input: CreateClassInput) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, input });
    setEditing(null);
    notifySuccess("Classe mise à jour");
  }
  function handleDelete(classe: Classe) {
    confirmAction({
      title: "Supprimer la classe",
      message: `Supprimer la classe ${classe.label} ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(classe.id);
          notifySuccess("Classe supprimée");
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  // Classes par ordre croissant : d'abord l'ordre du niveau, puis le libellé (tri naturel).
  const levelOrder = useMemo(() => new Map(levels.map((l) => [l.id, l.sortOrder])), [levels]);
  const classes = useMemo(
    () => [...(classesQuery.data ?? [])].sort((a, b) => {
      const lo = (levelOrder.get(a.levelId ?? -1) ?? 0) - (levelOrder.get(b.levelId ?? -1) ?? 0);
      return lo !== 0 ? lo : (a.label ?? "").localeCompare(b.label ?? "", "fr", { numeric: true });
    }),
    [classesQuery.data, levelOrder],
  );

  const columns: Column<Classe>[] = [
    {
      key: "label",
      header: "Classe",
      accessor: (c) => c.label,
      render: (c) => (
        <Link href={`/classes/${c.id}`} className="font-medium text-brand-700 hover:underline">
          {c.label}
        </Link>
      ),
    },
    {
      key: "level",
      header: "Niveau",
      accessor: (c) => (c.levelId ? (levelLabel.get(c.levelId) ?? "") : ""),
      render: (c) => (c.levelId ? (levelLabel.get(c.levelId) ?? "—") : "—"),
    },
    {
      key: "room",
      header: "Salle",
      accessor: (c) => (c.roomId ? (roomLabel.get(c.roomId) ?? "") : ""),
      render: (c) => (c.roomId ? (roomLabel.get(c.roomId) ?? "—") : "—"),
    },
    {
      key: "headcount",
      header: "Effectif",
      accessor: (c) => c.headcount ?? 0,
      render: (c) => {
        const headcount = c.headcount ?? 0;
        const full = c.maxCapacity != null && headcount >= c.maxCapacity;
        return (
          <Badge tone={full ? "red" : "green"}>
            {headcount}
            {c.maxCapacity != null ? ` / ${c.maxCapacity}` : ""}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (c) =>
        canWrite ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
              Modifier
            </Button>
            <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(c)}>
              Supprimer
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Classes</h1>
          <p className="text-sm text-gray-500">Organisation des classes par année scolaire</p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setAssisting(true)} disabled={!yearId}>
              Assistant (en lot)
            </Button>
            <Button onClick={() => setCreating(true)} disabled={!yearId}>
              Nouvelle classe
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Année scolaire</label>
        <Select
          className="max-w-xs"
          value={yearId ?? ""}
          onChange={(e) => setSelectedYearId(e.target.value ? Number(e.target.value) : null)}
        >
          {years.length === 0 && <option value="">—</option>}
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
              {y.current ? " (courante)" : ""}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={classes}
        loading={classesQuery.isLoading}
        error={!!classesQuery.error}
        getRowKey={(c) => c.id}
        emptyLabel="Aucune classe pour cette année."
        searchable
        searchPlaceholder="Rechercher une classe…"
        columnToggle
        exportable
        exportFilename="classes.csv"
      />

      {yearId && (
        <>
          <Modal open={assisting} onClose={() => setAssisting(false)} title="Assistant — création de classes">
            {assisting && (
              <ClassAssistant
                academicYearId={yearId}
                levels={levels}
                rooms={rooms}
                subjects={subjects}
                existingClasses={classes}
                onCreated={() => {
                  setAssisting(false);
                  classesQuery.refetch();
                }}
                onCancel={() => setAssisting(false)}
              />
            )}
          </Modal>

          <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle classe">
            <ClassForm
              academicYearId={yearId}
              levels={levels}
              rooms={rooms}
              submitLabel="Créer"
              onSubmit={handleCreate}
              onCancel={() => setCreating(false)}
              onRoomsChanged={() => roomsQuery.refetch()}
              onLevelsChanged={() => levelsQuery.refetch()}
            />
          </Modal>

          <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la classe">
            {editing && (
              <ClassForm
                initial={editing}
                academicYearId={yearId}
                levels={levels}
                rooms={rooms}
                submitLabel="Enregistrer"
                onSubmit={handleUpdate}
                onCancel={() => setEditing(null)}
                onRoomsChanged={() => roomsQuery.refetch()}
                onLevelsChanged={() => levelsQuery.refetch()}
              />
            )}
          </Modal>
        </>
      )}
    </div>
  );
}
