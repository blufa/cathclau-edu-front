"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listPeriods, listSubjects } from "@/lib/api/academics";
import { getStudent, searchStudents } from "@/lib/api/students";
import {
  getReportCardLines,
  getReportCardPdfObjectUrl,
  getStudentReportCards,
  publishReportCard,
  setReportCardDistinction,
} from "@/lib/api/grading";
import {
  DISTINCTION_LABEL,
  REPORT_CARD_STATUS_LABEL,
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
import { AreaTrendChart } from "@/components/charts/area-trend-chart";
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Livret scolaire</h1>
        <p className="text-sm text-slate-500">Historique des bulletins d&apos;un élève sur toutes les périodes</p>
      </Reveal>

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
              <AreaTrendChart data={trend} series={[{ key: "Moyenne", name: "Moyenne", color: "#14b8a6" }]} />
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
      <Table>
        <THead><tr><TH>Matière</TH><TH>Moy.</TH><TH>Coef.</TH><TH>Moy. pond.</TH><TH>Rang</TH></tr></THead>
        <TBody>
          {(linesQuery.data ?? []).map((l) => (
            <TR key={l.id}>
              <TD className="font-medium text-slate-900">{subjectLabel.get(l.subjectId) ?? `#${l.subjectId}`}</TD>
              <TD>{l.subjectAverage ?? "—"}</TD>
              <TD>{l.coefficient ?? "—"}</TD>
              <TD>{l.weightedAverage ?? "—"}</TD>
              <TD>{l.subjectRank ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
