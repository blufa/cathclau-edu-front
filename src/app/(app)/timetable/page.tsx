"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ActionIcon, Button, Group, NativeSelect, Paper, SegmentedControl, Text, Title } from "@mantine/core";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createSchedule,
  deleteSchedule,
  getScheduleByClass,
  getScheduleByTeacher,
  listAcademicYears,
  listClasses,
  listRooms,
  listSubjects,
  updateSchedule,
} from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import type { CreateScheduleInput, EmploiDuTemps, JourSemaine } from "@/lib/types/academics";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { ScheduleForm } from "@/components/timetable/schedule-form";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const DAYS: { key: JourSemaine; label: string }[] = [
  { key: "LUNDI", label: "Lundi" },
  { key: "MARDI", label: "Mardi" },
  { key: "MERCREDI", label: "Mercredi" },
  { key: "JEUDI", label: "Jeudi" },
  { key: "VENDREDI", label: "Vendredi" },
  { key: "SAMEDI", label: "Samedi" },
];

const hhmm = (t: string) => t?.slice(0, 5) ?? "";

export default function TimetablePage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const [mode, setMode] = useState<"class" | "teacher">("class");
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EmploiDuTemps | null>(null);

  const yearsQuery = useQuery(listAcademicYears, []);
  const teachersQuery = useQuery(listTeachers, []);
  const subjectsQuery = useQuery(listSubjects, []);
  const roomsQuery = useQuery(listRooms, []);

  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);

  const yearId = selectedYearId ?? years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const classesQuery = useQuery(() => (yearId ? listClasses(yearId) : Promise.resolve([])), [yearId]);
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);

  const effectiveClassId = classId ?? classes[0]?.id ?? null;
  const effectiveTeacherId = teacherId ?? teachers[0]?.id ?? null;

  const slotsQuery = useQuery(() => {
    if (mode === "class") return effectiveClassId ? getScheduleByClass(effectiveClassId) : Promise.resolve([]);
    return effectiveTeacherId ? getScheduleByTeacher(effectiveTeacherId) : Promise.resolve([]);
  }, [mode, effectiveClassId, effectiveTeacherId]);

  const subjectLabel = useMemo(() => new Map(subjects.map((s) => [s.id, s.label])), [subjects]);
  const roomLabel = useMemo(() => new Map(rooms.map((r) => [r.id, r.label])), [rooms]);
  const teacherName = useMemo(
    () => new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`])),
    [teachers],
  );
  const classLabel = useMemo(() => new Map(classes.map((c) => [c.id, c.label])), [classes]);

  const slotsByDay = useMemo(() => {
    const map = new Map<JourSemaine, EmploiDuTemps[]>();
    for (const d of DAYS) map.set(d.key, []);
    for (const s of slotsQuery.data ?? []) map.get(s.day)?.push(s);
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [slotsQuery.data]);

  async function handleCreate(input: CreateScheduleInput) {
    await createSchedule(input);
    setCreating(false);
    notifySuccess("Créneau ajouté");
    slotsQuery.refetch();
  }
  async function handleUpdate(input: CreateScheduleInput) {
    if (!editing) return;
    await updateSchedule(editing.id, input);
    setEditing(null);
    notifySuccess("Créneau modifié");
    slotsQuery.refetch();
  }
  function handleDelete(slot: EmploiDuTemps) {
    confirmAction({
      title: "Supprimer le créneau",
      message: "Supprimer ce créneau de l'emploi du temps ?",
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteSchedule(slot.id);
          notifySuccess("Créneau supprimé");
          slotsQuery.refetch();
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
          <Title order={2}>Emploi du temps</Title>
          <p className="text-sm text-gray-500">Planning hebdomadaire (détection de conflits)</p>
        </div>
        {canWrite && mode === "class" && (
          <Button onClick={() => setCreating(true)} disabled={!effectiveClassId}>
            Ajouter un créneau
          </Button>
        )}
      </div>

      <Group gap="sm" align="flex-end">
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as "class" | "teacher")}
          data={[
            { value: "class", label: "Par classe" },
            { value: "teacher", label: "Par enseignant" },
          ]}
        />
        {mode === "class" ? (
          <>
            <NativeSelect
              label="Année"
              value={yearId ?? ""}
              onChange={(e) => {
                setSelectedYearId(e.currentTarget.value ? Number(e.currentTarget.value) : null);
                setClassId(null);
              }}
              data={years.map((y) => ({ value: String(y.id), label: y.label + (y.current ? " (courante)" : "") }))}
            />
            <NativeSelect
              label="Classe"
              value={effectiveClassId ?? ""}
              onChange={(e) => setClassId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
              data={classes.map((c) => ({ value: String(c.id), label: c.label }))}
            />
          </>
        ) : (
          <NativeSelect
            label="Enseignant"
            value={effectiveTeacherId ?? ""}
            onChange={(e) => setTeacherId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
            data={teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))}
          />
        )}
      </Group>

      {slotsQuery.loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {DAYS.map((d) => {
            const slots = slotsByDay.get(d.key) ?? [];
            return (
              <div key={d.key} className="space-y-2">
                <Text fw={600} size="sm" c="dimmed" tt="uppercase">
                  {d.label}
                </Text>
                {slots.length === 0 && <p className="text-xs text-gray-300">—</p>}
                {slots.map((s) => (
                  <Paper key={s.id} withBorder radius="md" p="xs" className="bg-indigo-50/40">
                    <Group justify="space-between" wrap="nowrap" gap={4}>
                      <Text size="xs" fw={600} c="indigo">
                        {hhmm(s.startTime)} – {hhmm(s.endTime)}
                      </Text>
                      {canWrite && mode === "class" && (
                        <Group gap={2} wrap="nowrap">
                          <ActionIcon size="xs" variant="subtle" onClick={() => setEditing(s)} aria-label="Modifier">
                            ✎
                          </ActionIcon>
                          <ActionIcon size="xs" variant="subtle" color="red" onClick={() => handleDelete(s)} aria-label="Supprimer">
                            ✕
                          </ActionIcon>
                        </Group>
                      )}
                    </Group>
                    <Text size="sm" fw={500}>
                      {subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {mode === "class"
                        ? (s.teacherId ? (teacherName.get(s.teacherId) ?? `#${s.teacherId}`) : "—")
                        : (
                          <Link href={`/classes/${s.schoolClassId}`} className="text-indigo-600 hover:underline">
                            {classLabel.get(s.schoolClassId) ?? `Classe #${s.schoolClassId}`}
                          </Link>
                        )}
                      {s.roomId ? ` · ${roomLabel.get(s.roomId) ?? `#${s.roomId}`}` : ""}
                    </Text>
                  </Paper>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {effectiveClassId && (
        <>
          <Modal open={creating} onClose={() => setCreating(false)} title="Ajouter un créneau">
            {creating && (
              <ScheduleForm
                classId={effectiveClassId}
                subjects={subjects}
                teachers={teachers}
                rooms={rooms}
                onSubmit={handleCreate}
                onCancel={() => setCreating(false)}
              />
            )}
          </Modal>
          <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier le créneau">
            {editing && (
              <ScheduleForm
                classId={editing.schoolClassId}
                initial={editing}
                subjects={subjects}
                teachers={teachers}
                rooms={rooms}
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
