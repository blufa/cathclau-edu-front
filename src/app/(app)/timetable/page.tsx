"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ActionIcon, Button, Group, Select, Paper, SegmentedControl, Stack, Text, Title } from "@mantine/core";
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
  listClassSubjects,
  listRooms,
  listSubjects,
  proposeTimetable,
  updateSchedule,
  type TimetableProposal,
} from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { listEvents } from "@/lib/api/calendar";
import { EVENT_TYPE_LABEL, type AcademicEvent } from "@/lib/types/calendar";
import { DatePickerInput } from "@mantine/dates";
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
  const [genOpen, setGenOpen] = useState(false);

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

  // Matières affectées à la classe (avec enseignant) → restreint la matière + auto-affecte le prof.
  const classSubjectsQuery = useQuery(
    () => (effectiveClassId ? listClassSubjects(effectiveClassId) : Promise.resolve([])),
    [effectiveClassId],
  );
  const classSubjects = useMemo(() => classSubjectsQuery.data ?? [], [classSubjectsQuery.data]);

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

  // Semaine affichée → dates de chaque jour, pour annoter les jours fériés / vacances du calendrier.
  const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [weekDate, setWeekDate] = useState<string>(() => isoLocal(new Date()));
  const eventsQuery = useQuery(() => (yearId ? listEvents(yearId) : Promise.resolve([])), [yearId]);
  const holidays = useMemo(
    () => (eventsQuery.data ?? []).filter((e) => e.eventType === "HOLIDAY" || e.eventType === "VACATION"),
    [eventsQuery.data],
  );
  const weekDates = useMemo(() => {
    const base = weekDate ? new Date(weekDate + "T00:00:00") : new Date();
    const day = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() + (day === 0 ? -6 : 1 - day));
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return isoLocal(d);
    });
  }, [weekDate]);
  const holidayFor = (iso: string): AcademicEvent | undefined =>
    holidays.find((e) => iso >= e.startDate && iso <= (e.endDate ?? e.startDate));
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  const slotsByDay = useMemo(() => {
    const map = new Map<JourSemaine, EmploiDuTemps[]>();
    for (const d of DAYS) map.set(d.key, []);
    for (const s of slotsQuery.data ?? []) map.get(s.day)?.push(s);
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [slotsQuery.data]);

  function printTimetable() {
    const subjectLabel = new Map(subjects.map((s) => [s.id, s.label]));
    const roomLabel = new Map(rooms.map((r) => [r.id, r.label]));
    const heading = mode === "class"
      ? (effectiveClassId ? (classLabel.get(effectiveClassId) ?? `Classe #${effectiveClassId}`) : "")
      : (effectiveTeacherId ? (teacherName.get(effectiveTeacherId) ?? `#${effectiveTeacherId}`) : "");
    const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
    const cols = DAYS.map((d) => {
      const list = (slotsByDay.get(d.key) ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
      const cells = list.map((s) => {
        const who = mode === "class"
          ? (s.teacherId != null ? (teacherName.get(s.teacherId) ?? "") : "")
          : (classLabel.get(s.schoolClassId) ?? `Classe #${s.schoolClassId}`);
        const room = s.roomId != null ? (roomLabel.get(s.roomId) ?? "") : "";
        return `<div class="slot"><div class="time">${s.startTime.slice(0, 5)} – ${s.endTime.slice(0, 5)}</div>`
          + `<div class="subj">${esc(subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`)}</div>`
          + (who ? `<div>${esc(who)}</div>` : "")
          + (room ? `<div class="room">Salle : ${esc(room)}</div>` : "") + `</div>`;
      }).join("") || `<span class="empty">—</span>`;
      return `<td>${cells}</td>`;
    }).join("");
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Emploi du temps</title>`
      + `<style>body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#0f172a}h1{font-size:18px;margin:0 0 2px}`
      + `.sub{color:#64748b;font-size:12px;margin-bottom:12px}table{width:100%;border-collapse:collapse}`
      + `th,td{border:1px solid #cbd5e1;padding:8px;vertical-align:top;width:16.6%}th{background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:.04em}`
      + `.slot{margin-bottom:8px;padding:6px;background:#eff6ff;border-radius:6px}.time{font-weight:700;font-size:11px;color:#1d4ed8}`
      + `.subj{font-weight:600;font-size:12px}.room{color:#64748b;font-size:11px}.empty{color:#cbd5e1}@media print{body{padding:0}}</style>`
      + `</head><body><h1>Emploi du temps — ${esc(heading)}</h1><div class="sub">${new Date().toLocaleDateString("fr-FR")}</div>`
      + `<table><thead><tr>${DAYS.map((d) => `<th>${d.label}</th>`).join("")}</tr></thead><tbody><tr>${cols}</tr></tbody></table>`
      + `<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) { notifyError("Autorisez les pop-ups pour imprimer / télécharger."); return; }
    w.document.write(html);
    w.document.close();
  }

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
        <Group gap="sm">
          <Button variant="default" onClick={printTimetable} disabled={(slotsQuery.data ?? []).length === 0}>
            Imprimer / Télécharger
          </Button>
          {canWrite && mode === "class" && (
            <>
              <Button variant="light" onClick={() => setGenOpen(true)} disabled={classes.length === 0}>
                Générer automatiquement
              </Button>
              <Button onClick={() => setCreating(true)} disabled={!effectiveClassId}>
                Ajouter un créneau
              </Button>
            </>
          )}
        </Group>
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
            <Select
              label="Année"
              value={yearId != null ? String(yearId) : null}
              onChange={(value) => {
                setSelectedYearId(value ? Number(value) : null);
                setClassId(null);
              }}
              data={years.map((y) => ({ value: String(y.id), label: y.label + (y.current ? " (courante)" : "") }))}
            />
            <Select
              label="Classe"
              searchable
              value={effectiveClassId != null ? String(effectiveClassId) : null}
              onChange={(value) => setClassId(value ? Number(value) : null)}
              data={classes.map((c) => ({ value: String(c.id), label: c.label }))}
            />
          </>
        ) : (
          <Select
            label="Enseignant"
            value={effectiveTeacherId != null ? String(effectiveTeacherId) : null}
            onChange={(value) => setTeacherId(value ? Number(value) : null)}
            data={teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))}
          />
        )}
        <DatePickerInput label="Semaine" valueFormat="DD/MM/YYYY" value={weekDate} onChange={(v) => setWeekDate(v ?? isoLocal(new Date()))} />
      </Group>

      {slotsQuery.loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {DAYS.map((d, i) => {
            const slots = slotsByDay.get(d.key) ?? [];
            const date = weekDates[i];
            const hol = holidayFor(date);
            return (
              <div key={d.key} className={hol ? "space-y-2 opacity-60" : "space-y-2"}>
                <div className="flex items-baseline justify-between">
                  <Text fw={600} size="sm" c="dimmed" tt="uppercase">
                    {d.label}
                  </Text>
                  <span className="text-xs text-slate-400">{ddmm(date)}</span>
                </div>
                {hol && (
                  <div className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                    {EVENT_TYPE_LABEL[hol.eventType]} — {hol.title}
                  </div>
                )}
                {slots.length === 0 && !hol && <p className="text-xs text-gray-300">—</p>}
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
                classSubjects={classSubjects}
                classLabelById={classLabel}
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
                classSubjects={classSubjects}
                classLabelById={classLabel}
                onSubmit={handleUpdate}
                onCancel={() => setEditing(null)}
              />
            )}
          </Modal>
        </>
      )}

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Générer l'emploi du temps automatiquement">
        <AutoGenPanel
          classes={classes.map((c) => ({ id: c.id, label: c.label }))}
          defaultClassId={effectiveClassId}
          onClose={() => setGenOpen(false)}
          onApplied={() => { setGenOpen(false); slotsQuery.refetch(); }}
        />
      </Modal>
    </div>
  );
}

function AutoGenPanel({ classes, defaultClassId, onClose, onApplied }: {
  classes: { id: number; label: string }[];
  defaultClassId: number | null;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [scope, setScope] = useState<"current" | "all">("all");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState<TimetableProposal | null>(null);

  const classIds = scope === "current" && defaultClassId ? [defaultClassId] : classes.map((c) => c.id);

  async function generate() {
    if (classIds.length === 0) { notifyError("Aucune classe à planifier."); return; }
    setLoading(true);
    try { setProposal(await proposeTimetable(classIds)); }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  async function apply() {
    if (!proposal) return;
    setApplying(true);
    let applied = 0;
    let skipped = 0;
    for (const s of proposal.slots) {
      try {
        await createSchedule({
          schoolClassId: s.classId, subjectId: s.subjectId, teacherId: s.teacherId,
          roomId: null, day: s.day as JourSemaine, startTime: s.startTime, endTime: s.endTime,
        });
        applied++;
      } catch { skipped++; }
    }
    setApplying(false);
    notifySuccess(`${applied} créneau(x) créé(s)${skipped ? `, ${skipped} ignoré(s) pour conflit` : ""}`);
    onApplied();
  }

  return (
    <Stack gap="md">
      <SegmentedControl value={scope} onChange={(v) => setScope(v as "current" | "all")}
        data={[{ label: "Toutes les classes", value: "all" }, { label: "Classe courante", value: "current" }]} />
      <p className="text-xs text-slate-400">
        Remplit l&apos;emploi du temps directement à partir des <strong>disponibilités déclarées</strong> par les
        enseignants : chaque créneau disponible devient une séance de l&apos;une de ses classes, sans conflit.
        Aucun nombre de séances à saisir. Les conflits avec l&apos;existant sont ignorés à l&apos;application.
      </p>
      {!proposal ? (
        <Button onClick={generate} loading={loading}>Générer</Button>
      ) : (
        <>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p><strong>{proposal.slots.length}</strong> créneau(x) proposé(s) depuis les disponibilités.</p>
            {proposal.teachersWithoutAvailability.length > 0 && (
              <p className="text-amber-700">{proposal.teachersWithoutAvailability.length} enseignant(s) sans disponibilité déclarée — non planifié(s).</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setProposal(null)}>Recommencer</Button>
            <Button onClick={apply} loading={applying} disabled={proposal.slots.length === 0}>Appliquer</Button>
          </div>
        </>
      )}
      <div className="flex justify-end"><Button variant="subtle" onClick={onClose}>Fermer</Button></div>
    </Stack>
  );
}
