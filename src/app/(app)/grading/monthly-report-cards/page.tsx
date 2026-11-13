"use client";

/**
 * Bulletins mensuels (§censeur) : diagnostic de niveau en cours d'année, totalement séparé des
 * Bulletins officiels (jamais la même table, jamais compté dans la moyenne semestrielle/annuelle —
 * voir MonthlyReportCardService côté backend). Appréciation automatique (barème existant) + espace
 * pour l'appréciation manuelle du censeur ("pour que le parent sache si l'enfant doit réviser").
 */

import { useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses, listSubjects, getClassStudents } from "@/lib/api/academics";
import {
  generateMonthlyReportCardsBulk,
  getMonthlyReportCardLines,
  getMonthlyReportCardPdfObjectUrl,
  listMonthlyReportCards,
  setMonthlyReportCardComment,
} from "@/lib/api/grading";
import type { MonthlyReportCard, MonthlyReportCardLine } from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input, Label, Field } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { openPdfInApp } from "@/lib/open-pdf";

function currentMonthValue(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function MonthlyReportCardsPage() {
  const { user } = useAuth();
  const canManage = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["bulletin:generate"]);

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
    () => classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classes],
  );
  const [classId, setClassId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonthValue());

  const studentsQuery = useCachedQuery(classId ? `class-students:${classId}` : null, () => getClassStudents(classId as number), [classId]);
  const studentName = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [studentsQuery.data],
  );

  const cardsQuery = useCachedQuery(
    classId ? `monthly-report-cards:${classId}:${month}` : null,
    () => listMonthlyReportCards(classId as number, month),
    [classId, month],
  );
  const [generating, setGenerating] = useState(false);
  const [detail, setDetail] = useState<MonthlyReportCard | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);

  async function generate() {
    if (!classId) return;
    setGenerating(true);
    try {
      await generateMonthlyReportCardsBulk(classId, month);
      notifySuccess("Bulletins mensuels générés");
      cardsQuery.refetch();
    } catch (err) { notifyError(err); } finally { setGenerating(false); }
  }

  async function pdf(c: MonthlyReportCard) {
    setPdfLoadingId(c.id);
    try { openPdfInApp(await getMonthlyReportCardPdfObjectUrl(c.id), "Bulletin mensuel"); }
    catch (err) { notifyError(err); } finally { setPdfLoadingId(null); }
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Bulletins mensuels</h1>
        <p className="text-sm text-gray-500">
          Diagnostic de niveau en cours d&apos;année — jamais compté dans la moyenne du semestre ni de
          l&apos;année. Alimenté par les{" "}
          <a href="/grading/monthly" className="text-brand-600 hover:underline">évaluations mensuelles</a>.
        </p>
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label>Année</Label>
          <Select value={effectiveYearId ?? ""} onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}>
            {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
          </Select>
        </div>
        <div className="w-56">
          <Label>Classe</Label>
          <SearchableSelect
            value={classId != null ? String(classId) : ""}
            options={classOptions}
            onChange={(v) => setClassId(v ? Number(v) : null)}
            triggerClassName="w-full justify-between px-3"
          />
        </div>
        <Field>
          <Label>Mois</Label>
          <Input type="month" value={month} max={currentMonthValue()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" />
        </Field>
        {canManage && classId && (
          <Button onClick={generate} loading={generating}>Générer pour la classe</Button>
        )}
      </div>

      {!classId ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">Sélectionnez une classe.</p>
      ) : cardsQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Élève</TH><TH>Moyenne</TH><TH className="hidden sm:table-cell">Appréciation</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(cardsQuery.data ?? []).length === 0 && (
              <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucun bulletin mensuel généré pour ce mois.</TD></TR>
            )}
            {(cardsQuery.data ?? []).map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-gray-900">{studentName.get(c.studentId) ?? `#${c.studentId}`}</TD>
                <TD>{c.overallAverage ?? "—"} / 20</TD>
                <TD className="hidden max-w-xs truncate sm:table-cell text-gray-500">{c.comment ?? c.autoAppreciation ?? "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(c)}>Appréciation</Button>
                    <Button size="sm" variant="ghost" loading={pdfLoadingId === c.id} onClick={() => pdf(c)}>PDF</Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Appréciation — ${detail ? (studentName.get(detail.studentId) ?? `#${detail.studentId}`) : ""}`}>
        {detail && (
          <MonthlyAppreciationPane card={detail} onSaved={(updated) => { setDetail(updated); cardsQuery.refetch(); }} />
        )}
      </Modal>
    </div>
  );
}

function MonthlyAppreciationPane({ card, onSaved }: { card: MonthlyReportCard; onSaved: (c: MonthlyReportCard) => void }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const linesQuery = useCachedQuery(`monthly-report-card-lines:${card.id}`, () => getMonthlyReportCardLines(card.id), [card.id]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, () => listSubjects(), [tenantId]);
  const subjectLabel = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);
  const [comment, setComment] = useState(card.comment ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await setMonthlyReportCardComment(card.id, comment);
      notifySuccess("Appréciation enregistrée");
      onSaved(updated);
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  const lines: MonthlyReportCardLine[] = linesQuery.data ?? [];

  return (
    <div className="space-y-4">
      {linesQuery.loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Matière</TH><TH>Moyenne</TH><TH className="hidden sm:table-cell">Enseignant</TH></tr></THead>
          <TBody>
            {lines.map((l) => (
              <TR key={l.id}>
                <TD>{subjectLabel.get(l.subjectId) ?? `#${l.subjectId}`}</TD>
                <TD>{l.subjectAverage ?? "—"}</TD>
                <TD className="hidden sm:table-cell text-gray-500">{l.teacherName ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <p className="text-xs font-medium uppercase text-gray-400">Appréciation automatique</p>
        <p>{card.autoAppreciation ?? "—"}</p>
      </div>

      <Field>
        <Label>Commentaire du censeur</Label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-400"
          placeholder="Appréciation complémentaire, conseils de révision…" />
      </Field>
      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>Enregistrer</Button>
      </div>
    </div>
  );
}
