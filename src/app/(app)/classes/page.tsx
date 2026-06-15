"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createClass,
  deleteClass,
  listAcademicYears,
  listClasses,
  listLevels,
  listRooms,
  updateClass,
} from "@/lib/api/academics";
import type { Classe, CreateClassInput } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClassForm } from "@/components/classes/class-form";

export default function ClassesPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const yearsQuery = useQuery(listAcademicYears, []);
  const levelsQuery = useQuery(listLevels, []);
  const roomsQuery = useQuery(listRooms, []);

  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Classe | null>(null);

  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const levels = useMemo(() => levelsQuery.data ?? [], [levelsQuery.data]);
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);

  // Effective year = explicit choice, else the current year, else the first available.
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const yearId = selectedYearId ?? defaultYearId;

  const classesQuery = useQuery(
    () => (yearId ? listClasses(yearId) : Promise.resolve([])),
    [yearId],
  );

  const levelLabel = useMemo(() => new Map(levels.map((l) => [l.id, l.label])), [levels]);
  const roomLabel = useMemo(() => new Map(rooms.map((r) => [r.id, r.label])), [rooms]);

  async function handleCreate(input: CreateClassInput) {
    await createClass(input);
    setCreating(false);
    classesQuery.refetch();
  }
  async function handleUpdate(input: CreateClassInput) {
    if (!editing) return;
    await updateClass(editing.id, input);
    setEditing(null);
    classesQuery.refetch();
  }
  async function handleDelete(classe: Classe) {
    if (!confirm(`Supprimer la classe ${classe.label} ?`)) return;
    await deleteClass(classe.id);
    classesQuery.refetch();
  }

  const classes = classesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Classes</h1>
          <p className="text-sm text-gray-500">Organisation des classes par année scolaire</p>
        </div>
        {canWrite && (
          <Button onClick={() => setCreating(true)} disabled={!yearId}>
            Nouvelle classe
          </Button>
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

      {classesQuery.error ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger les classes.
        </p>
      ) : classesQuery.loading && classes.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Classe</TH>
              <TH>Niveau</TH>
              <TH>Salle</TH>
              <TH>Effectif</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {classes.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-10 text-center text-gray-400">
                  Aucune classe pour cette année.
                </TD>
              </TR>
            )}
            {classes.map((c) => {
              const headcount = c.headcount ?? 0;
              const full = c.maxCapacity != null && headcount >= c.maxCapacity;
              return (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/classes/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                      {c.label}
                    </Link>
                  </TD>
                  <TD>{c.levelId ? (levelLabel.get(c.levelId) ?? "—") : "—"}</TD>
                  <TD>{c.roomId ? (roomLabel.get(c.roomId) ?? "—") : "—"}</TD>
                  <TD>
                    <Badge tone={full ? "red" : "green"}>
                      {headcount}
                      {c.maxCapacity != null ? ` / ${c.maxCapacity}` : ""}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      {canWrite && (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                          Modifier
                        </Button>
                      )}
                      {canWrite && (
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(c)}>
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      {yearId && (
        <>
          <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle classe">
            <ClassForm
              academicYearId={yearId}
              levels={levels}
              rooms={rooms}
              submitLabel="Créer"
              onSubmit={handleCreate}
              onCancel={() => setCreating(false)}
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
              />
            )}
          </Modal>
        </>
      )}
    </div>
  );
}
