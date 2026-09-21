"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import {
  cancelScheduleWeekException,
  createSchedule,
  getEffectiveScheduleByClass,
  getEffectiveScheduleByTeacher,
  getScheduleByClass,
  getScheduleByTeacher,
  listAcademicYears,
  listClasses,
  listClassSubjects,
  listLevels,
  listRooms,
  listSubjects,
  moveScheduleForWeek,
  proposeTimetable,
  type TimetableProposal,
} from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { listEvents } from "@/lib/api/calendar";
import { EVENT_TYPE_LABEL, type AcademicEvent } from "@/lib/types/calendar";
import { SCHOOL_CYCLE_LABEL, type CreateScheduleInput, type EffectiveScheduleSlot, type EmploiDuTemps, type JourSemaine, type MoveScheduleForWeekInput, type SchoolCycle } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { ScheduleForm } from "@/components/timetable/schedule-form";
import { FixedScheduleForm } from "@/components/timetable/fixed-schedule-form";
import { MoveScheduleForWeekForm } from "@/components/timetable/move-schedule-for-week-form";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { TeacherLateSmsButton } from "@/components/timetable/teacher-late-sms-button";
import { notifyError, notifySuccess } from "@/lib/feedback";
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
  const tenantId = user?.tenantId ?? null;
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["emploi:manage"]);

  const [mode, setMode] = useState<"class" | "teacher">("class");
  const [view, setView] = useState<"liste" | "grille">("liste");
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [cycleFilter, setCycleFilter] = useState<SchoolCycle | "">("");
  const [classId, setClassId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [movingSlot, setMovingSlot] = useState<EffectiveScheduleSlot | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [fixedOpen, setFixedOpen] = useState(false);
  const [printingAll, setPrintingAll] = useState(false);

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);
  const roomsQuery = useCachedQuery(tenantId ? `rooms:${tenantId}` : null, listRooms, [tenantId]);
  const levelsQuery = useCachedQuery(tenantId ? `levels:${tenantId}` : null, listLevels, [tenantId]);

  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const levels = useMemo(() => levelsQuery.data ?? [], [levelsQuery.data]);
  const levelCycleById = useMemo(() => new Map(levels.map((l) => [l.id, l.cycle])), [levels]);
  // Deux cycles (Collège + Lycée) forment ensemble le « secondaire » — grille horaire par bandes de
  // 2h, contre 1h pour les autres cycles (maternelle/primaire), qui alternent des séances plus courtes.
  const isSecondaryCycle = (cycle: SchoolCycle | null | undefined) => cycle === "COLLEGE" || cycle === "LYCEE";

  const yearId = selectedYearId ?? years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const classesQuery = useCachedQuery(yearId ? `classes:${yearId}` : null, () => listClasses(yearId as number), [yearId]);
  const allClasses = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const classes = useMemo(
    () => (cycleFilter ? allClasses.filter((c) => c.levelId != null && levelCycleById.get(c.levelId) === cycleFilter) : allClasses),
    [allClasses, cycleFilter, levelCycleById],
  );

  const effectiveClassId = classId ?? classes[0]?.id ?? null;
  const effectiveTeacherId = teacherId ?? teachers[0]?.id ?? null;
  const effectiveClassCycle = effectiveClassId != null
    ? levelCycleById.get(allClasses.find((c) => c.id === effectiveClassId)?.levelId ?? -1) ?? null
    : null;

  // Matières affectées à la classe (avec enseignant) → restreint la matière + auto-affecte le prof.
  const classSubjectsQuery = useCachedQuery(
    effectiveClassId ? `class-subjects:${effectiveClassId}` : null,
    () => listClassSubjects(effectiveClassId as number),
    [effectiveClassId],
  );
  const classSubjects = useMemo(() => classSubjectsQuery.data ?? [], [classSubjectsQuery.data]);

  // Semaine affichée → dates de chaque jour ; weekDates[0] (le lundi) identifie la semaine pour la
  // vue effective (récurrent + déplacements/annulations ponctuels de cette semaine-là).
  const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [weekDate, setWeekDate] = useState<string>(() => isoLocal(new Date()));
  const eventsQuery = useCachedQuery(yearId ? `events:${yearId}` : null, () => listEvents(yearId as number), [yearId]);
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
  const weekMonday = weekDates[0];

  // Récurrent (toutes les semaines) — utilisé par la vue Grille et par Modifier/Supprimer (qui
  // agissent toujours sur le créneau récurrent, jamais sur une exception).
  const slotsCacheKey =
    mode === "class"
      ? (effectiveClassId ? `schedule-class:${effectiveClassId}` : null)
      : (effectiveTeacherId ? `schedule-teacher:${effectiveTeacherId}` : null);
  const slotsQuery = useCachedQuery(
    slotsCacheKey,
    () => {
      if (mode === "class") return effectiveClassId ? getScheduleByClass(effectiveClassId) : Promise.resolve([]);
      return effectiveTeacherId ? getScheduleByTeacher(effectiveTeacherId) : Promise.resolve([]);
    },
    [mode, effectiveClassId, effectiveTeacherId],
  );

  // Vue grille = édition directe du récurrent (mode classe uniquement). Partout ailleurs (liste, ou
  // mode enseignant qui n'a pas de grille), on affiche la vue effective de la semaine sélectionnée.
  const isGridView = mode === "class" && view === "grille";

  // Effectif pour la semaine sélectionnée (récurrent + déplacements/annulations ponctuels de cette
  // semaine-là) — utilisé par la vue Liste (classe ou enseignant).
  const effectiveQuery = useQuery(() => {
    if (isGridView || !weekMonday) return Promise.resolve([]);
    if (mode === "class") return effectiveClassId ? getEffectiveScheduleByClass(effectiveClassId, weekMonday) : Promise.resolve([]);
    return effectiveTeacherId ? getEffectiveScheduleByTeacher(effectiveTeacherId, weekMonday) : Promise.resolve([]);
  }, [isGridView, mode, effectiveClassId, effectiveTeacherId, weekMonday]);

  const subjectLabel = useMemo(() => new Map(subjects.map((s) => [s.id, s.label])), [subjects]);
  const roomLabel = useMemo(() => new Map(rooms.map((r) => [r.id, r.label])), [rooms]);
  const teacherName = useMemo(
    () => new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`])),
    [teachers],
  );
  // Numéro de l'enseignant sur l'emploi du temps imprimé — pour pouvoir le joindre directement
  // (ex. absence, remplacement) sans repasser par la fiche enseignant.
  const teacherPhone = useMemo(
    () => new Map(teachers.map((t) => [t.id, t.phone])),
    [teachers],
  );
  const classLabel = useMemo(() => new Map(classes.map((c) => [c.id, c.label])), [classes]);

  const classOptions: SearchableOption[] = useMemo(
    () => classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classes],
  );
  const dayLabel = useMemo(() => new Map(DAYS.map((d) => [d.key, d.label])), []);

  function refetchSchedules() {
    slotsQuery.refetch();
    effectiveQuery.refetch();
  }

  const slotsByDay = useMemo(() => {
    const map = new Map<JourSemaine, EmploiDuTemps[]>();
    for (const d of DAYS) map.set(d.key, []);
    for (const s of slotsQuery.data ?? []) map.get(s.day)?.push(s);
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [slotsQuery.data]);

  const effectiveByDay = useMemo(() => {
    const map = new Map<JourSemaine, EffectiveScheduleSlot[]>();
    for (const d of DAYS) map.set(d.key, []);
    for (const s of effectiveQuery.data ?? []) map.get(s.day)?.push(s);
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [effectiveQuery.data]);

  function printTimetable() {
    const subjectLabel = new Map(subjects.map((s) => [s.id, s.label]));
    const roomLabel = new Map(rooms.map((r) => [r.id, r.label]));
    const heading = mode === "class"
      ? (effectiveClassId ? (classLabel.get(effectiveClassId) ?? `Classe #${effectiveClassId}`) : "")
      : (effectiveTeacherId ? (teacherName.get(effectiveTeacherId) ?? `#${effectiveTeacherId}`) : "");
    const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
    const printByDay = isGridView ? slotsByDay : effectiveByDay;
    const cols = DAYS.map((d) => {
      const list = (printByDay.get(d.key) ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
      const cells = list.map((s) => {
        const who = mode === "class"
          ? (s.teacherId != null ? (teacherName.get(s.teacherId) ?? "") : "")
          : (classLabel.get(s.schoolClassId) ?? `Classe #${s.schoolClassId}`);
        const phone = mode === "class" && s.teacherId != null ? (teacherPhone.get(s.teacherId) ?? null) : null;
        const room = s.roomId != null ? (roomLabel.get(s.roomId) ?? "") : "";
        const title = s.subjectId != null ? (subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`) : (s.label ?? "Heure creuse");
        return `<div class="slot"><div class="time">${s.startTime.slice(0, 5)} – ${s.endTime.slice(0, 5)}</div>`
          + `<div class="subj">${esc(title)}</div>`
          + (who ? `<div>${esc(who)}${phone ? ` — ${esc(phone)}` : ""}</div>` : "")
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

  /** Un seul document paysage, une classe par page — regroupe l'emploi du temps de toutes les
   *  classes de l'année sélectionnée (une page = une classe, sauts de page automatiques). */
  async function printAllClasses() {
    if (classes.length === 0) return;
    setPrintingAll(true);
    try {
      const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
      const subjectLabelAll = new Map(subjects.map((s) => [s.id, s.label]));
      const roomLabelAll = new Map(rooms.map((r) => [r.id, r.label]));
      const perClass = await Promise.all(classes.map(async (c) => {
        const slots = await getScheduleByClass(c.id);
        const byDay = new Map(DAYS.map((d) => [d.key, slots.filter((s) => s.day === d.key).slice().sort((a, b) => a.startTime.localeCompare(b.startTime))]));
        const cols = DAYS.map((d) => {
          const cells = (byDay.get(d.key) ?? []).map((s) => {
            const title = s.subjectId != null ? esc(subjectLabelAll.get(s.subjectId) ?? `Matière #${s.subjectId}`) : esc(s.label ?? "Heure creuse");
            const who = s.teacherId != null ? esc(teacherName.get(s.teacherId) ?? "") : "";
            const phone = s.teacherId != null ? teacherPhone.get(s.teacherId) : null;
            const room = s.roomId != null ? esc(roomLabelAll.get(s.roomId) ?? "") : "";
            return `<div class="slot"><div class="time">${s.startTime.slice(0, 5)} – ${s.endTime.slice(0, 5)}</div>`
              + `<div class="subj">${title}</div>` + (who ? `<div>${who}${phone ? ` — ${esc(phone)}` : ""}</div>` : "") + (room ? `<div class="room">Salle : ${room}</div>` : "") + `</div>`;
          }).join("") || `<span class="empty">—</span>`;
          return `<td>${cells}</td>`;
        }).join("");
        return `<section class="page"><h1>Emploi du temps — ${esc(c.label)}</h1>`
          + `<table><thead><tr>${DAYS.map((d) => `<th>${d.label}</th>`).join("")}</tr></thead><tbody><tr>${cols}</tr></tbody></table></section>`;
      }));
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Emplois du temps — toutes les classes</title>`
        + `<style>@page{size:landscape}body{font-family:system-ui,Arial,sans-serif;color:#0f172a}`
        + `.page{padding:24px;page-break-after:always}.page:last-child{page-break-after:auto}`
        + `h1{font-size:18px;margin:0 0 12px}table{width:100%;border-collapse:collapse}`
        + `th,td{border:1px solid #cbd5e1;padding:8px;vertical-align:top;width:16.6%}th{background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:.04em}`
        + `.slot{margin-bottom:8px;padding:6px;background:#eff6ff;border-radius:6px}.time{font-weight:700;font-size:11px;color:#1d4ed8}`
        + `.subj{font-weight:600;font-size:12px}.room{color:#64748b;font-size:11px}.empty{color:#cbd5e1}@media print{.page{padding:0 0 24px}}</style>`
        + `</head><body>${perClass.join("")}<script>window.onload=function(){window.print()}</script></body></html>`;
      const w = window.open("", "_blank", "width=1200,height=800");
      if (!w) { notifyError("Autorisez les pop-ups pour imprimer / télécharger."); return; }
      w.document.write(html);
      w.document.close();
    } catch (err) {
      notifyError(err);
    } finally {
      setPrintingAll(false);
    }
  }

  async function handleCreate(input: CreateScheduleInput) {
    await createSchedule(input);
    setCreating(false);
    notifySuccess("Créneau ajouté");
    refetchSchedules();
  }
  async function handleMoveForWeek(input: MoveScheduleForWeekInput) {
    if (!movingSlot) return;
    await moveScheduleForWeek(movingSlot.scheduleId, input);
    setMovingSlot(null);
    notifySuccess("Créneau déplacé pour cette semaine");
    refetchSchedules();
  }

  async function handleCancelWeekException(slot: EffectiveScheduleSlot) {
    if (!weekMonday) return;
    await cancelScheduleWeekException(slot.scheduleId, weekMonday);
    setMovingSlot(null);
    notifySuccess("Créneau revenu à sa position habituelle pour cette semaine");
    refetchSchedules();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Emploi du temps</h1>
          <p className="text-sm text-gray-500">Planning hebdomadaire (détection de conflits)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={printTimetable}
            disabled={(isGridView ? slotsQuery.data ?? [] : effectiveQuery.data ?? []).length === 0}
          >
            Imprimer / Télécharger
          </Button>
          {mode === "class" && (
            <Button
              variant="secondary"
              onClick={printAllClasses}
              loading={printingAll}
              disabled={classes.length === 0}
            >
              Imprimer toutes les classes
            </Button>
          )}
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
            <div className="w-48">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Cycle</label>
              <Select
                value={cycleFilter}
                onChange={(e) => { setCycleFilter(e.target.value as SchoolCycle | ""); setClassId(null); }}
              >
                <option value="">Tous les cycles</option>
                {(Object.keys(SCHOOL_CYCLE_LABEL) as SchoolCycle[]).map((c) => (
                  <option key={c} value={c}>{SCHOOL_CYCLE_LABEL[c]}</option>
                ))}
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
            {effectiveTeacherId != null && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  Téléphone : {teacherPhone.get(effectiveTeacherId) || "—"}
                </span>
                <TeacherLateSmsButton
                  teacherName={teacherName.get(effectiveTeacherId) ?? "l'enseignant"}
                  phone={teacherPhone.get(effectiveTeacherId) ?? null}
                />
              </div>
            )}
          </div>
        )}
        {mode === "class" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Vue</label>
            <Segmented value={view} onChange={setView} options={[{ value: "liste", label: "Liste" }, { value: "grille", label: "Grille" }]} />
          </div>
        )}
        {!isGridView && (
          <div className="w-44">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Semaine</label>
            <DatePicker value={weekDate} onChange={(v) => setWeekDate(v || isoLocal(new Date()))} />
          </div>
        )}
      </div>

      {(isGridView ? slotsQuery.loading : effectiveQuery.loading) ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : isGridView && effectiveClassId ? (
        <TimetableGrid
          classId={effectiveClassId}
          slots={slotsQuery.data ?? []}
          classSubjects={classSubjects}
          subjects={subjects}
          teacherName={teacherName}
          slotBandMinutes={isSecondaryCycle(effectiveClassCycle) ? 120 : 60}
          onChanged={() => slotsQuery.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {DAYS.map((d, i) => {
            const slots = effectiveByDay.get(d.key) ?? [];
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
                  <div
                    key={s.scheduleId}
                    className={cn(
                      "rounded-lg border border-gray-200 p-2",
                      s.cancelled ? "bg-gray-50 opacity-60" : "bg-brand-50/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("text-xs font-semibold", s.cancelled ? "text-gray-400 line-through" : "text-brand-700")}>
                        {hhmm(s.startTime)} – {hhmm(s.endTime)}
                      </span>
                      {canWrite && mode === "class" && !s.cancelled && (
                        <button
                          type="button"
                          onClick={() => setMovingSlot(s)}
                          aria-label="Déplacer pour cette semaine"
                          className="rounded p-0.5 text-gray-400 hover:bg-white hover:text-brand-700"
                        >
                          <CalendarClock className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className={cn("text-sm font-medium", s.cancelled ? "text-gray-400 line-through" : "text-gray-800")}>
                      {s.subjectId != null ? (subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`) : (s.label ?? "Heure creuse")}
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
                    {mode === "class" && s.teacherId != null && (
                      // Numéro du professeur + SMS direct sur la carte : si on ne le voit pas en salle,
                      // on peut le contacter sans quitter l'emploi du temps.
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-400">{teacherPhone.get(s.teacherId) || "—"}</span>
                        {teacherPhone.get(s.teacherId) && (
                          <TeacherLateSmsButton
                            compact
                            teacherName={teacherName.get(s.teacherId) ?? "l'enseignant"}
                            phone={teacherPhone.get(s.teacherId) ?? null}
                          />
                        )}
                      </div>
                    )}
                    {s.moved && s.originalDay && (
                      <p className="mt-1 text-[11px] font-medium text-warning-700">
                        Déplacé depuis {dayLabel.get(s.originalDay) ?? s.originalDay}{" "}
                        {s.originalStartTime ? hhmm(s.originalStartTime) : ""}
                      </p>
                    )}
                    {s.cancelled && (
                      <p className="mt-1 text-[11px] font-medium text-error-600">Annulé cette semaine</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {effectiveClassId && (
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
      )}

      <Modal open={!!movingSlot} onClose={() => setMovingSlot(null)} title="Déplacer le créneau pour cette semaine">
        {movingSlot && weekMonday && (
          <MoveScheduleForWeekForm
            slot={movingSlot}
            weekStartDate={weekMonday}
            rooms={rooms}
            teachers={teachers}
            onSubmit={handleMoveForWeek}
            onCancelException={() => handleCancelWeekException(movingSlot)}
            onCancel={() => setMovingSlot(null)}
          />
        )}
      </Modal>

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
            onDone={() => { setFixedOpen(false); refetchSchedules(); }}
          />
        </Modal>
      )}

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Générer l'emploi du temps automatiquement">
        <AutoGenPanel
          classes={classes.map((c) => ({ id: c.id, label: c.label }))}
          defaultClassId={effectiveClassId}
          onClose={() => setGenOpen(false)}
          onApplied={() => { setGenOpen(false); refetchSchedules(); }}
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
