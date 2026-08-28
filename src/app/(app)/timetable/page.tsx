"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
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
import type { CreateScheduleInput, EmploiDuTemps, JourSemaine } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { ScheduleForm } from "@/components/timetable/schedule-form";
import { FixedScheduleForm } from "@/components/timetable/fixed-schedule-form";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const DAYS: { key: JourSemaine; label: string }[] = [
  { key: "LUNDI", label: "Lundi" },
  { key: "MARDI", label: "Mardi" },
  { key: "MERCREDI", label: "Mercredi" },
  { key: "JEUDI", label: "Jeudi" },
  { key: "VENDREDI", label: "Vendredi" },
  { key: "SAMEDI", label: "Samedi" },
];

const hhmm = (t: string) => t?.slice(0, 5) ?? "";

/** Petit sélecteur à deux options (remplace Mantine SegmentedControl). */
function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-white text-gray-900 shadow-theme-xs" : "text-gray-500 hover:text-gray-700",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TimetablePage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const [mode, setMode] = useState<"class" | "teacher">("class");
  const [view, setView] = useState<"liste" | "grille">("liste");
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EmploiDuTemps | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [fixedOpen, setFixedOpen] = useState(false);

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

  const classOptions: SearchableOption[] = useMemo(
    () => classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classes],
  );

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
          <h1 className="text-2xl font-semibold text-gray-900">Emploi du temps</h1>
          <p className="text-sm text-gray-500">Planning hebdomadaire (détection de conflits)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={printTimetable} disabled={(slotsQuery.data ?? []).length === 0}>
            Imprimer / Télécharger
          </Button>
          {canWrite && mode === "class" && (
            <>
              <Button variant="outline" onClick={() => setGenOpen(true)} disabled={classes.length === 0}>
                Générer automatiquement
              </Button>
              <Button variant="outline" onClick={() => setFixedOpen(true)} disabled={!effectiveClassId}>
                Horaire fixe
              </Button>
              <Button onClick={() => setCreating(true)} disabled={!effectiveClassId}>
                Ajouter un créneau
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[{ value: "class", label: "Par classe" }, { value: "teacher", label: "Par enseignant" }]}
        />
        {mode === "class" ? (
          <>
            <div className="w-48">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Année</label>
              <Select
                value={yearId != null ? String(yearId) : ""}
                onChange={(e) => { setSelectedYearId(e.target.value ? Number(e.target.value) : null); setClassId(null); }}
              >
                {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
              </Select>
            </div>
            <div className="w-56">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Classe</label>
              <SearchableSelect
                value={effectiveClassId != null ? String(effectiveClassId) : ""}
                options={classOptions}
                onChange={(val) => setClassId(val ? Number(val) : null)}
                triggerClassName="w-full justify-between px-3"
              />
            </div>
          </>
        ) : (
          <div className="w-64">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Enseignant</label>
            <Select
              value={effectiveTeacherId != null ? String(effectiveTeacherId) : ""}
              onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : null)}
            >
              {teachers.map((t) => (<option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>))}
            </Select>
          </div>
        )}
        {mode === "class" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Vue</label>
            <Segmented value={view} onChange={setView} options={[{ value: "liste", label: "Liste" }, { value: "grille", label: "Grille" }]} />
          </div>
        )}
        {view === "liste" && (
          <div className="w-44">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Semaine</label>
            <DatePicker value={weekDate} onChange={(v) => setWeekDate(v || isoLocal(new Date()))} />
          </div>
        )}
      </div>

      {slotsQuery.loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : mode === "class" && view === "grille" && effectiveClassId ? (
        <TimetableGrid
          classId={effectiveClassId}
          slots={slotsQuery.data ?? []}
          classSubjects={classSubjects}
          subjects={subjects}
          teacherName={teacherName}
          onChanged={() => slotsQuery.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {DAYS.map((d, i) => {
            const slots = slotsByDay.get(d.key) ?? [];
            const date = weekDates[i];
            const hol = holidayFor(date);
            return (
              <div key={d.key} className={hol ? "space-y-2 opacity-60" : "space-y-2"}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold uppercase text-gray-400">{d.label}</span>
                  <span className="text-xs text-gray-400">{ddmm(date)}</span>
                </div>
                {hol && (
                  <div className="rounded-md bg-error-50 px-2 py-1 text-xs font-medium text-error-700">
                    {EVENT_TYPE_LABEL[hol.eventType]} — {hol.title}
                  </div>
                )}
                {slots.length === 0 && !hol && <p className="text-xs text-gray-300">—</p>}
                {slots.map((s) => (
                  <div key={s.id} className="rounded-lg border border-gray-200 bg-brand-50/40 p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-brand-700">
                        {hhmm(s.startTime)} – {hhmm(s.endTime)}
                      </span>
                      {canWrite && mode === "class" && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setEditing(s)} aria-label="Modifier" className="rounded p-0.5 text-gray-400 hover:bg-white hover:text-brand-700">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => handleDelete(s)} aria-label="Supprimer" className="rounded p-0.5 text-gray-400 hover:bg-white hover:text-error-600">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800">
                      {subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {mode === "class"
                        ? (s.teacherId ? (teacherName.get(s.teacherId) ?? `#${s.teacherId}`) : "—")
                        : (
                          <Link href={`/classes/${s.schoolClassId}`} className="text-brand-600 hover:underline">
                            {classLabel.get(s.schoolClassId) ?? `Classe #${s.schoolClassId}`}
                          </Link>
                        )}
                      {s.roomId ? ` · ${roomLabel.get(s.roomId) ?? `#${s.roomId}`}` : ""}
                    </p>
                  </div>
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

      {effectiveClassId && (
        <Modal open={fixedOpen} onClose={() => setFixedOpen(false)} title="Créer un horaire fixe">
          <FixedScheduleForm
            key={effectiveClassId}
            classId={effectiveClassId}
            classRoomId={classes.find((c) => c.id === effectiveClassId)?.roomId ?? null}
            subjects={subjects}
            teachers={teachers}
            rooms={rooms}
            classSubjects={classSubjects}
            onCancel={() => setFixedOpen(false)}
            onDone={() => { setFixedOpen(false); slotsQuery.refetch(); }}
          />
        </Modal>
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
    <div className="space-y-4">
      <Segmented value={scope} onChange={setScope} options={[{ value: "all", label: "Toutes les classes" }, { value: "current", label: "Classe courante" }]} />
      <p className="text-xs text-gray-400">
        Remplit l&apos;emploi du temps directement à partir des <strong>disponibilités déclarées</strong> par les
        enseignants : chaque créneau disponible devient une séance de l&apos;une de ses classes, sans conflit.
        Aucun nombre de séances à saisir. Les conflits avec l&apos;existant sont ignorés à l&apos;application.
      </p>
      {!proposal ? (
        <Button onClick={generate} loading={loading}>Générer</Button>
      ) : (
        <>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
            <p><strong>{proposal.slots.length}</strong> créneau(x) proposé(s) depuis les disponibilités.</p>
            {proposal.teachersWithoutAvailability.length > 0 && (
              <p className="text-warning-700">{proposal.teachersWithoutAvailability.length} enseignant(s) sans disponibilité déclarée — non planifié(s).</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setProposal(null)}>Recommencer</Button>
            <Button onClick={apply} loading={applying} disabled={proposal.slots.length === 0}>Appliquer</Button>
          </div>
        </>
      )}
      <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Fermer</Button></div>
    </div>
  );
}
