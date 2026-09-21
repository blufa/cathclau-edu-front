"use client";

import { Fragment, useMemo, useState } from "react";
import { CalendarCheck, ChevronDown, ChevronRight, ClipboardList, ScanLine, Settings, UserCheck, Users } from "lucide-react";
import { AttendanceSettingsPanel } from "@/components/attendance/attendance-settings-panel";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses, getScheduleByClass, getScheduleByTeacher, listSubjects } from "@/lib/api/academics";
import type { Classe, EmploiDuTemps, Matiere } from "@/lib/types/academics";
import { searchStudents } from "@/lib/api/students";
import { listEmployees, listTeachers } from "@/lib/api/staff";
import {
  getAbsenteeListPdfObjectUrl,
  getClassAttendance,
  getClassCheckins,
  getEmployeeAttendance,
  getEmployeeMonthlySummary,
  getLatenessReportPdfObjectUrl,
  getTeacherAttendance,
  getTeacherCheckins,
  getTeacherMonthlySummary,
  getUnjustifiedAlerts,
  justifyAttendance,
  markEmployeeAbsent,
  notifyParentNow,
  recordBulkAttendance,
  recordTeacherAttendance,
} from "@/lib/api/attendance";
import { submitManualEntryOfflineAware, submitManualExitOfflineAware } from "@/lib/offline/submit-attendance-offline-aware";
import {
  ATTENDANCE_STATUS_LABEL,
  type AttendanceStatus,
  type StudentAttendance,
  type StudentCheckin,
} from "@/lib/types/attendance";
import { formatMinutes, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Student } from "@/lib/types/student";
import type { Teacher } from "@/lib/types/staff";
import type { Employee } from "@/lib/api/staff";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FilePreview } from "@/components/ui/file-preview";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<AttendanceStatus, "green" | "red" | "amber"> = {
  PRESENT: "green",
  ABSENT: "red",
  LATE: "amber",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowHm() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Résout le libellé d'un cours (nom de matière, ou libellé libre si pas de matière formelle) et de
 * la classe concernée, à partir d'un emploi du temps, du catalogue des matières et de la liste des
 * classes — pour afficher « pour quel cours, dans quelle classe » sur le détail des séances
 * (entrée/retard/sortie/départ anticipé), pas juste des totaux journaliers. Un enseignant enseignant
 * la même matière dans plusieurs classes, le nom du cours seul ne suffit pas à les distinguer. */
function useSessionLabels(
  slots: EmploiDuTemps[] | null | undefined,
  subjects: Matiere[] | null | undefined,
  classes: Classe[] | null | undefined,
) {
  return useMemo(() => {
    const subjectById = new Map((subjects ?? []).map((s) => [s.id, s.label]));
    const classById = new Map((classes ?? []).map((c) => [c.id, c.label]));
    const slotById = new Map((slots ?? []).map((s) => [s.id, s]));
    const courseLabel = (slotId: number) => {
      const slot = slotById.get(slotId);
      if (!slot) return "Cours";
      if (slot.subjectId != null) return subjectById.get(slot.subjectId) ?? "Cours";
      return slot.label ?? "Cours";
    };
    const classLabel = (slotId: number) => {
      const slot = slotById.get(slotId);
      if (!slot) return null;
      return classById.get(slot.schoolClassId) ?? null;
    };
    return { courseLabel, classLabel };
  }, [slots, subjects, classes]);
}

interface SessionCheckinLike {
  scheduleSlotId: number;
  checkInTime: string;
  checkOutTime: string | null;
  lateMinutes: number;
  earlyMinutes: number | null;
}

/** Détail des séances d'une journée pour une personne (élève/enseignant) : pour chaque cours,
 * l'heure d'entrée réelle (à l'heure/en retard) et de sortie réelle (à l'heure/départ anticipé) —
 * un pointage global par jour ne dit pas POUR QUEL COURS la personne est arrivée à l'heure ou en
 * retard, utile dès qu'il y a plusieurs séances (donc plusieurs entrées/sorties) le même jour. */
function SessionsDetail({ checkins, courseLabel, classLabel }: {
  checkins: SessionCheckinLike[];
  courseLabel: (slotId: number) => string;
  /** Optionnel : sur le tableau élèves, la classe est déjà fixée pour tout le tableau (redondant) —
   * seul le tableau enseignants (qui peut couvrir plusieurs classes) le fournit. */
  classLabel?: (slotId: number) => string | null;
}) {
  if (checkins.length === 0) {
    return <p className="px-3 py-2 text-xs text-gray-400">Aucune séance pointée ce jour-là.</p>;
  }
  const sorted = [...checkins].sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
      <Table>
        <THead>
          <tr>
            <TH>Cours</TH>
            {classLabel && <TH className="hidden sm:table-cell">Classe</TH>}
            <TH>Entrée</TH><TH>Statut entrée</TH><TH>Sortie</TH><TH>Statut sortie</TH>
          </tr>
        </THead>
        <TBody>
          {sorted.map((c, i) => (
            <TR key={i}>
              <TD className="text-xs font-medium text-gray-700">{courseLabel(c.scheduleSlotId)}</TD>
              {classLabel && <TD className="hidden text-xs text-gray-600 sm:table-cell">{classLabel(c.scheduleSlotId) ?? "—"}</TD>}
              <TD className="text-xs">{formatTime(c.checkInTime)}</TD>
              <TD className="text-xs">
                {c.lateMinutes > 0
                  ? <Badge tone="amber">Retard {formatMinutes(c.lateMinutes)}</Badge>
                  : <Badge tone="green">À l&apos;heure</Badge>}
              </TD>
              <TD className="text-xs">{formatTime(c.checkOutTime)}</TD>
              <TD className="text-xs">
                {!c.checkOutTime
                  ? <Badge tone="gray">—</Badge>
                  : c.earlyMinutes && c.earlyMinutes > 0
                    ? <Badge tone="amber">Anticipé {formatMinutes(c.earlyMinutes)}</Badge>
                    : <Badge tone="green">À l&apos;heure</Badge>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/** Bouton chevron pour déplier/replier le détail des séances d'une ligne. */
function ExpandToggle({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={expanded ? "Masquer le détail" : "Voir le détail des séances"}
      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "SECRETARY") || hasAnyPermission(user, ["presence:create"]);
  const canManageStaff = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY");
  const canManageSettings = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? defaultYearId;

  const classesQuery = useCachedQuery(
    effectiveYearId ? `classes:${effectiveYearId}` : null,
    () => listClasses(effectiveYearId as number),
    [effectiveYearId],
  );
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const classOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", trigger: "Toutes les classes", label: "Toutes les classes", searchText: "toutes" },
      ...classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    ],
    [classes],
  );

  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [pdf, setPdf] = useState<{ url: string; title: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState<"absents" | "retards" | null>(null);

  async function openAbsentees() {
    if (!classId || !date) return;
    setPdfLoading("absents");
    try { setPdf({ url: await getAbsenteeListPdfObjectUrl(classId, date), title: "Liste des absents" }); }
    catch (err) { notifyError(err); } finally { setPdfLoading(null); }
  }
  async function openLateness() {
    if (!classId || !date) return;
    setPdfLoading("retards");
    const from = date.slice(0, 8) + "01"; // premier jour du mois de la date sélectionnée
    try { setPdf({ url: await getLatenessReportPdfObjectUrl(classId, from, date), title: "Rapport des retards" }); }
    catch (err) { notifyError(err); } finally { setPdfLoading(null); }
  }

  const studentsQuery = useCachedQuery(
    classId ? `attendance-class-students:${classId}` : null,
    () => searchStudents({ classId: classId as number, size: 300 }).then((p) => p.content),
    [classId],
  );
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Présences</h1>
          <p className="text-sm text-gray-500">Appel de classe et suivi de l&apos;assiduité</p>
        </div>
        <LinkButton href="/attendance/scan" variant="outline" leftSection={<ScanLine className="h-4 w-4" />}>
          Scanner les cartes
        </LinkButton>
      </Reveal>

      {/* Shared selectors */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:w-auto">
          <label className="mb-1 block text-xs text-gray-500">Année</label>
          <Select
            className="w-full sm:max-w-[200px]"
            value={effectiveYearId ?? ""}
            onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="mb-1 block text-xs text-gray-500">Classe</label>
          <SearchableSelect
            value={classId != null ? String(classId) : ""}
            options={classOptions}
            onChange={(v) => setClassId(v ? Number(v) : null)}
            triggerClassName="w-full sm:max-w-[220px] justify-between px-3"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="mb-1 block text-xs text-gray-500">Date</label>
          <DatePicker value={date} onChange={(v) => setDate(v)} className="w-full sm:max-w-[180px]" maxDate={new Date()} />
        </div>
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
          <Button variant="secondary" disabled={!classId || !date} loading={pdfLoading === "absents"} onClick={openAbsentees} fullWidth className="sm:w-auto">
            Liste des absents (PDF)
          </Button>
          <Button variant="secondary" disabled={!classId || !date} loading={pdfLoading === "retards"} onClick={openLateness} fullWidth className="sm:w-auto">
            Retards du mois (PDF)
          </Button>
        </div>
      </div>

      <Tabs defaultValue="appel">
        <TabsList>
          <TabsTrigger value="appel" icon={ClipboardList}>Appel de classe</TabsTrigger>
          <TabsTrigger value="suivi" icon={CalendarCheck}>Présences élèves</TabsTrigger>
          {canManageStaff && (
            <TabsTrigger value="staff" icon={UserCheck}>Présences enseignants</TabsTrigger>
          )}
          {canManageStaff && (
            <TabsTrigger value="personnel" icon={Users}>Présences personnel</TabsTrigger>
          )}
          {canManageSettings && (
            <TabsTrigger value="settings" icon={Settings}>Réglages</TabsTrigger>
          )}
        </TabsList>

        <TabsPanel value="appel">
          {classId ? (
            <RollCall classId={classId} date={date} students={students} loading={studentsQuery.loading} canWrite={canWrite} />
          ) : (
            <SelectClassHint />
          )}
        </TabsPanel>

        <TabsPanel value="suivi">
          {classId ? (
            <AttendanceLog classId={classId} date={date} students={students} canWrite={canWrite} />
          ) : (
            <AttendanceLogAllClasses classes={classes} date={date} onPickClass={setClassId} />
          )}
        </TabsPanel>

        {canManageStaff && (
          <TabsPanel value="staff">
            <div className="space-y-6">
              <TeacherRollCall date={date} classes={classes} />
              <TeacherMonthlyRecap />
            </div>
          </TabsPanel>
        )}

        {canManageStaff && (
          <TabsPanel value="personnel">
            <div className="space-y-6">
              <EmployeeRollCall date={date} />
              <EmployeeMonthlyRecap />
            </div>
          </TabsPanel>
        )}

        {canManageSettings && (
          <TabsPanel value="settings">
            <AttendanceSettingsPanel canWrite={canManageSettings} />
          </TabsPanel>
        )}
      </Tabs>

      <FilePreview url={pdf?.url ?? null} title={pdf?.title} open={pdf != null} onClose={() => setPdf(null)} />
    </div>
  );
}

// ── Roll call (bulk entry) ───────────────────────────────────────────────────
function RollCall({ classId, date, students, loading, canWrite }: {
  classId: number; date: string; students: Student[]; loading: boolean; canWrite: boolean;
}) {
  const [entries, setEntries] = useState<Record<number, { status: AttendanceStatus; reason: string }>>({});
  const [saving, setSaving] = useState(false);

  function statusOf(id: number): AttendanceStatus {
    return entries[id]?.status ?? "PRESENT";
  }
  function setStatus(id: number, status: AttendanceStatus) {
    setEntries((p) => ({ ...p, [id]: { status, reason: p[id]?.reason ?? "" } }));
  }
  function setReason(id: number, reason: string) {
    setEntries((p) => ({ ...p, [id]: { status: p[id]?.status ?? "PRESENT", reason } }));
  }
  function allPresent() {
    const next: Record<number, { status: AttendanceStatus; reason: string }> = {};
    for (const s of students) next[s.id] = { status: "PRESENT", reason: "" };
    setEntries(next);
  }

  async function save() {
    setSaving(true);
    try {
      await recordBulkAttendance(
        classId,
        date,
        students.map((s) => ({ studentId: s.id, status: statusOf(s.id), reason: entries[s.id]?.reason || null })),
      );
      notifySuccess("Appel enregistré");
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (students.length === 0) return <p className="py-8 text-center text-sm text-gray-400">Aucun élève dans cette classe.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={allPresent}>Tout présent</Button>
        {canWrite && <Button size="sm" loading={saving} onClick={save}>Enregistrer l&apos;appel</Button>}
      </div>
      <Table>
        <THead>
          <tr><TH>Élève</TH><TH>Statut</TH><TH>Motif</TH></tr>
        </THead>
        <TBody>
          {students.map((s) => {
            const status = statusOf(s.id);
            return (
              <TR key={s.id}>
                <TD className="font-medium text-gray-900">{s.firstName} {s.lastName}</TD>
                <TD>
                  <div className="flex gap-1">
                    {(["PRESENT", "ABSENT", "LATE"] as AttendanceStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatus(s.id, st)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          status === st
                            ? st === "PRESENT" ? "bg-success-600 text-white"
                              : st === "ABSENT" ? "bg-error-600 text-white" : "bg-warning-500 text-white"
                            : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {ATTENDANCE_STATUS_LABEL[st]}
                      </button>
                    ))}
                  </div>
                </TD>
                <TD>
                  {status !== "PRESENT" && (
                    <Input
                      placeholder="Motif (optionnel)"
                      value={entries[s.id]?.reason ?? ""}
                      onChange={(e) => setReason(s.id, e.target.value)}
                      className="max-w-[220px]"
                    />
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

// ── Attendance log (view + correction) ───────────────────────────────────────
function AttendanceLog({ classId, date, students, canWrite }: {
  classId: number; date: string; students: Student[]; canWrite: boolean;
}) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const { data, loading, error, refetch } = useQuery(
    () => getClassAttendance(classId, date),
    [classId, date],
  );
  // Toujours afficher TOUS les élèves de la classe (comme TeacherRollCall/EmployeeRollCall listent
  // tous les enseignants/personnel), pas seulement ceux ayant déjà un enregistrement — avant, cet
  // onglet n'affichait qu'un enregistrement existant (créé via « Appel de classe »), donc restait
  // vide tant que l'appel n'avait pas été fait, contrairement aux onglets enseignants/personnel qui
  // partent toujours de la liste complète.
  const recordByStudent = useMemo(
    () => new Map((data ?? []).map((r) => [r.studentId, r])),
    [data],
  );
  // Pointages par séance (entrée/sortie), séparés de l'enregistrement journalier ci-dessus : un élève
  // peut avoir plusieurs séances (donc plusieurs sorties) le même jour. Sans ça, l'heure de sortie et
  // le départ anticipé (déjà scannés/saisis) n'apparaissaient nulle part sur ce tableau, contrairement
  // aux onglets enseignants/personnel qui les affichent.
  const checkinsQuery = useQuery(() => getClassCheckins(classId, date), [classId, date]);
  const checkinsByStudent = useMemo(() => {
    const map = new Map<number, { lastCheckout: string | null; totalEarly: number }>();
    for (const c of checkinsQuery.data ?? []) {
      const prev = map.get(c.studentId) ?? { lastCheckout: null, totalEarly: 0 };
      map.set(c.studentId, {
        lastCheckout: c.checkOutTime ?? prev.lastCheckout,
        totalEarly: prev.totalEarly + (c.earlyMinutes ?? 0),
      });
    }
    return map;
  }, [checkinsQuery.data]);
  // Liste brute (pas l'agrégat ci-dessus) pour le détail dépliable par élève : pour quel cours il est
  // entré à l'heure/en retard, reparti à l'heure/en avance — schedule + matières chargés une seule
  // fois pour toute la classe (pas par élève).
  const rawCheckinsByStudent = useMemo(() => {
    const map = new Map<number, StudentCheckin[]>();
    for (const c of checkinsQuery.data ?? []) {
      const list = map.get(c.studentId) ?? [];
      list.push(c);
      map.set(c.studentId, list);
    }
    return map;
  }, [checkinsQuery.data]);
  const scheduleQuery = useCachedQuery(`schedule-class:${classId}`, () => getScheduleByClass(classId), [classId]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);
  // Pas de classLabel ici : le tableau élèves est déjà scopé à une seule classe (redondant de l'afficher).
  const { courseLabel } = useSessionLabels(scheduleQuery.data, subjectsQuery.data, null);
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
  function toggleExpanded(studentId: number) {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }
  function refetchAll() { refetch(); checkinsQuery.refetch(); }
  const nameOf = useMemo(
    () => new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [students],
  );
  const monthStart = `${date.slice(0, 7)}-01`;
  const alertsQuery = useQuery(() => getUnjustifiedAlerts(classId, { from: monthStart, to: date, threshold: 2 }), [classId, date]);
  const [search, setSearch] = useState("");
  const filteredStudents = useMemo(
    () => students.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())),
    [students, search],
  );

  // Corriger vers « Présent » demande l'heure d'entrée (le retard est calculé automatiquement vs
  // l'emploi du temps, comme pour un scan) — clés par studentId (pas par id d'enregistrement, qui
  // peut ne pas encore exister pour un élève sans pointage).
  const [pendingPresent, setPendingPresent] = useState<Record<number, string>>({});
  const [savingPresent, setSavingPresent] = useState<number | null>(null);
  // Sortie manuelle (badge oublié) : même principe, sur la séance en cours à l'heure saisie.
  const [pendingExit, setPendingExit] = useState<Record<number, string>>({});
  const [savingExit, setSavingExit] = useState<number | null>(null);
  // « Retard »/« Absent » directs : passent par le même endpoint que l'appel de classe (upsert par
  // élève+date), donc fonctionnent même sans enregistrement préalable.
  const [savingStatus, setSavingStatus] = useState<number | null>(null);

  async function justify(rec: StudentAttendance, justified: boolean) {
    try {
      await justifyAttendance(rec.id, { justified, reason: rec.reason });
      notifySuccess(justified ? "Absence justifiée" : "Marquée non justifiée");
      refetch();
      alertsQuery.refetch();
    } catch (err) { notifyError(err); }
  }

  async function setStatus(studentId: number, status: AttendanceStatus) {
    setSavingStatus(studentId);
    try {
      await recordBulkAttendance(classId, date, [{ studentId, status }]);
      notifySuccess("Présence enregistrée");
      refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingStatus(null);
    }
  }

  function askEntryTime(studentId: number) {
    setPendingPresent((p) => ({ ...p, [studentId]: nowHm() }));
  }
  function cancelEntryTime(studentId: number) {
    setPendingPresent((p) => { const next = { ...p }; delete next[studentId]; return next; });
  }
  async function confirmPresent(studentId: number) {
    const time = pendingPresent[studentId];
    if (!time) return;
    setSavingPresent(studentId);
    try {
      const attempt = await submitManualEntryOfflineAware("STUDENT", studentId, date, time);
      notifySuccess(attempt.outcome === "queued"
        ? "Présence enregistrée hors-ligne — sera synchronisée automatiquement."
        : "Présence enregistrée");
      cancelEntryTime(studentId);
      refetchAll();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingPresent(null);
    }
  }

  function askExitTime(studentId: number) {
    setPendingExit((p) => ({ ...p, [studentId]: nowHm() }));
  }
  function cancelExitTime(studentId: number) {
    setPendingExit((p) => { const next = { ...p }; delete next[studentId]; return next; });
  }
  async function confirmExit(studentId: number) {
    const time = pendingExit[studentId];
    if (!time) return;
    setSavingExit(studentId);
    try {
      const attempt = await submitManualExitOfflineAware("STUDENT", studentId, date, time);
      notifySuccess(attempt.outcome === "queued"
        ? "Sortie enregistrée hors-ligne — sera synchronisée automatiquement."
        : "Sortie enregistrée");
      cancelExitTime(studentId);
      refetchAll();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingExit(null);
    }
  }

  async function notify(rec: StudentAttendance) {
    try {
      await notifyParentNow(rec.id);
      notifySuccess("Parent marqué notifié");
      refetch();
    } catch (err) {
      notifyError(err);
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (error) return <p className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700">Impossible de charger les présences.</p>;
  const alerts = alertsQuery.data ?? [];

  return (
    <div className="space-y-3">
      {alerts.length > 0 && (
        <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <strong>Alerte assiduité</strong> — {alerts.length} élève(s) avec ≥ 2 absences non justifiées ce mois (convocation parents recommandée) :{" "}
          {alerts.map((a) => `${nameOf.get(a.studentId) ?? `#${a.studentId}`} (${a.unjustifiedCount})`).join(", ")}.
        </div>
      )}
      {students.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Aucun élève dans cette classe.</p>
      ) : (
        <>
        <Input placeholder="Rechercher un élève…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-xs" />
        <Table>
          <THead>
            <tr>
              <TH></TH><TH>Élève</TH><TH>Statut</TH>
              <TH className="hidden sm:table-cell">Heure d&apos;entrée</TH>
              <TH className="hidden sm:table-cell">Retard</TH>
              <TH className="hidden sm:table-cell">Heure de sortie</TH>
              <TH className="hidden sm:table-cell">Départ anticipé</TH>
              <TH className="hidden sm:table-cell">Motif</TH>
              <TH className="hidden sm:table-cell">Justification</TH>
              <TH className="hidden sm:table-cell">Parent</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {filteredStudents.map((s) => {
              const r = recordByStudent.get(s.id) ?? null;
              const checkin = checkinsByStudent.get(s.id);
              const rawCheckins = rawCheckinsByStudent.get(s.id) ?? [];
              const isExpanded = expandedStudents.has(s.id);
              return (
              <Fragment key={s.id}>
              <TR>
                <TD>
                  {rawCheckins.length > 0 && <ExpandToggle expanded={isExpanded} onClick={() => toggleExpanded(s.id)} />}
                </TD>
                <TD className="font-medium text-gray-900">{nameOf.get(s.id) ?? `#${s.id}`}</TD>
                <TD>{r ? <Badge tone={STATUS_TONE[r.status]}>{ATTENDANCE_STATUS_LABEL[r.status]}</Badge> : <Badge tone="gray">Aucun pointage</Badge>}</TD>
                <TD className="hidden sm:table-cell">{formatTime(r?.checkInTime)}</TD>
                <TD className={cn("hidden sm:table-cell", r?.lateMinutes && r.lateMinutes > 0 ? "text-warning-600" : undefined)}>
                  {r?.lateMinutes && r.lateMinutes > 0 ? formatMinutes(r.lateMinutes) : "—"}
                </TD>
                <TD className="hidden sm:table-cell">{formatTime(checkin?.lastCheckout ?? null)}</TD>
                <TD className={cn("hidden sm:table-cell", checkin?.totalEarly ? "text-warning-600" : undefined)}>
                  {checkin?.totalEarly ? formatMinutes(checkin.totalEarly) : "—"}
                </TD>
                <TD className="hidden text-gray-600 sm:table-cell">{r?.reason ?? "—"}</TD>
                <TD className="hidden sm:table-cell">
                  {!r || r.status === "PRESENT" ? "—" : (
                    <div className="flex items-center gap-1">
                      <Badge tone={r.justified === true ? "green" : r.justified === false ? "red" : "gray"}>
                        {r.justified === true ? "Justifiée" : r.justified === false ? "Non justifiée" : "À traiter"}
                      </Badge>
                      {canWrite && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => justify(r, true)} aria-label="Justifier">✓</Button>
                          <Button size="sm" variant="ghost" className="text-error-600" onClick={() => justify(r, false)} aria-label="Non justifiée">✕</Button>
                        </>
                      )}
                    </div>
                  )}
                </TD>
                <TD className="hidden sm:table-cell">{r?.parentNotified ? <Badge tone="green">Notifié</Badge> : <Badge tone="gray">—</Badge>}</TD>
                <TD className="text-right">
                  {canWrite && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {pendingPresent[s.id] !== undefined ? (
                        <>
                          <Input type="time" value={pendingPresent[s.id]}
                            onChange={(e) => setPendingPresent((p) => ({ ...p, [s.id]: e.target.value }))}
                            className="w-24" />
                          <Button size="sm" loading={savingPresent === s.id} onClick={() => confirmPresent(s.id)}>OK</Button>
                          <Button size="sm" variant="ghost" onClick={() => cancelEntryTime(s.id)}>Annuler</Button>
                        </>
                      ) : pendingExit[s.id] !== undefined ? (
                        <>
                          <Input type="time" value={pendingExit[s.id]}
                            onChange={(e) => setPendingExit((p) => ({ ...p, [s.id]: e.target.value }))}
                            className="w-24" />
                          <Button size="sm" loading={savingExit === s.id} onClick={() => confirmExit(s.id)}>OK</Button>
                          <Button size="sm" variant="ghost" onClick={() => cancelExitTime(s.id)}>Annuler</Button>
                        </>
                      ) : (
                        // Mêmes boutons directs que pour les enseignants/personnel (TeacherRollCallRow,
                        // EmployeeRollCallRow) plutôt qu'un menu déroulant — même geste, même endroit
                        // pour tout le monde. « Présent »/« Sortie » demandent l'heure (retard/départ
                        // anticipé calculés automatiquement) ; « Retard »/« Absent » sont directs.
                        <>
                          <Button size="sm" variant="ghost" className="text-success-700" onClick={() => askEntryTime(s.id)}>Présent</Button>
                          <Button size="sm" variant="ghost" className="text-warning-700" loading={savingStatus === s.id} onClick={() => setStatus(s.id, "LATE")}>Retard</Button>
                          <Button size="sm" variant="ghost" className="text-brand-700" onClick={() => askExitTime(s.id)}>Sortie</Button>
                          <Button size="sm" variant="ghost" className="text-error-600" loading={savingStatus === s.id} onClick={() => setStatus(s.id, "ABSENT")}>Absent</Button>
                        </>
                      )}
                      {r && r.status !== "PRESENT" && !r.parentNotified && (
                        <Button size="sm" variant="ghost" onClick={() => notify(r)}>Notifier parent</Button>
                      )}
                    </div>
                  )}
                </TD>
              </TR>
              {isExpanded && (
                <TR>
                  {/* colSpan surdimensionné : le navigateur le limite automatiquement au nombre de
                      colonnes réellement visibles, qui varie selon la largeur d'écran (colonnes
                      masquées sur mobile ci-dessus) — évite de recalculer un compte exact. */}
                  <TD colSpan={100} className="bg-gray-50 p-0">
                    <SessionsDetail checkins={rawCheckins} courseLabel={courseLabel} />
                  </TD>
                </TR>
              )}
              </Fragment>
              );
            })}
          </TBody>
        </Table>
        </>
      )}
    </div>
  );
}

// ── Hints ────────────────────────────────────────────────────────────────────
function SelectClassHint() {
  return (
    <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
      Sélectionnez une classe ci-dessus pour faire l&apos;appel — l&apos;appel se fait forcément classe
      par classe.
    </p>
  );
}

/**
 * Vue d'ensemble en lecture seule des présences élèves de TOUTES les classes pour une date, quand
 * aucune classe n'est sélectionnée (§Correction-hier.md : plus de filtre obligatoire par défaut). Pas
 * d'actions de correction ici (retard/sortie anticipée/justification) — celles-ci restent sur
 * AttendanceLog, qui a besoin de l'emploi du temps d'UNE classe pour les calculer correctement ;
 * sélectionner une classe précise bascule sur cette vue complète.
 */
function AttendanceLogAllClasses({ classes, date, onPickClass }: {
  classes: Classe[]; date: string; onPickClass: (classId: number) => void;
}) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const rowsQuery = useQuery(
    () => Promise.allSettled(classes.map((c) => getClassAttendance(c.id, date).then((rows) => ({ c, rows }))))
      .then((results) => results.flatMap((r) => (r.status === "fulfilled" ? r.value.rows.map((row) => ({ row, classLabel: r.value.c.label, classId: r.value.c.id })) : []))),
    [classes.map((c) => c.id).join(","), date],
  );
  const studentsQuery = useCachedQuery(tenantId ? `students-all-v2:${tenantId}` : null, () => searchStudents({ size: 1000 }).then((p) => p.content), [tenantId]);
  const nameOf = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [studentsQuery.data],
  );
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const all = rowsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((r) => (nameOf.get(r.row.studentId) ?? "").toLowerCase().includes(q) || r.classLabel.toLowerCase().includes(q)) : all;
  }, [rowsQuery.data, search, nameOf]);

  return (
    <div className="space-y-3">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève ou une classe..." className="max-w-xs" />
      {rowsQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><TR><TH>Élève</TH><TH>Classe</TH><TH>Statut</TH><TH className="text-right">Action</TH></TR></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-gray-400">Aucune présence enregistrée pour cette date.</TD></TR>}
            {rows.map(({ row, classLabel, classId: cId }) => (
              <TR key={row.id}>
                <TD>{nameOf.get(row.studentId) ?? `#${row.studentId}`}</TD>
                <TD>{classLabel}</TD>
                <TD><Badge tone={STATUS_TONE[row.status]}>{ATTENDANCE_STATUS_LABEL[row.status]}</Badge></TD>
                <TD className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => onPickClass(cId)}>Voir la classe</Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

// ── Teacher roll call (separate table) ───────────────────────────────────────
function TeacherRollCall({ date, classes }: { date: string; classes: Classe[] }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, () => listTeachers(), [tenantId]);
  const teachers = useMemo<Teacher[]>(() => teachersQuery.data ?? [], [teachersQuery.data]);
  // Catalogue des matières chargé une seule fois pour toute la liste (pas par ligne), pour afficher
  // le nom du cours ET la classe dans le détail des séances de chaque enseignant — un enseignant
  // pouvant donner la même matière dans plusieurs classes, le nom du cours seul ne suffit pas.
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);
  const [search, setSearch] = useState("");
  const filteredTeachers = useMemo(
    () => teachers.filter((t) => `${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase())),
    [teachers, search],
  );

  if (teachersQuery.loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (teachers.length === 0) return <p className="py-8 text-center text-sm text-gray-400">Aucun enseignant.</p>;

  return (
    <div className="space-y-3">
      <Input placeholder="Rechercher un enseignant…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      <Table>
        <THead>
          <tr>
            <TH></TH><TH>Enseignant</TH><TH className="hidden sm:table-cell">Matricule</TH><TH>Statut</TH>
            <TH className="hidden sm:table-cell">Heure d&apos;entrée</TH><TH className="hidden sm:table-cell">Retard</TH>
            <TH className="hidden sm:table-cell">Heure de sortie</TH><TH className="hidden sm:table-cell">Départ anticipé</TH>
            <TH className="text-right">Marquer ({date})</TH>
          </tr>
        </THead>
        <TBody>
          {filteredTeachers.map((t) => (
            <TeacherRollCallRow key={t.id} teacher={t} date={date} subjects={subjectsQuery.data} classes={classes} />
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/** Une ligne = un enseignant : affiche son pointage réel du jour (statut, entrée/sortie, retard et
 * départ anticipé cumulés — qu'il vienne d'un scan de badge ou d'une saisie manuelle en cas de badge
 * oublié), avec les boutons pour le corriger. Le retard et le départ anticipé sont tous deux déduits
 * des heures effectives sur la fiche de paie (§payroll). Le détail dépliable montre, séance par
 * séance, pour quel cours ET quelle classe l'enseignant est arrivé à l'heure/en retard et reparti à
 * l'heure/en avance — les totaux ci-dessus ne le disent pas dès qu'il y a plusieurs séances le même
 * jour (potentiellement dans des classes différentes). */
function TeacherRollCallRow({ teacher: t, date, subjects, classes }: {
  teacher: Teacher; date: string; subjects: Matiere[] | null | undefined; classes: Classe[];
}) {
  const { data, loading, refetch } = useQuery(() => getTeacherAttendance(t.id, date, date), [t.id, date]);
  const checkinsQuery = useQuery(() => getTeacherCheckins(t.id, date), [t.id, date]);
  const scheduleQuery = useCachedQuery(`schedule-teacher:${t.id}`, () => getScheduleByTeacher(t.id), [t.id]);
  const { courseLabel, classLabel } = useSessionLabels(scheduleQuery.data, subjects, classes);
  const record = (data ?? []).find((a) => a.date === date) ?? null;
  const checkins = checkinsQuery.data ?? [];
  const lastCheckout = [...checkins].reverse().find((c) => c.checkOutTime)?.checkOutTime ?? null;
  const totalEarly = checkins.reduce((sum, c) => sum + (c.earlyMinutes ?? 0), 0);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  // Marquer « Présent »/« Sortie » demande l'heure — le retard/départ anticipé est calculé
  // automatiquement vs l'emploi du temps, comme pour un scan (§attendance/scan).
  const [enteringTime, setEnteringTime] = useState(false);
  const [exitingTime, setExitingTime] = useState(false);
  const [time, setTime] = useState(nowHm());

  function refetchAll() { refetch(); checkinsQuery.refetch(); }

  async function markPresent() {
    setBusy(true);
    try {
      const attempt = await submitManualEntryOfflineAware("TEACHER", t.id, date, time);
      notifySuccess(attempt.outcome === "queued"
        ? "Présence enregistrée hors-ligne — sera synchronisée automatiquement."
        : "Présence enregistrée");
      setEnteringTime(false);
      refetchAll();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }
  async function recordExit() {
    setBusy(true);
    try {
      const attempt = await submitManualExitOfflineAware("TEACHER", t.id, date, time);
      notifySuccess(attempt.outcome === "queued"
        ? "Sortie enregistrée hors-ligne — sera synchronisée automatiquement."
        : "Sortie enregistrée");
      setExitingTime(false);
      refetchAll();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }
  async function markAbsent() {
    setBusy(true);
    try {
      await recordTeacherAttendance(t.id, date, "ABSENT");
      notifySuccess("Présence enregistrée");
      refetchAll();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TR>
        <TD>
          {checkins.length > 0 && <ExpandToggle expanded={expanded} onClick={() => setExpanded((e) => !e)} />}
        </TD>
        <TD className="font-medium text-gray-900">{t.firstName} {t.lastName}</TD>
        <TD className="hidden font-mono text-xs text-gray-500 sm:table-cell">{t.staffNumber}</TD>
        <TD>
          {loading ? <Spinner className="h-3.5 w-3.5" /> : record ? (
            <Badge tone={record.status === "PRESENT" ? "green" : "red"}>
              {record.status === "PRESENT" ? "Présent" : "Absent"}
            </Badge>
          ) : <Badge tone="gray">Aucun pointage</Badge>}
        </TD>
        <TD className="hidden sm:table-cell">{formatTime(record?.checkInTime)}</TD>
        <TD className={cn("hidden sm:table-cell", record?.lateMinutes && record.lateMinutes > 0 ? "text-warning-600" : undefined)}>
          {record?.lateMinutes && record.lateMinutes > 0 ? formatMinutes(record.lateMinutes) : "—"}
        </TD>
        <TD className="hidden sm:table-cell">{formatTime(lastCheckout)}</TD>
        <TD className={cn("hidden sm:table-cell", totalEarly > 0 ? "text-warning-600" : undefined)}>
          {totalEarly > 0 ? formatMinutes(totalEarly) : "—"}
        </TD>
        <TD className="text-right">
          {enteringTime ? (
            <div className="inline-flex items-center gap-2">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-24" />
              <Button size="sm" loading={busy} onClick={markPresent}>OK</Button>
              <Button size="sm" variant="ghost" onClick={() => setEnteringTime(false)}>Annuler</Button>
            </div>
          ) : exitingTime ? (
            <div className="inline-flex items-center gap-2">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-24" />
              <Button size="sm" loading={busy} onClick={recordExit}>OK</Button>
              <Button size="sm" variant="ghost" onClick={() => setExitingTime(false)}>Annuler</Button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2">
              <Button size="sm" variant="ghost" className="text-success-700" disabled={busy}
                onClick={() => { setTime(nowHm()); setEnteringTime(true); }}>Présent</Button>
              <Button size="sm" variant="ghost" className="text-brand-700" disabled={busy}
                onClick={() => { setTime(nowHm()); setExitingTime(true); }}>Sortie</Button>
              <Button size="sm" variant="ghost" className="text-error-600" disabled={busy} onClick={markAbsent}>Absent</Button>
            </div>
          )}
        </TD>
      </TR>
      {expanded && (
        <TR>
          <TD colSpan={100} className="bg-gray-50 p-0">
            <SessionsDetail checkins={checkins} courseLabel={courseLabel} classLabel={classLabel} />
          </TD>
        </TR>
      )}
    </>
  );
}

// ── Récap mensuel pointage enseignant (heures + retard cumulé) ────────────────
function TeacherMonthlyRecap() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, () => listTeachers(), [tenantId]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const teacherOptions: SearchableOption[] = useMemo(
    () => teachers.map((t) => {
      const label = `${t.firstName} ${t.lastName}`;
      return { value: String(t.id), trigger: label, label, searchText: label };
    }),
    [teachers],
  );
  const now = new Date();
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [y, m] = period.split("-").map(Number);
  const sumQuery = useQuery(
    () => (teacherId ? getTeacherMonthlySummary(Number(teacherId), y, m) : Promise.resolve(null)),
    [teacherId, period],
  );
  const s = sumQuery.data;
  const fmtH = (mins: number) => `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")}`;

  // Détail jour par jour : date, statut et heure de pointage — pas seulement les totaux du mois.
  const monthStart = `${period}-01`;
  const monthEnd = new Date(y, m, 0).toISOString().slice(0, 10);
  const historyQuery = useQuery(
    () => (teacherId ? getTeacherAttendance(Number(teacherId), monthStart, monthEnd) : Promise.resolve([])),
    [teacherId, period],
  );
  const history = [...(historyQuery.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Récap mensuel — pointage enseignant</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Enseignant</label>
          <SearchableSelect value={teacherId ?? ""} options={teacherOptions} onChange={(v) => setTeacherId(v || null)}
            triggerClassName="w-full max-w-[240px] justify-between px-3" noResultsLabel="Aucun enseignant" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Mois</label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>
      {!teacherId ? (
        <p className="mt-4 text-sm text-gray-400">Sélectionnez un enseignant.</p>
      ) : sumQuery.loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : s ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Jours présents", value: String(s.presentDays) },
            { label: "Jours absents", value: String(s.absentDays) },
            { label: "Heures dues (mois)", value: fmtH(s.dueMinutes) },
            { label: "Retard cumulé", value: fmtH(s.totalLateMinutes), warn: s.totalLateMinutes > 0 },
            { label: "Départ anticipé cumulé", value: fmtH(s.totalEarlyMinutes), warn: s.totalEarlyMinutes > 0 },
            { label: "Absences (heures)", value: fmtH(s.absentMinutes), warn: s.absentMinutes > 0 },
            { label: "Heures effectives", value: fmtH(s.effectiveMinutes), strong: true },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl px-3 py-3 ${c.strong ? "bg-brand-50" : "bg-gray-50"}`}>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`mt-1 text-lg font-bold ${c.warn ? "text-error-600" : "text-gray-900"}`}>{c.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-gray-400">Heures effectives = heures dues du mois − absences − retard cumulé − départ anticipé cumulé. Le retard tient compte de la marge de transition entre salles et des récréations (réglages).</p>

      {teacherId && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Détail jour par jour</h4>
          {historyQuery.loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <Table>
              <THead><tr><TH>Date</TH><TH>Statut</TH><TH>Heure de pointage</TH><TH>Retard</TH></tr></THead>
              <TBody>
                {history.length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-gray-400">Aucun pointage ce mois-ci.</TD></TR>}
                {history.map((a) => (
                  <TR key={a.id}>
                    <TD>{a.date}</TD>
                    <TD><Badge tone={a.status === "PRESENT" ? "green" : "red"}>{a.status === "PRESENT" ? "Présent" : "Absent"}</Badge></TD>
                    <TD>{formatTime(a.checkInTime)}</TD>
                    <TD className={a.lateMinutes && a.lateMinutes > 0 ? "text-warning-600" : undefined}>
                      {a.lateMinutes && a.lateMinutes > 0 ? fmtH(a.lateMinutes) : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Personnel non-enseignant : présence (un seul pointage par jour) ───────────
function EmployeeRollCall({ date }: { date: string }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const employeesQuery = useCachedQuery(tenantId ? `employees-all:${tenantId}` : null, () => listEmployees(), [tenantId]);
  const employees = useMemo<Employee[]>(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const [search, setSearch] = useState("");
  const filteredEmployees = useMemo(
    () => employees.filter((e) => `${e.firstName ?? ""} ${e.lastName ?? ""}`.toLowerCase().includes(search.toLowerCase())),
    [employees, search],
  );

  if (employeesQuery.loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (employees.length === 0) return <p className="py-8 text-center text-sm text-gray-400">Aucun membre du personnel.</p>;

  return (
    <div className="space-y-3">
      <Input placeholder="Rechercher un membre du personnel…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      <Table>
        <THead>
          <tr>
            <TH>Personnel</TH><TH className="hidden sm:table-cell">Matricule</TH><TH>Statut</TH>
            <TH className="hidden sm:table-cell">Heure d&apos;entrée</TH><TH className="hidden sm:table-cell">Retard</TH>
            <TH className="hidden sm:table-cell">Heure de sortie</TH><TH className="hidden sm:table-cell">Départ anticipé</TH>
            <TH className="text-right">Marquer ({date})</TH>
          </tr>
        </THead>
        <TBody>
          {filteredEmployees.map((e) => <EmployeeRollCallRow key={e.id} employee={e} date={date} />)}
        </TBody>
      </Table>
    </div>
  );
}

/** Une ligne = un membre du personnel (administratif, direction, soutien) : un seul pointage par jour
 * (pas de créneau de cours comme les enseignants), vs l'horaire de référence de l'école (réglages). */
function EmployeeRollCallRow({ employee: e, date }: { employee: Employee; date: string }) {
  const { data, loading, refetch } = useQuery(() => getEmployeeAttendance(e.id, date, date), [e.id, date]);
  const record = (data ?? []).find((a) => a.date === date) ?? null;
  const [busy, setBusy] = useState(false);
  const [enteringTime, setEnteringTime] = useState(false);
  const [exitingTime, setExitingTime] = useState(false);
  const [time, setTime] = useState(nowHm());

  async function markPresent() {
    setBusy(true);
    try {
      const attempt = await submitManualEntryOfflineAware("EMPLOYEE", e.id, date, time);
      notifySuccess(attempt.outcome === "queued"
        ? "Présence enregistrée hors-ligne — sera synchronisée automatiquement."
        : "Présence enregistrée");
      setEnteringTime(false);
      refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }
  async function recordExit() {
    setBusy(true);
    try {
      const attempt = await submitManualExitOfflineAware("EMPLOYEE", e.id, date, time);
      notifySuccess(attempt.outcome === "queued"
        ? "Sortie enregistrée hors-ligne — sera synchronisée automatiquement."
        : "Sortie enregistrée");
      setExitingTime(false);
      refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }
  async function markAbsent() {
    setBusy(true);
    try {
      await markEmployeeAbsent(e.id);
      notifySuccess("Présence enregistrée");
      refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TR>
      <TD className="font-medium text-gray-900">{e.firstName} {e.lastName}</TD>
      <TD className="hidden font-mono text-xs text-gray-500 sm:table-cell">{e.employeeNumber}</TD>
      <TD>
        {loading ? <Spinner className="h-3.5 w-3.5" /> : record ? (
          <Badge tone={record.status === "PRESENT" ? "green" : "red"}>
            {record.status === "PRESENT" ? "Présent" : "Absent"}
          </Badge>
        ) : <Badge tone="gray">Aucun pointage</Badge>}
      </TD>
      <TD className="hidden sm:table-cell">{formatTime(record?.checkInTime)}</TD>
      <TD className={cn("hidden sm:table-cell", record?.lateMinutes && record.lateMinutes > 0 ? "text-warning-600" : undefined)}>
        {record?.lateMinutes && record.lateMinutes > 0 ? formatMinutes(record.lateMinutes) : "—"}
      </TD>
      <TD className="hidden sm:table-cell">{formatTime(record?.checkOutTime)}</TD>
      <TD className={cn("hidden sm:table-cell", record?.earlyMinutes && record.earlyMinutes > 0 ? "text-warning-600" : undefined)}>
        {record?.earlyMinutes && record.earlyMinutes > 0 ? formatMinutes(record.earlyMinutes) : "—"}
      </TD>
      <TD className="text-right">
        {enteringTime ? (
          <div className="inline-flex items-center gap-2">
            <Input type="time" value={time} onChange={(e2) => setTime(e2.target.value)} className="w-24" />
            <Button size="sm" loading={busy} onClick={markPresent}>OK</Button>
            <Button size="sm" variant="ghost" onClick={() => setEnteringTime(false)}>Annuler</Button>
          </div>
        ) : exitingTime ? (
          <div className="inline-flex items-center gap-2">
            <Input type="time" value={time} onChange={(e2) => setTime(e2.target.value)} className="w-24" />
            <Button size="sm" loading={busy} onClick={recordExit}>OK</Button>
            <Button size="sm" variant="ghost" onClick={() => setExitingTime(false)}>Annuler</Button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-success-700" disabled={busy}
              onClick={() => { setTime(nowHm()); setEnteringTime(true); }}>Présent</Button>
            <Button size="sm" variant="ghost" className="text-brand-700" disabled={busy}
              onClick={() => { setTime(nowHm()); setExitingTime(true); }}>Sortie</Button>
            <Button size="sm" variant="ghost" className="text-error-600" disabled={busy} onClick={markAbsent}>Absent</Button>
          </div>
        )}
      </TD>
    </TR>
  );
}

// ── Récap mensuel pointage personnel (retard/départ anticipé cumulés) ─────────
function EmployeeMonthlyRecap() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const employeesQuery = useCachedQuery(tenantId ? `employees-all:${tenantId}` : null, () => listEmployees(), [tenantId]);
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const employeeOptions: SearchableOption[] = useMemo(
    () => employees.map((e) => {
      const label = `${e.firstName} ${e.lastName}`;
      return { value: String(e.id), trigger: label, label, searchText: label };
    }),
    [employees],
  );
  const now = new Date();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [y, m] = period.split("-").map(Number);
  const sumQuery = useQuery(
    () => (employeeId ? getEmployeeMonthlySummary(Number(employeeId), y, m) : Promise.resolve(null)),
    [employeeId, period],
  );
  const s = sumQuery.data;
  const fmtH = (mins: number) => `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")}`;

  const monthStart = `${period}-01`;
  const monthEnd = new Date(y, m, 0).toISOString().slice(0, 10);
  const historyQuery = useQuery(
    () => (employeeId ? getEmployeeAttendance(Number(employeeId), monthStart, monthEnd) : Promise.resolve([])),
    [employeeId, period],
  );
  const history = [...(historyQuery.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Récap mensuel — pointage personnel</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Membre du personnel</label>
          <SearchableSelect value={employeeId ?? ""} options={employeeOptions} onChange={(v) => setEmployeeId(v || null)}
            triggerClassName="w-full max-w-[240px] justify-between px-3" noResultsLabel="Aucun membre du personnel" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Mois</label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>
      {!employeeId ? (
        <p className="mt-4 text-sm text-gray-400">Sélectionnez un membre du personnel.</p>
      ) : sumQuery.loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : s ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Jours présents", value: String(s.presentDays) },
            { label: "Jours absents", value: String(s.absentDays) },
            { label: "Retard cumulé", value: fmtH(s.totalLateMinutes), warn: s.totalLateMinutes > 0 },
            { label: "Départ anticipé cumulé", value: fmtH(s.totalEarlyMinutes), warn: s.totalEarlyMinutes > 0 },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`mt-1 text-lg font-bold ${c.warn ? "text-error-600" : "text-gray-900"}`}>{c.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-gray-400">Retard/départ anticipé calculés vs l&apos;horaire de référence du personnel (réglages).</p>

      {employeeId && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Détail jour par jour</h4>
          {historyQuery.loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <Table>
              <THead><tr><TH>Date</TH><TH>Statut</TH><TH className="hidden sm:table-cell">Entrée</TH><TH>Retard</TH><TH className="hidden sm:table-cell">Sortie</TH><TH>Départ anticipé</TH></tr></THead>
              <TBody>
                {history.length === 0 && <TR><TD colSpan={100} className="py-6 text-center text-gray-400">Aucun pointage ce mois-ci.</TD></TR>}
                {history.map((a) => (
                  <TR key={a.id}>
                    <TD>{a.date}</TD>
                    <TD><Badge tone={a.status === "PRESENT" ? "green" : "red"}>{a.status === "PRESENT" ? "Présent" : "Absent"}</Badge></TD>
                    <TD className="hidden sm:table-cell">{formatTime(a.checkInTime)}</TD>
                    <TD className={a.lateMinutes && a.lateMinutes > 0 ? "text-warning-600" : undefined}>
                      {a.lateMinutes && a.lateMinutes > 0 ? fmtH(a.lateMinutes) : "—"}
                    </TD>
                    <TD className="hidden sm:table-cell">{formatTime(a.checkOutTime)}</TD>
                    <TD className={a.earlyMinutes && a.earlyMinutes > 0 ? "text-warning-600" : undefined}>
                      {a.earlyMinutes && a.earlyMinutes > 0 ? fmtH(a.earlyMinutes) : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
