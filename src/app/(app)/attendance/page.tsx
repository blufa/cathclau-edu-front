"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { CalendarCheck, ClipboardList, ScanLine, UserCheck } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { searchStudents } from "@/lib/api/students";
import { listTeachers } from "@/lib/api/staff";
import {
  getAbsenteeListPdfObjectUrl,
  getClassAttendance,
  getLatenessReportPdfObjectUrl,
  getTeacherMonthlySummary,
  getUnjustifiedAlerts,
  justifyAttendance,
  markParentNotified,
  recordBulkAttendance,
  recordTeacherAttendance,
  updateAttendance,
} from "@/lib/api/attendance";
import {
  ATTENDANCE_STATUS_LABEL,
  type AttendanceStatus,
  type StudentAttendance,
  type TeacherAttendanceStatus,
} from "@/lib/types/attendance";
import type { Student } from "@/lib/types/student";
import type { Teacher } from "@/lib/types/staff";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FilePreview } from "@/components/ui/file-preview";
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

export default function AttendancePage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "SECRETARY");
  const canManageStaff = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY");

  const yearsQuery = useQuery(listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? defaultYearId;

  const classesQuery = useQuery(
    () => (effectiveYearId ? listClasses(effectiveYearId) : Promise.resolve([])),
    [effectiveYearId],
  );
  const classes = classesQuery.data ?? [];

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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Présences</h1>
          <p className="text-sm text-slate-500">Appel de classe et suivi de l&apos;assiduité</p>
        </div>
        <LinkButton href="/attendance/scan" variant="outline" leftSection={<ScanLine className="h-4 w-4" />}>
          Scanner les cartes
        </LinkButton>
      </Reveal>

      {/* Shared selectors */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Année</label>
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
          <label className="mb-1 block text-xs text-slate-500">Classe</label>
          <Select
            className="max-w-[220px]"
            value={classId ?? ""}
            onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Choisir —</option>
            {classes.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Date</label>
          <DatePickerInput value={date || null} onChange={(v) => setDate(v ?? "")} valueFormat="DD/MM/YYYY" className="max-w-[180px]" />
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

      <Tabs defaultValue="appel" color="brand" variant="pills" radius="md">
        <Tabs.List>
          <Tabs.Tab value="appel" leftSection={<ClipboardList className="h-4 w-4" />}>Appel de classe</Tabs.Tab>
          <Tabs.Tab value="suivi" leftSection={<CalendarCheck className="h-4 w-4" />}>Suivi & corrections</Tabs.Tab>
          {canManageStaff && (
            <Tabs.Tab value="staff" leftSection={<UserCheck className="h-4 w-4" />}>Présences enseignants</Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="appel" pt="lg">
          {classId ? (
            <RollCall classId={classId} date={date} students={students} loading={studentsQuery.loading} canWrite={canWrite} />
          ) : (
            <SelectClassHint />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="suivi" pt="lg">
          {classId ? (
            <AttendanceLog classId={classId} date={date} students={students} canWrite={canWrite} />
          ) : (
            <SelectClassHint />
          )}
        </Tabs.Panel>

        {canManageStaff && (
          <Tabs.Panel value="staff" pt="lg">
            <div className="space-y-6">
              <TeacherRollCall date={date} />
              <TeacherMonthlyRecap />
            </div>
          </Tabs.Panel>
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
  if (students.length === 0) return <p className="py-8 text-center text-sm text-slate-400">Aucun élève dans cette classe.</p>;

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
                <TD className="font-medium text-slate-900">{s.firstName} {s.lastName}</TD>
                <TD>
                  <div className="flex gap-1">
                    {(["PRESENT", "ABSENT", "LATE"] as AttendanceStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatus(s.id, st)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          status === st
                            ? st === "PRESENT" ? "bg-emerald-600 text-white"
                              : st === "ABSENT" ? "bg-red-600 text-white" : "bg-amber-500 text-white"
                            : "border border-slate-200 text-slate-500 hover:bg-slate-50"
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
  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Impossible de charger les présences.</p>;
  const rows = data ?? [];
  const alerts = alertsQuery.data ?? [];

  return (
    <div className="space-y-3">
      {alerts.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Alerte assiduité</strong> — {alerts.length} élève(s) avec ≥ 2 absences non justifiées ce mois (convocation parents recommandée) :{" "}
          {alerts.map((a) => `${nameOf.get(a.studentId) ?? `#${a.studentId}`} (${a.unjustifiedCount})`).join(", ")}.
        </div>
      )}
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucune présence enregistrée pour cette date.</p>
      ) : (
        <Table>
          <THead>
            <tr><TH>Élève</TH><TH>Statut</TH><TH>Motif</TH><TH>Justification</TH><TH>Parent</TH><TH className="text-right">Actions</TH></tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-slate-900">{nameOf.get(r.studentId) ?? `#${r.studentId}`}</TD>
                <TD><Badge tone={STATUS_TONE[r.status]}>{ATTENDANCE_STATUS_LABEL[r.status]}</Badge></TD>
                <TD className="text-slate-600">{r.reason ?? "—"}</TD>
                <TD>
                  {r.status === "PRESENT" ? "—" : (
                    <div className="flex items-center gap-1">
                      <Badge tone={r.justified === true ? "green" : r.justified === false ? "red" : "gray"}>
                        {r.justified === true ? "Justifiée" : r.justified === false ? "Non justifiée" : "À traiter"}
                      </Badge>
                      {canWrite && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => justify(r, true)} aria-label="Justifier">✓</Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => justify(r, false)} aria-label="Non justifiée">✕</Button>
                        </>
                      )}
                    </div>
                  )}
                </TD>
                <TD>{r.parentNotified ? <Badge tone="green">Notifié</Badge> : <Badge tone="gray">—</Badge>}</TD>
                <TD className="text-right">
                  {canWrite && (
                    <div className="flex items-center justify-end gap-2">
                      <Select
                        value={r.status}
                        onChange={(e) => correct(r, e.target.value as AttendanceStatus)}
                        className="max-w-[130px]"
                      >
                        {(["PRESENT", "ABSENT", "LATE"] as AttendanceStatus[]).map((st) => (
                          <option key={st} value={st}>{ATTENDANCE_STATUS_LABEL[st]}</option>
                        ))}
                      </Select>
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
    <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
      Sélectionnez une classe pour faire l&apos;appel ou consulter les présences.
    </p>
  );
}

// ── Teacher roll call (separate table) ───────────────────────────────────────
function TeacherRollCall({ date }: { date: string }) {
  const teachersQuery = useQuery(() => listTeachers(), []);
  const teachers = useMemo<Teacher[]>(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const [done, setDone] = useState<Record<number, TeacherAttendanceStatus>>({});
  const [busy, setBusy] = useState<number | null>(null);

  async function mark(t: Teacher, status: TeacherAttendanceStatus) {
    setBusy(t.id);
    try {
      await recordTeacherAttendance(t.id, date, status);
      setDone((p) => ({ ...p, [t.id]: status }));
      notifySuccess("Présence enregistrée");
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  }

  if (teachersQuery.loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (teachers.length === 0) return <p className="py-8 text-center text-sm text-slate-400">Aucun enseignant.</p>;

  return (
    <Table>
      <THead>
        <tr><TH>Enseignant</TH><TH>Matricule</TH><TH className="text-right">Présence ({date})</TH></tr>
      </THead>
      <TBody>
        {teachers.map((t) => (
          <TR key={t.id}>
            <TD className="font-medium text-slate-900">{t.firstName} {t.lastName}</TD>
            <TD className="font-mono text-xs text-slate-500">{t.staffNumber}</TD>
            <TD className="text-right">
              <div className="inline-flex items-center gap-2">
                {done[t.id] && (
                  <Badge tone={done[t.id] === "PRESENT" ? "green" : "red"}>
                    {done[t.id] === "PRESENT" ? "Présent" : "Absent"}
                  </Badge>
                )}
                <Button size="sm" variant="ghost" className="text-emerald-700" disabled={busy === t.id} onClick={() => mark(t, "PRESENT")}>Présent</Button>
                <Button size="sm" variant="ghost" className="text-red-600" disabled={busy === t.id} onClick={() => mark(t, "ABSENT")}>Absent</Button>
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Récap mensuel — pointage enseignant</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Enseignant</label>
          <Select className="max-w-[240px]" value={teacherId ?? ""} onChange={(e) => setTeacherId(e.target.value || null)}>
            <option value="">Choisir…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Mois</label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>
      {!teacherId ? (
        <p className="mt-4 text-sm text-slate-400">Sélectionnez un enseignant.</p>
      ) : sumQuery.loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : s ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Jours présents", value: String(s.presentDays) },
            { label: "Jours absents", value: String(s.absentDays) },
            { label: "Heures dues (mois)", value: fmtH(s.dueMinutes) },
            { label: "Retard cumulé", value: fmtH(s.totalLateMinutes), warn: s.totalLateMinutes > 0 },
            { label: "Absences (heures)", value: fmtH(s.absentMinutes), warn: s.absentMinutes > 0 },
            { label: "Heures effectives", value: fmtH(s.effectiveMinutes), strong: true },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl px-3 py-3 ${c.strong ? "bg-brand-50" : "bg-slate-50"}`}>
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className={`mt-1 text-lg font-bold ${c.warn ? "text-red-600" : "text-slate-900"}`}>{c.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-slate-400">Heures effectives = heures dues du mois − absences − retard cumulé. Le retard est calculé à chaque pointage (arrivée vs début du 1ᵉʳ cours du jour).</p>
    </div>
  );
}
