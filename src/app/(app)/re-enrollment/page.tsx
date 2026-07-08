"use client";

import { useMemo, useState } from "react";
import { Switch } from "@mantine/core";
import { GraduationCap, Rocket } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getClassStudents, listAcademicYears, listClasses, listLevels } from "@/lib/api/academics";
import { reenroll } from "@/lib/api/enrollments";
import type { ClassStudent, Classe } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { notifySuccess } from "@/lib/feedback";

type RowOverride = { include?: boolean; redoublant?: boolean; targetClassId?: number | "" };
type RowResult = "ok" | "error";

export default function ReEnrollmentPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canDo = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY");

  const yearsQuery = useQuery(() => listAcademicYears(), []);
  const levelsQuery = useQuery(() => listLevels(), []);
  const years = useMemo(() => [...(yearsQuery.data ?? [])].sort((a, b) => (b.label ?? "").localeCompare(a.label ?? "")), [yearsQuery.data]);

  const current = years.find((y) => y.current) ?? years[0];
  const [sourceYearId, setSourceYearId] = useState<string>("");
  const [targetYearId, setTargetYearId] = useState<string>("");
  const [sourceClassId, setSourceClassId] = useState<string>("");

  // Default years once loaded: source = the one just before current, target = current.
  const effectiveTarget = targetYearId || (current ? String(current.id) : "");
  const effectiveSource = sourceYearId || (years.find((y) => !current || y.id !== current.id) ? String(years.find((y) => !current || y.id !== current.id)!.id) : "");

  const sourceClassesQuery = useQuery(() => (effectiveSource ? listClasses(Number(effectiveSource)) : Promise.resolve([])), [effectiveSource]);
  const targetClassesQuery = useQuery(() => (effectiveTarget ? listClasses(Number(effectiveTarget)) : Promise.resolve([])), [effectiveTarget]);
  const studentsQuery = useQuery(() => (sourceClassId ? getClassStudents(Number(sourceClassId)) : Promise.resolve([])), [sourceClassId]);

  const [overrides, setOverrides] = useState<Record<number, RowOverride>>({});
  const [results, setResults] = useState<Record<number, RowResult>>({});
  const [running, setRunning] = useState(false);

  if (!tenantId) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  // Level progression helpers.
  const levels = levelsQuery.data ?? [];
  const levelById = new Map(levels.map((l) => [l.id, l]));
  const sortedLevels = [...levels].sort((a, b) => a.sortOrder - b.sortOrder);
  const nextLevelId = (levelId: number | null | undefined): number | null => {
    if (levelId == null) return null;
    const cur = levelById.get(levelId);
    if (!cur) return null;
    return sortedLevels.find((l) => l.sortOrder > cur.sortOrder)?.id ?? null;
  };
  const targetClasses = targetClassesQuery.data ?? [];
  const firstTargetClassForLevel = (levelId: number | null): number | "" =>
    (levelId == null ? undefined : targetClasses.find((c) => c.levelId === levelId)?.id) ?? "";

  const sourceClass: Classe | undefined = (sourceClassesQuery.data ?? []).find((c) => String(c.id) === sourceClassId);
  const promotionClassId = firstTargetClassForLevel(nextLevelId(sourceClass?.levelId));
  const sameLevelClassId = firstTargetClassForLevel(sourceClass?.levelId ?? null);

  function rowOf(s: ClassStudent) {
    const o = overrides[s.id] ?? {};
    const redoublant = o.redoublant ?? false;
    const include = o.include ?? true;
    const targetClassId = o.targetClassId ?? (redoublant ? sameLevelClassId : promotionClassId);
    return { include, redoublant, targetClassId };
  }
  function setRow(id: number, patch: RowOverride) {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  const students = studentsQuery.data ?? [];
  const selected = students.filter((s) => rowOf(s).include && rowOf(s).targetClassId);

  async function runBulk() {
    if (!effectiveTarget) return;
    setRunning(true);
    const res: Record<number, RowResult> = {};
    for (const s of students) {
      const r = rowOf(s);
      if (!r.include || !r.targetClassId) continue;
      try {
        await reenroll({ studentId: s.id, classId: Number(r.targetClassId), academicYearId: Number(effectiveTarget), type: "RE_ENROLLMENT" });
        res[s.id] = "ok";
      } catch {
        res[s.id] = "error";
      }
    }
    setResults(res);
    setRunning(false);
    const ok = Object.values(res).filter((v) => v === "ok").length;
    notifySuccess(`${ok} réinscription(s) générée(s)`);
  }

  const classLabel = (id: number | "") => (id === "" ? "—" : targetClasses.find((c) => c.id === id)?.label ?? `#${id}`);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Réinscription & passage en masse</h1>
        <p className="text-sm text-slate-500">Promouvez une classe entière vers l&apos;année suivante en un clic (classe suivante proposée automatiquement).</p>
      </Reveal>

      {/* Inputs: years + source class */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Année source</label>
          <Select value={effectiveSource} onChange={(e) => { setSourceYearId(e.target.value); setSourceClassId(""); }}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Année cible</label>
          <Select value={effectiveTarget} onChange={(e) => setTargetYearId(e.target.value)}>
            {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Classe source</label>
          <Select value={sourceClassId} onChange={(e) => { setSourceClassId(e.target.value); setOverrides({}); setResults({}); }}>
            <option value="">— Choisir une classe —</option>
            {(sourceClassesQuery.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>
      </div>

      {sourceClassId && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Élèves de la classe" value={students.length} icon={GraduationCap} accent="teal" />
          <StatCard title="Sélectionnés" value={selected.length} icon={Rocket} accent="indigo" />
          <StatCard title="Classe suivante proposée" value={classLabel(promotionClassId)} icon={GraduationCap} accent="sky"
            hint={promotionClassId === "" ? "Aucune classe du niveau suivant dans l'année cible" : undefined} />
        </div>
      )}

      {!sourceClassId ? (
        <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">Choisissez une année source et une classe pour démarrer.</p>
      ) : studentsQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <Table>
            <THead><tr>
              <TH>Inclure</TH><TH>Élève</TH><TH>Matricule</TH><TH>Redoublant</TH><TH>Classe cible ({years.find((y) => String(y.id) === effectiveTarget)?.label ?? ""})</TH><TH>Résultat</TH>
            </tr></THead>
            <TBody>
              {students.length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-slate-400">Aucun élève dans cette classe.</TD></TR>}
              {students.map((s) => {
                const r = rowOf(s);
                return (
                  <TR key={s.id}>
                    <TD>
                      <input type="checkbox" className="h-4 w-4 cursor-pointer accent-brand-600" checked={r.include}
                        onChange={(e) => setRow(s.id, { include: e.target.checked })} />
                    </TD>
                    <TD className="font-medium text-slate-900">{s.firstName} {s.lastName}</TD>
                    <TD className="font-mono text-xs text-slate-600">{s.studentNumber}</TD>
                    <TD>
                      <Switch size="sm" color="amber" checked={r.redoublant}
                        onChange={(e) => setRow(s.id, { redoublant: e.currentTarget.checked, targetClassId: undefined })} />
                    </TD>
                    <TD>
                      <Select className="max-w-[200px]" value={String(r.targetClassId)} onChange={(e) => setRow(s.id, { targetClassId: e.target.value ? Number(e.target.value) : "" })}>
                        <option value="">— Choisir —</option>
                        {targetClasses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </Select>
                    </TD>
                    <TD>
                      {results[s.id] === "ok" ? <Badge tone="green">Réinscrit</Badge>
                        : results[s.id] === "error" ? <Badge tone="red">Échec / déjà inscrit</Badge>
                        : r.redoublant ? <Badge tone="amber">Redouble</Badge> : <Badge tone="indigo">Passe</Badge>}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          {canDo && (
            <div className="flex items-center justify-end gap-3">
              <span className="text-sm text-slate-500">{selected.length} élève(s) à réinscrire dans l&apos;année cible</span>
              <Button onClick={runBulk} loading={running} disabled={selected.length === 0} leftSection={<Rocket className="h-4 w-4" />}>
                Réinscrire la sélection
              </Button>
            </div>
          )}
          <p className="text-xs text-slate-400">
            La réinscription génère la facture d&apos;inscription de l&apos;élève dans la classe cible. Le « redoublant » garde le même niveau ; sinon l&apos;élève passe au niveau suivant.
          </p>
        </>
      )}
    </div>
  );
}
