"use client";

import { useMemo, useState } from "react";
import { BookOpen, CalendarCheck, CalendarDays, Download, FileText, FolderOpen, Wallet } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { getReportCardPdfObjectUrl, getStudentReportCards } from "@/lib/api/grading";
import { getChildDocuments, getParentReceiptPdfObjectUrl } from "@/lib/api/portal";
import { getStudentAttendanceStats } from "@/lib/api/attendance";
import { listStudentLessons } from "@/lib/api/lessons";
import { getStudentSchedule } from "@/lib/api/students";
import { listRooms, listSubjects } from "@/lib/api/academics";
import type { EmploiDuTemps, JourSemaine } from "@/lib/types/academics";
import { listInvoicesByStudent } from "@/lib/api/billing";
import { WeeklyTimetable } from "@/components/timetable/weekly-timetable";
import { REPORT_CARD_STATUS_LABEL, type ReportCard } from "@/lib/types/grading";
import { INVOICE_STATUS_LABEL, type Invoice, type InvoiceStatus } from "@/lib/types/billing";
import type { Student } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Spinner } from "@/components/ui/spinner";
import { FilePreview } from "@/components/ui/file-preview";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notifyError } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

const INVOICE_TONE: Record<InvoiceStatus, "red" | "amber" | "green"> = { UNPAID: "red", PARTIAL: "amber", PAID: "green" };

export function StudentOverview({ student }: { student: Student }) {
  const reportsQuery = useQuery(() => getStudentReportCards(student.id), [student.id]);
  const statsQuery = useQuery(() => getStudentAttendanceStats(student.id), [student.id]);
  const invoicesQuery = useQuery(() => listInvoicesByStudent(student.id), [student.id]);
  const lessonsQuery = useQuery(() => listStudentLessons(student.id), [student.id]);
  const scheduleQuery = useQuery(() => getStudentSchedule(student.id), [student.id]);
  const subjectsQuery = useQuery(listSubjects, []);
  const roomsQuery = useQuery(listRooms, []);
  const documentsQuery = useQuery(() => getChildDocuments(student.id), [student.id]);
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);

  const published = useMemo(
    () => (reportsQuery.data ?? []).filter((r) => r.status === "PUBLISHED").sort((a, b) => (b.generatedAt ?? "").localeCompare(a.generatedAt ?? "")),
    [reportsQuery.data],
  );
  const invoices = invoicesQuery.data ?? [];
  const unpaid = invoices.filter((i) => i.status !== "PAID");
  const dueTotal = unpaid.reduce((s, i) => s + Number(i.remainingBalance ?? i.totalAmount), 0);
  const stats = statsQuery.data;
  const lessons = useMemo(
    () => [...(lessonsQuery.data ?? [])].sort((a, b) => (b.lessonDate ?? "").localeCompare(a.lessonDate ?? "")),
    [lessonsQuery.data],
  );
  const doneCount = lessons.filter((l) => l.status === "DONE").length;
  const subjectName = (id: number) => (subjectsQuery.data ?? []).find((s) => s.id === id)?.label ?? `Matière #${id}`;
  const roomName = (id: number | null) => (id == null ? undefined : (roomsQuery.data ?? []).find((r) => r.id === id)?.label);
  const scheduleSlots: EmploiDuTemps[] = (scheduleQuery.data ?? []).map((s) => ({
    id: s.id, tenantId: 0, schoolClassId: s.classId, subjectId: s.subjectId,
    teacherId: s.teacherId, roomId: s.roomId, day: s.day as JourSemaine, startTime: s.startTime, endTime: s.endTime,
  }));

  async function pdf(c: ReportCard) {
    try { setPreview({ url: await getReportCardPdfObjectUrl(c.id), title: "Bulletin" }); }
    catch (err) { notifyError(err); }
  }

  /** Opens a downloadable document (bulletin or receipt) through the authenticated blob endpoint. */
  async function openDocument(doc: { type: string; id: number; label: string }) {
    const key = `${doc.type}-${doc.id}`;
    setOpeningDoc(key);
    try {
      const url = doc.type === "RECU"
        ? await getParentReceiptPdfObjectUrl(doc.id)
        : await getReportCardPdfObjectUrl(doc.id);
      setPreview({ url, title: doc.label });
    } catch (err) { notifyError(err); } finally { setOpeningDoc(null); }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Assiduité" value={stats ? `${stats.attendanceRate}%` : "—"} icon={CalendarCheck} accent="teal" />
        <StatCard title="Absences / retards" value={stats ? `${stats.absentDays} / ${stats.lateDays}` : "—"} icon={CalendarCheck} accent="amber" />
        <StatCard title="Factures impayées" value={`${unpaid.length}`} hint={dueTotal > 0 ? `Reste ${formatGNF(dueTotal)}` : "À jour"} icon={Wallet} accent={unpaid.length ? "rose" : "emerald"} />
      </div>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays className="h-4 w-4 text-brand-600" /> Emploi du temps</h3>
        {scheduleQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <WeeklyTimetable slots={scheduleSlots} subjectName={subjectName} roomName={roomName}
            emptyText="Emploi du temps non encore défini pour la classe." />
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><FileText className="h-4 w-4 text-brand-600" /> Bulletins publiés</h3>
        {reportsQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : published.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Aucun bulletin publié.</p>
        ) : (
          <Table>
            <THead><tr><TH>Moyenne</TH><TH>Rang</TH><TH>Mention</TH><TH>Statut</TH><TH className="text-right" /></tr></THead>
            <TBody>
              {published.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-slate-900">{c.overallAverage ?? "—"}</TD>
                  <TD>{c.rank != null ? `${c.rank}/${c.classSize ?? "?"}` : "—"}</TD>
                  <TD>{c.honor ?? "—"}</TD>
                  <TD><Badge tone="green">{REPORT_CARD_STATUS_LABEL[c.status]}</Badge></TD>
                  <TD className="text-right"><Button size="sm" variant="ghost" onClick={() => pdf(c)}>PDF</Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <BookOpen className="h-4 w-4 text-brand-600" /> Cahier de textes
          {lessons.length > 0 && <span className="text-xs font-normal text-slate-400">— {doneCount}/{lessons.length} séances réalisées</span>}
        </h3>
        {lessonsQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : lessons.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Aucune séance enregistrée.</p>
        ) : (
          <Table>
            <THead><tr><TH>Date</TH><TH>Thème</TH><TH>Devoirs</TH><TH>Statut</TH></tr></THead>
            <TBody>
              {lessons.slice(0, 10).map((l) => (
                <TR key={l.id}>
                  <TD className="whitespace-nowrap text-sm">{l.lessonDate}</TD>
                  <TD className="font-medium text-slate-900">{l.title}</TD>
                  <TD className="max-w-[220px] truncate text-sm text-slate-600" title={l.homework ?? ""}>{l.homework ?? "—"}</TD>
                  <TD><Badge tone={l.status === "DONE" ? "green" : "amber"}>{l.status === "DONE" ? "Réalisé" : "Planifié"}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Wallet className="h-4 w-4 text-brand-600" /> Factures</h3>
        {invoicesQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : invoices.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Aucune facture.</p>
        ) : (
          <Table>
            <THead><tr><TH>Objet</TH><TH>Référence</TH><TH>Total</TH><TH>Reste</TH><TH>Statut</TH><TH className="text-right" /></tr></THead>
            <TBody>
              {invoices.map((i: Invoice) => (
                <TR key={i.id}>
                  <TD className="text-sm text-slate-700">{i.periodLabel ?? "Frais / inscription"}</TD>
                  <TD className="font-mono text-xs text-slate-600">{i.reference}</TD>
                  <TD className="font-medium text-slate-900">{formatGNF(i.totalAmount)}</TD>
                  <TD>{formatGNF(i.remainingBalance ?? i.totalAmount)}</TD>
                  <TD><Badge tone={INVOICE_TONE[i.status]}>{INVOICE_STATUS_LABEL[i.status]}</Badge></TD>
                  <TD className="text-right">{i.status !== "PAID" && <span className="text-xs text-slate-400">À régler à l&apos;école</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><FolderOpen className="h-4 w-4 text-brand-600" /> Documents</h3>
        {documentsQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (documentsQuery.data ?? []).length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Aucun document disponible (bulletins publiés et reçus apparaîtront ici).</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {(documentsQuery.data ?? []).map((doc) => (
              <li key={`${doc.type}-${doc.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-slate-700">
                  <FileText className="h-4 w-4 text-slate-400" />
                  {doc.label}
                  <Badge tone={doc.type === "RECU" ? "green" : "indigo"}>{doc.type === "RECU" ? "Reçu" : "Bulletin"}</Badge>
                </span>
                <Button size="sm" variant="ghost" loading={openingDoc === `${doc.type}-${doc.id}`} onClick={() => openDocument(doc)}>
                  <Download className="mr-1 h-3.5 w-3.5" /> Ouvrir
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} />
    </div>
  );
}
