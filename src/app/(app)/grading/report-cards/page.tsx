"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses, listClassSubjects, listPeriods, listSubjects } from "@/lib/api/academics";
import { getStudent, searchStudents } from "@/lib/api/students";
import {
  getAnnualReportCardPdfObjectUrl,
  getAnnualReportCards,
  getAssessmentPlanPdfObjectUrl,
  getClassCentralizerPdfObjectUrl,
  getReportCardLines,
  getReportCardPdfObjectUrl,
  getStudentReportCards,
  publishReportCard,
  setReportCardDistinction,
} from "@/lib/api/grading";
import {
  DISTINCTION_LABEL,
  REPORT_CARD_STATUS_LABEL,
  type AnnualReportCard,
  type Distinction,
  type ReportCard,
} from "@/lib/types/grading";
import type { Student } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { FilePreview } from "@/components/ui/file-preview";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { BarTrendChart } from "@/components/charts/bar-trend-chart";
import { Reveal } from "@/components/public/reveal";
import { notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE = { DRAFT: "gray", GENERATED: "indigo", PUBLISHED: "green" } as const;

export default function ReportCardsPage() {
  const { user } = useAuth();
  const canPublish = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  // Dynamic search: query follows what you type (debounced), no need to press a button.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const studentsQuery = useQuery(
    () => (query ? searchStudents({ search: query, size: 10 }).then((p) => p.content) : Promise.resolve([])),
    [query],
  );
  const [student, setStudent] = useState<Student | null>(null);
  const [manual, setManual] = useState(false);

  // Deep-link from a student's record: /report-cards?student=ID auto-loads that student's livret.
  const params = useSearchParams();
  const studentIdParam = params.get("student");
  const paramStudentQuery = useQuery(
    () => (studentIdParam ? getStudent(Number(studentIdParam)).then((d) => d.student) : Promise.resolve(null)),
    [studentIdParam],
  );
  const current = student ?? (manual ? null : paramStudentQuery.data ?? null);

  // Period labels (pluriannuel): map periodId → "Période — Année".
  const yearsQuery = useQuery(listAcademicYears, []);
  const periodMapQuery = useQuery(async () => {
    const years = yearsQuery.data ?? [];
    const entries: [number, string][] = [];
    for (const y of years) {
      const periods = await listPeriods(y.id);
      for (const p of periods) entries.push([p.id, `${p.label} · ${y.label}`]);
    }
    return new Map(entries);
  }, [yearsQuery.data]);
  const periodLabel = (id: number) => periodMapQuery.data?.get(id) ?? `Période #${id}`;

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bulletins</h1>
        <p className="text-sm text-slate-500">Livret d&apos;un élève, et documents de classe (centralisateur, fiche de notes, bulletin annuel)</p>
      </Reveal>

      <Tabs defaultValue="livret">
        <TabsList>
          <TabsTrigger value="livret">Livret élève</TabsTrigger>
          <TabsTrigger value="classe">Documents de classe</TabsTrigger>
        </TabsList>

        <TabsPanel value="livret">
          <div className="space-y-6 pt-2">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="w-full pl-9" placeholder="Rechercher un élève (nom, matricule)…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {studentsQuery.data && studentsQuery.data.length > 0 && !current && (
              <div className="flex flex-wrap gap-2">
                {studentsQuery.data.map((s) => (
                  <button key={s.id} onClick={() => { setStudent(s); setManual(true); }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm transition hover:border-brand-300 hover:text-brand-700">
                    {s.firstName} {s.lastName} <span className="text-xs text-slate-400">{s.studentNumber}</span>
                  </button>
                ))}
              </div>
            )}

            {current && <StudentRecord student={current} periodLabel={periodLabel} canPublish={canPublish} onChangeStudent={() => { setStudent(null); setManual(true); }} />}
          </div>
        </TabsPanel>

        <TabsPanel value="classe">
          <div className="pt-2">
            <ClassDocumentsPanel />
          </div>
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function StudentRecord({ student, periodLabel, canPublish, onChangeStudent }: {
  student: Student; periodLabel: (id: number) => string; canPublish: boolean; onChangeStudent: () => void;
}) {
  const q = useQuery(() => getStudentReportCards(student.id), [student.id]);
  const [detail, setDetail] = useState<ReportCard | null>(null);
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);

  const cards = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => (a.generatedAt ?? "").localeCompare(b.generatedAt ?? "")),
    [q.data],
  );
  const trend = cards
    .filter((c) => c.overallAverage != null)
    .map((c) => ({ name: periodLabel(c.periodId).split(" · ")[0], Moyenne: Number(c.overallAverage) }));

  async function pdf(c: ReportCard) {
    try { setPreview({ url: await getReportCardPdfObjectUrl(c.id), title: "Bulletin" }); }
    catch (err) { notifyError(err); }
  }
  async function publish(c: ReportCard) {
    try { await publishReportCard(c.id); notifySuccess("Bulletin publié"); q.refetch(); } catch (err) { notifyError(err); }
  }
  async function changeDistinction(c: ReportCard, distinction: Distinction) {
    try { await setReportCardDistinction(c.id, distinction); notifySuccess("Appréciation mise à jour"); q.refetch(); } catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-50 to-white p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
          {student.firstName[0]}{student.lastName[0]}
        </span>
        <div className="flex-1">
          <p className="text-lg font-bold text-slate-900">{student.firstName} {student.lastName}</p>
          <p className="font-mono text-sm text-slate-500">{student.studentNumber}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onChangeStudent}>Changer d&apos;élève</Button>
      </div>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : cards.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Aucun bulletin pour cet élève.</p>
      ) : (
        <>
          {trend.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Évolution de la moyenne</h3>
              <BarTrendChart data={trend} series={[{ key: "Moyenne", name: "Moyenne", color: "#14b8a6" }]} />
            </div>
          )}
          <Table>
            <THead><tr><TH>Période</TH><TH>Moyenne</TH><TH>Rang</TH><TH>Mention</TH><TH>Appréciation</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
            <TBody>
              {cards.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-slate-900">{periodLabel(c.periodId)}</TD>
                  <TD>{c.overallAverage ?? "—"}</TD>
                  <TD>{c.rank != null ? `${c.rank}/${c.classSize ?? "?"}` : "—"}</TD>
                  <TD>{c.honor ?? "—"}</TD>
                  <TD>
                    {canPublish && c.status !== "PUBLISHED" ? (
                      <Select className="max-w-[180px]" value={c.distinction ?? "NONE"} onChange={(e) => changeDistinction(c, e.target.value as Distinction)}>
                        {(Object.keys(DISTINCTION_LABEL) as Distinction[]).map((d) => <option key={d} value={d}>{DISTINCTION_LABEL[d]}</option>)}
                      </Select>
                    ) : (
                      c.distinction && c.distinction !== "NONE" ? <Badge tone="indigo">{DISTINCTION_LABEL[c.distinction]}</Badge> : <span className="text-slate-400">—</span>
                    )}
                  </TD>
                  <TD><Badge tone={STATUS_TONE[c.status]}>{REPORT_CARD_STATUS_LABEL[c.status]}</Badge></TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(c)}>Détail</Button>
                      <Button size="sm" variant="ghost" onClick={() => pdf(c)}>PDF</Button>
                      {canPublish && c.status !== "PUBLISHED" && <Button size="sm" onClick={() => publish(c)}>Publier</Button>}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? periodLabel(detail.periodId) : ""}>
        {detail && <ReportCardLines card={detail} />}
      </Modal>

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} />
    </div>
  );
}

function ReportCardLines({ card }: { card: ReportCard }) {
  const linesQuery = useQuery(() => getReportCardLines(card.id), [card.id]);
  const subjectsQuery = useQuery(() => listSubjects(), []);
  const subjectLabel = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);

  if (linesQuery.loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Moyenne", v: card.overallAverage ?? "—" },
          { l: "Rang", v: card.rank != null ? `${card.rank}/${card.classSize ?? "?"}` : "—" },
          { l: "Moy. classe", v: card.classAverage ?? "—" },
          { l: "Mention", v: card.honor ?? "—" },
        ].map((i) => (
          <div key={i.l} className="rounded-xl border border-slate-200 p-3 text-center">
            <div className="text-lg font-bold text-slate-900">{i.v}</div>
            <div className="text-xs text-slate-500">{i.l}</div>
          </div>
        ))}
      </div>
      {card.decision && <p className="text-sm text-slate-700">Décision : <strong>{card.decision}</strong></p>}
      {(() => {
        const lines = linesQuery.data ?? [];
        const showCoursCompo = lines.some((l) => l.coursAverage != null || l.compoAverage != null);
        return (
          <Table>
            <THead>
              <tr>
                <TH>Matière</TH>
                {showCoursCompo && <TH>Cours</TH>}
                {showCoursCompo && <TH>Compo.</TH>}
                <TH>Moy.</TH><TH>Coef.</TH><TH>Moy. pond.</TH><TH>Rang</TH>
              </tr>
            </THead>
            <TBody>
              {lines.map((l) => (
                <TR key={l.id}>
                  <TD className="font-medium text-slate-900">{subjectLabel.get(l.subjectId) ?? `#${l.subjectId}`}</TD>
                  {showCoursCompo && <TD>{l.coursAverage ?? "—"}</TD>}
                  {showCoursCompo && <TD>{l.compoAverage ?? "—"}</TD>}
                  <TD>{l.subjectAverage ?? "—"}</TD>
                  <TD>{l.coefficient ?? "—"}</TD>
                  <TD>{l.weightedAverage ?? "—"}</TD>
                  <TD>{l.subjectRank ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        );
      })()}
    </div>
  );
}

// ── Documents de classe (centralisateur, fiche de notes, bulletin annuel) ───
function ClassDocumentsPanel() {
  const yearsQuery = useQuery(listAcademicYears, []);
  const [academicYearId, setAcademicYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const years = yearsQuery.data ?? [];
  // Année par défaut = la plus récente, tant que l'utilisateur n'en a pas choisi une explicitement.
  const effectiveYearId = academicYearId ?? years[0]?.id ?? null;

  const classesQuery = useQuery(() => (effectiveYearId ? listClasses(effectiveYearId) : Promise.resolve([])), [effectiveYearId]);
  const periodsQuery = useQuery(() => (effectiveYearId ? listPeriods(effectiveYearId) : Promise.resolve([])), [effectiveYearId]);
  const subjectsQuery = useQuery(() => (classId ? listClassSubjects(classId) : Promise.resolve([])), [classId]);
  const allSubjectsQuery = useQuery(listSubjects, []);
  const subjectLabel = useMemo(() => new Map((allSubjectsQuery.data ?? []).map((s) => [s.id, s.label])), [allSubjectsQuery.data]);

  async function download(key: string, fn: () => Promise<string>, title: string) {
    setBusy(key);
    try { setPreview({ url: await fn(), title }); }
    catch (err) { notifyError(err); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select value={effectiveYearId ?? ""} onChange={(e) => { setAcademicYearId(Number(e.target.value)); setClassId(null); setPeriodId(null); }}>
          {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
        </Select>
        <Select value={classId ?? ""} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— Classe —</option>
          {(classesQuery.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
        <Select value={periodId ?? ""} onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— Période —</option>
          {(periodsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
        <Select value={subjectId ?? ""} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— Matière (fiche de notes) —</option>
          {(subjectsQuery.data ?? []).map((s) => <option key={s.subjectId} value={s.subjectId}>{subjectLabel.get(s.subjectId) ?? `#${s.subjectId}`}</option>)}
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={!classId || !periodId}
          loading={busy === "centralisateur"}
          onClick={() => classId && periodId && download("centralisateur",
            () => getClassCentralizerPdfObjectUrl(classId, periodId), "Centralisateur de classe")}
        >
          Centralisateur (PDF)
        </Button>
        <Button
          variant="secondary"
          disabled={!classId || !subjectId || !effectiveYearId}
          loading={busy === "fiche"}
          onClick={() => classId && subjectId && effectiveYearId && download("fiche",
            () => getAssessmentPlanPdfObjectUrl(classId, subjectId, effectiveYearId), "Fiche de notes vierge")}
        >
          Fiche de notes vierge (PDF)
        </Button>
      </div>

      {classId && effectiveYearId ? (
        <AnnualReportCardsTable classId={classId} academicYearId={effectiveYearId} onPreview={setPreview} />
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          Choisissez une classe pour voir les bulletins annuels (1er + 2ème semestre).
        </p>
      )}

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} />
    </div>
  );
}

function AnnualReportCardsTable({ classId, academicYearId, onPreview }: {
  classId: number; academicYearId: number; onPreview: (p: { url: string | null; title: string } | null) => void;
}) {
  const q = useQuery(() => getAnnualReportCards(classId, academicYearId), [classId, academicYearId]);
  const studentsQuery = useQuery(() => searchStudents({ classId, size: 200 }).then((p) => p.content), [classId]);
  const studentName = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [studentsQuery.data],
  );
  const [busy, setBusy] = useState<number | null>(null);

  async function pdf(card: AnnualReportCard) {
    setBusy(card.studentId);
    try { onPreview({ url: await getAnnualReportCardPdfObjectUrl(card.studentId, classId, academicYearId), title: "Bulletin annuel" }); }
    catch (err) { notifyError(err); }
    finally { setBusy(null); }
  }

  if (q.loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const cards = q.data ?? [];
  if (cards.length === 0) {
    return <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Aucun bulletin semestriel généré pour cette classe et cette année.</p>;
  }
  return (
    <Table>
      <THead><tr><TH>Élève</TH><TH>Moy. S1</TH><TH>Moy. S2</TH><TH>Moy. annuelle</TH><TH>Rang</TH><TH>Mention</TH><TH className="text-right">Actions</TH></tr></THead>
      <TBody>
        {cards.map((c) => (
          <TR key={c.studentId}>
            <TD className="font-medium text-slate-900">{studentName.get(c.studentId) ?? `Élève #${c.studentId}`}</TD>
            <TD>{c.s1Average ?? "—"}</TD>
            <TD>{c.s2Average ?? "—"}</TD>
            <TD className="font-semibold">{c.overallAverage ?? "—"}</TD>
            <TD>{c.rank != null ? `${c.rank}/${c.classSize ?? "?"}` : "—"}</TD>
            <TD>{c.honor ?? "—"}</TD>
            <TD className="text-right">
              <Button size="sm" variant="ghost" loading={busy === c.studentId} onClick={() => pdf(c)}>PDF</Button>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
