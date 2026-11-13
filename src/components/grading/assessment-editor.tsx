"use client";

/**
 * Formulaire de création/édition d'évaluation (AssessmentForm) et grille de saisie de notes
 * (GradeGrid) — extraits de app/(app)/grading/page.tsx pour être réutilisables depuis l'onglet
 * "Évaluations mensuelles" (app/(app)/grading/monthly/page.tsx, §censeur) sans dupliquer la logique.
 * Next.js interdit d'exporter des composants nommés depuis un fichier `page.tsx` (seuls `default`,
 * `metadata`, etc. sont autorisés) — d'où cette extraction dans un fichier de composants partagés.
 */

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { submitGradesOfflineAware } from "@/lib/offline/submit-grades-offline-aware";
import { useGradeQueueStore } from "@/lib/offline/grade-queue-store";
import { isNetworkError } from "@/lib/api/errors";
import { isDesktop } from "@/lib/offline/desktop-runtime";
import { queueOfflineAssessment } from "@/lib/offline/desktop-assessments";
import { listClassSubjects, listPeriods, listSubjects } from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import {
  createAssessment,
  updateAssessment,
  getGradeSheet,
  validateAllGrades,
  unlockGrade,
} from "@/lib/api/grading";
import {
  ASSESSMENT_TYPE_LABEL,
  type Assessment,
  type AssessmentInput,
  type AssessmentType,
} from "@/lib/types/grading";
import type { ClasseMatiere } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input, Label, Field } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notifyError, notifySuccess } from "@/lib/feedback";

/** Catégories figées d'évaluation pour le Français (§retour utilisateur) : "en classe c'est
 * Français, mais à l'évaluation c'est Dictée et Questions / Rédaction" — toujours ces deux
 * libellés-là, pour que tous les profs de français utilisent les mêmes noms d'une classe à
 * l'autre (plutôt qu'un texte libre qui varie selon qui saisit). */
const FRENCH_LABEL_PRESETS = ["Dictée et Questions", "Rédaction"];

/** Compare un libellé de matière à "Français" en ignorant accents/casse (ex. "français",
 * "FRANÇAIS", "francais" doivent tous matcher). */
function isFrench(label: string | undefined): boolean {
  if (!label) return false;
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "francais";
}

export function AssessmentForm({ classId, yearId, initial, onCancel, onCreated, defaultType = "QUIZ" }: {
  classId: number; yearId: number | null; initial?: Assessment; onCancel: () => void; onCreated: () => void;
  /** Type figé à la création (jamais un sélecteur visible, §retour utilisateur) — "QUIZ" sur l'onglet
   * Évaluations normal, "MONTHLY" sur l'onglet Évaluations mensuelles. */
  defaultType?: AssessmentType;
}) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const isEdit = !!initial;
  const subjectsQuery = useCachedQuery(`class-subjects:${classId}`, () => listClassSubjects(classId), [classId]);
  const allSubjects = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, () => listSubjects(), [tenantId]);
  const periodsQuery = useCachedQuery(yearId ? `periods:${yearId}` : null, () => listPeriods(yearId as number), [yearId]);
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const [loading, setLoading] = useState(false);

  const subjectName = useMemo(() => new Map((allSubjects.data ?? []).map((s) => [s.id, s.label])), [allSubjects.data]);
  const teacherName = useMemo(() => new Map((teachersQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachersQuery.data]);
  const classSubjects: ClasseMatiere[] = subjectsQuery.data ?? [];

  const [subjectIds, setSubjectIds] = useState<string[]>(initial ? [String(initial.subjectId)] : []);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  // Catégories figées du Français (§retour utilisateur) : seulement quand UNE SEULE matière est
  // choisie et que c'est Français — avec plusieurs matières sélectionnées (ex. composition
  // commune), les présets n'ont pas de sens pour les autres matières, on garde le texte libre.
  const isFrancaisSelected = subjectIds.length === 1 && isFrench(subjectName.get(Number(subjectIds[0])));
  // Coefficient par matière, modifiable par l'utilisateur quand plusieurs matières sont choisies
  // (§retour utilisateur : "il ne donne pas la possibilité d'ajouter le coefficient de la matière"
  // quand toutes les matières sont cochées) — initialisé à la valeur automatique (classe puis matière)
  // mais reste éditable, par matière, avant de créer les évaluations.
  const [coefficients, setCoefficients] = useState<Record<string, string>>({});

  const schema = z.object({
    periodId: z.string().min(1, "Requis"),
    type: z.string(),
    label: z.string().trim().min(1, "Requis"),
    date: z.string(),
    coefficient: z.number(),
    maxScore: z.number().min(1),
  });
  type FormValues = z.infer<typeof schema>;

  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      periodId: initial ? String(initial.periodId) : "",
      // Nouvelle création : toujours defaultType, seul type encore proposé (§retour utilisateur,
      // "il faut juste laisser le type Interrogation") — le libellé libre (ex. "Évaluation Écrite")
      // suffit à distinguer les évaluations, le type n'est plus un choix. Une évaluation existante
      // d'un autre type (HOMEWORK/EXAM/FINAL, créée avant ce changement) garde son type en édition.
      type: initial ? initial.type : defaultType,
      label: initial?.label ?? "",
      date: initial?.date ?? "",
      coefficient: initial ? Number(initial.coefficient) : 1,
      maxScore: initial ? Number(initial.maxScore) : 20,
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  // Coefficient d'une matière POUR CETTE CLASSE (ClasseMatiere), sinon coef par défaut de la matière.
  function coefFor(sid: string): number {
    const cm = classSubjects.find((c) => String(c.subjectId) === sid);
    if (cm?.coefficient != null && !Number.isNaN(Number(cm.coefficient))) return Number(cm.coefficient);
    const subj = (allSubjects.data ?? []).find((s) => String(s.id) === sid);
    if (subj?.coefficient != null && !Number.isNaN(Number(subj.coefficient))) return Number(subj.coefficient);
    return Number(v.coefficient) || 1;
  }

  function toggleSubject(sid: string) {
    const checking = !subjectIds.includes(sid);
    const next = checking ? [...subjectIds, sid] : subjectIds.filter((s) => s !== sid);
    setSubjectIds(next);
    setSubjectError(null);
    if (next.length === 1) {
      const c = coefFor(next[0]);
      if (c > 0) setValue("coefficient", c);
    }
    if (checking && coefficients[sid] == null) {
      setCoefficients((prev) => ({ ...prev, [sid]: String(coefFor(sid)) }));
    }
  }

  async function submit(values: FormValues) {
    if (subjectIds.length === 0) { setSubjectError("Choisissez au moins une matière"); return; }
    setLoading(true);
    try {
      const multi = subjectIds.length > 1;
      const build = (sid: string): AssessmentInput => {
        const cm = classSubjects.find((c) => String(c.subjectId) === sid);
        return {
          classId, subjectId: Number(sid), teacherId: cm?.teacherId ?? null,
          periodId: Number(values.periodId), type: values.type as AssessmentType,
          label: values.label,
          date: values.date || null,
          coefficient: multi ? (Number(coefficients[sid]) || coefFor(sid)) : Number(values.coefficient),
          maxScore: Number(values.maxScore),
        };
      };
      if (isEdit && initial) {
        // Modification : une seule matière.
        await updateAssessment(initial.id, build(subjectIds[0]));
      } else {
        for (const sid of subjectIds) {
          const input = build(sid);
          try {
            await createAssessment(input);
          } catch (err) {
            // Hors-ligne sur desktop : mise en file — le seul refus possible (période clôturée
            // entre-temps) ne peut être détecté qu'à la synchro, jamais localement.
            if (isNetworkError(err) && isDesktop() && tenantId != null) {
              await queueOfflineAssessment({ ...input, etablissementId: tenantId });
            } else {
              throw err;
            }
          }
        }
      }
      onCreated();
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Matière(s) <span className="text-error-500">*</span></Label>
        <p className="text-xs text-gray-400">
          {isEdit ? "La matière ne se change pas ici (supprimez et recréez si besoin)." : "Sélectionnez plusieurs matières pour créer l'évaluation d'un coup (ex. composition)."}
        </p>
        <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {classSubjects.map((cm) => (
            <label key={cm.subjectId} className={`flex items-center gap-2 text-sm ${isEdit ? "opacity-60" : "cursor-pointer"}`}>
              <input type="checkbox" disabled={isEdit} checked={subjectIds.includes(String(cm.subjectId))}
                onChange={() => toggleSubject(String(cm.subjectId))}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
              {subjectName.get(cm.subjectId) ?? `#${cm.subjectId}`}
            </label>
          ))}
        </div>
        {subjectError && <p className="text-xs text-error-600">{subjectError}</p>}
      </Field>
      {subjectIds.length > 0 && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <p className="mb-1 text-xs font-medium text-gray-500">
            Enseignant(s) — affecté(s) à cette classe{subjectIds.length > 1 ? " · coefficient par matière" : ""}
          </p>
          {subjectIds.map((sid) => {
            const cm = classSubjects.find((c) => String(c.subjectId) === sid);
            return (
              <div key={sid} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-gray-700">{subjectName.get(Number(sid)) ?? `#${sid}`}</span>
                <div className="flex items-center gap-2">
                  <span className={cm?.teacherId ? "text-gray-600" : "text-warning-600"}>
                    {cm?.teacherId ? (teacherName.get(cm.teacherId) ?? `#${cm.teacherId}`) : "aucun enseignant affecté"}
                  </span>
                  {subjectIds.length > 1 && (
                    <Input type="number" min={0} step={0.5} className="h-7 w-16 px-1.5 text-right"
                      value={coefficients[sid] ?? String(coefFor(sid))}
                      onChange={(e) => setCoefficients((prev) => ({ ...prev, [sid]: e.target.value }))} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!periodsQuery.loading && (periodsQuery.data ?? []).length === 0 && (
        <div className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-800">
          Aucune période pour cette année. Créez d&apos;abord des <strong>trimestres / semestres</strong> dans « Années scolaires », puis revenez ajouter l&apos;évaluation.
        </div>
      )}
      <Field>
        <Label>Période <span className="text-error-500">*</span></Label>
        <Select value={v.periodId} onChange={(e) => setValue("periodId", e.target.value)}>
          <option value="">— Choisir —</option>
          {(periodsQuery.data ?? []).map((p) => (<option key={p.id} value={p.id} disabled={p.closed}>{p.label}{p.closed ? " (clôturée)" : ""}</option>))}
        </Select>
        {errors.periodId && <p className="text-xs text-error-600">{errors.periodId.message}</p>}
      </Field>
      <Field>
        <Label>Type</Label>
        {/* Toujours le type figé (defaultType) à la création — seul type restant (§retour
            utilisateur) ; les compositions se créent et se notent depuis l'onglet Compositions. En
            édition, le type d'origine est affiché mais ne se change pas (comme la matière). */}
        <Select disabled value={v.type}>
          <option value={v.type}>{ASSESSMENT_TYPE_LABEL[v.type as AssessmentType]}</option>
        </Select>
      </Field>
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        {isFrancaisSelected ? (
          <>
            <p className="text-xs text-gray-400">Catégories fixes du Français — toujours les mêmes, pour tous les profs.</p>
            <Select value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label}>
              <option value="">— Choisir —</option>
              {FRENCH_LABEL_PRESETS.map((p) => (<option key={p} value={p}>{p}</option>))}
            </Select>
          </>
        ) : (
          <Input value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
        )}
        {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
      </Field>
      <Field>
        <Label>Date</Label>
        <DatePicker value={v.date} onChange={(val) => setValue("date", val)} clearable />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Note sur</Label>
          <Input type="number" min={1} value={v.maxScore} onChange={(e) => setValue("maxScore", Number(e.target.value))} />
        </Field>
        {subjectIds.length > 1 ? (
          <div className="flex items-end pb-2 text-xs text-gray-500">Coefficient : réglable par matière ci-dessus.</div>
        ) : (
          <Field>
            <Label>Coefficient</Label>
            <Input type="number" min={0} step={0.5} value={v.coefficient} onChange={(e) => setValue("coefficient", Number(e.target.value))} />
          </Field>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>{isEdit ? "Enregistrer" : "Créer"}</Button>
      </div>
    </form>
  );
}

export function GradeGrid({ assessment, canWrite, canEditExisting, onDone }: { assessment: Assessment; canWrite: boolean; canEditExisting: boolean; onDone: () => void }) {
  // Saisie anonyme (matricule, jamais le nom) réservée au rôle Enseignant ET seulement pour les
  // évaluations mensuelles (§censeur) et les compositions (type EXAM) — c'est là que l'anonymat a
  // un sens (éviter le biais de connaître l'auteur de la copie en notant une épreuve surveillée).
  // Sur les évaluations normales (QUIZ/HOMEWORK), l'enseignant voit matricule ET nom comme les
  // autres profils (§retour censeur : "seulement garder l'anonymat pour les évaluations mensuelles
  // et compositions, mais pour l'évaluation normale afficher le matricule et le nom").
  const { user } = useAuth();
  const anonymous = hasRole(user, "TEACHER") && (assessment.type === "MONTHLY" || assessment.type === "EXAM");

  // Feuille de notes du module grading (élève + note existante en un seul appel) — pas
  // /academics/classes/{id}/students, qui ne liste que les inscriptions VALIDÉES et faisait
  // disparaître toute la classe dès qu'un élève avait une inscription encore PENDING (retour
  // enseignant : "je ne vois pas la liste des élèves" après avoir créé une composition).
  const sheetQuery = useCachedQuery(`grade-sheet:${assessment.id}`, () => getGradeSheet(assessment.id), [assessment.id]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const max = Number(assessment.maxScore);

  const rows = useMemo(() => sheetQuery.data ?? [], [sheetQuery.data]);
  // Recherche d'élève (§retour utilisateur : "pouvoir rechercher l'élève et trouver sa note dans
  // cette matière") — filtre d'affichage seulement, jamais les données envoyées à save() (toujours
  // basé sur `rows` en entier, pour ne jamais perdre une note saisie puis masquée par la recherche).
  // En mode anonyme (enseignant), la recherche ne porte QUE sur le matricule — chercher par nom
  // permettrait de retrouver la copie d'un élève précis, contournant l'anonymat voulu.
  const [search, setSearch] = useState("");
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.studentNumber ?? "").toLowerCase().includes(q) || (!anonymous && r.fullName.toLowerCase().includes(q)));
  }, [rows, search, anonymous]);
  const existing = useMemo(() => new Map(rows.map((r) => [r.studentId, r])), [rows]);
  const locked = rows.some((r) => r.validated);
  // Sauvegarde hors-ligne pas encore synchronisée pour CETTE évaluation (voir sync-engine.ts) — sert de
  // base d'affichage prioritaire sur `existing` : c'est le dernier état saisi par l'enseignant, même si
  // le serveur ne le connaît pas encore.
  const queuedEntry = useGradeQueueStore((s) => s.items.find((i) => i.assessmentId === assessment.id));
  const queuedByStudent = useMemo(
    () => new Map((queuedEntry?.grades ?? []).map((g) => [g.studentId, g.value])),
    [queuedEntry],
  );

  function valueOf(studentId: number): string {
    if (values[studentId] !== undefined) return values[studentId];
    if (queuedByStudent.has(studentId)) return String(queuedByStudent.get(studentId));
    return existing.get(studentId)?.value ?? "";
  }
  function invalid(v: string): boolean { if (v === "") return false; const n = Number(v); return Number.isNaN(n) || n < 0 || n > max; }

  async function save() {
    setSaving(true);
    try {
      // En mode anonyme (enseignant), le message d'erreur reste sur le matricule — jamais le nom,
      // pour ne pas réintroduire la correspondance nom/copie que l'anonymat vise à éviter.
      const withRaw = rows.map((s) => ({ studentId: s.studentId, studentNumber: s.studentNumber, fullName: s.fullName, raw: valueOf(s.studentId) }));
      // Notes hors barème (0–max) : jamais un échec silencieux (§retour utilisateur) — le reste de la
      // classe s'enregistre normalement, mais l'enseignant doit savoir laquelle a été ignorée et
      // pourquoi, sinon la note disparaît sans explication.
      const skipped = withRaw.filter((e) => e.raw !== "" && invalid(e.raw));
      const entries = withRaw
        .filter((e) => e.raw !== "" && !invalid(e.raw))
        .map((e) => ({ studentId: e.studentId, value: Number(e.raw) }));
      const attempt = await submitGradesOfflineAware(assessment.id, entries);
      if (attempt.outcome === "online") {
        notifySuccess("Notes enregistrées");
        sheetQuery.refetch();
      } else {
        notifySuccess("Notes enregistrées hors-ligne — seront synchronisées à la reconnexion");
      }
      if (skipped.length > 0) {
        const label = anonymous ? "matricule(s)" : "élève(s)";
        const names = skipped.map((e) => (anonymous ? e.studentNumber : e.fullName) ?? `#${e.studentId}`).join(", ");
        notifyError(`Note hors barème (0–${max}) ignorée pour le(s) ${label} : ${names}.`);
      }
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }
  async function validate() {
    try { await validateAllGrades(assessment.id); notifySuccess("Notes validées (verrouillées)"); onDone(); }
    catch (err) { notifyError(err); }
  }
  async function unlockAll() {
    const validated = rows.filter((r) => r.validated && r.gradeId != null).map((r) => r.gradeId as number);
    try {
      await Promise.all(validated.map((id) => unlockGrade(id)));
      notifySuccess("Notes déverrouillées — correction possible");
      sheetQuery.refetch();
    } catch (err) { notifyError(err); }
  }

  if (sheetQuery.loading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {queuedEntry && (
        <div className={
          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm " +
          (queuedEntry.status === "failed" ? "bg-error-50 text-error-800" : "bg-info-50 text-info-800")
        }>
          <span>
            {queuedEntry.status === "failed"
              ? `Notes enregistrées hors-ligne, échec de la synchronisation : ${queuedEntry.lastError ?? "erreur inconnue"}. Voir le bandeau hors-ligne pour réessayer.`
              : "Notes enregistrées hors-ligne — en attente de synchronisation."}
          </span>
        </div>
      )}
      {locked && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning-50 px-4 py-2 text-sm text-warning-800">
          <span>Notes validées et verrouillées.</span>
          {canEditExisting && <Button size="sm" variant="outline" onClick={unlockAll}>Déverrouiller</Button>}
        </div>
      )}
      {!locked && !canEditExisting && (
        <p className="rounded-xl bg-gray-50 px-4 py-2 text-xs text-gray-500">Vous pouvez saisir les notes manquantes. Une note déjà saisie n&apos;est modifiable que par la direction.</p>
      )}
      <Field>
        <Label>Rechercher {anonymous ? "(matricule)" : "un élève (nom ou matricule)"}</Label>
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={anonymous ? "Matricule…" : "Nom ou matricule…"} />
      </Field>
      <div className="max-h-[55vh] overflow-y-auto">
        <Table>
          <THead>
            <tr>
              <TH>Matricule</TH>
              {/* Colonne nom masquée seulement en saisie anonyme (enseignant) — §retour utilisateur :
                  les autres profils veulent le matricule ET le nom, pas l'un à la place de l'autre. */}
              {!anonymous && <TH>Élève</TH>}
              <TH>Note / {max}</TH>
            </tr>
          </THead>
          <TBody>
            {filteredRows.length === 0 && (
              <TR><TD colSpan={anonymous ? 2 : 3} className="py-6 text-center text-gray-400">Aucun élève trouvé.</TD></TR>
            )}
            {filteredRows.map((s) => {
              const v = valueOf(s.studentId);
              const bad = invalid(v);
              // A grade already entered for this student is read-only unless the user may edit existing grades.
              const alreadyEntered = existing.get(s.studentId)?.value != null && existing.get(s.studentId)?.value !== "";
              const readOnly = locked || !canWrite || (alreadyEntered && !canEditExisting);
              return (
                <TR key={s.studentId}>
                  {/* Saisie anonyme (enseignant uniquement, §retour utilisateur) : l'élève écrit son
                      matricule sur sa copie, pas son nom — la colonne Élève n'existe même pas pour ce
                      rôle, pour ne jamais réintroduire la correspondance nom/copie que l'anonymat vise
                      à éviter. Les autres profils voient matricule ET nom (ils transcrivent des notes
                      déjà attribuées, pas de biais à éviter). */}
                  <TD className="font-medium text-gray-900">{s.studentNumber ?? "—"}</TD>
                  {!anonymous && <TD className="text-gray-700">{s.fullName}</TD>}
                  <TD>
                    <input type="number" min={0} max={max} disabled={readOnly} value={v}
                      onChange={(e) => setValues((p) => ({ ...p, [s.studentId]: e.target.value }))}
                      className={`h-9 w-24 rounded-lg border px-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ${bad ? "border-error-400 bg-error-50 text-error-700" : "border-gray-300 focus:border-brand-400"}`} />
                    {alreadyEntered && !canEditExisting && !locked && <span className="ml-2 text-[10px] text-gray-400">saisie verrouillée</span>}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
      {canWrite && !locked && (
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={save} loading={saving}>Enregistrer</Button>
          <Button onClick={validate}>Valider & verrouiller</Button>
        </div>
      )}
    </div>
  );
}
