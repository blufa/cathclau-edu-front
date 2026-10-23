"use client";

import { useMemo, useState } from "react";
import { PlayCircle, ArrowRight, Undo2, AlertTriangle, CheckCircle2, History, Award } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses, listPeriods, listSubjects } from "@/lib/api/academics";
import {
  advanceValidationWorkflow,
  getValidationWorkflow,
  getValidationWorkflowHistory,
  rejectValidationWorkflow,
  simulateGrades,
  getHonorRollPdfObjectUrl,
} from "@/lib/api/grading";
import {
  WORKFLOW_STAGE_LABEL,
  type SimulationReport,
  type ValidationStep,
  type WorkflowStage,
} from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { FilePreview } from "@/components/ui/file-preview";
import { Field, Label, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";

const STAGE_ORDER: WorkflowStage[] = [
  "DRAFT", "SUBMITTED", "DEPARTMENT_APPROVED", "STUDIES_APPROVED", "PRINCIPAL_APPROVED", "PUBLISHED", "LOCKED",
];

export default function ValidationPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canAct = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "RESPONSABLE_PEDAGOGIQUE", "TEACHER") || hasAnyPermission(user, ["bulletin:generate", "bulletin:publish"]);

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
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
  const periodsQuery = useQuery(
    () => (effectiveYearId ? listPeriods(effectiveYearId) : Promise.resolve([])),
    [effectiveYearId],
  );
  const periods = useMemo(() => periodsQuery.data ?? [], [periodsQuery.data]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);
  const subjectName = (id: number) => subjectsQuery.data?.find((s) => s.id === id)?.label ?? `#${id}`;

  const [classId, setClassId] = useState<number | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [palmares, setPalmares] = useState<string | null>(null);
  const [loadingPalmares, setLoadingPalmares] = useState(false);

  async function openPalmares() {
    if (!periodId) return;
    setLoadingPalmares(true);
    try {
      setPalmares(await getHonorRollPdfObjectUrl(periodId));
    } catch (err) {
      notifyError(err);
    } finally {
      setLoadingPalmares(false);
    }
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Conseil de classe — bulletins</h1>
        <p className="text-sm text-gray-500">Simulez les moyennes et rangs avant publication, puis validez les bulletins par niveau</p>
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Année</label>
          <Select className="max-w-[200px]" value={effectiveYearId ?? ""} onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}>
            {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Classe</label>
          <SearchableSelect
            value={classId != null ? String(classId) : ""}
            options={classOptions}
            onChange={(v) => setClassId(v ? Number(v) : null)}
            triggerClassName="max-w-[220px] justify-between px-3"
            noResultsLabel="Aucune classe"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Période</label>
          <Select className="max-w-[220px]" value={periodId ?? ""} onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Choisir —</option>
            {periods.map((p) => (<option key={p.id} value={p.id}>{p.label}{p.closed ? " (clôturée)" : ""}</option>))}
          </Select>
        </div>
        <div className="ml-auto">
          <Button variant="secondary" disabled={!periodId} loading={loadingPalmares} onClick={openPalmares} leftSection={<Award className="h-4 w-4" />}>
            Palmarès de l'école (PDF)
          </Button>
        </div>
      </div>

      {!classId || !periodId ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          Sélectionnez une classe et une période.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <SimulationCard classId={classId} periodId={periodId} subjectName={subjectName} />
          <WorkflowCard classId={classId} periodId={periodId} canAct={canAct} />
        </div>
      )}

      <FilePreview url={palmares} title="Palmarès de l'école" open={palmares != null} onClose={() => setPalmares(null)} autoPrint />
    </div>
  );
}

// ── Simulation ────────────────────────────────────────────────────────────────
function SimulationCard({
  classId, periodId, subjectName,
}: { classId: number; periodId: number; subjectName: (id: number) => string }) {
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [loading, setLoading] = useState(false);

  function run() {
    setLoading(true);
    simulateGrades(classId, periodId)
      .then(setReport)
      .catch(notifyError)
      .finally(() => setLoading(false));
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <PlayCircle className="h-4 w-4 text-brand-600" /> Simulation des bulletins
        </h2>
        <Button onClick={run} loading={loading}>Simuler</Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !report ? (
        <p className="px-4 py-10 text-center text-sm text-gray-400">Lancez une simulation à blanc pour prévisualiser moyennes, rangs et anomalies.</p>
      ) : (
        <>
          <div className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
            {report.studentCount} élève(s) — anomalies signalées en orange
          </div>
          <Table>
            <THead>
              <TR><TH>Rang</TH><TH>Élève</TH><TH>Moyenne</TH><TH>Matières</TH><TH>Anomalie</TH></TR>
            </THead>
            <TBody>
              {report.students.map((s) => {
                return (
                  <TR key={s.studentId}>
                    <TD>{s.rank ?? "—"}</TD>
                    <TD className="font-medium text-gray-900">{s.studentName ?? `Élève #${s.studentId}`}</TD>
                    <TD>{s.overallAverage ?? "—"}</TD>
                    <TD>{s.gradedSubjects}</TD>
                    <TD>
                      {s.hasNoGrades ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Aucune note
                        </span>
                      ) : s.missingSubjects.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-700" title={s.missingSubjects.map(subjectName).join(", ")}>
                          <AlertTriangle className="h-3.5 w-3.5" /> {s.missingSubjects.length} matière(s) manquante(s)
                        </span>
                      ) : (
                        <span className="text-xs text-success-600">—</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
              {report.students.length === 0 && (
                <TR><TD colSpan={5} className="py-8 text-center text-sm text-gray-400">Aucun élève inscrit.</TD></TR>
              )}
            </TBody>
          </Table>
        </>
      )}
    </div>
  );
}

// ── Workflow de validation ────────────────────────────────────────────────────
function WorkflowCard({
  classId, periodId, canAct,
}: { classId: number; periodId: number; canAct: boolean }) {
  const wfQuery = useQuery(() => getValidationWorkflow(classId, periodId), [classId, periodId]);
  const workflow = wfQuery.data;
  const historyQuery = useQuery<ValidationStep[]>(
    () => (workflow ? getValidationWorkflowHistory(workflow.id) : Promise.resolve([])),
    [workflow?.id],
  );

  const [busy, setBusy] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [targetStage, setTargetStage] = useState<WorkflowStage>("DRAFT");

  const currentIndex = workflow ? STAGE_ORDER.indexOf(workflow.currentStage) : -1;
  const nextStage = currentIndex >= 0 && currentIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentIndex + 1] : null;
  const earlierStages = currentIndex > 0 ? STAGE_ORDER.slice(0, currentIndex) : [];

  function refresh() { wfQuery.refetch(); historyQuery.refetch(); }

  async function doAdvance() {
    if (!workflow) return;
    setBusy(true);
    try {
      await advanceValidationWorkflow(workflow.id, comment.trim() || undefined);
      notifySuccess("Workflow avancé à l'étape suivante.");
      setAdvanceOpen(false); setComment(""); refresh();
    } catch (err) { notifyError(err); } finally { setBusy(false); }
  }

  async function doReject() {
    if (!workflow) return;
    setBusy(true);
    try {
      await rejectValidationWorkflow(workflow.id, targetStage, comment.trim() || undefined);
      notifySuccess("Workflow renvoyé à une étape antérieure.");
      setRejectOpen(false); setComment(""); refresh();
    } catch (err) { notifyError(err); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <CheckCircle2 className="h-4 w-4 text-brand-600" /> Validation des bulletins
        </h2>
      </div>

      {wfQuery.loading || !workflow ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-4 p-4">
          <ol className="space-y-1.5">
            {STAGE_ORDER.map((stage, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <li key={stage} className="flex items-center gap-2 text-sm">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    active ? "bg-brand-600 text-white" : done ? "bg-success-100 text-success-700" : "bg-gray-100 text-gray-400"
                  }`}>{done ? "✓" : i + 1}</span>
                  <span className={active ? "font-semibold text-gray-900" : done ? "text-gray-600" : "text-gray-400"}>
                    {WORKFLOW_STAGE_LABEL[stage]}
                  </span>
                  {active && <Badge tone="brand">Étape courante</Badge>}
                </li>
              );
            })}
          </ol>

          {canAct && (
            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              <Button onClick={() => setAdvanceOpen(true)} disabled={!nextStage} leftSection={<ArrowRight className="h-4 w-4" />}>
                {nextStage ? `Avancer → ${WORKFLOW_STAGE_LABEL[nextStage]}` : "Étape finale"}
              </Button>
              <Button variant="secondary" onClick={() => { setTargetStage(earlierStages[earlierStages.length - 1] ?? "DRAFT"); setRejectOpen(true); }} disabled={earlierStages.length === 0} leftSection={<Undo2 className="h-4 w-4" />}>
                Rejeter
              </Button>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <History className="h-3.5 w-3.5" /> Historique
            </h3>
            {(historyQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">Aucune action enregistrée.</p>
            ) : (
              <ul className="space-y-2">
                {(historyQuery.data ?? []).map((step) => (
                  <li key={step.id} className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{step.action} — {WORKFLOW_STAGE_LABEL[step.stage] ?? step.stage}</span>
                      <span className="text-gray-400">{formatDateTime(step.actedAt)}</span>
                    </div>
                    {step.comment && <p className="mt-0.5 text-gray-500">{step.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Modal open={advanceOpen} onClose={() => setAdvanceOpen(false)} title="Valider l'étape">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Faire avancer le workflow{nextStage ? ` vers « ${WORKFLOW_STAGE_LABEL[nextStage]} »` : ""}. Vous signez cette étape.
          </p>
          <Field>
            <Label>Commentaire (optionnel)</Label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAdvanceOpen(false)}>Annuler</Button>
            <Button onClick={doAdvance} loading={busy}>Valider</Button>
          </div>
        </div>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Rejeter le workflow">
        <div className="space-y-4">
          <Field>
            <Label>Renvoyer à l&apos;étape</Label>
            <Select value={targetStage} onChange={(e) => setTargetStage(e.target.value as WorkflowStage)}>
              {earlierStages.map((s) => (<option key={s} value={s}>{WORKFLOW_STAGE_LABEL[s]}</option>))}
            </Select>
          </Field>
          <Field>
            <Label>Motif du rejet</Label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button variant="danger" onClick={doReject} loading={busy}>Rejeter</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
