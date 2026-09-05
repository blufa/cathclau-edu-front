"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, ClipboardList, ScanLine, Settings, UserCheck } from "lucide-react";
import { AttendanceSettingsPanel } from "@/components/attendance/attendance-settings-panel";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { searchStudents } from "@/lib/api/students";
import { listTeachers } from "@/lib/api/staff";
import {
  getAbsenteeListPdfObjectUrl,
  getClassAttendance,
  getLatenessReportPdfObjectUrl,
  getTeacherAttendance,
  getTeacherMonthlySummary,
  getUnjustifiedAlerts,
  justifyAttendance,
  markParentNotified,
  recordBulkAttendance,
  recordStudentManualEntry,
  recordTeacherAttendance,
  recordTeacherManualEntry,
  updateAttendance,
} from "@/lib/api/attendance";
import {
  ATTENDANCE_STATUS_LABEL,
  type AttendanceStatus,
  type StudentAttendance,
} from "@/lib/types/attendance";
import { formatMinutes } from "@/lib/format";
import type { Student } from "@/lib/types/student";
import type { Teacher } from "@/lib/types/staff";
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

export default function AttendancePage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "SECRETARY") || hasAnyPermission(user, ["presence:create"]);
  const canManageStaff = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY");
  const canManageSettings = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const yearsQuery = useQuery(listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? defaultYearId;

  const classesQuery = useQuery(
    () => (effectiveYearId ? listClasses(effectiveYearId) : Promise.resolve([])),
    [effectiveYearId],
  );
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const classOptions: SearchableOption[] = useMemo(
    () => classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
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

  const studentsQuery = useQuery(
    () => (classId ? searchStudents({ classId, size: 300 }).then((p) => p.content) : Promise.resolve([])),
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
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Année</label>
          <Select
            className="max-w-[200px]"
            value={effectiveYearId ?? ""}
            onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Classe</label>
          <SearchableSelect
            value={classId != null ? String(classId) : ""}
            options={classOptions}
            onChange={(v) => setClassId(v ? Number(v) : null)}
            triggerClassName="w-full max-w-[220px] justify-between px-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Date</label>
          <DatePicker value={date} onChange={(v) => setDate(v)} className="max-w-[180px]" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" disabled={!classId || !date} loading={pdfLoading === "absents"} onClick={openAbsentees}>
            Liste des absents (PDF)
          </Button>
          <Button variant="secondary" disabled={!classId || !date} loading={pdfLoading === "retards"} onClick={openLateness}>
            Retards du mois (PDF)
          </Button>
        </div>
      </div>

      <Tabs defaultValue="appel">
        <TabsList>
          <TabsTrigger value="appel" icon={ClipboardList}>Appel de classe</TabsTrigger>
          <TabsTrigger value="suivi" icon={CalendarCheck}>Suivi & corrections</TabsTrigger>
          {canManageStaff && (
            <TabsTrigger value="staff" icon={UserCheck}>Présences enseignants</TabsTrigger>
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
            <SelectClassHint />
          )}
        </TabsPanel>

        {canManageStaff && (
          <TabsPanel value="staff">
            <div className="space-y-6">
              <TeacherRollCall date={date} />
              <TeacherMonthlyRecap />
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
  const { data, loading, error, refetch } = useQuery(
    () => getClassAttendance(classId, date),
    [classId, date],
  );
  const nameOf = useMemo(
    () => new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [students],
  );
  const monthStart = `${date.slice(0, 7)}-01`;
  const alertsQuery = useQuery(() => getUnjustifiedAlerts(classId, { from: monthStart, to: date, threshold: 2 }), [classId, date]);

  // Corriger vers « Présent » demande l'heure d'entrée (le retard est calculé automatiquement vs
  // l'emploi du temps, comme pour un scan) — un id présent ici affiche l'éditeur inline pour la ligne.
  const [pendingPresent, setPendingPresent] = useState<Record<number, string>>({});
  const [savingPresent, setSavingPresent] = useState<number | null>(null);

  async function justify(rec: StudentAttendance, justified: boolean) {
    try {
      await justifyAttendance(rec.id, { justified, reason: rec.reason });
      notifySuccess(justified ? "Absence justifiée" : "Marquée non justifiée");
      refetch();
      alertsQuery.refetch();
    } catch (err) { notifyError(err); }
  }

  async function correct(rec: StudentAttendance, status: AttendanceStatus) {
    try {
      await updateAttendance(rec.id, status, rec.reason ?? undefined);
      notifySuccess("Présence corrigée");
      refetch();
    } catch (err) {
      notifyError(err);
    }
  }

  function askEntryTime(rec: StudentAttendance) {
    setPendingPresent((p) => ({ ...p, [rec.id]: nowHm() }));
  }
  function cancelEntryTime(rec: StudentAttendance) {
    setPendingPresent((p) => { const next = { ...p }; delete next[rec.id]; return next; });
  }
  async function confirmPresent(rec: StudentAttendance) {
    const time = pendingPresent[rec.id];
    if (!time) return;
    setSavingPresent(rec.id);
    try {
      await recordStudentManualEntry(rec.studentId, date, time);
      notifySuccess("Présence corrigée");
      cancelEntryTime(rec);
      refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSavingPresent(null);
    }
  }

  async function notify(rec: StudentAttendance) {
    try {
      await markParentNotified(rec.id);
      notifySuccess("Parent marqué notifié");
      refetch();
    } catch (err) {
      notifyError(err);
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (error) return <p className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700">Impossible de charger les présences.</p>;
  const rows = data ?? [];
  const alerts = alertsQuery.data ?? [];

  return (
    <div className="space-y-3">
      {alerts.length > 0 && (
        <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <strong>Alerte assiduité</strong> — {alerts.length} élève(s) avec ≥ 2 absences non justifiées ce mois (convocation parents recommandée) :{" "}
          {alerts.map((a) => `${nameOf.get(a.studentId) ?? `#${a.studentId}`} (${a.unjustifiedCount})`).join(", ")}.
        </div>
      )}
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Aucune présence enregistrée pour cette date.</p>
      ) : (
        <Table>
          <THead>
            <tr><TH>Élève</TH><TH>Statut</TH><TH>Heure d&apos;entrée</TH><TH>Retard</TH><TH>Motif</TH><TH>Justification</TH><TH>Parent</TH><TH className="text-right">Actions</TH></tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-gray-900">{nameOf.get(r.studentId) ?? `#${r.studentId}`}</TD>
                <TD><Badge tone={STATUS_TONE[r.status]}>{ATTENDANCE_STATUS_LABEL[r.status]}</Badge></TD>
                <TD>{r.checkInTime ?? "—"}</TD>
                <TD className={r.lateMinutes && r.lateMinutes > 0 ? "text-warning-600" : undefined}>
                  {r.lateMinutes && r.lateMinutes > 0 ? formatMinutes(r.lateMinutes) : "—"}
                </TD>
                <TD className="text-gray-600">{r.reason ?? "—"}</TD>
                <TD>
                  {r.status === "PRESENT" ? "—" : (
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
                <TD>{r.parentNotified ? <Badge tone="green">Notifié</Badge> : <Badge tone="gray">—</Badge>}</TD>
                <TD className="text-right">
                  {canWrite && (
                    <div className="flex items-center justify-end gap-2">
                      {pendingPresent[r.id] !== undefined ? (
                        <>
                          <Input type="time" value={pendingPresent[r.id]}
                            onChange={(e) => setPendingPresent((p) => ({ ...p, [r.id]: e.target.value }))}
                            className="w-24" />
                          <Button size="sm" loading={savingPresent === r.id} onClick={() => confirmPresent(r)}>OK</Button>
                          <Button size="sm" variant="ghost" onClick={() => cancelEntryTime(r)}>Annuler</Button>
                        </>
                      ) : (
                        <Select
                          value={r.status}
                          onChange={(e) => {
                            const v = e.target.value as AttendanceStatus;
                            if (v === "PRESENT") askEntryTime(r); else correct(r, v);
                          }}
                          className="max-w-[130px]"
                        >
                          {(["PRESENT", "ABSENT", "LATE"] as AttendanceStatus[]).map((st) => (
                            <option key={st} value={st}>{ATTENDANCE_STATUS_LABEL[st]}</option>
                          ))}
                        </Select>
                      )}
                      {r.status !== "PRESENT" && !r.parentNotified && (
                        <Button size="sm" variant="ghost" onClick={() => notify(r)}>Notifier parent</Button>
                      )}
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

// ── Hints ────────────────────────────────────────────────────────────────────
function SelectClassHint() {
  return (
    <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
      Sélectionnez une classe pour faire l&apos;appel ou consulter les présences.
    </p>
  );
}

// ── Teacher roll call (separate table) ───────────────────────────────────────
function TeacherRollCall({ date }: { date: string }) {
  const teachersQuery = useQuery(() => listTeachers(), []);
  const teachers = useMemo<Teacher[]>(() => teachersQuery.data ?? [], [teachersQuery.data]);

  if (teachersQuery.loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (teachers.length === 0) return <p className="py-8 text-center text-sm text-gray-400">Aucun enseignant.</p>;

  return (
    <Table>
      <THead>
        <tr><TH>Enseignant</TH><TH>Matricule</TH><TH>Statut</TH><TH>Heure d&apos;entrée</TH><TH>Retard</TH><TH className="text-right">Marquer ({date})</TH></tr>
      </THead>
      <TBody>
        {teachers.map((t) => <TeacherRollCallRow key={t.id} teacher={t} date={date} />)}
      </TBody>
    </Table>
  );
}

/** Une ligne = un enseignant : affiche son pointage réel du jour (statut, heure d'entrée, retard —
 * qu'il vienne d'un scan de badge ou d'une saisie manuelle), avec les boutons pour la corriger. */
function TeacherRollCallRow({ teacher: t, date }: { teacher: Teacher; date: string }) {
  const { data, loading, refetch } = useQuery(() => getTeacherAttendance(t.id, date, date), [t.id, date]);
  const record = (data ?? []).find((a) => a.date === date) ?? null;
  const [busy, setBusy] = useState(false);
  // Marquer « Présent » demande l'heure d'entrée — le retard est calculé automatiquement vs l'emploi
  // du temps, comme pour un scan (§attendance/scan).
  const [enteringTime, setEnteringTime] = useState(false);
  const [time, setTime] = useState(nowHm());

  async function markPresent() {
    setBusy(true);
    try {
      await recordTeacherManualEntry(t.id, date, time);
      notifySuccess("Présence enregistrée");
      setEnteringTime(false);
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
      await recordTeacherAttendance(t.id, date, "ABSENT");
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
      <TD className="font-medium text-gray-900">{t.firstName} {t.lastName}</TD>
      <TD className="font-mono text-xs text-gray-500">{t.staffNumber}</TD>
      <TD>
        {loading ? <Spinner className="h-3.5 w-3.5" /> : record ? (
          <Badge tone={record.status === "PRESENT" ? "green" : "red"}>
            {record.status === "PRESENT" ? "Présent" : "Absent"}
          </Badge>
        ) : <Badge tone="gray">Aucun pointage</Badge>}
      </TD>
      <TD>{record?.checkInTime ?? "—"}</TD>
      <TD className={record?.lateMinutes && record.lateMinutes > 0 ? "text-warning-600" : undefined}>
        {record?.lateMinutes && record.lateMinutes > 0 ? formatMinutes(record.lateMinutes) : "—"}
      </TD>
      <TD className="text-right">
        {enteringTime ? (
          <div className="inline-flex items-center gap-2">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-24" />
            <Button size="sm" loading={busy} onClick={markPresent}>OK</Button>
            <Button size="sm" variant="ghost" onClick={() => setEnteringTime(false)}>Annuler</Button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-success-700" disabled={busy}
              onClick={() => { setTime(nowHm()); setEnteringTime(true); }}>Présent</Button>
            <Button size="sm" variant="ghost" className="text-error-600" disabled={busy} onClick={markAbsent}>Absent</Button>
          </div>
        )}
      </TD>
    </TR>
  );
}

// ── Récap mensuel pointage enseignant (heures + retard cumulé) ────────────────
function TeacherMonthlyRecap() {
  const teachersQuery = useQuery(() => listTeachers(), []);
  const teachers = teachersQuery.data ?? [];
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
          <Select className="max-w-[240px]" value={teacherId ?? ""} onChange={(e) => setTeacherId(e.target.value || null)}>
            <option value="">Choisir…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </Select>
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
                    <TD>{a.checkInTime ?? "—"}</TD>
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
