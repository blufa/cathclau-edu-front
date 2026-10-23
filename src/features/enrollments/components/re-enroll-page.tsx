"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Rocket, Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getClassStudents, listAcademicYears, listClasses, listLevels } from "@/lib/api/academics";
import { getArrears, reenroll } from "@/lib/api/enrollments";
import type { ClassStudent, Classe } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { useCashierSessionGate } from "@/hooks/use-cashier-session-gate";
import { MultiChildCollectModal } from "@/features/billing/components/multi-child-collect-modal";

const EMPTY_OPTION: SearchableOption = { value: "", trigger: "— Choisir —", label: "— Choisir —", searchText: "" };
function toOptions(items: { id: number; label: string }[]): SearchableOption[] {
  return [EMPTY_OPTION, ...items.map((i) => ({ value: String(i.id), trigger: i.label, label: i.label, searchText: i.label }))];
}

type RowOverride = { include?: boolean; redoublant?: boolean; targetClassId?: number | "" };
type RowResult = "ok" | "error";

export default function ReEnrollmentPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canDo = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["inscription:create"]);

  const yearsQuery = useCachedQuery("academic-years", () => listAcademicYears(), []);
  const levelsQuery = useCachedQuery(tenantId ? `levels:${tenantId}` : null, () => listLevels(), [tenantId]);
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

  // Dette de l'année précédente (§retour comptable) : un élève admis mais pas à jour dans ses
  // finances ne doit pas pouvoir être réinscrit, ni en passage ni en redoublant la même classe.
  const arrearsQuery = useQuery(() => {
    const ids = (studentsQuery.data ?? []).map((s) => s.id);
    return ids.length && effectiveTarget ? getArrears(ids, Number(effectiveTarget)) : Promise.resolve([]);
  }, [studentsQuery.data, effectiveTarget]);

  const [overrides, setOverrides] = useState<Record<number, RowOverride>>({});
  const [results, setResults] = useState<Record<number, RowResult>>({});
  const [running, setRunning] = useState(false);
  const [payingStudent, setPayingStudent] = useState<{ id: number; name: string } | null>(null);

  // Barrière caisse (§retour comptable) : la réinscription régénère les factures de frais, réglées au
  // guichet au même moment — même garde que "Nouvelle inscription" (voir BulkFamilyEnrollmentPage).
  const { sessionOpen, loading: sessionLoading } = useCashierSessionGate();
  const cashierBlocked = !sessionLoading && !sessionOpen;

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

  const arrearsByStudent = new Map((arrearsQuery.data ?? []).map((a) => [a.studentId, a]));
  const isBlocked = (id: number) => Number(arrearsByStudent.get(id)?.totalDue ?? 0) > 0;

  function rowOf(s: ClassStudent) {
    const o = overrides[s.id] ?? {};
    const redoublant = o.redoublant ?? false;
    const include = isBlocked(s.id) ? false : (o.include ?? true);
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
      } catch (err) {
        res[s.id] = "error";
        // Défense en profondeur : l'UI bloque déjà les élèves en dette avant ce point (case "Inclure"
        // désactivée), mais si le serveur rejette malgré tout (ex. dette apparue entre-temps), le
        // comptable doit voir le vrai message plutôt qu'un échec muet.
        notifyError(err);
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
          <SearchableSelect
            options={toOptions(sourceClassesQuery.data ?? [])}
            value={sourceClassId}
            onChange={(v) => { setSourceClassId(v); setOverrides({}); setResults({}); }}
            triggerClassName="w-full justify-between px-3"
          />
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
              <TH>Inclure</TH><TH>Élève</TH><TH className="hidden sm:table-cell">Matricule</TH><TH>Redoublant</TH><TH>Classe cible ({years.find((y) => String(y.id) === effectiveTarget)?.label ?? ""})</TH><TH>Factures impayées (année précédente)</TH><TH>Résultat</TH>
            </tr></THead>
            <TBody>
              {students.length === 0 && <TR><TD colSpan={100} className="py-10 text-center text-slate-400">Aucun élève dans cette classe.</TD></TR>}
              {students.map((s) => {
                const r = rowOf(s);
                const blocked = isBlocked(s.id);
                return (
                  <TR key={s.id}>
                    <TD>
                      <input type="checkbox" className="h-4 w-4 cursor-pointer accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                        checked={r.include} disabled={blocked}
                        onChange={(e) => setRow(s.id, { include: e.target.checked })} />
                    </TD>
                    <TD className="font-medium text-slate-900">{s.firstName} {s.lastName}</TD>
                    <TD className="hidden font-mono text-xs text-slate-600 sm:table-cell">{s.studentNumber}</TD>
                    <TD>
                      <Switch checked={r.redoublant} ariaLabel="Redoublant"
                        onChange={(checked) => setRow(s.id, { redoublant: checked, targetClassId: undefined })} />
                    </TD>
                    <TD>
                      <SearchableSelect
                        options={toOptions(targetClasses)}
                        value={r.targetClassId ? String(r.targetClassId) : ""}
                        onChange={(v) => setRow(s.id, { targetClassId: v ? Number(v) : "" })}
                        triggerClassName="w-[200px] justify-between px-3"
                      />
                    </TD>
                    <TD>
                      {blocked ? (
                        <div className="flex items-center gap-2">
                          <Badge tone="red">{formatGNF(arrearsByStudent.get(s.id)?.totalDue ?? 0)}</Badge>
                          <Button size="sm" variant="secondary" leftSection={<Wallet className="h-3.5 w-3.5" />}
                            onClick={() => setPayingStudent({ id: s.id, name: `${s.firstName} ${s.lastName}` })}>
                            Encaisser
                          </Button>
                        </div>
                      ) : "—"}
                    </TD>
                    <TD>
                      {results[s.id] === "ok" ? <Badge tone="green">Réinscrit</Badge>
                        : results[s.id] === "error" ? <Badge tone="red">Échec / déjà inscrit</Badge>
                        : blocked ? <Badge tone="red">Bloqué</Badge>
                        : r.redoublant ? <Badge tone="amber">Redouble</Badge> : <Badge tone="indigo">Passe</Badge>}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <MultiChildCollectModal
            students={payingStudent ? [payingStudent] : []}
            tenantId={tenantId}
            open={payingStudent != null}
            onClose={() => setPayingStudent(null)}
            onCollected={() => { setPayingStudent(null); arrearsQuery.refetch(); }}
          />

          {canDo && (
            <div className="flex flex-col items-end gap-2">
              {cashierBlocked && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Caisse fermée : ouvrez votre caisse (menu « Session de caisse ») avant de réinscrire — les frais se règlent au guichet au moment de la réinscription.
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                <span className="text-sm text-slate-500">{selected.length} élève(s) à réinscrire dans l&apos;année cible</span>
                <Button onClick={runBulk} loading={running} disabled={selected.length === 0 || cashierBlocked} leftSection={<Rocket className="h-4 w-4" />}>
                  Réinscrire la sélection
                </Button>
              </div>
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
